// SPDX-License-Identifier: Apache-2.0

// Tests for text columns, against a migrated PostgreSQL server: adding them, the texts people and
// private rows hold, the refusals of texts that don't fit, and how the change
// history shows them; with what every type of column shares, for planned hires, features,
// activities, and who sees a Personal or Confidential column.

import type { PrivatePage } from "@fathom/shared";
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

const text: ColumnKind = {
  type: "text",
  map: "texts",
  name: "Fictional Desk",
  value: "North 4-12",
  changed: "Remote",
  inHistory: "North 4-12",
  changedInHistory: "Remote",
  noneInHistory: null,
  stored: { column: "text", value: "North 4-12" },
};

const {
  send,
  editor,
  column: textColumn,
  newPerson,
  addedId,
  approve,
  readPerson,
} = addedColumnTests(() => test, text);

describe("adding text columns", () => {
  it("adds one with a class of its own and no list", async () => {
    const { cookie } = await editor();
    expect(await textColumn(cookie, { visibility: "personal" })).toMatchObject({
      type: "text",
      listId: null,
      visibility: "personal",
      multiple: false,
    });
  });
});

describe("people's texts", () => {
  it("keep a text trimmed, and record nothing when it's sent again with spaces around it", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await textColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: "  North 4-12 " });
    await approve({ people: [id] });
    expect((await readPerson(cookie, id))?.texts).toEqual({
      [fieldId]: "North 4-12",
    });
    const saved = await send(cookie, "PATCH", `/api/people/${id}`, {
      texts: { [fieldId]: " North 4-12 " },
    });
    expect(saved.json()).toEqual({ changeSetId: null });
  });

  it("refuse a text past 200 characters, or of several lines", async () => {
    const { cookie } = await editor();
    const field = await textColumn(cookie);
    const long = await send(
      cookie,
      "POST",
      "/api/people",
      newPerson({ [field.id]: "x".repeat(201) }),
    );
    expect(long.statusCode).toBe(400);
    expect(errorOf(long)).toBe(`${field.name}: use 200 characters or fewer`);
    const lines = await send(
      cookie,
      "POST",
      "/api/people",
      newPerson({ [field.id]: "North\nwing" }),
    );
    expect(errorOf(lines)).toBe(`${field.name}: use one line`);
  });
});

describe("a private page's text column", () => {
  describeRowNamingColumn(() => test, text);
});

describeColumnValues(() => test, text);
describeClassedColumn(() => test, text, "confidential");
describeClassedColumn(() => test, text, "personal");
