// SPDX-License-Identifier: Apache-2.0

// Activities: work a release or a project needs that isn't a feature, with a feature's planning
// fields, each of exactly one release or one project.

import { z } from "zod";
import { planningRequestShape, planningShape } from "./features.ts";
import { featureColumnsSchema } from "./projects.ts";

// The keys of an activity's own fields, in the order its table and details show them.
export const activityColumnKeys = [
  "name",
  "statusId",
  "description",
  "note",
  "releaseId",
  "projectId",
  "priorityId",
  "neededBy",
  "estimateHours",
  "sizeId",
  "riskId",
  "featureTeamId",
] as const;

// An activity as its draft makes it.
export const activitySchema = z.object({
  ...planningShape,
  releaseId: z.string().nullable(),
  projectId: z.string().nullable(),
});

export type Activity = z.infer<typeof activitySchema>;

// An activity added or changed names the release or the project it belongs to; which one is
// checked by activityOwnerProblem, so the refusal reads as a person would say it.
export const activityRequestSchema = z.object({
  ...planningRequestShape,
  releaseId: z.uuid().nullable().default(null),
  projectId: z.uuid().nullable().default(null),
});

export type ActivityRequest = z.infer<typeof activityRequestSchema>;

// Why an activity can't belong to what it names: an activity belongs to exactly one release or
// one project.
export const activityOwnerProblem = (
  owners: Pick<ActivityRequest, "releaseId" | "projectId">,
): string | undefined => {
  if (owners.releaseId === null && owners.projectId === null) {
    return "Choose a release or a project";
  }
  if (owners.releaseId !== null && owners.projectId !== null) {
    return "Choose a release or a project, not both";
  }
  return undefined;
};

// Every activity, the live ones by name, then those drafted to be added, in the order drafted, the
// columns added to Activities, and whether the user may change them.
export const activityPlanSchema = z.object({
  activities: z.array(activitySchema),
  columns: featureColumnsSchema,
  canEdit: z.boolean(),
});

export type ActivityPlan = z.infer<typeof activityPlanSchema>;
