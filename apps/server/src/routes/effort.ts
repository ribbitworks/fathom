// SPDX-License-Identifier: Apache-2.0

// The conversions between units of effort, read by those who see the plan and changed by those who
// change configuration. A change answers with the change set it was saved in, which undoing it
// names. The data access layer checks the actor's permissions.

import {
  effortConversionsSchema,
  savedEffortConversionsSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { DataAccess } from "../data/index.ts";

const path = "/api/effort-conversions";

export function effortRoutes(data: DataAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      path,
      { schema: { response: { 200: effortConversionsSchema } } },
      async (request) => data.readEffortConversions(request.actor),
    );
    app.put(
      path,
      {
        schema: {
          body: effortConversionsSchema,
          response: { 200: savedEffortConversionsSchema },
        },
      },
      async (request) => {
        const { result, changeSetId } = await data.changeEffortConversions(
          request.actor,
          request.body,
        );
        return { conversions: result, changeSetId };
      },
    );
    done();
  };
}
