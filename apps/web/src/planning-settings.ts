// SPDX-License-Identifier: Apache-2.0

// The planning settings for the whole of Fathom, through the server's API: read by those who see
// configuration, and changed a few at a time, so changes to other settings made meanwhile are kept.

import {
  type PlanningSettingsChange,
  planningSettingsSchema,
  savedPlanningSettingsSchema,
} from "@fathom/shared";
import { queryOptions } from "@tanstack/react-query";
import { getJson, sendJsonFor } from "./api.ts";

const path = "/api/planning-settings";

export const planningSettingsQuery = queryOptions({
  queryKey: ["planning-settings"],
  queryFn: async () => getJson(path, planningSettingsSchema),
});

// Saves a change, returning the change set it was saved in.
export const changePlanningSettings = async (change: PlanningSettingsChange) =>
  (await sendJsonFor("PATCH", path, change, savedPlanningSettingsSchema))
    .changeSetId;
