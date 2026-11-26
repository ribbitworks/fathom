// SPDX-License-Identifier: Apache-2.0

// The tables that can have columns added.

import { z } from "zod";

export const columnTables = ["people", "features", "activities"] as const;

export type ColumnTable = (typeof columnTables)[number];

export const columnTableSchema = z.enum(columnTables);

// The table a column is on, by the name its row records; one recorded before columns had tables is
// on People. Any other table, such as a private page's, is refused rather than taken for People,
// whose rules would then reach it.
export function columnTableOf(tableName: unknown): ColumnTable {
  if (tableName === null || tableName === undefined) return "people";
  const table = columnTables.find((known) => known === tableName);
  if (table === undefined) {
    throw new Error("A column is on a table that takes no added columns");
  }
  return table;
}
