// SPDX-License-Identifier: Apache-2.0

// The routes drafting activities, of releases and projects alike, which are read with the plan. The
// data access layer checks the actor's permissions.

import {
  activityRequestSchema,
  addedPlanSchema,
  addedRecordsSchema,
  changeSetIdSchema,
  projectPlanSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ActivityAccess } from "../data/plan-access.ts";

const created = 201;
const idParams = z.object({ id: z.uuid() });
const planResponse = z.object({
  plan: projectPlanSchema,
  changeSetId: changeSetIdSchema,
});

export function activityRoutes(
  activities: ActivityAccess,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.post(
      "/api/activities",
      {
        schema: {
          body: addedRecordsSchema(activityRequestSchema),
          response: { [created]: addedPlanSchema },
        },
      },
      async (request, reply) => {
        const { result, ids, changeSetId } = await activities.add(
          request.actor,
          request.body.records,
        );
        return reply.status(created).send({ plan: result, ids, changeSetId });
      },
    );
    app.put(
      "/api/activities/:id",
      {
        schema: {
          params: idParams,
          body: activityRequestSchema,
          response: { 200: planResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await activities.change(
          request.actor,
          request.params.id,
          request.body,
        );
        return { plan: result, changeSetId };
      },
    );
    app.delete(
      "/api/activities/:id",
      { schema: { params: idParams, response: { 200: savedSchema } } },
      async (request) => ({
        changeSetId: await activities.remove(request.actor, request.params.id),
      }),
    );
    done();
  };
}
