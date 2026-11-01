// SPDX-License-Identifier: Apache-2.0

// Recording the change history, shared by the server's data access layer and the seed data command,
// so both record changes the same way. Each change is one field of one record, with its sensitivity
// tier and its old and new values; changes saved together are one change set.

import { randomUUID } from "node:crypto";
import type { Database } from "./client.ts";
import { changes, changeSets } from "./schema.ts";

export interface ChangeRecord {
  // The kind of record changed, such as "person".
  recordType: string;
  recordId: string;
  action: "created" | "changed" | "deleted";
  field: string;
  tier: string;
  // Null when the field had no value, as before a record is created or after it is deleted.
  oldValue: unknown;
  newValue: unknown;
  // Whether the change is to the record's draft rather than to the live record.
  draft?: boolean;
}

// What a change set did: saved changes, or approved, rejected, discarded, or resubmitted drafts: rejected
// drafts sent for approval again unchanged.
export type ChangeSetKind =
  "edit" | "approval" | "rejection" | "discard" | "resubmission";

// The history field holding a person's values for a column: one field of the person per column.
export const valueField = (fieldId: string) => `value:${fieldId}`;

// The column a history field holds values for, or null for a record's own details.
export function fieldOfValue(field: string): string | null {
  return field.startsWith("value:") ? field.slice("value:".length) : null;
}

// Rows split into groups small enough for one statement each, since PostgreSQL takes at most
// 65,535 values in a statement, and a large paste or its undo records many thousands of changes.
export function inChunks<Row>(rows: readonly Row[], size = 1000): Row[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size),
  );
}

// Records changes as one change set, in the transaction that makes them. The maker is null for
// Fathom itself, such as for seed data. With no changes, nothing is recorded, so there is never an
// empty change set, and the result is null; otherwise it is the change set's identifier.
export async function recordChanges(
  transaction: Pick<Database, "insert">,
  madeBy: string | null,
  made: readonly ChangeRecord[],
  kind: ChangeSetKind = "edit",
): Promise<string | null> {
  if (made.length === 0) return null;
  const changeSetId = randomUUID();
  await transaction
    .insert(changeSets)
    .values({ id: changeSetId, madeBy, kind });
  for (const chunk of inChunks(made)) {
    await transaction.insert(changes).values(
      chunk.map((change) => ({
        ...change,
        draft: change.draft ?? false,
        changeSetId,
      })),
    );
  }
  return changeSetId;
}
