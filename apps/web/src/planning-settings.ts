// SPDX-License-Identifier: Apache-2.0

// The planning settings for the whole of Fathom, through the server's API: read by those who see
// configuration, with their draft in place, and drafted a few at a time, so changes to other
// settings made meanwhile are kept; and the settings as the change history words their values.

import {
  type ChangeValue,
  type PlanningSettingsChange,
  type PlanningSettingsShown,
  planningSettingsId,
  planningSettingsShownSchema,
  type RecordDraft,
  savedPlanningSettingsSchema,
  type Weekday,
  weekdaySchema,
  weekOrder,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { getJson, sendJsonFor } from "./api.ts";
import { recordNode } from "./record-drafts.ts";

const path = "/api/planning-settings";

export const planningSettingsQuery = queryOptions({
  queryKey: ["planning-settings"],
  queryFn: async () => getJson(path, planningSettingsShownSchema),
});

// Saves a change as a draft, returning the change set it was saved in.
export const changePlanningSettings = async (change: PlanningSettingsChange) =>
  (await sendJsonFor("PATCH", path, change, savedPlanningSettingsSchema))
    .changeSetId;

export const planningSettingsRef = {
  type: "planning-settings",
  id: planningSettingsId,
} as const;

export const planningSettingsSubject = "the planning settings";

export const planningSettingsNode = (settings: PlanningSettingsShown) =>
  recordNode(
    "planning-settings",
    { ...settings, id: planningSettingsId },
    planningSettingsSubject,
  );

// Settings' values as the change history keeps them, each number as text, so a draft's details
// word them as the history does, but with the working days in the order of the week they start.
const settingWords = (
  values: object,
  startsOn: Weekday,
): Readonly<Record<string, ChangeValue>> =>
  Object.fromEntries(
    Object.entries(values).flatMap(([key, value]): [string, ChangeValue][] => {
      if (typeof value === "number") return [[key, String(value)]];
      // The only setting held as a list is the working days.
      if (!Array.isArray(value)) return [];
      return [
        [
          key,
          weekOrder(startsOn)
            .filter((day) => value.includes(day))
            .map(String),
        ],
      ];
    }),
  );

// A draft of the settings and the settings it makes, worded as the change history words them, each
// side's days in its own week's order.
export const settingsDraftWords = (
  draft: RecordDraft,
  settings: PlanningSettingsShown,
) => {
  const liveStart = weekdaySchema.safeParse(
    new Map(Object.entries(draft.live)).get("weekStartsOn"),
  ).data;
  return [
    {
      ...draft,
      live: settingWords(draft.live, liveStart ?? settings.weekStartsOn),
    },
    settingWords(settings, settings.weekStartsOn),
  ] as const;
};
