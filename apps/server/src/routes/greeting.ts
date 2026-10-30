// SPDX-License-Identifier: Apache-2.0

// The greeting endpoint, which proves the server can read data from the database as the
// application's role.

import { greetingResponseSchema } from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { DataAccess } from "../data/index.ts";

export function greetingRoutes(data: DataAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/greeting",
      { schema: { response: { 200: greetingResponseSchema } } },
      async (request) => ({
        greeting: await data.readGreeting(request.actor),
      }),
    );
    done();
  };
}
