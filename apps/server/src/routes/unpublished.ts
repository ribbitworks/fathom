// SPDX-License-Identifier: Apache-2.0

// The user's own unpublished changes to drafts: listing them, and publishing or discarding them all
// at once. The data access layer checks the actor may make drafts.

import { unpublishedDoneSchema, unpublishedSchema } from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { UnpublishedAccess } from "../data/index.ts";

const done = { 200: unpublishedDoneSchema };

export function unpublishedRoutes(
  unpublished: UnpublishedAccess,
): FastifyPluginCallbackZod {
  return (app, _options, finished) => {
    app.get(
      "/api/unpublished",
      { schema: { response: { 200: unpublishedSchema } } },
      async (request) => unpublished.read(request.actor),
    );

    app.post(
      "/api/unpublished/publish",
      { schema: { response: done } },
      async (request) => ({
        total: await unpublished.publish(request.actor),
      }),
    );

    app.post(
      "/api/unpublished/discard",
      { schema: { response: done } },
      async (request) => ({
        total: await unpublished.discard(request.actor),
      }),
    );
    finished();
  };
}
