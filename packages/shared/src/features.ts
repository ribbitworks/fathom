// SPDX-License-Identifier: Apache-2.0

// Features, the planned work on the roadmap, as the Decisions Log sets out: each one of the plan's
// records, changed through drafts, with a status from the built-in list of feature statuses, and
// optionally the month it is needed by, customers, a target cycle, an estimate kept in hours, a
// feature team, a short description, and a note. A feature that targets no cycle is in Later.

import { z } from "zod";
import { daySchema, monthSchema } from "./days.ts";
import { recordDraftSchema } from "./drafts.ts";
import {
  linksSchema,
  notesSchema,
  numbersSchema,
  requestedLinksSchema,
  requestedNotesSchema,
  requestedNumbersSchema,
  requestedValuesSchema,
  valuesSchema,
} from "./people.ts";
import type { Meaning } from "./lists.ts";
import {
  optionalText,
  picked,
  recordName,
  recordShape,
} from "./record-fields.ts";

// The keys of Features' built-in columns, in the order they start in.
export const featureColumnKeys = [
  "name",
  "statusId",
  "neededBy",
  "customerIds",
  "description",
  "note",
  "targetCycle",
  "estimateHours",
  "featureTeamId",
] as const;

export const featureLengths = { description: 200 } as const;

// The largest estimate, in hours: about 125,000 person-days, more than any feature needs.
export const largestEstimateHours = 999_999;

// A feature being planned or worked on needs a feature team to own it, as the Decisions Log sets
// out; a possible one need not have one yet, and a done or cancelled one raises no warnings.
export const needsFeatureTeam = (
  meaning: Meaning | undefined,
  featureTeamId: string | null,
): boolean =>
  featureTeamId === null &&
  (meaning === "planned" || meaning === "in-progress");

// A feature's draft, naming added columns as a person's draft does: by column, with their live
// values held by type beside the live values of the feature's own fields.
export const featureDraftSchema = recordDraftSchema.extend({
  live: z
    .object({
      values: valuesSchema,
      links: linksSchema,
      notes: notesSchema,
      numbers: numbersSchema,
    })
    .loose(),
});

export type FeatureDraft = z.infer<typeof featureDraftSchema>;

// A feature as its draft makes it. A target cycle is known by its stream and the day it starts.
export const featureSchema = z.object({
  ...recordShape,
  draft: featureDraftSchema.optional(),
  name: z.string(),
  statusId: z.string(),
  neededBy: z.string().nullable(),
  customerIds: z.array(z.string()),
  targetStreamId: z.string().nullable(),
  targetCycle: z.string().nullable(),
  estimateHours: z.number().nullable(),
  featureTeamId: z.string().nullable(),
  description: z.string().nullable(),
  note: z.string().nullable(),
  values: valuesSchema,
  links: linksSchema.default({}),
  notes: notesSchema.optional(),
  numbers: numbersSchema.optional(),
});

export type Feature = z.infer<typeof featureSchema>;

const hundredths = 100;

// A feature added without a status starts in the first status offered that means Possible, and one
// changed without a status keeps its own. The note is checked by the server.
export const featureRequestSchema = z.object({
  name: recordName,
  statusId: z.uuid().optional(),
  neededBy: monthSchema.nullable().default(null),
  customerIds: picked,
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
  note: z.string().nullable().default(null),
  values: requestedValuesSchema.default({}),
  links: requestedLinksSchema.default({}),
  notes: requestedNotesSchema.default({}),
  numbers: requestedNumbersSchema.default({}),
});

export type FeatureRequest = z.infer<typeof featureRequestSchema>;
