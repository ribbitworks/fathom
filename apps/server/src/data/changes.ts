// SPDX-License-Identifier: Apache-2.0

// Records the change history: every change to Fathom's data, with its old and new values, grouped
// into the change sets saved together. Part of the data access layer, the only server code that
// queries the database. Changes to people are recorded as changes to their drafts until approved.

import {
  type ChangeSetKind,
  type Database,
  databaseCodes,
  hasDatabaseCode,
  recordChanges as recordChangeSet,
} from "@fathom/db";
import type { Tier } from "@fathom/shared";
import { ConflictError } from "../errors.ts";

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// The kinds of record whose changes are recorded. A person's column values are recorded on the
// person, one field for each column, so the person's history holds all of their details. A table's
// column order is one record, named after its table.
export type RecordType =
  | "list"
  | "list-item"
  | "choice-order"
  | "field"
  | "column-order"
  | "person"
  | "saved-view";

export interface Change {
  recordType: RecordType;
  recordId: string;
  action: "created" | "changed" | "deleted";
  field: string;
  tier: Tier;
  // Null when the field had no value, as before a record is created or after it is deleted.
  oldValue: unknown;
  newValue: unknown;
  // Whether the change is to the record's draft rather than to the live record.
  draft?: boolean;
}

// What a change returns, and the change set it was saved in, which undoing it names; null when
// nothing changed.
export interface Saved<Result> {
  result: Result;
  changeSetId: string | null;
}

// Values as stored in the history, so lists of choices compare by what they hold.
function sameValue(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

// The changes between two versions of a record, one for each field that differs. A missing version
// is the record before it was created or after it was deleted. Each field is General unless the
// record's tiers say otherwise.
export function changesBetween<Fields extends Record<string, unknown>>(
  recordType: RecordType,
  id: string,
  action: Change["action"],
  before: Fields | undefined,
  after: Fields | undefined,
  fields: readonly (keyof Fields & string)[],
  tierOf: (field: string) => Tier = () => "general",
): Change[] {
  return fields.flatMap((field) => {
    // The field is always one of the fixed fields its caller names.
    /* eslint-disable security/detect-object-injection */
    const oldValue = before?.[field] ?? null;
    const newValue = after?.[field] ?? null;
    /* eslint-enable security/detect-object-injection */
    return sameValue(oldValue, newValue)
      ? []
      : [
          {
            recordType,
            recordId: id,
            action,
            field,
            tier: tierOf(field),
            oldValue,
            newValue,
          },
        ];
  });
}

// Whether a change failed because another, saved at the same moment, was in its way, so it can
// simply be tried again.
export function savedAtSameMoment(error: unknown): boolean {
  return [
    databaseCodes.deadlockDetected,
    databaseCodes.serializationFailure,
  ].some((code) => hasDatabaseCode(error, code));
}

// Runs a change, answering a name already taken plainly.
export async function refusingDuplicates<Result>(
  message: string,
  change: () => Promise<Result>,
): Promise<Result> {
  try {
    return await change();
  } catch (error) {
    if (hasDatabaseCode(error, databaseCodes.uniqueViolation)) {
      throw new ConflictError(message);
    }
    throw error;
  }
}

// The kinds of change set that change drafts as their maker intends them, so are unpublished until
// published; approving, rejecting, and resubmitting decide or send published drafts.
const editing: readonly ChangeSetKind[] = ["edit", "discard", "withdrawal"];

// Records changes as one change set, in the transaction that makes them, the way the seed data
// command does too. Changes to drafts are the maker's own, unpublished, until they publish them,
// unless they are to published drafts themselves.
export async function recordChanges(
  transaction: Pick<Database, "insert">,
  madeBy: string | null,
  made: readonly Change[],
  kind: ChangeSetKind = "edit",
  unpublished = editing.includes(kind) &&
    made.some(({ draft }) => draft === true),
): Promise<string | null> {
  return recordChangeSet(transaction, madeBy, made, kind, unpublished);
}
