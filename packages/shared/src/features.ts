// SPDX-License-Identifier: Apache-2.0

// Features, the planned work on the roadmap, as the Decisions Log sets out: each one of the plan's
// records, changed through drafts, with a fixed status, and optionally a target cycle, an estimate
// kept in hours, a feature team, and a description. A feature that targets no cycle is in Later.

import { z } from "zod";
import { daySchema } from "./days.ts";
import { optionalText, recordName, recordShape } from "./record-fields.ts";

export const featureLengths = { description: 5000 } as const;

// The largest estimate the database holds, in hours.
export const largestEstimateHours = 9_999_999_999.99;

export const featureStatusSchema = z.enum([
  "possible",
  "planned",
  "in-progress",
  "done",
  "cancelled",
]);

export type FeatureStatus = z.infer<typeof featureStatusSchema>;

export const firstFeatureStatus: FeatureStatus = "possible";

// A feature being planned or worked on needs a feature team to own it, as the Decisions Log sets
// out; a possible one need not have one yet, and a done or cancelled one raises no warnings.
export const needsFeatureTeam = (
  feature: Pick<Feature, "status" | "featureTeamId">,
): boolean =>
  feature.featureTeamId === null &&
  (feature.status === "planned" || feature.status === "in-progress");

// A feature as its draft makes it. A target cycle is known by its stream and the day it starts.
export const featureSchema = z.object({
  ...recordShape,
  name: z.string(),
  status: featureStatusSchema,
  targetStreamId: z.string().nullable(),
  targetCycle: z.string().nullable(),
  estimateHours: z.number().nullable(),
  featureTeamId: z.string().nullable(),
  description: z.string().nullable(),
});

export type Feature = z.infer<typeof featureSchema>;

const hundredths = 100;

// A feature added without a status starts as Possible, and one changed without a status keeps its
// own.
export const featureRequestSchema = z.object({
  name: recordName,
  status: featureStatusSchema.optional(),
  target: z
    .object({ streamId: z.uuid(), cycle: daySchema })
    .nullable()
    .default(null),
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
});

export type FeatureRequest = z.infer<typeof featureRequestSchema>;
