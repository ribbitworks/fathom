// SPDX-License-Identifier: Apache-2.0

// Feature teams: reading them, for everyone who sees the org chart, and drafting teams added,
// changed, and removed, discarding drafts, sending rejected ones for approval again, and setting a
// team's colour. Approving and rejecting drafts is in drafts.ts. The data access layer checks the
// actor's permissions.

import {
  changeSetIdSchema,
  featureTeamChangeSchema,
  featureTeamColourSchema,
  featureTeamRequestSchema,
  featureTeamsSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { FeatureTeamAccess } from "../data/index.ts";

const created = 201;
const noContent = 204;
const teamParams = z.object({ teamId: z.uuid() });
const saved = { 200: savedSchema };

export function featureTeamRoutes(
  teams: FeatureTeamAccess,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/feature-teams",
      { schema: { response: { 200: featureTeamsSchema } } },
      async (request) => teams.read(request.actor),
    );

    app.post(
      "/api/feature-teams",
      {
        schema: {
          body: featureTeamRequestSchema,
          response: {
            [created]: z.object({
              id: z.string(),
              changeSetId: changeSetIdSchema,
            }),
          },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await teams.create(
          request.actor,
          request.body,
        );
        return reply.status(created).send({ id: result, changeSetId });
      },
    );

    app.patch(
      "/api/feature-teams/:teamId",
      {
        schema: {
          params: teamParams,
          body: featureTeamChangeSchema,
          response: saved,
        },
      },
      async (request) => ({
        changeSetId: await teams.update(
          request.actor,
          request.params.teamId,
          request.body,
        ),
      }),
    );

    app.delete(
      "/api/feature-teams/:teamId",
      { schema: { params: teamParams, response: saved } },
      async (request) => ({
        changeSetId: await teams.delete(request.actor, request.params.teamId),
      }),
    );

    app.delete(
      "/api/feature-teams/:teamId/draft",
      { schema: { params: teamParams, response: saved } },
      async (request) => ({
        changeSetId: await teams.discardDraft(
          request.actor,
          request.params.teamId,
        ),
      }),
    );

    // Sends a rejected draft for approval again, unchanged.
    app.delete(
      "/api/feature-teams/:teamId/draft/rejection",
      { schema: { params: teamParams, response: saved } },
      async (request) => ({
        changeSetId: await teams.resubmitDraft(
          request.actor,
          request.params.teamId,
        ),
      }),
    );

    app.put(
      "/api/feature-teams/:teamId/colour",
      { schema: { params: teamParams, body: featureTeamColourSchema } },
      async (request, reply) => {
        await teams.setColour(
          request.actor,
          request.params.teamId,
          request.body.colour,
        );
        return reply.status(noContent).send();
      },
    );

    done();
  };
}
