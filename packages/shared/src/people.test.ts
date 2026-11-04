// SPDX-License-Identifier: Apache-2.0

// Tests for the requests that change people and the People table's columns.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fieldRequestSchema, personChangeSchema } from "./people.ts";

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("fieldRequestSchema", () => {
  it("takes a choice column's tier from its list, so drops any visibility sent", () => {
    const listId = randomUUID();
    expect(
      fieldRequestSchema.parse({
        name: " Site ",
        listId,
        visibility: "restricted",
      }),
    ).toEqual({
      name: "Site",
      type: "choice",
      listId,
      visibility: undefined,
      multiple: false,
      required: false,
    });
  });

  it("asks a choice column for a list", () => {
    expect(messages(fieldRequestSchema.safeParse({ name: "Site" }))).toEqual([
      "Choose a list",
    ]);
  });

  it("keeps a web link column's visibility", () => {
    expect(
      fieldRequestSchema.parse({
        name: "Profile",
        type: "link",
        visibility: "general",
      }).visibility,
    ).toBe("general");
  });

  it("refuses a web link column without a visibility, with a list, or with several links", () => {
    expect(
      messages(
        fieldRequestSchema.safeParse({
          name: "Profile",
          type: "link",
          listId: randomUUID(),
          multiple: true,
        }),
      ),
    ).toEqual([
      "Choose a visibility",
      "A web link column has no list",
      "A web link column holds one link",
    ]);
  });
});

describe("personChangeSchema", () => {
  it("takes each choice in a column once", () => {
    const column = randomUUID();
    const choice = randomUUID();
    expect(
      personChangeSchema.safeParse({ values: { [column]: [choice] } }).success,
    ).toBe(true);
    expect(
      messages(
        personChangeSchema.safeParse({
          values: { [column]: [choice, choice] },
        }),
      ),
    ).toEqual(["Each choice once"]);
  });
});
