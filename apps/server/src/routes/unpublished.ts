// SPDX-License-Identifier: Apache-2.0

// The user's own unpublished changes to drafts: listing them, and publishing or discarding them, all
// at once or those chosen. The data access layer checks the actor may make drafts, and that the
// changes chosen are theirs.

import {
  unpublishedChosenSchema,
  unpublishedDoneSchema,
  unpublishedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { UnpublishedAccess } from "../data/index.ts";

const done = {
  body: unpublishedChosenSchema.nullish(),
  response: { 200: unpublishedDoneSchema },
};

export function unpublishedRoutes(
  unpublished: UnpublishedAccess,
): FastifyPluginCallbackZod {
  return (app, _options, finished) => {
    app.get(
      "/api/unpublished",
      { schema: { response: { 200: unpublishedSchema } } },
      async (request) => unpublished.read(request.actor),
    );

    app.post("/api/unpublished/publish", { schema: done }, async (request) => ({
      total: await unpublished.publish(request.actor, request.body?.drafts),
    }));

    app.post("/api/unpublished/discard", { schema: done }, async (request) => ({
      total: await unpublished.discard(request.actor, request.body?.drafts),
    }));
    finished();
  };
}
