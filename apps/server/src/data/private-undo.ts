// SPDX-License-Identifier: Apache-2.0

// Undoing a change to a private page, its columns or rows: putting back what the change set took
// away, taking away what it added, and recording the undo as a new change set. Only the page's maker
// undoes its changes, while their role may make pages. Part of the data access layer.

import {
  changes,
  fields,
  fieldOfValue,
  privatePages,
  privateRows,
  type Reader,
  valueField,
} from "@fathom/db";
import { makesPrivatePages, seesClass } from "@fathom/shared";
import { and, asc, eq, gt, inArray, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { type Actor, storedTier } from "../access.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import {
  type PrivateRecordType,
  privateRecordTypes,
  recordChanges,
  type StoredChange,
  type Transaction,
} from "./changes.ts";
import { deletePageColumnOrder, writePageColumnOrder } from "./column-order.ts";
import { checkLiveLists } from "./fields.ts";
import { lockPageOrder } from "./private-page-changes.ts";
import {
  changedSince,
  checkColumnFits,
  reversed,
  type Undone,
} from "./undo-records.ts";
import {
  type FieldRow,
  insertValues,
  privateTable,
  readColumnsById,
  valueRows,
  writeValues,
} from "./values.ts";

// Whether a change set changed a private page, or anything on one; such a change set changes
// nothing else.
export async function changesPrivatePage(
  reader: Reader,
  changeSetId: string,
): Promise<boolean> {
  const [found] = await reader
    .select({ id: changes.id })
    .from(changes)
    .where(
      and(
        eq(changes.changeSetId, changeSetId),
        inArray(changes.recordType, [...privateRecordTypes]),
      ),
    )
    .limit(1);
  return found !== undefined;
}

// A private page's changes are its maker's alone, so for anyone else, and for its maker once their
// role may no longer make pages, they are not there.
export function requirePrivateUndo(actor: Actor, madeBy: string | null): void {
  if (
    madeBy !== actor.user.id ||
    !actor.permissions.includes(makesPrivatePages)
  ) {
    throw new NotFoundError();
  }
}

const kindOrder: readonly PrivateRecordType[] = [
  "private-page",
  "private-column",
  "private-row",
];

const byKind = (first: Undone, second: Undone) =>
  kindOrder.indexOf(first.recordType as PrivateRecordType) -
  kindOrder.indexOf(second.recordType as PrivateRecordType);

const text = (value: unknown) => String(value);
// A removed page's order of its columns, as its history kept it.
const recordedOrder = z.array(z.string()).catch([]);
const flag = (value: unknown) => value === true;

// A field's value before the change, or as it is now when the change left it alone.
const putBack = <Value>(
  record: Undone,
  field: string,
  now: Value,
  convert: (value: unknown) => Value,
): Value => (record.old.has(field) ? convert(record.old.get(field)) : now);

// Where a page or row put back takes its place: the one it had, unless another has taken it since,
// and then after the others, so no two share one.
async function placeFor(
  transaction: Transaction,
  table: typeof privatePages | typeof privateRows,
  siblings: SQL,
  wanted: number,
): Promise<number> {
  const [place] = await transaction
    .select({
      taken: sql<boolean>`bool_or(${table.position} = ${wanted})`,
      next: sql<number>`coalesce(max(${table.position}), -1) + 1`,
    })
    .from(table)
    .where(siblings);
  return place?.taken === true ? place.next : wanted;
}

// The value rows of a row's values before the change.
const valuesBefore = (record: Undone) =>
  [...record.old].flatMap(([field, value]) => {
    const fieldId = fieldOfValue(field);
    return fieldId === null
      ? []
      : valueRows(record.id, fieldId, value, "private-row");
  });

interface PrivateUndo {
  recreate: (transaction: Transaction, record: Undone) => Promise<void>;
  restore: (transaction: Transaction, record: Undone) => Promise<void>;
  remove: (transaction: Transaction, id: string) => Promise<void>;
}

