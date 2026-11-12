// SPDX-License-Identifier: Apache-2.0

// Recording an export: the browser makes the file, and tells the server what it holds, so one
// holding Personal or Confidential data is recorded in the access history. The data access layer
// checks the actor's permissions and the columns' classes.

import { exportRecordedSchema, exportRequestSchema } from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { DataAccess } from "../data/index.ts";

export function exportRoutes(data: DataAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.post(
      "/api/exports",
      {
        schema: {
          body: exportRequestSchema,
          response: { 200: exportRecordedSchema },
        },
      },
      async (request) => data.recordExport(request.actor, request.body),
    );
    done();
  };
}
