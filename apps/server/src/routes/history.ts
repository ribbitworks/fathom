// SPDX-License-Identifier: Apache-2.0

// The access history and the change history: the most recent entries, for users who may view them,
// and older changes on request. The data access layer checks the actor's permissions.

import {
  changeHistoryQuerySchema,
  changeHistorySchema,
  historyListSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { DataAccess } from "../data/index.ts";

export function historyRoutes(data: DataAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/access-history",
      { schema: { response: { 200: historyListSchema } } },
      async (request) => ({ entries: await data.readHistory(request.actor) }),
    );
    app.get(
      "/api/changes",
      {
        schema: {
          querystring: changeHistoryQuerySchema,
          response: { 200: changeHistorySchema },
        },
      },
      async (request) =>
        data.readChanges(
          request.actor,
          request.query.before,
          request.query.search,
        ),
    );
    done();
  };
}
