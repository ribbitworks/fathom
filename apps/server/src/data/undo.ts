// SPDX-License-Identifier: Apache-2.0

// Undoing a change set: one transaction that puts back the old values of everything it changed,
// recorded as a new change set, so the history is never rewritten. Part of the data access layer.
// Only the user who made a change can undo it, with the permissions it needs now, and only while
// nothing it changed has been changed again since. Records it deleted come back with the same
// identifiers, in the places they were in, and with the values they held.

import {
  changes,
  changeSets,
  columnOrders,
  type Database,
  databaseCodes,
  fields,
  fieldValues,
  hasDatabaseCode,
  listItems,
  lists,
  people,
  savedViews,
} from "@fathom/db";
import { type Tier, tierSchema } from "@fathom/shared";
import { and, asc, count, eq, gt, inArray, or, sql } from "drizzle-orm";
import {
  type Actor,
  requirePermission,
  requireTierEdit,
  seesTier,
} from "../access.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import {
  type Change,
  type RecordType,
  recordChanges,
  type Transaction,
} from "./changes.ts";
import { writeColumnOrder } from "./column-order.ts";
import { checkValuesFit, lockFields } from "./fields.ts";
import { lockChoices, placeChoice, refuseIfUsed } from "./lists.ts";
import {
  peopleFitColumns,
  personTier,
  recordSensitiveChanges,
} from "./people.ts";
import { fieldOfValue, readColumns, writeValues } from "./values.ts";
import { requireViewUndo, viewTierNow } from "./views.ts";

const changedSince =
  "This has been changed since, so it can no longer be undone";

// The permission each kind of record needs to change it.
const editPermission = {
  list: "configuration:edit",
  "list-item": "configuration:edit",
  field: "configuration:edit",
  "column-order": "configuration:edit",
  person: "people:edit",
  // Who may change each view is checked for the view itself.
  "saved-view": "people:view",
} as const;

// The order kinds of record are put back in, so a record comes back before those that belong to it.
// Deletions run in the opposite order.
const kindOrder: readonly RecordType[] = [
  "list",
  "list-item",
  "field",
  "column-order",
  "person",
  "saved-view",
];

// The table each kind of record is kept in. A column order is only ever changed, never created or
// deleted, and is put back as a whole, so it has no columns to set here.
const tables = {
  list: lists,
  "list-item": listItems,
  field: fields,
  person: people,
  "saved-view": savedViews,
} as const;
const tableOf = (record: Undone) =>
  tables[record.recordType as keyof typeof tables];

type Convert = (value: unknown) => unknown;
const text: Convert = (value) => String(value);
const flag: Convert = (value) => value === true;
const day: Convert = (value) => (typeof value === "string" ? value : null);
const tier: Convert = (value) => tierSchema.catch("general").parse(value);
// Read back through the view's own checks whenever it is read.
const asStored: Convert = (value) => value;

// The database columns each kind of record has, as the change history names its fields, and how to
// read each column's value from the history. Other fields, such as a record's place in its order or
// a person's values for a column, are put back separately.
const columnsOf: Record<
  Exclude<RecordType, "column-order">,
  Readonly<Record<string, Convert>>
> = {
  list: { name: text, description: text, visibility: tier, retired: flag },
  "list-item": { listId: text, label: text, description: text, retired: flag },
  field: {
    tableName: text,
    name: text,
    listId: text,
    multiple: flag,
    required: flag,
  },
  person: {
    preferredName: text,
    employeeId: text,
    startDate: day,
    endDate: day,
  },
  "saved-view": {
    tableName: text,
    name: text,
    definition: asStored,
    createdBy: text,
  },
};

type StoredChange = typeof changes.$inferSelect;

interface Undone {
  recordType: RecordType;
  id: string;
  action: Change["action"];
  // The values before the change, by field, which undoing puts back.
  old: Map<string, unknown>;
}

// The records a change set changed, in the order first changed, each with its old values.
function recordsOf(rows: readonly StoredChange[]): Undone[] {
  const records = new Map<string, Undone>();
  for (const row of rows) {
    const key = `${row.recordType} ${row.recordId}`;
    const record = records.get(key) ?? {
      recordType: row.recordType as RecordType,
      id: row.recordId,
      action: row.action as Change["action"],
      old: new Map<string, unknown>(),
    };
    record.old.set(row.field, row.oldValue);
    records.set(key, record);
  }
  return [...records.values()];
}

