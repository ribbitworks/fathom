// SPDX-License-Identifier: Apache-2.0

// Saved views of each table that keeps them: reading those the user may see, and saving, changing,
// and deleting them; and the view the user last showed on each page with a Views menu. A table or
// page that keeps no views is no such address. The data access layer checks the actor's permissions.

import {
  changeSetIdSchema,
  lastViewRequestSchema,
  lastViewsSchema,
  listedViewSchema,
  savedSchema,
  savedViewChangeSchema,
  savedViewRequestSchema,
  type ViewPage,
  viewPageSchema,
  type ViewTable,
  viewTableSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ViewAccess } from "../data/index.ts";
import { NotFoundError } from "../errors.ts";

const created = 201;
const noContent = 204;

const tableParams = z.object({ table: z.string() });
const viewParams = tableParams.extend({ viewId: z.uuid() });
const pageParams = z.object({ page: z.string() });
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

function pageOf(params: { page: string }): ViewPage {
  const page = viewPageSchema.safeParse(params.page);
  if (!page.success) throw new NotFoundError("There is no such page");
  return page.data;
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

    app.get(
      "/api/last-views",
      { schema: { response: { 200: lastViewsSchema } } },
      async (request) => views.readLast(request.actor),
    );

    app.put(
      "/api/last-views/:page",
      { schema: { params: pageParams, body: lastViewRequestSchema } },
      async (request, reply) => {
        await views.saveLast(
          request.actor,
          pageOf(request.params),
          request.body,
        );
        return reply.status(noContent).send();
      },
    );

    done();
  };
}
