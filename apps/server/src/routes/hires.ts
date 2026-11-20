// SPDX-License-Identifier: Apache-2.0

// Planned hires: reading those the user may see, and drafting hires added, changed, moved between
// states, filled, and removed, discarding drafts, and sending rejected ones for approval again.
// Approving and rejecting drafts is in drafts.ts. The data access layer checks the actor's
// permissions.

import {
  changeSetIdSchema,
  hireChangeSchema,
  hireFillSchema,
  hiresRequestSchema,
  hiresSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { HireAccess } from "../data/people-access.ts";

const created = 201;
const hireParams = z.object({ hireId: z.uuid() });
const saved = { 200: savedSchema };

export function hireRoutes(hires: HireAccess): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/planned-hires",
      { schema: { response: { 200: hiresSchema } } },
      async (request) => hires.read(request.actor),
    );

    app.post(
      "/api/planned-hires",
      {
        schema: {
          body: hiresRequestSchema,
          response: {
            [created]: z.object({
              ids: z.array(z.string()),
              changeSetId: changeSetIdSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await hires.create(
          request.actor,
          request.body.hires,
        );
        return reply.status(created).send({ ids: result, changeSetId });
      },
    );

    app.patch(
      "/api/planned-hires/:hireId",
      {
        schema: { params: hireParams, body: hireChangeSchema, response: saved },
      },
      async (request) => ({
        changeSetId: await hires.update(
          request.actor,
          request.params.hireId,
          request.body,
        ),
      }),
    );

    app.delete(
      "/api/planned-hires/:hireId",
      { schema: { params: hireParams, response: saved } },
      async (request) => ({
        changeSetId: await hires.delete(request.actor, request.params.hireId),
      }),
    );

    app.delete(
      "/api/planned-hires/:hireId/draft",
      { schema: { params: hireParams, response: saved } },
      async (request) => ({
        changeSetId: await hires.discardDraft(
          request.actor,
          request.params.hireId,
        ),
      }),
    );

    app.post(
      "/api/planned-hires/:hireId/fill",
      {
        schema: { params: hireParams, body: hireFillSchema, response: saved },
      },
      async (request) => ({
        changeSetId: await hires.fill(
          request.actor,
          request.params.hireId,
          request.body,
        ),
      }),
    );

    // Sends a rejected draft for approval again, unchanged.
    app.delete(
      "/api/planned-hires/:hireId/draft/rejection",
      { schema: { params: hireParams, response: saved } },
      async (request) => ({
        changeSetId: await hires.resubmitDraft(
          request.actor,
          request.params.hireId,
        ),
      }),
    );

    done();
  };
}
