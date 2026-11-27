// SPDX-License-Identifier: Apache-2.0

// Tests for text columns, against a migrated PostgreSQL server: adding them, on one line or several,
// the texts people and private rows hold, the refusals of texts that don't fit, and how the change
// history shows them; with what every type of column shares, for planned hires, features,
// activities, and who sees a Personal or Confidential column.

import { fieldValues } from "@fathom/db";
import type { PrivatePage } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, ok, startTestApp, type TestApp, unique } from "./test-app.ts";
import {
  addedColumnTests,
  type ColumnKind,
  describeClassedColumn,
  describeColumnValues,
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
  noneInHistory: null,
};

const {
  send,
  editor,
  column: textColumn,
  newPerson,
  addedId,
  approve,
  readPerson,
  historyFields,
} = addedColumnTests(() => test, text);

const textRows = (fieldId: string) =>
  test.connection
    .select({ text: fieldValues.text, note: fieldValues.note })
    .from(fieldValues)
    .where(eq(fieldValues.fieldId, fieldId));

describe("adding text columns", () => {
  it("adds one of one line, or of several lines, with a class of its own and no list", async () => {
    const { cookie } = await editor();
    expect(await textColumn(cookie, { visibility: "personal" })).toMatchObject({
      type: "text",
      listId: null,
      visibility: "personal",
      multiple: false,
    });
    expect(
      (await textColumn(cookie, { visibility: "personal" })).multiline,
    ).toBeUndefined();
    expect((await textColumn(cookie, { multiline: true })).multiline).toBe(
      true,
    );
  });

  it("refuses changing whether it holds several lines", async () => {
    const { cookie } = await editor();
    const field = await textColumn(cookie);
    const response = await send(
      cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      {
        name: field.name,
        type: "text",
        visibility: "general",
        multiline: true,
      },
    );
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      "Several lines can't change once a column is added",
    );
  });
});

describe("people's texts", () => {
  it("keep a text, trimmed, as a row of its own once approved, never as a note", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await textColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: "  North 4-12 " });
    await approve({ people: [id] });
    const person = await readPerson(cookie, id);
    expect(person?.texts).toEqual({ [fieldId]: "North 4-12" });
    expect(person?.notes).toEqual({});
    expect(await textRows(fieldId)).toEqual([
      { text: "North 4-12", note: null },
    ]);
  });

  it("are changed by a draft, showing the live text beside, and removed when emptied", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await textColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: "North 4-12" });
    await approve({ people: [id] });

    await send(cookie, "PATCH", `/api/people/${id}`, {
      texts: { [fieldId]: "South 2-07" },
    });
    const drafted = await readPerson(cookie, id);
    expect(drafted?.texts).toEqual({ [fieldId]: "South 2-07" });
    expect(drafted?.draft?.live.texts).toEqual({ [fieldId]: "North 4-12" });

    await send(cookie, "PATCH", `/api/people/${id}`, {
      texts: { [fieldId]: " " },
    });
    await approve({ people: [id] });
    expect(await textRows(fieldId)).toEqual([]);
  });

  it("refuse a text past 200 characters, or of several lines, in a column of one line", async () => {
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

  it("keep several lines, up to 2,000 characters, in a column of several lines", async () => {
    const { cookie } = await editor();
    const field = await textColumn(cookie, { multiline: true });
    const text = `North wing\r\n${"x".repeat(1900)}`;
    const id = await addedId(cookie, { [field.id]: text });
    expect((await readPerson(cookie, id))?.texts).toEqual({
      [field.id]: `North wing\n${"x".repeat(1900)}`,
    });
    const long = await send(
      cookie,
      "POST",
      "/api/people",
      newPerson({ [field.id]: "x".repeat(2001) }),
    );
    expect(long.statusCode).toBe(400);
  });

  it("are recorded in the change history as written", async () => {
    const { cookie } = await editor();
    const field = await textColumn(cookie);
    const id = await addedId(cookie, { [field.id]: "North 4-12" });
    await approve({ people: [id] });
    await send(cookie, "PATCH", `/api/people/${id}`, {
      texts: { [field.id]: "Remote" },
    });
    await approve({ people: [id] });
    expect(
      (await historyFields(cookie)).filter(
        ({ column }) => column === field.name,
      ),
    ).toContainEqual({
      field: "value",
      column: field.name,
      oldValue: "North 4-12",
      newValue: "Remote",
    });
  });

  it("record nothing when a text is saved as it is", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await textColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: "North 4-12" });
    await approve({ people: [id] });
    const saved = await send(cookie, "PATCH", `/api/people/${id}`, {
      texts: { [fieldId]: " North 4-12 " },
    });
    expect(saved.json()).toEqual({ changeSetId: null });
  });
});

describe("a private page's text column", () => {
  it("names each row, and refuses a row without its text", async () => {
    const maker = await editor();
    const { page } = await ok<{ page: PrivatePage }>(
      await send(maker.cookie, "POST", "/api/private-pages", {
        name: unique("Fictional Reading List"),
        columns: [
          {
            name: "Title",
            type: "text",
            visibility: "general",
            multiline: true,
          },
        ],
      }),
      201,
    );
    expect(page.columns[0]?.multiline).toBe(true);
    const title = String(page.columns[0]?.id);
    const rows = `/api/private-pages/${page.id}/rows`;
    const saved = await ok<{ page: PrivatePage }>(
      await send(maker.cookie, "POST", rows, {
        texts: { [title]: "Tide Tables" },
      }),
      201,
    );
    expect(saved.page.rows[0]?.texts).toEqual({ [title]: "Tide Tables" });
    const empty = await send(maker.cookie, "POST", rows, {
      texts: { [title]: "  " },
    });
    expect(empty.statusCode).toBe(400);
    expect(errorOf(empty)).toBe("Title must be filled in");
  });
});

describeColumnValues(() => test, text);
describeClassedColumn(() => test, text, "confidential");
describeClassedColumn(() => test, text, "personal");
