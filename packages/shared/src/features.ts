// SPDX-License-Identifier: Apache-2.0

// Features, the planned work on the roadmap: their fields, and the warnings a feature raises.

import { z } from "zod";
import { daySchema, monthSchema } from "./days.ts";
import { recordDraftSchema } from "./drafts.ts";
import {
  plannedColumnValues,
  givenColumnValues,
  shownColumnValues,
  valuesSchema,
} from "./column-values.ts";
import { byMeaning, type Meaning } from "./lists.ts";
import {
  optionalText,
  picked,
  recordName,
  recordShape,
} from "./record-fields.ts";

// The keys of a feature's own built-in fields.
export const featureColumnKeys = [
  "name",
  "statusId",
  "description",
  "note",
  "customerIds",
  "priorityId",
  "neededBy",
  "estimateHours",
  "sizeId",
  "riskId",
  "targetCycle",
  "featureTeamId",
] as const;

export const featureLengths = { description: 200 } as const;

// The largest estimate, in hours: about 125,000 person-days, more than any feature needs.
export const largestEstimateHours = 999_999;

// Whether a feature's status commits to it: planned or being worked on, rather than possible, done
// or cancelled.
export const isCommitted = byMeaning(
  {
    proposed: false,
    open: false,
    hired: false,
    left: false,
    possible: false,
    planned: true,
    "in-progress": true,
    done: false,
    cancelled: false,
  },
  false,
);

// A committed feature needs a feature team to own it; a possible one need not have one yet, and a
// done or cancelled one raises no warnings.
export const needsFeatureTeam = (
  meaning: Meaning | undefined,
  featureTeamId: string | null,
): boolean => featureTeamId === null && isCommitted(meaning);

// A committed feature with no month allocated is Not staffed.
export const needsStaffing = (
  meaning: Meaning | null | undefined,
  staffed: boolean,
): boolean => !staffed && isCommitted(meaning);

// The meanings of a status that say how far a feature has come, furthest first. Other meanings,
// such as cancelled, say it won't be delivered.
export const progressMeanings = [
  "done",
  "in-progress",
  "planned",
  "possible",
] as const satisfies readonly Meaning[];

export type ProgressMeaning = (typeof progressMeanings)[number];

const isProgress = (
  meaning: Meaning | null | undefined,
): meaning is ProgressMeaning =>
  progressMeanings.some((progress) => progress === meaning);

// The features targeting a stream's cycle, by what their status means, each in the order given;
// those whose status means something else are left out.
export function featuresByMeaning<
  Targeting extends Pick<
    Feature,
    "statusId" | "targetStreamId" | "targetCycle"
  >,
>(
  features: readonly Targeting[],
  cycle: { streamId: string; startsOn: string },
  meaningOf: (statusId: string) => Meaning | null | undefined,
): Record<ProgressMeaning, Targeting[]> {
  const byMeaning: Record<ProgressMeaning, Targeting[]> = {
    done: [],
    "in-progress": [],
    planned: [],
    possible: [],
  };
  for (const feature of features) {
    const meaning = meaningOf(feature.statusId);
    if (
      feature.targetStreamId === cycle.streamId &&
      feature.targetCycle === cycle.startsOn &&
      isProgress(meaning)
    ) {
      // The meaning is one of the record's own keys.
      // eslint-disable-next-line security/detect-object-injection
      byMeaning[meaning].push(feature);
    }
  }
  return byMeaning;
}

// A feature's draft, naming added columns as a person's draft does: by column, with their live
// values held by type beside the live values of the feature's own fields.
export const featureDraftSchema = recordDraftSchema.extend({
  live: z
    .object({
      values: valuesSchema,
      ...givenColumnValues,
    })
    .loose(),
});

export type FeatureDraft = z.infer<typeof featureDraftSchema>;

// The planning fields a feature and an activity share, as a draft makes them.
export const planningShape = {
  ...recordShape,
  draft: featureDraftSchema.optional(),
  name: z.string(),
  statusId: z.string(),
  priorityId: z.string().nullable(),
  sizeId: z.string().nullable(),
  riskId: z.string().nullable(),
  neededBy: z.string().nullable(),
  estimateHours: z.number().nullable(),
  featureTeamId: z.string().nullable(),
  description: z.string().nullable(),
  note: z.string().nullable(),
  values: valuesSchema,
  ...shownColumnValues,
  // Whether any allocation gives it a month, as drafts make the allocations, and as they are live:
  // a fact about the work, seen by all who see it, though the allocations aren't.
  staffed: z.boolean(),
  staffedLive: z.boolean(),
};

// A feature as its draft makes it. A target cycle is known by its stream and the day it starts.
export const featureSchema = z.object({
  ...planningShape,
  customerIds: z.array(z.string()),
  targetStreamId: z.string().nullable(),
  targetCycle: z.string().nullable(),
});

export type Feature = z.infer<typeof featureSchema>;

const hundredths = 100;

// The planning fields a feature and an activity are added and changed with. One added without a
// status starts in the first status offered that means Possible, and one changed without a status
// keeps its own. The note is checked by the server.
export const planningRequestShape = {
  name: recordName,
  statusId: z.uuid().optional(),
  priorityId: z.uuid().nullable().default(null),
  sizeId: z.uuid().nullable().default(null),
  riskId: z.uuid().nullable().default(null),
  neededBy: monthSchema.nullable().default(null),
  estimateHours: z
    .number()
    .min(0)
    .max(largestEstimateHours)
    .nullable()
    .default(null)
    .transform((hours) =>
      hours === null ? null : Math.round(hours * hundredths) / hundredths,
    ),
  featureTeamId: z.uuid().nullable().default(null),
  description: optionalText(featureLengths.description),
  note: z.string().nullable().default(null),
  ...plannedColumnValues,
};

export const featureRequestSchema = z.object({
  ...planningRequestShape,
  customerIds: picked,
  target: z
    .object({ streamId: z.uuid(), cycle: daySchema })
    .nullable()
    .default(null),
});

export type FeatureRequest = z.infer<typeof featureRequestSchema>;
