// SPDX-License-Identifier: Apache-2.0

// Settings for the whole of Fathom, which every signed-in user receives with their session, and
// those who may change them change here. The data access layer checks the actor may.

import {
  passwordSettingsSchema,
  timeZoneRequestSchema,
  timeZoneSettingSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { DataAccess } from "../data/index.ts";

export function settingsRoutes(data: DataAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.put(
      "/api/settings/time-zone",
      {
        schema: {
          body: timeZoneRequestSchema,
          response: { 200: timeZoneSettingSchema },
        },
      },
      async (request) =>
        data.changeTimeZone(request.actor, request.body.timeZone),
    );
    app.put(
      "/api/settings/passwords",
      {
        schema: {
          body: passwordSettingsSchema,
          response: { 200: passwordSettingsSchema },
        },
      },
      async (request) =>
        data.changePasswordSettings(request.actor, request.body),
    );
    done();
  };
}
