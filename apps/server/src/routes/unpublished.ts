// SPDX-License-Identifier: Apache-2.0

// The user's own unpublished changes to drafts: listing them, and publishing or discarding them, all
// at once or those chosen. The data access layer checks the actor may make drafts, that the changes
// chosen are theirs, which of them the acting role may publish, and which fields someone else
// changed meanwhile, which publishing answers with both values until the request keeps one.

import {
  publishRefusalSchema,
  unpublishedChosenSchema,
  unpublishedDoneSchema,
  unpublishedPublishedSchema,
  unpublishedPublishSchema,
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

    app.post(
      "/api/unpublished/publish",
      {
        schema: {
          body: unpublishedPublishSchema.nullish(),
          response: {
            200: unpublishedPublishedSchema,
            409: publishRefusalSchema,
          },
        },
      },
      async (request) =>
        unpublished.publish(request.actor, request.body ?? undefined),
    );

    app.post("/api/unpublished/discard", { schema: done }, async (request) => ({
      total: await unpublished.discard(request.actor, request.body?.drafts),
    }));
    finished();
  };
}
