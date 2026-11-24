// SPDX-License-Identifier: Apache-2.0

// The planning settings for the whole of Fathom, through the server's API: read by those who see
// configuration, with their draft in place, and drafted a few at a time, so changes to other
// settings made meanwhile are kept; and the settings as the change history words their values.

import {
  type ChangeValue,
  type PlanningSettingsChange,
  type Show,
  type PlanningSettingsShown,
  planningSettingsId,
  planningSettingsShownSchema,
  type RecordDraft,
  savedPlanningSettingsSchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { getJson, sendJsonFor } from "./api.ts";
import { withLiveFields } from "./live-records.ts";
import { recordNode } from "./record-drafts.ts";

const path = "/api/planning-settings";

export const planningSettingsQuery = queryOptions({
  queryKey: ["planning-settings"],
  queryFn: async () => getJson(path, planningSettingsShownSchema),
});

// The settings as they are live, with their draft taken back.
export function liveSettings<Settings extends PlanningSettingsShown>(
  settings: Settings,
): Settings {
  const { draft, ...rest } = settings;
  return draft === undefined
    ? settings
    : withLiveFields<Settings>(settings, draft, rest as Settings);
}

// The settings as the Draft view shows them: as drafted, or as they are live, Live only and, once
// rejected, Drafts applied, which takes a rejected draft back.
export function shownSettings<Settings extends PlanningSettingsShown>(
  settings: Settings,
  show: Show,
): Settings {
  const takenBack =
    show === "live" ||
    (show === "drafts" && settings.draft?.state === "rejected");
  return takenBack ? liveSettings(settings) : settings;
}

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
// word them as the history does.
const settingWords = (values: object): Readonly<Record<string, ChangeValue>> =>
  Object.fromEntries(
    Object.entries(values).flatMap(([key, value]): [string, ChangeValue][] => {
      if (typeof value === "number") return [[key, String(value)]];
      if (Array.isArray(value)) return [[key, value.map(String)]];
      return [];
    }),
  );

// A draft of the settings and the settings it makes, worded as the change history words them.
export const settingsDraftWords = (
  draft: RecordDraft,
  settings: PlanningSettingsShown,
) =>
  [
    { ...draft, live: settingWords(draft.live) },
    settingWords(settings),
  ] as const;
