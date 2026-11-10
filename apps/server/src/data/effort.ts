// SPDX-License-Identifier: Apache-2.0

// The conversions between units of effort for the whole of Fathom, seen with the plan and changed
// straight away, rather than as drafts, by those who change configuration, each change recorded in
// the change history so it can be undone. Estimates keep their hours when a conversion changes.
// Part of the data access layer, the only server code that queries the database.

import {
  type Database,
  effortConversions,
  effortConversionsId,
} from "@fathom/db";
import type { EffortConversions } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { type Actor, requirePermission } from "../access.ts";
import { changesBetween, recordChanges, type Saved } from "./changes.ts";

const conversionFields = [
  "hoursPerDay",
  "daysPerWeek",
  "daysPerMonth",
] as const satisfies readonly (keyof EffortConversions)[];

// Locked for a change when asked, so two changes made at once are recorded one after the other.
async function readConversions(
  reader: Pick<Database, "select">,
  { lock = false } = {},
): Promise<EffortConversions> {
  const query = reader
    .select({
      hoursPerDay: effortConversions.hoursPerDay,
      daysPerWeek: effortConversions.daysPerWeek,
      daysPerMonth: effortConversions.daysPerMonth,
    })
    .from(effortConversions)
    .where(eq(effortConversions.id, effortConversionsId));
  const [row] = await (lock ? query.for("update") : query);
  if (row === undefined)
    throw new Error("The effort conversions are missing; apply the migrations");
  return row;
}

export async function readEffortConversions(
  database: Database,
  actor: Actor,
): Promise<EffortConversions> {
  requirePermission(actor, "plan:view");
  return readConversions(database);
}

export async function changeEffortConversions(
  database: Database,
  actor: Actor,
  conversions: EffortConversions,
): Promise<Saved<EffortConversions>> {
  requirePermission(actor, "configuration:edit");
  return database.transaction(async (transaction) => {
    const before = await readConversions(transaction, { lock: true });
    const made = changesBetween(
      "effort-conversions",
      effortConversionsId,
      "changed",
      before,
      conversions,
      conversionFields,
    );
    if (made.length === 0) return { result: before, changeSetId: null };
    await transaction
      .update(effortConversions)
      .set(conversions)
      .where(eq(effortConversions.id, effortConversionsId));
    const changeSetId = await recordChanges(transaction, actor, made);
    return { result: conversions, changeSetId };
  });
}