// The record's database columns as they were before the change.
function columnValues(record: Undone): Record<string, unknown> {
  if (record.recordType === "column-order") return {};
  const columns = columnsOf[record.recordType];
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

// Checks that putting back a record's old settings still holds with the data as it is now: a list
// can be retired only while no column draws on it, and a column's settings must fit its values.
async function checkFits(
  transaction: Transaction,
  record: Undone,
  values: Record<string, unknown>,
): Promise<void> {
  if (record.recordType === "list" && values.retired === true) {
    await refuseIfUsed(transaction, record.id, "retired");
  }
  if (record.recordType === "field") {
    for (const current of await lockFields(transaction)) {
      if (current.id === record.id) {
        await checkValuesFit(transaction, current, { ...current, ...values });
      }
    }
  }
}

// A list of identifiers or keys as the history holds it.
const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

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

// Puts back a choice's place, a table's column order, and a person's values for each column.
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
  if (record.recordType === "column-order") {
    await writeColumnOrder(transaction, ids(old.get("order")));
  }
  for (const [field, value] of old) {
    const fieldId = fieldOfValue(field);
    if (fieldId !== null) {
      await writeValues(transaction, id, fieldId, ids(value));
    }
  }
}

// Makes a deleted record again, with the same identifier.
async function recreate(
  transaction: Transaction,
  record: Undone,
): Promise<void> {
  const row = { ...columnValues(record), id: record.id };
  // Each table takes the columns read for its own kind of record.
  await transaction
    .insert(tableOf(record))
    .values(row as typeof people.$inferInsert);
  await putBackPlaceAndValues(transaction, record);
}

