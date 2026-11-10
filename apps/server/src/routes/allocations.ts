// SPDX-License-Identifier: Apache-2.0

// Allocations: read by those who see them, and changed as drafts, one allocation from a month at a
// time, by those who edit them. A change answers with the change set it was saved in. The data
// access layer checks the actor's permissions.

import {
  allocationChangeSchema,
  allocationsSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { DataAccess } from "../data/index.ts";

const path = "/api/allocations";

export function allocationRoutes(data: DataAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      path,
      { schema: { response: { 200: allocationsSchema } } },
      async (request) => data.allocations.read(request.actor),
    );
    app.post(
      `${path}/changes`,
      {
        schema: {
          body: allocationChangeSchema,
          response: { 200: savedSchema },
        },
      },
      async (request) => ({
        changeSetId: await data.allocations.change(request.actor, request.body),
      }),
    );
    done();
  };
}
