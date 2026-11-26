// SPDX-License-Identifier: Apache-2.0

// The People table's own order of its columns, built-in and added alike, which each view starts from,
// and each private page's order of its columns. Part of the data access layer. Moving a column
// changes the view, not this order; approving a new column adds it at the end.

import { columnOrders, type Database, fields, type Reader } from "@fathom/db";
import { builtInColumnNames } from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import type { Transaction } from "./changes.ts";

const table = "people";

// The People table's built-in columns, in the order they start in.
export const builtInColumns: readonly string[] = [...builtInColumnNames.keys()];

// A private page's order, kept under a name of its own.
const pageOrder = (pageId: string) => `private:${pageId}`;

// The stored order, locked for a change when given a transaction that changes it.
async function storedOrder(
  reader: Reader,
  name: string,
  lock: boolean,
): Promise<string[]> {
  const query = reader
    .select({ keys: columnOrders.keys })
    .from(columnOrders)
    .where(eq(columnOrders.tableName, name));
  const [row] = await (lock ? query.for("update") : query);
  return row?.keys ?? [];
}

// Every current column's key, in order: as stored, skipping deleted columns, with every built-in
// column, then any added column the stored order does not name yet.
export async function readColumnOrder(reader: Reader): Promise<string[]> {
  return currentOrder(reader, await storedOrder(reader, table, false));
}

async function currentOrder(
  reader: Reader,
  stored: readonly string[],
): Promise<string[]> {
  const added = await reader
    .select({ id: fields.id })
    .from(fields)
    .where(eq(fields.tableName, table))
    .orderBy(asc(fields.id));
  const addedKeys = added.map(({ id }) => id);
  const order = withBuiltIns(
    stored.filter(
      (key) => builtInColumns.includes(key) || addedKeys.includes(key),
    ),
  );
  return [...order, ...addedKeys.filter((key) => !order.includes(key))];
}

// An order with every built-in column: one it does not name, such as one added since it was stored,
// goes just after the built-in column it follows in their starting order.
function withBuiltIns(stored: readonly string[]): string[] {
  const order = [...stored];
  for (const [index, key] of builtInColumns.entries()) {
    if (order.includes(key)) continue;
    const at =
      index === 0 ? -1 : order.indexOf(builtInColumns[index - 1] as string);
    order.splice(at + 1, 0, key);
  }
  return order;
}

// Saves the order of the People table's columns, or a private page's.
async function writeColumnOrder(
  transaction: Pick<Database, "insert">,
  keys: readonly string[],
  name: string,
): Promise<void> {
  await transaction
    .insert(columnOrders)
    .values({ tableName: name, keys: [...keys] })
    .onConflictDoUpdate({
      target: columnOrders.tableName,
      set: { keys: [...keys] },
    });
}

// Puts a new column at the end of the order, without recording it: it is part of adding the column.
export async function appendColumn(
  transaction: Transaction,
  key: string,
): Promise<void> {
  const order = await currentOrder(
    transaction,
    await storedOrder(transaction, table, true),
  );
  await writeColumnOrder(
    transaction,
    [...order.filter((other) => other !== key), key],
    table,
  );
}

// A private page's columns in order: as stored, then any the stored order does not name.
export async function readPageColumnOrder(
  reader: Reader,
  pageId: string,
  columnIds: readonly string[],
): Promise<string[]> {
  const stored = (await storedOrder(reader, pageOrder(pageId), false)).filter(
    (key) => columnIds.includes(key),
  );
  return [...stored, ...columnIds.filter((key) => !stored.includes(key))];
}

export const writePageColumnOrder = (
  transaction: Pick<Database, "insert">,
  pageId: string,
  keys: readonly string[],
) => writeColumnOrder(transaction, keys, pageOrder(pageId));

// Forgets a removed page's order.
export async function deletePageColumnOrder(
  transaction: Pick<Database, "delete">,
  pageId: string,
): Promise<void> {
  await transaction
    .delete(columnOrders)
    .where(eq(columnOrders.tableName, pageOrder(pageId)));
}
