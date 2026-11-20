// SPDX-License-Identifier: Apache-2.0

// The records a change set changed, and putting back the live ones as they were. Part of the data
// access layer.

import {
  fields,
  fieldValues,
  listItems,
  lists,
  people,
  plannedHires,
  savedViews,
} from "@fathom/db";
import type { RecordType as PlanRecordType } from "@fathom/shared";
import { count, eq } from "drizzle-orm";
import { storedTier } from "../access.ts";
import { ConflictError } from "../errors.ts";
import type {
  Change,
  RecordType,
  StoredChange,
  Transaction,
} from "./changes.ts";
import { draftsUse, takenEmployeeIds } from "./drafts.ts";
import { checkLiveList, checkValuesFit, lockFields } from "./fields.ts";
import { lockChoices, placeChoice, refuseIfUsed } from "./lists.ts";
import { fieldOfValue, writeValues } from "./values.ts";

export const changedSince =
  "This has been changed since, so it can no longer be undone";

// The order kinds of record are put back in, so a record comes back before those that belong to it.
// Deletions run in the opposite order.
const kindOrder: readonly RecordType[] = [
  "list",
  "list-item",
  "choice-order",
  "field",
  "person",
  "planned-hire",
  "feature-team",
  "saved-view",
];

export const byKind = (record: Undone) => kindOrder.indexOf(record.recordType);

// The table each kind of record is kept in. A list's choice order is only ever changed live by
// approving, which cannot be undone.
const tables = {
  list: lists,
  "list-item": listItems,
  field: fields,
  person: people,
  "planned-hire": plannedHires,
  "saved-view": savedViews,
} as const;
const tableOf = (record: Undone) =>
  tables[record.recordType as keyof typeof tables];

type Convert = (value: unknown) => unknown;
const text: Convert = (value) => String(value);
const flag: Convert = (value) => value === true;
const textOrNull: Convert = (value) =>
  typeof value === "string" ? value : null;
// A tier the server no longer knows is put back as the most sensitive.
const sensitiveTier: Convert = (value) => storedTier(value);
// Put back as recorded: a hire's temporary number and a size's weight, each a number or none, and a
// view's definition, read back through the view's own checks whenever it is read.
const asStored: Convert = (value) => value;

// The database columns each kind of record has, as the change history names its fields, and how to
// read each column's value from the history. Other fields, such as a record's place in its order or
// a person's values for a column, are put back separately.
const columnsOf: Record<
  Exclude<RecordType, "choice-order" | PlanRecordType>,
  Readonly<Record<string, Convert>>
> = {
  list: {
    name: text,
    description: text,
    visibility: sensitiveTier,
    retired: flag,
  },
  "list-item": {
    listId: text,
    label: text,
    description: text,
    retired: flag,
    meaning: textOrNull,
    weight: asStored,
  },
  field: {
    tableName: text,
    name: text,
    type: text,
    // A web link column has no list, and a choice column no visibility, which are never recorded.
    listId: text,
    visibility: sensitiveTier,
    multiple: flag,
    required: flag,
    onPlannedHires: flag,
  },
  person: {
    preferredName: text,
    employeeId: text,
    positionId: text,
    startDate: textOrNull,
    endDate: textOrNull,
    isManager: flag,
    stateId: textOrNull,
  },
  // Feature teams change only through drafts, so their live rows are never put back here.
  "feature-team": {},
  "planned-hire": {
    requisition: textOrNull,
    temporaryNumber: asStored,
    positionId: text,
    targetDate: textOrNull,
    stateId: text,
    managerId: textOrNull,
    filledBy: textOrNull,
  },
  "saved-view": {
    tableName: text,
    name: text,
    scope: text,
    definition: asStored,
    createdBy: text,
  },
};

export interface Undone {
  recordType: RecordType;
  id: string;
  action: Change["action"];
  // Whether the change was to the record's draft.
  draft: boolean;
  // The values before the change, by field, which undoing puts back.
  old: Map<string, unknown>;
}

// The records a change set changed, in the order first changed, each with its old values.
export function recordsOf(rows: readonly StoredChange[]): Undone[] {
  const records = new Map<string, Undone>();
  for (const row of rows) {
    const key = `${row.recordType} ${row.recordId} ${String(row.draft)}`;
    const record = records.get(key) ?? {
      recordType: row.recordType as RecordType,
      id: row.recordId,
      action: row.action as Change["action"],
      draft: row.draft,
      old: new Map<string, unknown>(),
    };
    record.old.set(row.field, row.oldValue);
    records.set(key, record);
  }
  return [...records.values()];
}

// The record's database columns as they were before the change.
function columnValues(record: Undone): Record<string, unknown> {
  // Changes to the plan's records, and the planning settings' live ones, are refused before any is
  // put back.
  const columns = columnsOf[record.recordType as keyof typeof columnsOf];
  return Object.fromEntries(
    [...record.old].flatMap(([field, value]) =>
      Object.hasOwn(columns, field)
        ? // The field is one of the record's own columns, checked just above.
          // eslint-disable-next-line security/detect-object-injection
          [[field, (columns[field] as Convert)(value)]]
        : [],
    ),
  );
}

