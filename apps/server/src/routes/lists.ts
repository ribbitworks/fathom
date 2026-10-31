// SPDX-License-Identifier: Apache-2.0

// The lists of choices for people's details: reading every list, and adding, editing, and removing
// choices. The data access layer checks the actor's permissions.

import {
  listItemRequestSchema,
  listItemSchema,
  listNameSchema,
  listsSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { DataAccess } from "../data/index.ts";

const created = 201;
const noContent = 204;

const itemResponse = z.object({ item: listItemSchema });
const listParams = z.object({ list: listNameSchema });
const itemParams = z.object({ list: listNameSchema, id: z.uuid() });

export function listRoutes(data: DataAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/lists",
      { schema: { response: { 200: listsSchema } } },
      async (request) => ({ lists: await data.readLists(request.actor) }),
    );

    app.post(
      "/api/lists/:list/items",
      {
        schema: {
          params: listParams,
          body: listItemRequestSchema,
          response: { [created]: itemResponse },
        },
      },
      async (request, reply) =>
        reply.status(created).send({
          item: await data.addListItem(
            request.actor,
            request.params.list,
            request.body,
          ),
        }),
    );

    app.put(
      "/api/lists/:list/items/:id",
      {
        schema: {
          params: itemParams,
          body: listItemRequestSchema,
          response: { 200: itemResponse },
        },
      },
      async (request) => ({
        item: await data.updateListItem(
          request.actor,
          request.params.list,
          request.params.id,
          request.body,
        ),
      }),
    );

    app.delete(
      "/api/lists/:list/items/:id",
      { schema: { params: itemParams } },
      async (request, reply) => {
        await data.deleteListItem(
          request.actor,
          request.params.list,
          request.params.id,
        );
        return reply.status(noContent).send();
      },
    );
    done();
  };
}
