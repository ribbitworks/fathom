// SPDX-License-Identifier: Apache-2.0

// The planning settings for the whole of Fathom, which forecasts work from: the conversions between
// units of effort, which double as a working month's days and a working day's hours; the default
// share of a person's time that goes to feature work at all; the share a new starter delivers in
// each of their first months, full from the month after the last; and the default buffer added to
// effort before forecasting, which leaves the effort entered as it is. A change is a draft, live
// once approved with Approve Configuration.

import { z } from "zod";
import { heldBySchema, recordDraftSchema } from "./drafts.ts";
import {
  effortConversionNames,
  effortConversionsSchema,
  startingEffortConversions,
} from "./effort.ts";
import { outOfRange } from "./numbers.ts";
import { changeSetIdSchema } from "./people.ts";

export const planningSettingLimits = {
  focusPercent: { least: 1, most: 100 },
  bufferPercent: { least: 0, most: 100 },
  rampUpPercent: { least: 1, most: 100 },
  rampUpMonths: { least: 0, most: 12 },
} as const;

export const planningSettingNames = {
  ...effortConversionNames,
  focusPercent: "Default focus",
  bufferPercent: "Default buffer",
  rampUpPercents: "Ramp-up",
} as const;

const percent = "%";

const wholePercentage = (
  name: string,
  { least, most }: { least: number; most: number },
) =>
  z
    .number()
    .int({ error: `${name}: use a whole percentage` })
    .min(least, { error: outOfRange(name, { least, most }, percent) })
    .max(most, { error: outOfRange(name, { least, most }, percent) });

const { focusPercent, bufferPercent, rampUpPercent, rampUpMonths } =
  planningSettingLimits;

const tooManyMonths = `${planningSettingNames.rampUpPercents}: use up to ${String(
  rampUpMonths.most,
)} months`;

export const planningSettingsSchema = effortConversionsSchema.extend({
  focusPercent: wholePercentage(
    planningSettingNames.focusPercent,
    focusPercent,
  ),
  bufferPercent: wholePercentage(
    planningSettingNames.bufferPercent,
    bufferPercent,
  ),
  rampUpPercents: z
    .array(wholePercentage(planningSettingNames.rampUpPercents, rampUpPercent))
    .max(rampUpMonths.most, { error: tooManyMonths }),
});

export type PlanningSettings = z.infer<typeof planningSettingsSchema>;

// Every setting, in the order they are listed.
export const planningSettingFields = [
  "hoursPerDay",
  "daysPerWeek",
  "daysPerMonth",
  "focusPercent",
  "bufferPercent",
  "rampUpPercents",
] as const satisfies readonly (keyof PlanningSettings)[];

// The settings held as percentages.
export const percentSettingFields = [
  "focusPercent",
  "bufferPercent",
  "rampUpPercents",
] as const satisfies readonly (keyof PlanningSettings)[];

// A new starter's share of full output from the month after the last month of ramp-up.
export const fullOutputPercent = 100;

// Any of the settings, changed together; those left out stay as they are.
export const planningSettingsChangeSchema = planningSettingsSchema.partial();

export type PlanningSettingsChange = z.infer<
  typeof planningSettingsChangeSchema
>;

// The settings with a change made to them, those it leaves out as they were.
export const changedSettings = (
  settings: PlanningSettings,
  change: PlanningSettingsChange,
): PlanningSettings => ({
  hoursPerDay: change.hoursPerDay ?? settings.hoursPerDay,
  daysPerWeek: change.daysPerWeek ?? settings.daysPerWeek,
  daysPerMonth: change.daysPerMonth ?? settings.daysPerMonth,
  focusPercent: change.focusPercent ?? settings.focusPercent,
  bufferPercent: change.bufferPercent ?? settings.bufferPercent,
  rampUpPercents: change.rampUpPercents ?? settings.rampUpPercents,
});

export const startingPlanningSettings: PlanningSettings = {
  ...startingEffortConversions,
  focusPercent: 80,
  bufferPercent: 0,
  rampUpPercents: [50, 75],
};

// The settings as the reader sees them, with their draft, waiting for approval, in place, and what
// it changes from the live settings, and who holds them, when someone else has unpublished changes.
export const planningSettingsShownSchema = planningSettingsSchema.extend({
  draft: recordDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type PlanningSettingsShown = z.infer<typeof planningSettingsShownSchema>;

export const savedPlanningSettingsSchema = z.object({
  settings: planningSettingsShownSchema,
  changeSetId: changeSetIdSchema,
});

export type SavedPlanningSettings = z.infer<typeof savedPlanningSettingsSchema>;
