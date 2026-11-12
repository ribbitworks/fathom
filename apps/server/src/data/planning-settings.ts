// SPDX-License-Identifier: Apache-2.0

// The planning settings for the whole of Fathom, seen by those who see configuration, with the
// conversions between units of effort among them seen with the plan, and changed straight away,
// rather than as drafts, by those who change configuration, each change recorded in the change
// history so it can be undone. Estimates keep
// their hours when a conversion changes. Part of the data access layer, the only server code that
// queries the database.

import {
  type Database,
  planningSettings,
  planningSettingsId,
} from "@fathom/db";
import {
  type EffortConversions,
  type PlanningSettings,
  type PlanningSettingsChange,
  changedSettings,
  planningSettingFields,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { type Actor, requirePermission } from "../access.ts";
import { changesBetween, recordChanges, type Saved } from "./changes.ts";

// Locked for a change when asked, so two changes made at once are recorded one after the other.
async function readSettings(
  reader: Pick<Database, "select">,
  { lock = false } = {},
): Promise<PlanningSettings> {
  const query = reader
    .select({
      hoursPerDay: planningSettings.hoursPerDay,
      daysPerWeek: planningSettings.daysPerWeek,
      daysPerMonth: planningSettings.daysPerMonth,
      focusPercent: planningSettings.focusPercent,
      bufferPercent: planningSettings.bufferPercent,
      rampUpPercents: planningSettings.rampUpPercents,
    })
    .from(planningSettings)
    .where(eq(planningSettings.id, planningSettingsId));
  const [row] = await (lock ? query.for("update") : query);
  if (row === undefined)
    throw new Error("The planning settings are missing; apply the migrations");
  return row;
}

export async function readPlanningSettings(
  database: Database,
  actor: Actor,
): Promise<PlanningSettings> {
  requirePermission(actor, "configuration:view");
  return readSettings(database);
}

export async function readEffortConversions(
  database: Database,
  actor: Actor,
): Promise<EffortConversions> {
  requirePermission(actor, "plan:view");
  const { hoursPerDay, daysPerWeek, daysPerMonth } =
    await readSettings(database);
  return { hoursPerDay, daysPerWeek, daysPerMonth };
}

// Changes the settings given, leaving the others as they are, so two people changing different
// settings at once keep both changes.
export async function changePlanningSettings(
  database: Database,
  actor: Actor,
  change: PlanningSettingsChange,
): Promise<Saved<PlanningSettings>> {
  requirePermission(actor, "configuration:edit");
  return database.transaction(async (transaction) => {
    const before = await readSettings(transaction, { lock: true });
    const after = changedSettings(before, change);
    const made = changesBetween(
      "planning-settings",
      planningSettingsId,
      "changed",
      before,
      after,
      planningSettingFields,
    );
    if (made.length === 0) return { result: before, changeSetId: null };
    await transaction
      .update(planningSettings)
      .set(after)
      .where(eq(planningSettings.id, planningSettingsId));
    const changeSetId = await recordChanges(transaction, actor, made);
    return { result: after, changeSetId };
  });
}
