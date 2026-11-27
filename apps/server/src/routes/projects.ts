// SPDX-License-Identifier: Apache-2.0

// The routes for customers, projects with their milestones, proposals and features, and a feature's
// projects and proposals. The data access layer checks the actor's permissions.

import {
  addedPlanSchema,
  addedRecordsSchema,
  changeSetIdSchema,
  customerRequestSchema,
  featureProjectsRequestSchema,
  featureRequestSchema,
  milestoneAddingSchema,
  milestoneRequestSchema,
  planChoicesSchema,
  projectPlanSchema,
  projectRequestSchema,
  proposalRequestSchema,
  removalReasonRequestSchema,
  savedSchema,
  scopeHistorySchema,
} from "@fathom/shared";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { PlanAdding, PlanKind, PlanRecordRequest } from "../data/index.ts";
import type { ProjectAccess } from "../data/plan-access.ts";

const created = 201;

const planResponse = z.object({
  plan: projectPlanSchema,
  changeSetId: changeSetIdSchema,
});
const addedResponse = { [created]: addedPlanSchema };
const idParams = z.object({ id: z.uuid() });
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

    // Adding several records of a kind at once, all in one change set or none, milestones among
    // them, whichever projects they are of.
    const addingRoute = (
      path: string,
      type: PlanAdding["type"],
      body: z.ZodType,
    ) => {
      app.post(
        `/api/${path}`,
        {
          schema: { body: addedRecordsSchema(body), response: addedResponse },
        },
        async (request, reply) => {
          const { result, ids, changeSetId } = await projects.add(
            request.actor,
            // The records are parsed against the schema the kind takes.
            { type, requests: request.body.records } as PlanAdding,
          );
          return reply.status(created).send({ plan: result, ids, changeSetId });
        },
      );
    };
    addingRoute("milestones", "milestone", milestoneAddingSchema);

    // Adding, changing, and removing customers, projects, proposals, and features.
    const recordRoutes = (path: string, type: PlanKind, body: z.ZodType) => {
      const asked = (request: unknown) =>
        // The body is parsed against the schema the kind takes.
        ({ type, request }) as PlanRecordRequest;
      addingRoute(path, type, body);
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
    app.put(
      "/api/features/:id/projects-and-proposals",
      {
        schema: {
          params: idParams,
          body: featureProjectsRequestSchema,
          response: { 200: planResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await projects.changeFeatureProjects(
          request.actor,
          request.params.id,
          request.body,
        );
        return { plan: result, changeSetId };
      },
    );

    for (const [path, type] of [
      ["projects", "project"],
      ["proposals", "proposal"],
    ] as const) {
      app.get(
        `/api/${path}/:id/scope-history`,
        { schema: { params: idParams, response: { 200: scopeHistorySchema } } },
        async (request) =>
          projects.readScopeHistory(request.actor, type, request.params.id),
      );
    }
    app.put(
      "/api/features/:id/proposals/:proposalId/removal-reason",
      {
        schema: {
          params: z.object({ id: z.uuid(), proposalId: z.uuid() }),
          body: removalReasonRequestSchema,
          response: { 200: planResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await projects.changeRemovalReason(
          request.actor,
          request.params.id,
          request.params.proposalId,
          request.body,
        );
        return { plan: result, changeSetId };
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
