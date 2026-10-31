// SPDX-License-Identifier: Apache-2.0

// Records the change history: every change to Fathom's data, with its old and new values, grouped
// into the change sets saved together. Part of the data access layer, the only server code that
// queries the database. Until plan approval arrives, each change set is applied as it is saved.

import { changes, changeSets, type Database } from "@fathom/db";
import type { Tier } from "@fathom/shared";
import { randomUUID } from "node:crypto";

// The kinds of record whose changes are recorded.
export type RecordType = "list" | "list-item";

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
