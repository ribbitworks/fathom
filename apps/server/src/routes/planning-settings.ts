// SPDX-License-Identifier: Apache-2.0

// The planning settings, read by those who see configuration and changed by those who change it, a
// few at a time, and the conversions between units of effort alone, read by those who see the plan
// to convert estimates. A change answers with the change set it was saved in, which undoing it
// names. The data access layer checks the actor's permissions.

import {
  effortConversionsSchema,
  planningSettingsChangeSchema,
  planningSettingsSchema,
  savedPlanningSettingsSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { DataAccess } from "../data/index.ts";

const path = "/api/planning-settings";

export function planningSettingsRoutes(
  data: DataAccess,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      path,
      { schema: { response: { 200: planningSettingsSchema } } },
      async (request) => data.readPlanningSettings(request.actor),
    );
    app.patch(
      path,
      {
        schema: {
          body: planningSettingsChangeSchema,
          response: { 200: savedPlanningSettingsSchema },
        },
      },
      async (request) => {
        const { result, changeSetId } = await data.changePlanningSettings(
          request.actor,
          request.body,
        );
        return { settings: result, changeSetId };
      },
    );
    app.get(
      "/api/effort-conversions",
      { schema: { response: { 200: effortConversionsSchema } } },
      async (request) => data.readEffortConversions(request.actor),
    );
    done();
  };
}