// Checks that putting back a record's old settings still holds with the data as it is now: an ID
// must be one no other person or hire has taken since, a list can be retired only while no column
// draws on it, and a column's settings must fit its values.
async function checkFits(
  transaction: Transaction,
  record: Undone,
  values: Record<string, unknown>,
): Promise<void> {
  const putBackId = values.employeeId ?? values.requisition;
  if (
    typeof putBackId === "string" &&
    (await takenEmployeeIds(transaction, [putBackId], [record.id])).length > 0
  ) {
    throw new ConflictError(changedSince);
  }
  if (record.recordType === "list" && values.retired === true) {
    await refuseIfUsed(transaction, record.id, "retired");
  }
  if (record.recordType === "field") {
    for (const current of await lockFields(transaction)) {
      if (current.id === record.id) {
        const wanted = { ...current, ...values };
        await checkValuesFit(transaction, current, wanted);
        if (wanted.listId !== null && wanted.listId !== current.listId) {
          await checkLiveList(transaction, wanted.listId);
        }
      }
    }
  }
}

// Where to put back a choice or column: after the record it followed, at the top, or at the end if
// the one it followed is gone.
function placeFor(
  after: unknown,
  others: readonly { id: string }[],
): { after: string | null } | "end" {
  if (after === null) return { after: null };
  return typeof after === "string" && others.some((row) => row.id === after)
    ? { after }
    : "end";
}

// Puts back a choice's place and a person's values for each column.
async function putBackPlaceAndValues(
  transaction: Transaction,
  record: Undone,
): Promise<void> {
  const { id, old } = record;
  if (old.has("order") && record.recordType === "list-item") {
    const choices = await transaction
      .select({ listId: listItems.listId })
      .from(listItems)
      .where(eq(listItems.id, id));
    for (const { listId } of choices) {
      await placeChoice(
        transaction,
        listId,
        id,
        placeFor(old.get("order"), await lockChoices(transaction, listId)),
      );
    }
  }
  for (const [field, value] of old) {
    const fieldId = fieldOfValue(field);
    if (fieldId !== null) {
      // Only people's values change live outside approving; a hire's change only in its draft.
      await writeValues(transaction, id, fieldId, value, "person");
    }
  }
}

// Makes a deleted record again, with the same identifier.
export async function recreate(
  transaction: Transaction,
  record: Undone,
): Promise<void> {
  const row: Record<string, unknown> = {
    ...columnValues(record),
    id: record.id,
  };
  // A person or hire whose history was recorded before Position was built in has none to put back.
  if (
    (record.recordType === "person" || record.recordType === "planned-hire") &&
    row.positionId === undefined
  ) {
    throw new ConflictError(changedSince);
  }
  await checkFits(transaction, record, row);
  // Each table takes the columns read for its own kind of record.
  await transaction
    .insert(tableOf(record))
    .values(row as typeof people.$inferInsert);
  await putBackPlaceAndValues(transaction, record);
}

// Puts back the old values of a record that was changed.
export async function restore(
  transaction: Transaction,
  record: Undone,
): Promise<void> {
  const set = columnValues(record);
  await checkFits(transaction, record, set);
  if (Object.keys(set).length > 0) {
    const table = tableOf(record);
    await transaction.update(table).set(set).where(eq(table.id, record.id));
  }
  await putBackPlaceAndValues(transaction, record);
}

// Refuses to delete a list or column that something added since belongs to: a choice in the list,
// or a value in the column. The database refuses for choices and people.
async function refuseIfHeld(
  transaction: Transaction,
  record: Undone,
): Promise<void> {
  // Drafts hold choices and values without the database knowing.
  if (
    (record.recordType === "field" &&
      (await draftsUse(transaction, { column: record.id }))) ||
    (record.recordType === "list-item" &&
      (await draftsUse(transaction, { choice: record.id })))
  ) {
    throw new ConflictError(changedSince);
  }
  const holders = {
    list: () =>
      transaction
        .select({ total: count() })
        .from(listItems)
        .where(eq(listItems.listId, record.id)),
    field: () =>
      transaction
        .select({ total: count() })
        .from(fieldValues)
        .where(eq(fieldValues.fieldId, record.id)),
  };
  if (record.recordType === "list" || record.recordType === "field") {
    const [held] = await holders[record.recordType]();
    if (Number(held?.total) > 0) throw new ConflictError(changedSince);
  }
}

// Deletes a record the change set created.
export async function remove(
  transaction: Transaction,
  record: Undone,
): Promise<void> {
  await refuseIfHeld(transaction, record);
  const table = tableOf(record);
  await transaction.delete(table).where(eq(table.id, record.id));
}

// The changes undoing makes: each change reversed, in the opposite order.
export function reversed(rows: readonly StoredChange[]): Change[] {
  const opposite = new Map<string, Change["action"]>([
    ["created", "deleted"],
    ["deleted", "created"],
  ]);
  return [...rows].reverse().map((row) => ({
    recordType: row.recordType as RecordType,
    recordId: row.recordId,
    action: opposite.get(row.action) ?? "changed",
    field: row.field,
    tier: storedTier(row.tier),
    oldValue: row.newValue,
    newValue: row.oldValue,
    draft: row.draft,
  }));
}
