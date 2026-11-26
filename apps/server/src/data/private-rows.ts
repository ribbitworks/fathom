// SPDX-License-Identifier: Apache-2.0

// The rows of a person's own pages: adding one, changing its values, and removing it. Part of the
// data access layer.

import { type Database, privateRows } from "@fathom/db";
import {
  type PrivatePage,
  type PrivateRowRequest,
  seesClass,
} from "@fathom/shared";
import { and, eq, max } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Actor } from "../access.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors.ts";
import {
  type Change,
  changesBetween,
  type Saved,
  type Transaction,
} from "./changes.ts";
import type { Recorded } from "./draft-records.ts";
import { askedColumnValues } from "./person-fields.ts";
import { makeRandomKey } from "./private-keys.ts";
import { changingPage } from "./private-page-changes.ts";
import { type PageRow, rowValues, type RowRow } from "./private-page-reads.ts";
import {
  type ColumnInfo,
  fieldOfValue,
  inListOrder,
  insertValues,
  readPageColumns,
  valueField,
  valueFieldsIn,
  valueRows,
  writeValues,
} from "./values.ts";

const noRow = "There is no such row";
const noColumn = "There is no such column";
const hiddenFirst =
  "This page's first column is of a class your role can't see, so no row can be added";

// A row as the change history records it: its page, its place, and its values.
const rowVersion = (
  row: Pick<RowRow, "pageId" | "position">,
  values: Recorded,
): Recorded => ({
  pageId: row.pageId,
  position: row.position,
  ...values,
});

// The changes between two versions of a row, each value with its column's class.
export function rowChanges(
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
  columns: readonly ColumnInfo[],
): Change[] {
  return changesBetween(
    "private-row",
    id,
    action,
    before,
    after,
    ["pageId", "position", ...valueFieldsIn(before, after)],
    (field) =>
      columns.find(({ id: columnId }) => valueField(columnId) === field)
        ?.tier ?? "general",
  );
}

// The changes removing rows and their values, as removing them, or their page, does.
export async function rowsRemoved(
  transaction: Transaction,
  rows: readonly RowRow[],
  columns: readonly ColumnInfo[],
): Promise<Change[]> {
  const values = await rowValues(
    transaction,
    rows.map(({ id }) => id),
    columns,
  );
  return rows.flatMap((row) =>
    rowChanges(
      row.id,
      "deleted",
      // Every row read has its values, if none.
      rowVersion(row, values.get(row.id) as Recorded),
      undefined,
      columns,
    ),
  );
}

// Refuses values asked for in a column the actor does not see, as if it were not there.
function refuseUnseen(
  seen: readonly ColumnInfo[],
  request: PrivateRowRequest,
): void {
  const named = [
    request.values,
    request.links,
    request.notes,
    request.numbers,
  ].flatMap((byColumn) => Object.keys(byColumn ?? {}));
  if (named.some((id) => !seen.some((column) => column.id === id))) {
    throw new BadRequestError(noColumn);
  }
}

// A row's values once a request changes them, checked against the page's columns: every column,
// so a row always keeps its first column's value, though only those the actor sees may change.
async function askedValues(
  transaction: Transaction,
  actor: Actor,
  columns: readonly ColumnInfo[],
  request: PrivateRowRequest,
  current: Recorded | undefined,
): Promise<Recorded> {
  refuseUnseen(
    columns.filter(({ tier }) => seesClass(actor.permissions, tier)),
    request,
  );
  const known = await inListOrder(
    transaction,
    Object.values(request.values ?? {}).flat(),
  );
  return askedColumnValues(columns, known, request, current);
}

// Refuses a new row to a maker whose role can't see the first column, which every row needs a
// value in, without naming the column.
function refuseHiddenFirst(
  actor: Actor,
  page: PageRow,
  columns: readonly ColumnInfo[],
): void {
  // Every page has its first column.
  const first = columns.find(
    ({ id }) => id === page.firstFieldId,
  ) as ColumnInfo;
  if (!seesClass(actor.permissions, first.tier)) {
    throw new ForbiddenError(hiddenFirst);
  }
}

export async function addRow(
  database: Database,
  actor: Actor,
  pageId: string,
  request: PrivateRowRequest,
): Promise<Saved<PrivatePage>> {
  return changingPage(database, actor, pageId, async (transaction, page) => {
    const columns = await readPageColumns(transaction, page.id);
    refuseHiddenFirst(actor, page, columns);
    const values = await askedValues(
      transaction,
      actor,
      columns,
      request,
      undefined,
    );
    const [last] = await transaction
      .select({ position: max(privateRows.position) })
      .from(privateRows)
      .where(eq(privateRows.pageId, page.id));
    const row = {
      id: randomUUID(),
      pageId: page.id,
      position: (last?.position ?? -1) + 1,
    };
    await transaction.insert(privateRows).values(row);
    await makeRandomKey(transaction, "row", row.id);
    const made = rowChanges(
      row.id,
      "created",
      undefined,
      rowVersion(row, values),
      columns,
    );
    await insertValues(
      transaction,
      made.flatMap(({ field, newValue }) => {
        const fieldId = fieldOfValue(field);
        return fieldId === null
          ? []
          : valueRows(row.id, fieldId, newValue, "private-row");
      }),
    );
    return made;
  });
}

// The row, locked for a change, on the page given; any other row is not there.
async function lockRow(
  transaction: Transaction,
  page: PageRow,
  id: string,
): Promise<RowRow> {
  const [row] = await transaction
    .select()
    .from(privateRows)
    .where(and(eq(privateRows.id, id), eq(privateRows.pageId, page.id)))
    .for("update");
  if (row === undefined) throw new NotFoundError(noRow);
  return row;
}

// Changes a row's values: each column named is replaced, and null removes its value.
export async function changeRow(
  database: Database,
  actor: Actor,
  pageId: string,
  id: string,
  request: PrivateRowRequest,
): Promise<Saved<PrivatePage>> {
  return changingPage(database, actor, pageId, async (transaction, page) => {
    const row = await lockRow(transaction, page, id);
    const columns = await readPageColumns(transaction, page.id);
    const current = (await rowValues(transaction, [id], columns)).get(id);
    const values = await askedValues(
      transaction,
      actor,
      columns,
      request,
      current,
    );
    const made = rowChanges(
      id,
      "changed",
      rowVersion(row, current as Recorded),
      rowVersion(row, values),
      columns,
    );
    for (const { field, newValue } of made) {
      // Only values change here, never the row's page or place.
      const fieldId = fieldOfValue(field) as string;
      await writeValues(transaction, id, fieldId, newValue, "private-row");
    }
    return made;
  });
}

export async function removeRow(
  database: Database,
  actor: Actor,
  pageId: string,
  id: string,
): Promise<Saved<PrivatePage>> {
  return changingPage(database, actor, pageId, async (transaction, page) => {
    const row = await lockRow(transaction, page, id);
    const made = await rowsRemoved(
      transaction,
      [row],
      await readPageColumns(transaction, page.id),
    );
    await transaction.delete(privateRows).where(eq(privateRows.id, id));
    return made;
  });
}
