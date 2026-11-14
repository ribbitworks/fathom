// SPDX-License-Identifier: Apache-2.0

// People and the columns on the People table: reading everyone the user may see, and the org
// chart; drafting people added, one or several at once, changed, and removed, discarding drafts,
// and sending rejected ones for approval again; adding, changing, and deleting columns; and moving
// any column, built-in or added. Approving and rejecting drafts is in drafts.ts.
// The data access layer checks the actor's permissions.

import {
  changeSetIdSchema,
  dayQuerySchema,
  fieldRequestSchema,
  fieldSchema,
  orgChartSchema,
  peopleRequestSchema,
  peopleColumnsSchema,
  peopleSchema,
  personChangeSchema,
  savedSchema,
  teamColourRequestSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { PeopleAccess } from "../data/index.ts";

const created = 201;
const noContent = 204;

const personParams = z.object({ personId: z.uuid() });
const fieldParams = z.object({ fieldId: z.uuid() });
const fieldResponse = z.object({
  field: fieldSchema,
  changeSetId: changeSetIdSchema,
});
const saved = { 200: savedSchema };

export function peopleRoutes(people: PeopleAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/people",
      {
        schema: {
          querystring: dayQuerySchema,
          response: { 200: peopleSchema },
        },
      },
      async (request) => people.read(request.actor, request.query.on),
    );

    app.get(
      "/api/people/columns",
      { schema: { response: { 200: peopleColumnsSchema } } },
      async (request) => people.readColumns(request.actor),
    );

    app.get(
      "/api/org-chart",
      {
        schema: {
          querystring: dayQuerySchema,
          response: { 200: orgChartSchema },
        },
      },
      async (request) => people.readOrgChart(request.actor, request.query.on),
    );

    // A team is its manager's, so it is named by them.
    app.put(
      "/api/org-chart/teams/:personId/colour",
      {
        schema: { params: personParams, body: teamColourRequestSchema },
      },
      async (request, reply) => {
        await people.setTeamColour(
          request.actor,
          request.params.personId,
          request.body.colour,
        );
        return reply.status(noContent).send();
      },
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

    // Discarding a draft of a column, and sending a rejected one for approval again unchanged.
    app.delete(
      "/api/people/columns/:fieldId/draft",
      { schema: { params: fieldParams, response: saved } },
      async (request) => ({
        changeSetId: await people.discardColumnDraft(
          request.actor,
          request.params.fieldId,
        ),
      }),
    );
    app.delete(
      "/api/people/columns/:fieldId/draft/rejection",
      { schema: { params: fieldParams, response: saved } },
      async (request) => ({
        changeSetId: await people.resubmitColumnDraft(
          request.actor,
          request.params.fieldId,
        ),
      }),
    );

    done();
  };
}
