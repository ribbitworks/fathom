// SPDX-License-Identifier: Apache-2.0

// Tests for date columns, against a migrated PostgreSQL server: adding them, a required one refusing
// none, and a day the database can't hold refused; with what every type of column shares, for
// people, planned hires, features, activities, private pages, undo, the change history, and who
// sees a Personal or Confidential column.

import type { Field, PrivatePage } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, ok, startTestApp, type TestApp, unique } from "./test-app.ts";
import {
  addedColumnTests,
  type ColumnKind,
  describeClassedColumn,
  describeColumnValues,
  describeRowNamingColumn,
} from "./test-added-columns.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

const date: ColumnKind = {
  type: "date",
  map: "days",
  name: "Fictional Last Review",
  value: "2026-03-14",
  changed: "2026-04-01",
  inHistory: "2026-03-14",
  changedInHistory: "2026-04-01",
  noneInHistory: null,
  stored: { column: "date", value: "2026-03-14" },
};

const {
  send,
  editor,
  column: dateColumn,
  newPerson,
  addedId,
} = addedColumnTests(() => test, date);

// First, while there is no one, so a column can be required from the start.
describe("a required date column", () => {
  it("refuses a person without a day, and a day removed", async () => {
    const { cookie } = await editor();
    const { field: required } = await ok<{ field: Field }>(
      await send(cookie, "POST", "/api/people/columns", {
        name: unique(date.name),
        type: "date",
        visibility: "general",
        required: true,
        onPlannedHires: false,
      }),
      201,
    );
    await test.approveLists();
    const missing = await send(cookie, "POST", "/api/people", newPerson());
    expect(errorOf(missing)).toBe(`${required.name} must be filled in`);
    const id = await addedId(cookie, { [required.id]: "2026-03-14" });
    const removed = await send(cookie, "PATCH", `/api/people/${id}`, {
      days: { [required.id]: null },
    });
    expect(errorOf(removed)).toBe(`${required.name} must be filled in`);
    // Removed, so the people the other tests add need no day in it.
    await ok(await send(cookie, "DELETE", `/api/people/${id}/draft`));
    await ok(
      await send(cookie, "DELETE", `/api/people/columns/${required.id}`),
    );
    await test.approveLists();
  });
});

describe("adding date columns", () => {
  it("adds one with a class of its own and no list", async () => {
    const { cookie } = await editor();
    expect(await dateColumn(cookie, { visibility: "personal" })).toMatchObject({
      type: "date",
      listId: null,
      visibility: "personal",
      multiple: false,
    });
  });
});

describe("a day in year 0000, which the database can't hold", () => {
  it("is refused for a person and for a private page's row", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await dateColumn(cookie);
    const person = await send(
      cookie,
      "POST",
      "/api/people",
      newPerson({ [fieldId]: "0000-01-01" }),
    );
    expect(person.statusCode).toBe(400);
    const { page } = await ok<{ page: PrivatePage }>(
      await send(cookie, "POST", "/api/private-pages", {
        name: unique("Fictional Tide Log"),
        columns: [{ name: "Day", type: "date", visibility: "general" }],
      }),
      201,
    );
    const row = await send(
      cookie,
      "POST",
      `/api/private-pages/${page.id}/rows`,
      {
        days: { [String(page.columns[0]?.id)]: "0000-01-01" },
      },
    );
    expect(row.statusCode).toBe(400);
  });
});

describe("a private page's date column", () => {
  describeRowNamingColumn(() => test, date);
});

describeColumnValues(() => test, date);
describeClassedColumn(() => test, date, "confidential");
describeClassedColumn(() => test, date, "personal");
