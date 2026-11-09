// SPDX-License-Identifier: Apache-2.0

// Tests for the requests that change people and the People table's columns.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  fieldRequestSchema,
  personChangeSchema,
  personRequestSchema,
  personSchema,
} from "./people.ts";

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
      onPlannedHires: true,
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

  it("refuses a number column without a visibility, with a list, or with several numbers", () => {
    expect(
      messages(
        fieldRequestSchema.safeParse({
          name: "Score",
          type: "number",
          listId: randomUUID(),
          multiple: true,
        }),
      ),
    ).toEqual([
      "Choose a visibility",
      "A number column has no list",
      "A number column holds one number",
    ]);
  });

  it("keeps a note column's visibility", () => {
    expect(
      fieldRequestSchema.parse({
        name: "Review notes",
        type: "note",
        visibility: "confidential",
      }).visibility,
    ).toBe("confidential");
  });

  it("refuses a note column without a visibility, with a list, or with several notes", () => {
    expect(
      messages(
        fieldRequestSchema.safeParse({
          name: "Review notes",
          type: "note",
          listId: randomUUID(),
          multiple: true,
        }),
      ),
    ).toEqual([
      "Choose a visibility",
      "A note column has no list",
      "A note column holds one note",
    ]);
  });
});

describe("notes", () => {
  it("are asked for by column, with null removing one", () => {
    const column = randomUUID();
    expect(
      personChangeSchema.parse({ notes: { [column]: "*Kind*" } }).notes,
    ).toEqual({ [column]: "*Kind*" });
    expect(
      personChangeSchema.parse({ notes: { [column]: null } }).notes,
    ).toEqual({ [column]: null });
    expect(
      personChangeSchema.safeParse({ notes: { column: "Kind" } }).success,
    ).toBe(false);
  });

  it("may be left out of a person, their draft, and a request to add them", () => {
    const person = personSchema.parse({
      id: "p1",
      preferredName: "Fictional Person",
      employeeId: "E-1",
      values: {},
      draft: {
        action: "changed",
        changed: [],
        live: { values: {} },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
    });
    expect(person.notes).toBeUndefined();
    expect(person.draft?.live.notes).toBeUndefined();
    expect(
      personRequestSchema.parse({
        preferredName: "Fictional Person",
        employeeId: "E-1",
        positionId: randomUUID(),
      }).notes,
    ).toBeUndefined();
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

describe("a team name in a change to a person", () => {
  it("is trimmed, and removed when empty", () => {
    expect(personChangeSchema.parse({ teamName: " Platform " })).toEqual({
      teamName: "Platform",
    });
    expect(personChangeSchema.parse({ teamName: "  " })).toEqual({
      teamName: null,
    });
  });

  it("is at most 60 characters", () => {
    expect(
      personChangeSchema.safeParse({ teamName: "x".repeat(61) }).success,
    ).toBe(false);
  });
});
