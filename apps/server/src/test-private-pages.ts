// SPDX-License-Identifier: Apache-2.0

// What the tests of private pages share: storing a page, its columns, rows and values straight in
// the database, and making, reading, changing and undoing them through the server.

import {
  type Database,
  fields,
  fieldValues,
  privatePages,
  privateRows,
} from "@fathom/db";
import type { PrivatePage } from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { ok, type TestApp, type TestUser, unique } from "./test-app.ts";

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

export interface SavedPage {
  page: PrivatePage;
  changeSetId: string | null;
}

export const numberColumn = (name: string, visibility = "general") => ({
  name,
  type: "number",
  visibility,
});

export const pageUrl = (page: { id: string }) =>
  `/api/private-pages/${page.id}`;

// Making, reading, changing and undoing pages through the server, as a user, against the test app
// the getter gives once it has started.
export function privatePageHelpers(app: () => TestApp) {
  // Sends a request as a user, expecting the status given, and returns its body.
  const sent = async <Body>(
    as: TestUser,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    url: string,
    payload?: object,
    status = 200,
  ) => ok<Body>(await app().request(as.cookie, method, url, payload), status);

  const makePage = (
    as: TestUser,
    columns: object[] = [numberColumn("Number"), numberColumn("Pages")],
  ) =>
    sent<SavedPage>(
      as,
      "POST",
      "/api/private-pages",
      { name: unique("Fictional Page"), columns },
      201,
    );

  const undo = (as: TestUser, changeSetId: string | null) =>
    app().request(as.cookie, "POST", `/api/undo/${String(changeSetId)}`);

  return {
    sent,
    makePage,
    addRow: (as: TestUser, page: PrivatePage, numbers: object) =>
      sent<SavedPage>(as, "POST", `${pageUrl(page)}/rows`, { numbers }, 201),
    undo,
    undone: async (as: TestUser, changeSetId: string | null) => {
      const response = await undo(as, changeSetId);
      expect(response.statusCode, response.body).toBe(200);
    },
    read: (as: TestUser, page: { id: string }) =>
      sent<PrivatePage>(as, "GET", pageUrl(page)),
  };
}