// Puts back the old values of a record that was changed.
async function restore(
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
async function remove(transaction: Transaction, record: Undone): Promise<void> {
  await refuseIfHeld(transaction, record);
  const table = tableOf(record);
  await transaction.delete(table).where(eq(table.id, record.id));
}

// The changes undoing makes: each change reversed, in the opposite order.
function reversed(rows: readonly StoredChange[]): Change[] {
  const opposite = new Map<string, Change["action"]>([
    ["created", "deleted"],
    ["deleted", "created"],
  ]);
  return [...rows].reverse().map((row) => ({
    recordType: row.recordType as RecordType,
    recordId: row.recordId,
    action: opposite.get(row.action) ?? "changed",
    field: row.field,
    tier: tierSchema.catch("confidential").parse(row.tier),
    oldValue: row.newValue,
    newValue: row.oldValue,
  }));
}

const byKind = (record: Undone) => kindOrder.indexOf(record.recordType);

const tierRank: readonly Tier[] = ["general", "restricted", "confidential"];

// The more sensitive of two tiers.
const higher = (first: Tier, second: Tier): Tier =>
  tierRank.indexOf(first) >= tierRank.indexOf(second) ? first : second;

// The identifiers of the records of one kind.
const idsOf = (records: readonly Undone[], kind: RecordType) =>
  records.filter((record) => record.recordType === kind).map(({ id }) => id);

// Locks every record the undo changes that still exists, in the order other changes lock them:
// lists, then their choices, then columns, then the column order, then people, then saved views. A
// change saved at the same moment either finishes first, and is then seen as a change since, or
// waits for the undo.
async function lockRecords(
  transaction: Transaction,
  records: readonly Undone[],
): Promise<void> {
  const choiceIds = idsOf(records, "list-item");
  const choiceLists = await transaction
    .select({ listId: listItems.listId })
    .from(listItems)
    .where(inArray(listItems.id, choiceIds));
  const listIds = [
    ...idsOf(records, "list"),
    ...choiceLists.map(({ listId }) => listId),
    // A deleted choice's list, which the undo puts it back in.
    ...records.flatMap((record) => {
      const listId = record.old.get("listId");
      return record.recordType === "list-item" && typeof listId === "string"
        ? [listId]
        : [];
    }),
  ];
  await transaction
    .select({ id: lists.id })
    .from(lists)
    .where(inArray(lists.id, [...new Set(listIds)]))
    .orderBy(asc(lists.id))
    .for("update");
  await transaction
    .select({ id: listItems.id })
    .from(listItems)
    .where(inArray(listItems.id, choiceIds))
    .orderBy(asc(listItems.id))
    .for("update");
  await lockFields(transaction);
  if (idsOf(records, "column-order").length > 0) {
    await transaction
      .select({ tableName: columnOrders.tableName })
      .from(columnOrders)
      .for("update");
  }
  await transaction
    .select({ id: people.id })
    .from(people)
    .where(inArray(people.id, idsOf(records, "person")))
    .orderBy(asc(people.id))
    .for("update");
  await transaction
    .select({ id: savedViews.id })
    .from(savedViews)
    .where(inArray(savedViews.id, idsOf(records, "saved-view")))
    .orderBy(asc(savedViews.id))
    .for("update");
}

async function undoIn(
  transaction: Transaction,
  actor: Actor,
  changeSetId: string,
): Promise<string | null> {
  const [changeSet] = await transaction
    .select()
    .from(changeSets)
    .where(eq(changeSets.id, changeSetId));
  if (changeSet === undefined) throw new NotFoundError();
  if (changeSet.madeBy !== actor.user.id) {
    throw new ForbiddenError("Only the person who made a change can undo it");
  }
  // Undoing the same change twice at once: the second waits, then finds the first's changes since.
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${changeSetId}, 0))`,
  );
  const rows = await transaction
    .select()
    .from(changes)
    .where(eq(changes.changeSetId, changeSetId))
    .orderBy(asc(changes.id));
  const records = recordsOf(rows);
  for (const record of records) {
    requirePermission(actor, editPermission[record.recordType]);
  }
  await lockRecords(transaction, records);
  // A column's values are as sensitive as its list is now, or was when they changed, whichever is
  // more sensitive.
  const tierNow = personTier(await readColumns(transaction));
  // So is a saved view's history, as sensitive as the columns it uses are now.
  const viewTiers = new Map<string, Tier>();
  for (const record of records) {
    if (record.recordType === "saved-view") {
      const held = rows
        .filter(
          (row) => row.recordId === record.id && row.field === "definition",
        )
        .flatMap((row) => [row.oldValue, row.newValue]);
      viewTiers.set(record.id, await viewTierNow(transaction, record.id, held));
    }
  }
  const undoing = reversed(rows).map((change) => {
    if (change.recordType === "person" && fieldOfValue(change.field) !== null) {
      return { ...change, tier: higher(change.tier, tierNow(change.field)) };
    }
    return change.recordType === "saved-view"
      ? {
          ...change,
          // Every view the change set changed has its tier, found just above.
          tier: higher(change.tier, viewTiers.get(change.recordId) as Tier),
        }
      : change;
  });
  // A view's tier is that of the columns it uses, which its maker needs only to see.
  for (const change of undoing) {
    if (change.recordType === "saved-view") {
      if (!seesTier(actor, change.tier)) throw new ForbiddenError();
    } else if (change.tier !== "general") {
      requireTierEdit(actor, change.tier);
    }
  }
  for (const record of records) {
    if (record.recordType === "saved-view") {
      await requireViewUndo(
        transaction,
        actor,
        record.id,
        record.old.get("createdBy"),
      );
    }
  }
  const later = await transaction
    .select({ id: changes.id })
    .from(changes)
    .where(
      and(
        gt(changes.id, Math.max(...rows.map(({ id }) => id))),
        or(
          ...records.map((record) =>
            and(
              eq(changes.recordType, record.recordType),
              eq(changes.recordId, record.id),
            ),
          ),
        ),
      ),
    )
    .limit(1);
  if (later.length > 0) throw new ConflictError(changedSince);

  const ascending = [...records].sort((a, b) => byKind(a) - byKind(b));
  for (const record of ascending.filter(({ action }) => action === "deleted")) {
    await recreate(transaction, record);
  }
  for (const record of ascending.filter(({ action }) => action === "changed")) {
    await restore(transaction, record);
  }
  const created = ascending.filter(({ action }) => action === "created");
  // People added together, such as pasted rows, are removed in one statement.
  const addedPeople = idsOf(created, "person");
  await transaction.delete(people).where(inArray(people.id, addedPeople));
  for (const record of created
    .filter((record) => record.recordType !== "person")
    .reverse()) {
    await remove(transaction, record);
  }
  // The people put back must still fit their columns as they are now.
  const restored = records.filter(
    (record) => record.recordType === "person" && record.action !== "created",
  );
  if (
    !(await peopleFitColumns(
      transaction,
      restored.map(({ id }) => id),
    ))
  ) {
    throw new ConflictError(changedSince);
  }
  await recordSensitiveChanges(transaction, actor.user.id, undoing);
  return recordChanges(transaction, actor.user.id, undoing);
}

// Undoes a change set the actor made, and returns the change set that undid it.
export async function undoChangeSet(
  database: Database,
  actor: Actor,
  changeSetId: string,
): Promise<string | null> {
  try {
    return await database.transaction((transaction) =>
      undoIn(transaction, actor, changeSetId),
    );
  } catch (error) {
    // Something the undo would put back conflicts with a change made since, such as a name now taken
    // or a choice now deleted.
    if (
      [
        databaseCodes.uniqueViolation,
        databaseCodes.foreignKeyViolation,
        databaseCodes.restrictViolation,
        databaseCodes.checkViolation,
      ].some((code) => hasDatabaseCode(error, code))
    ) {
      throw new ConflictError(changedSince);
    }
    throw error;
  }
}