const undoers: Readonly<Record<PrivateRecordType, PrivateUndo>> = {
  "private-page": {
    recreate: async (transaction, record) => {
      const userId = text(record.old.get("userId"));
      await transaction.insert(privatePages).values({
        id: record.id,
        userId,
        name: text(record.old.get("name")),
        position: await placeFor(
          transaction,
          privatePages,
          eq(privatePages.userId, userId),
          Number(record.old.get("position")),
        ),
        firstFieldId: text(record.old.get("firstFieldId")),
      });
      await writePageColumnOrder(
        transaction,
        record.id,
        recordedOrder.parse(record.old.get("columnOrder")),
      );
    },
    restore: async (transaction, record) => {
      // Locked, and not changed since, so still there.
      const [page] = await transaction
        .select()
        .from(privatePages)
        .where(eq(privatePages.id, record.id));
      const { name, position } = page as typeof privatePages.$inferSelect;
      await transaction
        .update(privatePages)
        .set({
          name: putBack(record, "name", name, text),
          position: putBack(record, "position", position, Number),
        })
        .where(eq(privatePages.id, record.id));
    },
    remove: async (transaction, id) => {
      await transaction.delete(privatePages).where(eq(privatePages.id, id));
      await deletePageColumnOrder(transaction, id);
    },
  },
  "private-column": {
    recreate: async (transaction, record) => {
      const listId = putBack<string | null>(record, "listId", null, text);
      await checkLiveLists(transaction, listId === null ? [] : [listId]);
      await transaction.insert(fields).values({
        id: record.id,
        tableName: privateTable,
        pageId: text(record.old.get("pageId")),
        name: text(record.old.get("name")),
        type: text(record.old.get("type")),
        listId,
        visibility: putBack<string | null>(record, "visibility", null, text),
        multiple: flag(record.old.get("multiple")),
        required: flag(record.old.get("required")),
      });
    },
    restore: async (transaction, record) => {
      // Its page is locked, and it is not changed since, so still there.
      const [column] = await transaction
        .select()
        .from(fields)
        .where(eq(fields.id, record.id));
      const current = column as FieldRow;
      const wanted: FieldRow = {
        ...current,
        name: putBack(record, "name", current.name, text),
        listId: putBack(record, "listId", current.listId, text),
        visibility: putBack(record, "visibility", current.visibility, text),
        multiple: putBack(record, "multiple", current.multiple, flag),
      };
      await checkColumnFits(transaction, current, wanted);
      await transaction
        .update(fields)
        .set({
          name: wanted.name,
          listId: wanted.listId,
          visibility: wanted.visibility,
          multiple: wanted.multiple,
        })
        .where(eq(fields.id, record.id));
    },
    remove: async (transaction, id) => {
      await transaction.delete(fields).where(eq(fields.id, id));
    },
  },
  "private-row": {
    recreate: async (transaction, record) => {
      const pageId = text(record.old.get("pageId"));
      await transaction.insert(privateRows).values({
        id: record.id,
        pageId,
        position: await placeFor(
          transaction,
          privateRows,
          eq(privateRows.pageId, pageId),
          Number(record.old.get("position")),
        ),
      });
      await insertValues(transaction, valuesBefore(record));
    },
    restore: async (transaction, record) => {
      for (const [field, value] of record.old) {
        // A changed row records only its values.
        const fieldId = fieldOfValue(field) as string;
        await writeValues(
          transaction,
          record.id,
          fieldId,
          value,
          "private-row",
        );
      }
    },
    remove: async (transaction, id) => {
      await transaction.delete(privateRows).where(eq(privateRows.id, id));
    },
  },
};

const undoerOf = (record: Undone) =>
  undoers[record.recordType as PrivateRecordType];

const recordedText = sql`coalesce(${changes.newValue}, ${changes.oldValue}) #>> '{}'`;

// The columns whose values the change set changed.
const valueColumnsOf = (rows: readonly StoredChange[]) => [
  ...new Set(rows.flatMap(({ field }) => fieldOfValue(field) ?? [])),
];

