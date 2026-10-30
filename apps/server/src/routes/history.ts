// SPDX-License-Identifier: Apache-2.0

// The access history: the most recent entries, for users who may view it. The data access layer
// checks the actor's permission.

import { historyListSchema } from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { DataAccess } from "../data/index.ts";

export function historyRoutes(data: DataAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/access-history",
      { schema: { response: { 200: historyListSchema } } },
      async (request) => ({ entries: await data.readHistory(request.actor) }),
    );
    done();
  };
}
