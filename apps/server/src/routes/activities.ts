// SPDX-License-Identifier: Apache-2.0

// The routes for activities, of releases and projects alike. The data access layer checks the
// actor's permissions.

import {
  activityPlanSchema,
  activityRequestSchema,
  changeSetIdSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ActivityAccess } from "../data/plan-access.ts";

const created = 201;
const idParams = z.object({ id: z.uuid() });
const planResponse = z.object({
  activities: activityPlanSchema,
  changeSetId: changeSetIdSchema,
});

export function activityRoutes(
  activities: ActivityAccess,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/activities",
      { schema: { response: { 200: activityPlanSchema } } },
      async (request) => activities.read(request.actor),
    );
    app.post(
      "/api/activities",
      {
        schema: {
          body: activityRequestSchema,
          response: { [created]: planResponse },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await activities.add(
          request.actor,
          request.body,
        );
        return reply.status(created).send({ activities: result, changeSetId });
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
        return { activities: result, changeSetId };
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
