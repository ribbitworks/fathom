// SPDX-License-Identifier: Apache-2.0

// The columns of a person's own pages, as columns on any table: adding, changing and removing them.
// Part of the data access layer.

import { type Database, fields } from "@fathom/db";
import {
  type PrivateColumnRequest,
  type PrivatePage,
  seesClass,
  type Tier,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type Actor, mostSensitive } from "../access.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.ts";
import {
  type Change,
  changesBetween,
  refusingDuplicates,
  type Saved,
  type Transaction,
} from "./changes.ts";
import { readPageColumnOrder, writePageColumnOrder } from "./column-order.ts";
import { columnRow, duplicateField, noField } from "./column-state.ts";
import { checkLiveLists, checkValuesFit } from "./fields.ts";
import { changingPage } from "./private-page-changes.ts";
import {
  type PageRow,
  pageRows,
  rowValues,
  seenColumns,
} from "./private-page-reads.ts";
import { rowChanges } from "./private-rows.ts";
import {
  type ColumnInfo,
  type FieldRow,
  privateTable,
  readColumnsById,
  readPageColumns,
} from "./values.ts";

const sameType = "A column's type cannot change";
const firstStays = "The first column names each row, so it can't be removed";
const unseenTier =
  "Choose a list, or a visibility, whose details this role can see";

const columnFields = [
  "pageId",
  "name",
  "type",
  "listId",
  "visibility",
  "multiple",
  "required",
] as const;

const columnChanges = (
  id: string,
  action: Change["action"],
  before: FieldRow | undefined,
  after: FieldRow | undefined,
  tier: Tier,
) =>
  changesBetween(
    "private-column",
    id,
    action,
    before,
    after,
    columnFields,
    () => tier,
  );

// A column on a page as a request asks for it, as its row in the database.
const requestedRow = (
  id: string,
  pageId: string,
  request: PrivateColumnRequest,
  required: boolean,
): FieldRow => ({
  ...columnRow(id, {
    tableName: privateTable,
    name: request.name,
    type: request.type,
    listId: request.listId ?? null,
    visibility: request.visibility ?? null,
    multiple: request.multiple,
    required,
    unit: request.unit ?? null,
  }),
  pageId,
});

// The columns given that still exist, read back with their classes as they are now, refusing any
// of a class the actor's role does not see.
export async function checkedColumns(
  transaction: Transaction,
  actor: Actor,
  ids: readonly string[],
): Promise<ColumnInfo[]> {
  const columns = await readColumnsById(transaction, ids);
  if (columns.some(({ tier }) => !seesClass(actor.permissions, tier))) {
    throw new ForbiddenError(unseenTier);
  }
  return columns;
}

// Adds columns to a page, after those it has, and returns the changes to record.
export async function addColumns(
  transaction: Transaction,
  actor: Actor,
  pageId: string,
  rows: readonly FieldRow[],
): Promise<Change[]> {
  await checkLiveLists(
    transaction,
    rows.flatMap(({ listId }) => (listId === null ? [] : [listId])),
  );
  const order = await readPageColumnOrder(
    transaction,
    pageId,
    (await readPageColumns(transaction, pageId)).map(({ id }) => id),
  );
  await transaction.insert(fields).values([...rows]);
  const added = await checkedColumns(
    transaction,
    actor,
    rows.map(({ id }) => id),
  );
  await writePageColumnOrder(transaction, pageId, [
    ...order,
    ...rows.map(({ id }) => id),
  ]);
  return rows.flatMap((row) =>
    columnChanges(
      row.id,
      "created",
      undefined,
      row,
      // Every column added was read back with its class.
      (added.find(({ id }) => id === row.id) as ColumnInfo).tier,
    ),
  );
}

// The columns a request makes, the first required, since it names each row.
export const columnsAsked = (
  pageId: string,
  requests: readonly PrivateColumnRequest[],
): FieldRow[] =>
  requests.map((request, index) =>
    requestedRow(randomUUID(), pageId, request, index === 0),
  );

const savingColumn = (
  database: Database,
  actor: Actor,
  pageId: string,
  change: (transaction: Transaction, page: PageRow) => Promise<Change[]>,
) =>
  refusingDuplicates(duplicateField, () =>
    changingPage(database, actor, pageId, change),
  );

export async function addColumn(
  database: Database,
  actor: Actor,
  pageId: string,
  request: PrivateColumnRequest,
): Promise<Saved<PrivatePage>> {
  return savingColumn(database, actor, pageId, async (transaction, page) =>
    addColumns(transaction, actor, page.id, [
      requestedRow(randomUUID(), page.id, request, false),
    ]),
  );
}

// A column on the page the actor sees; any other is not there. Changes to a page wait on its lock,
// so the column stays as read.
async function seenColumn(
  transaction: Transaction,
  actor: Actor,
  page: PageRow,
  id: string,
): Promise<ColumnInfo> {
  const column = (await seenColumns(transaction, actor, page.id)).find(
    (seen) => seen.id === id,
  );
  if (column === undefined) throw new NotFoundError(noField);
  return column;
}

// Renames a column, or changes its list, its class, or whether it takes several choices, so long as
// the values its rows hold still fit. Its type never changes.
export async function changeColumn(
  database: Database,
  actor: Actor,
  pageId: string,
  id: string,
  request: PrivateColumnRequest,
): Promise<Saved<PrivatePage>> {
  return savingColumn(database, actor, pageId, async (transaction, page) => {
    const before = await seenColumn(transaction, actor, page, id);
    if (request.type !== before.type) throw new BadRequestError(sameType);
    const after = requestedRow(id, page.id, request, before.required);
    if (after.listId !== null && after.listId !== before.listId) {
      await checkLiveLists(transaction, [after.listId]);
    }
    await checkValuesFit(transaction, before, after);
    await transaction
      .update(fields)
      .set({
        name: after.name,
        listId: after.listId,
        visibility: after.visibility,
        multiple: after.multiple,
      })
      .where(eq(fields.id, id));
    const [changed] = await checkedColumns(transaction, actor, [after.id]);
    return columnChanges(
      id,
      "changed",
      before,
      after,
      // The column was read back with its class.
      mostSensitive([before.tier, (changed as ColumnInfo).tier]),
    );
  });
}

// The changes removing a page's columns, as removing the page does.
export const columnsRemoved = (columns: readonly ColumnInfo[]): Change[] =>
  columns.flatMap((column) =>
    columnChanges(column.id, "deleted", column, undefined, column.tier),
  );

// Removes a column and its values, other than the first, which names each row.
export async function removeColumn(
  database: Database,
  actor: Actor,
  pageId: string,
  id: string,
): Promise<Saved<PrivatePage>> {
  return changingPage(database, actor, pageId, async (transaction, page) => {
    const column = await seenColumn(transaction, actor, page, id);
    if (id === page.firstFieldId) throw new ConflictError(firstStays);
    const rows = await pageRows(transaction, page.id);
    const values = await rowValues(
      transaction,
      rows.map((row) => row.id),
      [column],
    );
    await transaction.delete(fields).where(eq(fields.id, id));
    return [
      ...columnsRemoved([column]),
      ...rows.flatMap((row) =>
        rowChanges(row.id, "changed", values.get(row.id), {}, [column]),
      ),
    ];
  });
}
