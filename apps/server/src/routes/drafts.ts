// SPDX-License-Identifier: Apache-2.0

// Approving and rejecting drafts of people, lists, choices, and the order of lists' choices, several
// kinds at once, in one change set. Neither can be undone. The data access layer checks the actor's
// permissions.

import {
  draftsRequestSchema,
  rejectionRequestSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import type { DraftAccess } from "../data/index.ts";

const saved = { 200: savedSchema };

export function draftRoutes(drafts: DraftAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.post(
      "/api/drafts/approval",
      { schema: { body: draftsRequestSchema, response: saved } },
      async (request) => ({
        changeSetId: await drafts.approve(request.actor, request.body),
      }),
    );

    app.post(
      "/api/drafts/rejection",
      { schema: { body: rejectionRequestSchema, response: saved } },
      async (request) => {
        const { reason, ...asked } = request.body;
        return {
          changeSetId: await drafts.reject(request.actor, asked, reason),
        };
      },
    );
    done();
  };
}
