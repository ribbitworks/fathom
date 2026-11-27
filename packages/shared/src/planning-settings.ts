// SPDX-License-Identifier: Apache-2.0

// The planning settings for the whole of Fathom, which effort is converted and work forecast with:
// their schema, starting values and names, and a change made to them.

import { z } from "zod";
import { heldBySchema, recordDraftSchema } from "./drafts.ts";
import {
  type EffortConversions,
  effortConversionNames,
  effortConversionsSchema,
  startingEffortConversions,
} from "./effort.ts";
import { outOfRange } from "./numbers.ts";
import { changeSetIdSchema } from "./people.ts";
import {
  startingWorkingWeek,
  weekStartsOnSchema,
  workingDaysSchema,
  workingWeekNames,
} from "./working-week.ts";

const planningSettingLimits = {
  focusPercent: { least: 1, most: 100 },
  bufferPercent: { least: 0, most: 100 },
} as const;

export const planningSettingNames = {
  hoursPerDay: effortConversionNames.hoursPerDay,
  ...workingWeekNames,
  daysPerMonth: effortConversionNames.daysPerMonth,
  focusPercent: "Default focus",
  bufferPercent: "Default buffer",
} as const;

const percent = "%";

const wholePercentage = (
  name: string,
  { least, most }: { least: number; most: number },
) =>
  z
    .number()
    .int({ error: `Use whole percentages for ${name}` })
    .min(least, { error: outOfRange(name, { least, most }, percent) })
    .max(most, { error: outOfRange(name, { least, most }, percent) });

const { focusPercent, bufferPercent } = planningSettingLimits;

export const planningSettingsSchema = effortConversionsSchema
  .pick({ hoursPerDay: true, daysPerMonth: true })
  .extend({
    workingDays: workingDaysSchema,
    weekStartsOn: weekStartsOnSchema,
    focusPercent: wholePercentage(
      planningSettingNames.focusPercent,
      focusPercent,
    ),
    bufferPercent: wholePercentage(
      planningSettingNames.bufferPercent,
      bufferPercent,
    ),
  });

export type PlanningSettings = z.infer<typeof planningSettingsSchema>;

// Every setting, in the order they are listed.
export const planningSettingFields = [
  "hoursPerDay",
  "workingDays",
  "weekStartsOn",
  "daysPerMonth",
  "focusPercent",
  "bufferPercent",
] as const satisfies readonly (keyof PlanningSettings)[];

// The settings held as percentages.
export const percentSettingFields = [
  "focusPercent",
  "bufferPercent",
] as const satisfies readonly (keyof PlanningSettings)[];

// A whole, as a percentage, of which focus and the buffer are shares.
export const hundredPercent = 100;

// Any of the settings, changed together; those left out stay as they are.
export const planningSettingsChangeSchema = planningSettingsSchema.partial();

export type PlanningSettingsChange = z.infer<
  typeof planningSettingsChangeSchema
>;

// The settings with a change made to them, those it leaves out as they were. The working days are
// kept in order, Monday first, so naming the same days in another order changes nothing.
export const changedSettings = (
  settings: PlanningSettings,
  change: PlanningSettingsChange,
): PlanningSettings => ({
  hoursPerDay: change.hoursPerDay ?? settings.hoursPerDay,
  workingDays: (change.workingDays ?? settings.workingDays).toSorted(
    (first, second) => first - second,
  ),
  weekStartsOn: change.weekStartsOn ?? settings.weekStartsOn,
  daysPerMonth: change.daysPerMonth ?? settings.daysPerMonth,
  focusPercent: change.focusPercent ?? settings.focusPercent,
  bufferPercent: change.bufferPercent ?? settings.bufferPercent,
});

export const startingPlanningSettings: PlanningSettings = {
  hoursPerDay: startingEffortConversions.hoursPerDay,
  workingDays: [...startingWorkingWeek.workingDays],
  weekStartsOn: startingWorkingWeek.weekStartsOn,
  daysPerMonth: startingEffortConversions.daysPerMonth,
  focusPercent: 80,
  bufferPercent: 0,
};

// The conversions between units of effort the settings give: a person-week holds a day for each
// working day.
export const effortConversionsOf = ({
  hoursPerDay,
  workingDays,
  daysPerMonth,
}: {
  hoursPerDay: number;
  workingDays: readonly number[];
  daysPerMonth: number;
}): EffortConversions => ({
  hoursPerDay,
  daysPerWeek: workingDays.length,
  daysPerMonth,
});

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