// The pages a change set's records are on, as the history recorded them, in the order they are
// locked.
async function pagesOf(
  transaction: Transaction,
  records: readonly Undone[],
): Promise<string[]> {
  const pages = records
    .filter(({ recordType }) => recordType === "private-page")
    .map(({ id }) => id);
  const recorded = await transaction
    .selectDistinct({ pageId: sql<string>`${recordedText}` })
    .from(changes)
    .where(
      and(
        inArray(changes.recordType, ["private-column", "private-row"]),
        eq(changes.field, "pageId"),
        inArray(
          changes.recordId,
          records.map(({ id }) => id),
        ),
      ),
    );
  return [
    ...new Set([...pages, ...recorded.map(({ pageId }) => pageId)]),
  ].sort();
}

// Waits for every change to the pages the undo changes, so one saved at the same moment either
// finishes first, and is then seen as a change since, or waits for the undo. Putting back or taking
// away a page, or its place, waits for the order of the actor's pages first, as moving one does.
async function lockPages(
  transaction: Transaction,
  actor: Actor,
  records: readonly Undone[],
): Promise<void> {
  if (
    records.some(
      ({ recordType, action, old }) =>
        recordType === "private-page" &&
        (action !== "changed" || old.has("position")),
    )
  ) {
    await lockPageOrder(transaction, actor);
  }
  await transaction
    .select({ id: privatePages.id })
    .from(privatePages)
    .where(inArray(privatePages.id, await pagesOf(transaction, records)))
    .orderBy(asc(privatePages.id))
    .for("update");
}

// Refuses an undo once anything it puts back or takes away has changed since: the records it
// changed, the columns whose values it puts back, and what has been added since to a page or a
// column it takes away.
async function refuseChangedSince(
  transaction: Transaction,
  rows: readonly StoredChange[],
  records: readonly Undone[],
): Promise<void> {
  const added = (kind: PrivateRecordType) =>
    records
      .filter(
        ({ recordType, action }) => recordType === kind && action === "created",
      )
      .map(({ id }) => id);
  const [later] = await transaction
    .select({ id: changes.id })
    .from(changes)
    .where(
      and(
        gt(changes.id, Math.max(...rows.map(({ id }) => id))),
        inArray(changes.recordType, [...privateRecordTypes]),
        or(
          inArray(
            changes.recordId,
            records.map(({ id }) => id),
          ),
          and(
            eq(changes.field, "pageId"),
            inArray(recordedText, added("private-page")),
          ),
          inArray(changes.field, added("private-column").map(valueField)),
          and(
            eq(changes.recordType, "private-column"),
            inArray(changes.recordId, valueColumnsOf(rows)),
          ),
        ),
      ),
    )
    .limit(1);
  if (later !== undefined) throw new ConflictError(changedSince);
}

// Undoes a change set that changed private pages, their columns or rows, once the actor may.
export async function undoPrivateChanges(
  transaction: Transaction,
  actor: Actor,
  rows: readonly StoredChange[],
  records: readonly Undone[],
): Promise<string | null> {
  if (
    rows.some(({ tier }) => !seesClass(actor.permissions, storedTier(tier)))
  ) {
    throw new ForbiddenError();
  }
  await lockPages(transaction, actor, records);
  await refuseChangedSince(transaction, rows, records);
  const ascending = [...records].sort(byKind);
  for (const record of ascending.filter(({ action }) => action === "deleted")) {
    await undoerOf(record).recreate(transaction, record);
  }
  for (const record of ascending.filter(({ action }) => action === "changed")) {
    await undoerOf(record).restore(transaction, record);
  }
  for (const record of ascending
    .filter(({ action }) => action === "created")
    .reverse()) {
    await undoerOf(record).remove(transaction, record.id);
  }
  // The columns put back, and those whose values are, as they are now, in classes the actor sees,
  // refused as a change made in an unseen class is.
  const columns = await readColumnsById(transaction, [
    ...records
      .filter(({ recordType }) => recordType === "private-column")
      .map(({ id }) => id),
    ...valueColumnsOf(rows),
  ]);
  if (columns.some(({ tier }) => !seesClass(actor.permissions, tier))) {
    throw new ForbiddenError();
  }
  return recordChanges(transaction, actor, reversed(rows));
}
