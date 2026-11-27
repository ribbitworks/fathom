// SPDX-License-Identifier: Apache-2.0

// Tests for who may read a private page, and the requests that make and change one.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  mayEditPrivatePage,
  mayReadPrivatePage,
  mostColumnsAtOnce,
  privateColumnRequestSchema,
  privatePageLengths,
  privatePageRequestSchema,
} from "./private-pages.ts";

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

const numberColumn = (name: string) => ({
  name,
  type: "number",
  visibility: "general",
});

describe("mayReadPrivatePage", () => {
  const maker = "fictional-maker";
  it.each([
    ["its maker, who may make pages", maker, ["private-pages:make"], true],
    ["its maker, no longer allowed to make pages", maker, [], false],
    [
      "another reader, an Administrator",
      "fictional-other",
      ["private-pages:make", "administration:edit"],
      false,
    ],
  ] as const)("lets %s read it: %s", (_who, id, permissions, expected) => {
    expect(mayReadPrivatePage({ id, permissions }, { userId: maker })).toBe(
      expected,
    );
    expect(mayEditPrivatePage({ id, permissions }, { userId: maker })).toBe(
      expected,
    );
  });
});

describe("privateColumnRequestSchema", () => {
  it("takes a column drawing on a list from Lists", () => {
    const listId = randomUUID();
    expect(
      privateColumnRequestSchema.parse({ name: "Mood", listId }),
    ).toMatchObject({ name: "Mood", type: "choice", listId });
  });

  it("refuses a new list made with the column", () => {
    expect(
      messages(
        privateColumnRequestSchema.safeParse({
          name: "Mood",
          newList: { name: "Moods", choices: [{ label: "Calm" }] },
        }),
      ),
    ).toEqual(["Choose a list from Lists"]);
  });
});

describe("privatePageRequestSchema", () => {
  it("takes a name and columns, the first naming each row", () => {
    expect(
      privatePageRequestSchema.parse({
        name: " Reading list ",
        columns: [numberColumn("Number"), numberColumn("Pages")],
      }),
    ).toMatchObject({
      name: "Reading list",
      columns: [{ name: "Number" }, { name: "Pages" }],
    });
  });

  it.each([
    ["no name", { name: " ", columns: [numberColumn("Number")] }],
    [
      "a name too long",
      {
        name: "x".repeat(privatePageLengths.name + 1),
        columns: [numberColumn("Number")],
      },
    ],
    [
      "too many columns",
      {
        name: "Wide",
        columns: Array.from({ length: mostColumnsAtOnce + 1 }, (_, index) =>
          numberColumn(`Column ${String(index)}`),
        ),
      },
    ],
  ])("refuses %s", (_case, request) => {
    expect(privatePageRequestSchema.safeParse(request).success).toBe(false);
  });

  it("refuses a page with no columns", () => {
    expect(
      messages(
        privatePageRequestSchema.safeParse({ name: "Empty", columns: [] }),
      ),
    ).toEqual(["Add a column to name each row"]);
  });

  it("takes a text column first, to name each row", () => {
    expect(
      privatePageRequestSchema.safeParse({
        name: "Reading list",
        columns: [{ name: "Title", type: "text", visibility: "general" }],
      }).success,
    ).toBe(true);
  });

  it("takes a date column first, to name each row", () => {
    expect(
      privatePageRequestSchema.safeParse({
        name: "Tide log",
        columns: [{ name: "Day", type: "date", visibility: "general" }],
      }).success,
    ).toBe(true);
  });

  it("refuses a first column of a type that cannot name a row", () => {
    expect(
      messages(
        privatePageRequestSchema.safeParse({
          name: "Notes",
          columns: [{ name: "Note", type: "note", visibility: "general" }],
        }),
      ),
    ).toEqual(["The first column names each row, so choose another type"]);
  });

  it("refuses requiring a column after the first", () => {
    expect(
      messages(
        privatePageRequestSchema.safeParse({
          name: "Strict",
          columns: [
            numberColumn("Count"),
            { ...numberColumn("Pages"), required: true },
          ],
        }),
      ),
    ).toEqual(["Only the first column is required"]);
  });

  it("refuses two columns of one name, ignoring letter case", () => {
    expect(
      messages(
        privatePageRequestSchema.safeParse({
          name: "Twins",
          columns: [numberColumn("Count"), numberColumn("count")],
        }),
      ),
    ).toEqual(["Give each column its own name"]);
  });
});
