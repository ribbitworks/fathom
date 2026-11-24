// SPDX-License-Identifier: Apache-2.0

// The routes for customers, projects with their milestones and activities, proposals, and features,
// and duplicating a feature or an activity, each answering with the change set it was saved in.
// The data access layer checks the actor's permissions.

import {
  activityDuplicateRequestSchema,
  activityRequestSchema,
  changeSetIdSchema,
  customerRequestSchema,
  duplicatedSchema,
  featureProjectsRequestSchema,
  featureRequestSchema,
  fieldRequestSchema,
  fieldSchema,
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
import type { PlanKind, PlanRecordRequest } from "../data/index.ts";
import type { ProjectAccess } from "../data/plan-access.ts";

const created = 201;

const planResponse = z.object({
  plan: projectPlanSchema,
  changeSetId: changeSetIdSchema,
});
const idParams = z.object({ id: z.uuid() });
const projectParams = z.object({ projectId: z.uuid() });
const belongingParams = z.object({ projectId: z.uuid(), id: z.uuid() });
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

    // The columns added to Features.
    const columnParams = z.object({ fieldId: z.uuid() });
    const columnResponse = z.object({
      field: fieldSchema,
      changeSetId: z.string().nullable(),
    });
    app.post(
      "/api/features/columns",
      {
        schema: {
          body: fieldRequestSchema,
          response: { [created]: columnResponse },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await projects.createFeatureColumn(
          request.actor,
          request.body,
        );
        return reply.status(created).send({ field: result, changeSetId });
      },
    );
    app.put(
      "/api/features/columns/:fieldId",
      {
        schema: {
          params: columnParams,
          body: fieldRequestSchema,
          response: { 200: columnResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await projects.updateFeatureColumn(
          request.actor,
          request.params.fieldId,
          request.body,
        );
        return { field: result, changeSetId };
      },
    );
    app.delete(
      "/api/features/columns/:fieldId",
      { schema: { params: columnParams, response: saved } },
      async (request) => ({
        changeSetId: await projects.deleteFeatureColumn(
          request.actor,
          request.params.fieldId,
        ),
      }),
    );
    app.delete(
      "/api/features/columns/:fieldId/draft",
      { schema: { params: columnParams, response: saved } },
      async (request) => ({
        changeSetId: await projects.discardFeatureColumnDraft(
          request.actor,
          request.params.fieldId,
        ),
      }),
    );
    app.delete(
      "/api/features/columns/:fieldId/draft/rejection",
      { schema: { params: columnParams, response: saved } },
      async (request) => ({
        changeSetId: await projects.resubmitFeatureColumnDraft(
          request.actor,
          request.params.fieldId,
        ),
      }),
    );

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
          params: belongingParams,
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
      { schema: { params: belongingParams, response: saved } },
      async (request) => ({
        changeSetId: await projects.removeMilestone(
          request.actor,
          request.params.projectId,
          request.params.id,
        ),
      }),
    );

    app.post(
      "/api/features/:id/duplicate",
      {
        schema: {
          params: idParams,
          response: { [created]: duplicatedSchema },
        },
      },
      async (request, reply) =>
        reply
          .status(created)
          .send(
            await projects.duplicateFeature(request.actor, request.params.id),
          ),
    );
    app.post(
      "/api/activities/:id/duplicate",
      {
        schema: {
          params: idParams,
          body: activityDuplicateRequestSchema,
          response: { [created]: duplicatedSchema },
        },
      },
      async (request, reply) =>
        reply
          .status(created)
          .send(
            await projects.duplicateActivity(
              request.actor,
              request.params.id,
              request.body,
            ),
          ),
    );

    app.post(
      "/api/projects/:projectId/activities",
      {
        schema: {
          params: projectParams,
          body: activityRequestSchema,
          response: { [created]: planResponse },
        },
      },
      async (request, reply) => {
        const { result, changeSetId } = await projects.addActivity(
          request.actor,
          request.params.projectId,
          request.body,
        );
        return reply.status(created).send({ plan: result, changeSetId });
      },
    );
    app.put(
      "/api/projects/:projectId/activities/:id",
      {
        schema: {
          params: belongingParams,
          body: activityRequestSchema,
          response: { 200: planResponse },
        },
      },
      async (request) => {
        const { result, changeSetId } = await projects.changeActivity(
          request.actor,
          request.params.projectId,
          request.params.id,
          request.body,
        );
        return { plan: result, changeSetId };
      },
    );
    app.delete(
      "/api/projects/:projectId/activities/:id",
      { schema: { params: belongingParams, response: saved } },
      async (request) => ({
        changeSetId: await projects.removeActivity(
          request.actor,
          request.params.projectId,
          request.params.id,
        ),
      }),
    );
    done();
  };
}
