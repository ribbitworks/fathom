// SPDX-License-Identifier: Apache-2.0

// Activities: work a project or a release needs that isn't a feature, as records of the plan.

import { z } from "zod";
import type { RecordType } from "./drafts.ts";
import { estimateHoursSchema, featureLengths } from "./features.ts";
import { optionalText, recordName, recordShape } from "./record-fields.ts";

// What an activity belongs to, and the kind of record it is for each, so each takes its owner's
// permissions.
export const activityTypes = {
  project: "project-activity",
  release: "release-activity",
} as const satisfies Record<string, RecordType>;

export type ActivityOwner = keyof typeof activityTypes;

export type ActivityType = (typeof activityTypes)[ActivityOwner];

export const activityTypeList = [
  activityTypes.project,
  activityTypes.release,
] as const satisfies readonly ActivityType[];

export const isActivityType = (type: RecordType): type is ActivityType =>
  (activityTypeList as readonly RecordType[]).includes(type);

// The field naming each owner, as the record and its draft keep it.
export const activityOwnerFields = {
  project: "projectId",
  release: "releaseId",
} as const satisfies Record<ActivityOwner, string>;

export const activityLengths = {
  description: featureLengths.description,
} as const;

export const activitySchema = z.object({
  ...recordShape,
  // Exactly one of these names its owner.
  projectId: z.string().nullable(),
  releaseId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  note: z.string().nullable(),
  estimateHours: z.number().nullable(),
});

export type Activity = z.infer<typeof activitySchema>;

// The note is checked by the server, as a feature's is.
export const activityRequestSchema = z.object({
  name: recordName,
  description: optionalText(activityLengths.description),
  note: z.string().nullable().default(null),
  estimateHours: estimateHoursSchema,
});

export type ActivityRequest = z.infer<typeof activityRequestSchema>;

// An activity as drafts and refusals name it, with the project or release it belongs to.
export const activitySubject = (activity: string, owner: string): string =>
  `the activity ${activity} of ${owner}`;
