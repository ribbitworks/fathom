// SPDX-License-Identifier: Apache-2.0

// Customers, projects with their milestones, proposals, and features: reading them all at once,
// with what they can be given, and drafting each added, changed, and removed. Every change answers with the
// change set it was saved in, and every change but a removal with every record as the editor now
// sees them. Discarding and resubmitting their drafts goes through the routes for every plan
// record's draft. The data access layer checks the actor's permissions.

import {
  changeSetIdSchema,
  customerRequestSchema,
  featureRequestSchema,
  milestoneRequestSchema,
  planChoicesSchema,
  projectPlanSchema,
  projectRequestSchema,
  proposalRequestSchema,
  savedSchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type {
  PlanKind,
  PlanRecordRequest,
  ProjectAccess,
} from "../data/index.ts";

const created = 201;

const planResponse = z.object({
  plan: projectPlanSchema,
  changeSetId: changeSetIdSchema,
});
const idParams = z.object({ id: z.uuid() });
const projectParams = z.object({ projectId: z.uuid() });
const milestoneParams = z.object({ projectId: z.uuid(), id: z.uuid() });
const saved = { 200: savedSchema };

export function projectRoutes(
  projects: ProjectAccess,
): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    app.get(
      "/api/projects",
      { schema: { response: { 200: projectPlanSchema } } },
      async (request) => projects.read(request.actor),
    );
    app.get(
      "/api/projects/choices",
      { schema: { response: { 200: planChoicesSchema } } },
      async (request) => projects.readChoices(request.actor),
    );

    // Adding, changing, and removing customers, projects, proposals, and features.
    const recordRoutes = (path: string, type: PlanKind, body: z.ZodType) => {
      const asked = (request: unknown) =>
        // The body is parsed against the schema the kind takes.
        ({ type, request }) as PlanRecordRequest;
      app.post(
        `/api/${path}`,
        { schema: { body, response: { [created]: planResponse } } },
        async (request, reply) => {
          const { result, changeSetId } = await projects.add(
            request.actor,
            asked(request.body),
          );
          return reply.status(created).send({ plan: result, changeSetId });
        },
      );
      app.put(
        `/api/${path}/:id`,
        { schema: { params: idParams, body, response: { 200: planResponse } } },
        async (request) => {
          const { result, changeSetId } = await projects.change(
            request.actor,
            request.params.id,
            asked(request.body),
          );
          return { plan: result, changeSetId };
        },
      );
      app.delete(
        `/api/${path}/:id`,
        { schema: { params: idParams, response: saved } },
        async (request) => ({
          changeSetId: await projects.remove(
            request.actor,
            type,
            request.params.id,
          ),
        }),
      );
    };
    recordRoutes("customers", "customer", customerRequestSchema);
    recordRoutes("projects", "project", projectRequestSchema);
    recordRoutes("proposals", "proposal", proposalRequestSchema);
    recordRoutes("features", "feature", featureRequestSchema);

    app.post(
      "/api/projects/:projectId/milestones",
      {
        schema: {
          params: projectParams,
          body: milestoneRequestSchema,
          response: { [created]: planResponse },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await projects.addMilestone(
          request.actor,
          request.params.projectId,
          request.body,
        );
        return reply.status(created).send({ plan: result, changeSetId });
      },
    );
    app.put(
      "/api/projects/:projectId/milestones/:id",
      {
        schema: {
          params: milestoneParams,
          body: milestoneRequestSchema,
          response: { 200: planResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await projects.changeMilestone(
          request.actor,
          request.params.projectId,
          request.params.id,
          request.body,
        );
        return { plan: result, changeSetId };
      },
    );
    app.delete(
      "/api/projects/:projectId/milestones/:id",
      { schema: { params: milestoneParams, response: saved } },
      async (request) => ({
        changeSetId: await projects.removeMilestone(
          request.actor,
          request.params.projectId,
          request.params.id,
        ),
      }),
    );
    done();
  };
}
