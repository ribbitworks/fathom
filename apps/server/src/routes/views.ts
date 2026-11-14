// SPDX-License-Identifier: Apache-2.0

// Saved views of each table that keeps them: reading those the user may see, and saving, changing,
// and deleting them. A table that keeps no views is no such address. The data access layer checks
// the actor's permissions.

import {
  changeSetIdSchema,
  listedViewSchema,
  savedSchema,
  savedViewChangeSchema,
  savedViewRequestSchema,
  type ViewTable,
  viewTableSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ViewAccess } from "../data/index.ts";
import { NotFoundError } from "../errors.ts";

const created = 201;

const tableParams = z.object({ table: z.string() });
const viewParams = tableParams.extend({ viewId: z.uuid() });
const viewResponse = z.object({
  view: listedViewSchema,
  changeSetId: changeSetIdSchema,
});

// An unknown table is no such address, rather than a bad request.
function tableOf(params: { table: string }): ViewTable {
  const table = viewTableSchema.safeParse(params.table);
  if (!table.success) throw new NotFoundError("There is no such page");
  return table.data;
}

export function viewRoutes(views: ViewAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/views/:table",
      {
        schema: {
          params: tableParams,
          response: { 200: z.array(listedViewSchema) },
        },
      },
      async (request) => views.read(request.actor, tableOf(request.params)),
    );

    app.post(
      "/api/views/:table",
      {
        schema: {
          params: tableParams,
          body: savedViewRequestSchema,
          response: { [created]: viewResponse },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await views.create(
          request.actor,
          tableOf(request.params),
          request.body,
        );
        return reply.status(created).send({ view: result, changeSetId });
      },
    );

    app.put(
      "/api/views/:table/:viewId",
      {
        schema: {
          params: viewParams,
          body: savedViewChangeSchema,
          response: { 200: viewResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await views.update(
          request.actor,
          tableOf(request.params),
          request.params.viewId,
          request.body,
        );
        return { view: result, changeSetId };
      },
    );

    app.delete(
      "/api/views/:table/:viewId",
      { schema: { params: viewParams, response: { 200: savedSchema } } },
      async (request) => ({
        changeSetId: await views.delete(
          request.actor,
          tableOf(request.params),
          request.params.viewId,
        ),
      }),
    );

    done();
  };
}
