// SPDX-License-Identifier: Apache-2.0

// When a user's private removals began, and what others made live of each record since: the check
// on publishing compares a removal with those. Part of the data access layer.

import { changes, changeSets, inChunks, type Reader, users } from "@fathom/db";
import { and, eq, gt, inArray, max } from "drizzle-orm";
import { wantsNoDraft } from "./draft-records.ts";
import { openChangeSets } from "./draft-makers.ts";
import { madeInOrder } from "./history-order.ts";
import { type LiveSince } from "./private-conflicts.ts";
import { changeKey } from "./unpublished-uses.ts";

interface Removing {
  recordType: string;
  recordId: string;
  action: string;
  fields: Record<string, unknown>;
}

// A private change that removes its record, or takes back the published draft, which may be one
// that adds it.
const removing = (row: Removing) =>
  row.action === "deleted" || wantsNoDraft(row);

// When the user's removal of each record given began: the latest of their changes still private
// that removed it, which their removal holds, by key.
export async function beganAt(
  reader: Reader,
  userId: string,
  recordIds: readonly string[],
): Promise<Map<string, Date | null>> {
  const began = new Map<string, Date | null>();
  for (const chunk of inChunks([...new Set(recordIds)])) {
    const rows = await reader
      .select({
        recordType: changes.recordType,
        recordId: changes.recordId,
        began: max(changeSets.madeAt),
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(
        and(
          openChangeSets(userId),
          eq(changes.action, "deleted"),
          inArray(changes.recordId, chunk),
        ),
      )
      .groupBy(changes.recordType, changes.recordId);
    for (const row of rows) began.set(changeKey(row), row.began);
  }
  return began;
}

// What others made live of each record the user's private changes remove or take back, since each
// began, by key: none for a change that began before any change recorded, as seeded drafts are.
export async function readLiveSince(
  reader: Reader,
  userId: string,
  rows: readonly Removing[],
): Promise<Map<string, LiveSince>> {
  const removals = rows.filter(removing);
  const began = await beganAt(
    reader,
    userId,
    removals.map(({ recordId }) => recordId),
  );
  // Only removals the history records the start of are compared, each from when it began.
  const dated = removals.flatMap((row) => {
    const since = began.get(changeKey(row));
    return since instanceof Date
      ? [{ key: changeKey(row), id: row.recordId, since }]
      : [];
  });
  const found = new Map<string, LiveSince>();
  for (const chunk of inChunks(dated)) {
    const earliest = new Date(Math.min(...chunk.map(({ since }) => +since)));
    const made = await reader
      .select({
        recordType: changes.recordType,
        recordId: changes.recordId,
        action: changes.action,
        field: changes.field,
        tier: changes.tier,
        madeAt: changeSets.madeAt,
        madeBy: users.name,
      })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .leftJoin(users, eq(users.id, changeSets.madeBy))
      .where(
        and(
          eq(changes.draft, false),
          eq(changeSets.private, false),
          gt(changeSets.madeAt, earliest),
          inArray(
            changes.recordId,
            chunk.map(({ id }) => id),
          ),
        ),
      )
      .orderBy(...madeInOrder);
    const byKey = new Map<string, typeof made>();
    for (const change of made) {
      const key = changeKey(change);
      byKey.set(key, [...(byKey.get(key) ?? []), change]);
    }
    for (const { key, since } of chunk) {
      const later = (byKey.get(key) ?? []).filter(
        ({ madeAt }) => madeAt > since,
      );
      if (later.length > 0) {
        found.set(key, {
          added: later.some(({ action }) => action === "created"),
          changes: later.map(({ field, tier, madeBy }) => ({
            field,
            tier,
            madeBy,
          })),
        });
      }
    }
  }
  return found;
}
