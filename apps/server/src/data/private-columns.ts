// SPDX-License-Identifier: Apache-2.0

// The columns of a person's own pages, as columns on any table: adding them with their page, and
// the changes removing them with it. Part of the data access layer.

import { fields } from "@fathom/db";
import {
  type PrivateColumnRequest,
  seesClass,
  type Tier,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import { type Change, changesBetween, type Transaction } from "./changes.ts";
import { writePageColumnOrder } from "./column-order.ts";
import { columnRow } from "./column-state.ts";
import { checkLiveLists } from "./fields.ts";
import {
  type ColumnInfo,
  type FieldRow,
  privateTable,
  readPageColumns,
} from "./values.ts";

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
  }),
  pageId,
});

// The columns given, read back with their classes, refusing any of a class the actor's role does not
// see.
async function checkedColumns(
  transaction: Transaction,
  actor: Actor,
  pageId: string,
  rows: readonly FieldRow[],
): Promise<ColumnInfo[]> {
  const columns = await readPageColumns(transaction, pageId);
  const added = columns.filter(({ id }) => rows.some((row) => row.id === id));
  if (added.some(({ tier }) => !seesClass(actor.permissions, tier))) {
    throw new ForbiddenError(unseenTier);
  }
  return added;
}

// Adds a new page's columns, in order, and returns the changes to record.
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
  await transaction.insert(fields).values([...rows]);
  const added = await checkedColumns(transaction, actor, pageId, rows);
  await writePageColumnOrder(
    transaction,
    pageId,
    rows.map(({ id }) => id),
  );
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

// The changes removing a page's columns, as removing the page does.
export const columnsRemoved = (columns: readonly ColumnInfo[]): Change[] =>
  columns.flatMap((column) =>
    columnChanges(column.id, "deleted", column, undefined, column.tier),
  );
