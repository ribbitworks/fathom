// SPDX-License-Identifier: Apache-2.0

// Undoing a change the user made, to lists or to people, named by the change set every change
// answers with. The data access layer checks the actor may undo it.

import { savedSchema } from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { DataAccess } from "../data/index.ts";

export function undoRoutes(data: DataAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.post(
      "/api/undo/:changeSetId",
      {
        schema: {
          params: z.object({ changeSetId: z.uuid() }),
          response: { 200: savedSchema },
        },
      },
      async (request) => ({
        changeSetId: await data.undo(request.actor, request.params.changeSetId),
      }),
    );
    done();
  };
}
