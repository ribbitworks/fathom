// SPDX-License-Identifier: Apache-2.0

// Records and reads the change history: every change to Fathom's data, with its old and new values,
// grouped into the change sets saved together. Part of the data access layer, the only server code
// that queries the database. Who created and last changed a record is read from it, counting only
// changes to fields in the tiers the reader may see. Until plan approval arrives, each change set is
// applied as it is saved.

import { changes, changeSets, type Database, users } from "@fathom/db";
import type { ChangeStamp, Tier } from "@fathom/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";

// The kinds of record whose changes are recorded.
export type RecordType = "list-item";

export interface Change {
  recordType: RecordType;
  recordId: string;
  action: "created" | "changed" | "deleted";
  field: string;
  tier: Tier;
  // Null when the field had no value, as before a record is created or after it is deleted.
  oldValue: unknown;
  newValue: unknown;
}

// Takes a transaction, so changes are recorded together with the data they change. The maker is
// null for Fathom itself, such as for data made by setup or seed scripts. With no changes, nothing is
// recorded, so there is never an empty change set.
export async function recordChanges(
  transaction: Pick<Database, "insert">,
  madeBy: string | null,
  made: readonly Change[],
): Promise<void> {
  if (made.length === 0) return;
  const changeSetId = randomUUID();
  await transaction.insert(changeSets).values({ id: changeSetId, madeBy });
  await transaction
    .insert(changes)
    .values(made.map((change) => ({ ...change, changeSetId })));
}

export interface Stamps {
  created: ChangeStamp;
  changed: ChangeStamp;
}

// Who created and last changed each record, from the changes to fields in the given tiers, in the
// order they were saved. A record with no such changes has no entry.
export async function readStamps(
  database: Database,
  recordType: RecordType,
  recordIds: readonly string[],
  tiers: readonly Tier[],
): Promise<Map<string, Stamps>> {
  if (recordIds.length === 0) return new Map();
  // The first and last change to each record, found by the database.
  const edges = database
    .select({
      recordId: changes.recordId,
      firstId: sql<number>`min(${changes.id})`.as("first_id"),
      lastId: sql<number>`max(${changes.id})`.as("last_id"),
    })
    .from(changes)
    .where(
      and(
        eq(changes.recordType, recordType),
        inArray(changes.recordId, [...recordIds]),
        inArray(changes.tier, [...tiers]),
      ),
    )
    .groupBy(changes.recordId)
    .as("edges");
  const first = alias(changes, "first_change");
  const last = alias(changes, "last_change");
  const firstSet = alias(changeSets, "first_set");
  const lastSet = alias(changeSets, "last_set");
  const firstUser = alias(users, "first_user");
  const lastUser = alias(users, "last_user");
  const rows = await database
    .select({
      recordId: edges.recordId,
      createdAt: firstSet.madeAt,
      createdBy: firstSet.madeBy,
      // Accounts are never deleted, so a maker always has a name.
      createdName: sql<string>`coalesce(${firstUser.name}, '')`,
      changedAt: lastSet.madeAt,
      changedBy: lastSet.madeBy,
      changedName: sql<string>`coalesce(${lastUser.name}, '')`,
    })
    .from(edges)
    .innerJoin(first, eq(first.id, edges.firstId))
    .innerJoin(firstSet, eq(firstSet.id, first.changeSetId))
    .leftJoin(firstUser, eq(firstUser.id, firstSet.madeBy))
    .innerJoin(last, eq(last.id, edges.lastId))
    .innerJoin(lastSet, eq(lastSet.id, last.changeSetId))
    .leftJoin(lastUser, eq(lastUser.id, lastSet.madeBy));
  const stamp = (at: Date, by: string | null, name: string): ChangeStamp => ({
    by: by === null ? null : { id: by, name },
    at: at.toISOString(),
  });
  return new Map(
    rows.map((row) => [
      row.recordId,
      {
        created: stamp(row.createdAt, row.createdBy, row.createdName),
        changed: stamp(row.changedAt, row.changedBy, row.changedName),
      },
    ]),
  );
}
