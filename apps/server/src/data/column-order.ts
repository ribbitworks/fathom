// SPDX-License-Identifier: Apache-2.0

// The order of the People table's columns, built-in and added alike, which is the same for everyone.
// Part of the data access layer. Moving a column is a draft of the whole order, as column-drafts.ts
// sets out, which approving writes here.

import { columnOrders, type Database, fields } from "@fathom/db";
import { asc, eq } from "drizzle-orm";
import type { Transaction } from "./changes.ts";

const table = "people";

// The People table's built-in columns, in the order they start in.
export const builtInColumns = [
  "preferredName",
  "employeeId",
  "startDate",
  "endDate",
] as const;

type Reader = Pick<Database, "select">;

// The stored order, locked for a change when given a transaction that changes it.
async function storedOrder(reader: Reader, lock = false): Promise<string[]> {
  const query = reader
    .select({ keys: columnOrders.keys })
    .from(columnOrders)
    .where(eq(columnOrders.tableName, table));
  const [row] = await (lock ? query.for("update") : query);
  return row?.keys ?? [];
}

// Every current column's key, in order: as stored, skipping deleted columns, then any column the
// stored order does not name yet, built-in columns first.
export async function readColumnOrder(reader: Reader): Promise<string[]> {
  return currentOrder(reader, await storedOrder(reader));
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
  const current = [...builtInColumns, ...added.map(({ id }) => id)];
  return [
    ...stored.filter((key) => current.includes(key)),
    ...current.filter((key) => !stored.includes(key)),
  ];
}

// Saves the order of the People table's columns.
export async function writeColumnOrder(
  transaction: Pick<Database, "insert">,
  keys: readonly string[],
): Promise<void> {
  await transaction
    .insert(columnOrders)
    .values({ tableName: table, keys: [...keys] })
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
    await storedOrder(transaction, true),
  );
  await writeColumnOrder(transaction, [
    ...order.filter((other) => other !== key),
    key,
  ]);
}
