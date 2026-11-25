// SPDX-License-Identifier: Apache-2.0

// Activities: work a release or a project needs that isn't a feature, with a feature's planning
// fields, each of exactly one release or one project.

import { z } from "zod";
import { planningRequestShape, planningShape } from "./features.ts";

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

type Owners = Pick<ActivityRequest, "releaseId" | "projectId">;

// What an activity belongs to once a change chooses its release or its project: choosing one moves
// it there, clearing the other; a change that chooses neither leaves both as they were.
export const ownersAfter = (
  owners: Owners,
  change: Partial<Owners>,
): Owners => {
  if (typeof change.releaseId === "string") {
    return { releaseId: change.releaseId, projectId: null };
  }
  if (typeof change.projectId === "string") {
    return { releaseId: null, projectId: change.projectId };
  }
  return { ...owners, ...change };
};

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
