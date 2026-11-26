// SPDX-License-Identifier: Apache-2.0

// What the tests of private pages share: storing a page, its columns, rows and values straight in
// the database, as saving one through the server will.

import {
  type Database,
  fields,
  fieldValues,
  privatePages,
  privateRows,
} from "@fathom/db";
import { randomUUID } from "node:crypto";
import { unique } from "./test-app.ts";

export interface StoredColumn {
  name: string;
  type: "number" | "note" | "choice";
  visibility?: "general" | "personal" | "confidential";
  // The list a choice column draws on.
  listId?: string;
}

export const numberAndNote: StoredColumn[] = [
  { name: "Number", type: "number" },
  { name: "Note", type: "note" },
];

// A page stored for its maker, with its columns, the first naming each row, and its rows' values,
// each a column's number or note by the column's name.
export async function storedPage(
  connection: Database,
  makerId: string,
  columns: readonly StoredColumn[],
  rows: readonly Record<string, number | string>[] = [],
  position = 0,
) {
  const pageId = randomUUID();
  const ids = new Map(columns.map(({ name }) => [name, randomUUID()]));
  const rowIds = rows.map(() => randomUUID());
  await connection.transaction(async (transaction) => {
    await transaction.insert(privatePages).values({
      id: pageId,
      userId: makerId,
      name: unique("Fictional Page"),
      position,
      firstFieldId: String(ids.get(columns[0]?.name ?? "")),
    });
    await transaction.insert(fields).values(
      columns.map(({ name, type, visibility = "general", listId }, index) => ({
        id: String(ids.get(name)),
        tableName: "private",
        pageId,
        name,
        type,
        ...(listId === undefined ? { visibility } : { listId }),
        required: index === 0,
      })),
    );
    if (rows.length === 0) return;
    await transaction
      .insert(privateRows)
      .values(rowIds.map((id, index) => ({ id, pageId, position: index })));
    await transaction.insert(fieldValues).values(
      rows.flatMap((values, index) =>
        Object.entries(values).map(([name, value]) => ({
          fieldId: String(ids.get(name)),
          privateRowId: rowIds.at(index),
          ...(typeof value === "number" ? { number: value } : { note: value }),
        })),
      ),
    );
  });
  return { pageId, ids, rowIds };
}
