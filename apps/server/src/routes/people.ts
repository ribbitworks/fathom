// SPDX-License-Identifier: Apache-2.0

// People and the columns on the People table: reading everyone the user may see, and the org
// chart; drafting people added, one or several at once, changed, and removed, discarding drafts,
// and sending rejected ones for approval again; adding, changing, and deleting columns; and moving
// any column, built-in or added. Approving and rejecting drafts is in drafts.ts.
// The data access layer checks the actor's permissions.

import {
  changeSetIdSchema,
  columnKeySchema,
  fieldMoveSchema,
  fieldRequestSchema,
  fieldSchema,
  orgChartSchema,
  peopleRequestSchema,
  peopleSchema,
  personChangeSchema,
  savedSchema,
  savedViewChangeSchema,
  savedViewRequestSchema,
  savedViewSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ColumnDraftTarget, PeopleAccess } from "../data/index.ts";

const created = 201;

const personParams = z.object({ personId: z.uuid() });
const fieldParams = z.object({ fieldId: z.uuid() });
const viewParams = z.object({ viewId: z.uuid() });
const viewResponse = z.object({
  view: savedViewSchema,
  changeSetId: changeSetIdSchema,
});
const fieldResponse = z.object({
  field: fieldSchema,
  changeSetId: changeSetIdSchema,
});
const saved = { 200: savedSchema };

export function peopleRoutes(people: PeopleAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/people",
      { schema: { response: { 200: peopleSchema } } },
      async (request) => people.read(request.actor),
    );

    app.get(
      "/api/org-chart",
      { schema: { response: { 200: orgChartSchema } } },
      async (request) => people.readOrgChart(request.actor),
    );

    app.post(
      "/api/people",
      {
        schema: {
          body: peopleRequestSchema,
          response: {
            [created]: z.object({
              ids: z.array(z.string()),
              changeSetId: changeSetIdSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await people.create(
          request.actor,
          request.body.people,
        );
        return reply.status(created).send({ ids: result, changeSetId });
      },
    );

    app.patch(
      "/api/people/:personId",
      {
        schema: {
          params: personParams,
          body: personChangeSchema,
          response: saved,
        },
      },
      async (request) => ({
        changeSetId: await people.update(
          request.actor,
          request.params.personId,
          request.body,
        ),
      }),
    );

    app.delete(
      "/api/people/:personId",
      { schema: { params: personParams, response: saved } },
      async (request) => ({
        changeSetId: await people.delete(
          request.actor,
          request.params.personId,
        ),
      }),
    );

    app.delete(
      "/api/people/:personId/draft",
      { schema: { params: personParams, response: saved } },
      async (request) => ({
        changeSetId: await people.discardDraft(
          request.actor,
          request.params.personId,
        ),
      }),
    );

    // Sends a rejected draft for approval again, unchanged.
    app.delete(
      "/api/people/:personId/draft/rejection",
      { schema: { params: personParams, response: saved } },
      async (request) => ({
        changeSetId: await people.resubmitDraft(
          request.actor,
          request.params.personId,
        ),
      }),
    );

    app.post(
      "/api/people/columns",
      {
        schema: {
          body: fieldRequestSchema,
          response: { [created]: fieldResponse },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await people.createField(
          request.actor,
          request.body,
        );
        return reply.status(created).send({ field: result, changeSetId });
      },
    );

    app.put(
      "/api/people/columns/:fieldId",
      {
        schema: {
          params: fieldParams,
          body: fieldRequestSchema,
          response: { 200: fieldResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await people.updateField(
          request.actor,
          request.params.fieldId,
          request.body,
        );
        return { field: result, changeSetId };
      },
    );

    // Built-in columns move too, so a column is named by its key.
    app.put(
      "/api/people/columns/:key/position",
      {
        schema: {
          params: z.object({ key: columnKeySchema }),
          body: fieldMoveSchema,
          response: saved,
        },
      },
      async (request) => ({
        changeSetId: await people.moveColumn(
          request.actor,
          request.params.key,
          request.body.after,
        ),
      }),
    );

    app.delete(
      "/api/people/columns/:fieldId",
      { schema: { params: fieldParams, response: saved } },
      async (request) => ({
        changeSetId: await people.deleteField(
          request.actor,
          request.params.fieldId,
        ),
      }),
    );

    // Discarding a draft of a column or of the column order, and sending a rejected one for approval
    // again unchanged.
    const columnDraftRoutes = <Params extends z.ZodType>(
      path: string,
      params: Params,
      target: (params: z.infer<Params>) => ColumnDraftTarget,
    ) => {
      app.delete(
        `${path}/draft`,
        { schema: { params, response: saved } },
        async (request) => ({
          changeSetId: await people.discardColumnDraft(
            request.actor,
            target(request.params as z.infer<Params>),
          ),
        }),
      );
      app.delete(
        `${path}/draft/rejection`,
        { schema: { params, response: saved } },
        async (request) => ({
          changeSetId: await people.resubmitColumnDraft(
            request.actor,
            target(request.params as z.infer<Params>),
          ),
        }),
      );
    };
    columnDraftRoutes("/api/people/columns/order", z.object({}), () => ({
      kind: "order",
    }));
    columnDraftRoutes(
      "/api/people/columns/:fieldId",
      fieldParams,
      ({ fieldId }) => ({
        kind: "column",
        id: fieldId,
      }),
    );

    app.post(
      "/api/people/views",
      {
        schema: {
          body: savedViewRequestSchema,
          response: { [created]: viewResponse },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await people.createView(
          request.actor,
          request.body,
        );
        return reply.status(created).send({ view: result, changeSetId });
      },
    );

    app.put(
      "/api/people/views/:viewId",
      {
        schema: {
          params: viewParams,
          body: savedViewChangeSchema,
          response: { 200: viewResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await people.updateView(
          request.actor,
          request.params.viewId,
          request.body,
        );
        return { view: result, changeSetId };
      },
    );

    app.delete(
      "/api/people/views/:viewId",
      { schema: { params: viewParams, response: saved } },
      async (request) => ({
        changeSetId: await people.deleteView(
          request.actor,
          request.params.viewId,
        ),
      }),
    );

    done();
  };
}
