// SPDX-License-Identifier: Apache-2.0

// The live columns added to tables that offer each list's choices. Part of the data access layer.

import { fields, type Reader } from "@fathom/db";
import { type ColumnTable, columnTables } from "@fathom/shared";
import { inArray } from "drizzle-orm";

export interface AddedUse {
  table: ColumnTable;
  name: string;
}

// Each list's added columns, by the list's identifier.
export async function addedColumnsByList(
  reader: Reader,
): Promise<ReadonlyMap<string, readonly AddedUse[]>> {
  const rows = await reader
    .select({
      listId: fields.listId,
      name: fields.name,
      tableName: fields.tableName,
    })
    .from(fields)
    .where(inArray(fields.tableName, columnTables));
  const byList = new Map<string, AddedUse[]>();
  for (const table of columnTables) {
    for (const { listId, name } of rows.filter(
      ({ tableName }) => tableName === table,
    )) {
      if (listId !== null) {
        byList.set(listId, [...(byList.get(listId) ?? []), { table, name }]);
      }
    }
  }
  return byList;
}
