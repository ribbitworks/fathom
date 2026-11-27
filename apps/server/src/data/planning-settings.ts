// SPDX-License-Identifier: Apache-2.0

// The planning settings for the whole of Fathom, and the conversions between units of effort they
// give: read, and drafted. Part of the data access layer.

import {
  type Database,
  planningSettings,
  planningSettingsId,
  type Reader,
} from "@fathom/db";
import {
  type EffortConversions,
  type PlanningSettings,
  type PlanningSettingsChange,
  type PlanningSettingsShown,
  changedSettings,
  effortConversionsOf,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import {
  type Actor,
  requireAnyPermission,
  requirePermission,
} from "../access.ts";
import type { Saved, Transaction } from "./changes.ts";
import { planningSettingsKind } from "./planning-settings-kind.ts";
import { type RecordsState, versionOf } from "./record-state.ts";
import {
  changeableRecord,
  drafting,
  saveRecordDraft,
} from "./record-drafting.ts";
import { readRecordMakers } from "./record-makers.ts";
import { readRecordsState, recordDraftOut, recordHeldBy } from "./records.ts";

const missing = "The planning settings are missing; apply the migrations";

// The settings as the reader sees them, with their draft in place.
async function settingsOut(
  transaction: Transaction,
  reader: Actor,
  state: RecordsState,
): Promise<PlanningSettingsShown> {
  const settings = versionOf(state, "planning-settings", planningSettingsId);
  if (settings === undefined) throw new Error(missing);
  const draft = recordDraftOut(
    planningSettingsKind,
    state,
    await readRecordMakers(transaction, state, reader),
    planningSettingsId,
  );
  return {
    ...(settings as PlanningSettings),
    ...(draft === undefined ? {} : { draft }),
    ...recordHeldBy(state, "planning-settings", planningSettingsId),
  };
}

export async function readPlanningSettings(
  database: Database,
  actor: Actor,
): Promise<PlanningSettingsShown> {
  requirePermission(actor, "configuration:view");
  // Read as of one moment, so an approval saved meanwhile is seen whole or not at all.
  return database.transaction(
    async (transaction) =>
      settingsOut(
        transaction,
        actor,
        await readRecordsState(transaction, actor.user.id),
      ),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// The approved settings' one row, the migrations having made it.
async function settingsRow(reader: Reader) {
  const [row] = await reader
    .select()
    .from(planningSettings)
    .where(eq(planningSettings.id, planningSettingsId));
  if (row === undefined) throw new Error(missing);
  return row;
}

// The settings the hours an allocation gives are worked out from, as approved, for the server's own
// use: the page is sent the hours, never the settings.
export async function readHourSettings(reader: Reader) {
  const {
    hoursPerDay,
    daysPerMonth,
    focusPercent,
    bufferPercent,
    rampUpPercents,
  } = await settingsRow(reader);
  return {
    hoursPerDay,
    daysPerMonth,
    focusPercent,
    bufferPercent,
    rampUpPercents,
  };
}

export async function readEffortConversions(
  database: Database,
  actor: Actor,
): Promise<EffortConversions> {
  // Estimates on features and projects alike are read in these units.
  requireAnyPermission(actor, ["plan:view", "features:view"]);
  return effortConversionsOf(await settingsRow(database));
}

// Drafts the settings given, leaving the others as the editor's draft has them, so two people
// changing different settings keep both changes.
export async function changePlanningSettings(
  database: Database,
  actor: Actor,
  change: PlanningSettingsChange,
): Promise<Saved<PlanningSettingsShown>> {
  requirePermission(actor, "configuration:edit");
  return drafting(database, actor.user.id, async (transaction, state) => {
    const before = changeableRecord(
      state,
      "planning-settings",
      planningSettingsId,
    ) as PlanningSettings;
    const changeSetId = await saveRecordDraft(
      transaction,
      actor,
      state,
      "planning-settings",
      planningSettingsId,
      changedSettings(before, change),
    );
    return {
      result: await settingsOut(
        transaction,
        actor,
        await readRecordsState(transaction, actor.user.id),
      ),
      changeSetId,
    };
  });
}
