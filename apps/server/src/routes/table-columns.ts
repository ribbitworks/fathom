// SPDX-License-Identifier: Apache-2.0

// The routes for the columns added to one table of planned work, under its path, such as
// /api/features/columns: adding, changing and removing them, and discarding and resubmitting their
// drafts. The data access layer checks the actor's permissions.

import { fieldRequestSchema, fieldSchema, savedSchema } from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ColumnAccess } from "../data/column-access.ts";

const created = 201;
const columnParams = z.object({ fieldId: z.uuid() });
const columnResponse = z.object({
  field: fieldSchema,
  changeSetId: z.string().nullable(),
});
const saved = { 200: savedSchema };

export function tableColumnRoutes(
  path: string,
  columns: ColumnAccess,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.post(
      `/api/${path}/columns`,
      {
        schema: {
          body: fieldRequestSchema,
          response: { [created]: columnResponse },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await columns.create(
          request.actor,
          request.body,
        );
        return reply.status(created).send({ field: result, changeSetId });
      },
    );
    app.put(
      `/api/${path}/columns/:fieldId`,
      {
        schema: {
          params: columnParams,
          body: fieldRequestSchema,
          response: { 200: columnResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await columns.update(
          request.actor,
          request.params.fieldId,
          request.body,
        );
        return { field: result, changeSetId };
      },
    );
    app.delete(
      `/api/${path}/columns/:fieldId`,
      { schema: { params: columnParams, response: saved } },
      async (request) => ({
        changeSetId: await columns.remove(
          request.actor,
          request.params.fieldId,
        ),
      }),
    );
    app.delete(
      `/api/${path}/columns/:fieldId/draft`,
      { schema: { params: columnParams, response: saved } },
      async (request) => ({
        changeSetId: await columns.discardDraft(
          request.actor,
          request.params.fieldId,
        ),
      }),
    );
    app.delete(
      `/api/${path}/columns/:fieldId/draft/rejection`,
      { schema: { params: columnParams, response: saved } },
      async (request) => ({
        changeSetId: await columns.resubmitDraft(
          request.actor,
          request.params.fieldId,
        ),
      }),
    );
    done();
  };
}
