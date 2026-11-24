// SPDX-License-Identifier: Apache-2.0

// Tests for the requests that change people and the People table's columns.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  columnTableOf,
  editsColumnsOf,
  fieldRequestSchema,
  newListSchema,
  personChangeSchema,
  personRequestSchema,
  personSchema,
} from "./people.ts";
import { listLengths, mostChoicesAtOnce } from "./lists.ts";

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("columnTableOf", () => {
  it("names Features for a column on Features, and People for any other, older ones included", () => {
    expect(columnTableOf("features")).toBe("features");
    expect(columnTableOf("people")).toBe("people");
    expect(columnTableOf(null)).toBe("people");
  });
});

describe("editsColumnsOf", () => {
  it.each([
    ["people", ["people:edit", "people:view"], true],
    ["people", ["configuration:edit", "people:view"], false],
    ["features", ["features:edit", "people:view"], true],
    ["features", ["features:edit"], false],
    ["features", ["configuration:edit", "people:view"], false],
  ] as const)("on %s, with %j, is %s", (table, permissions, expected) => {
    expect(editsColumnsOf(permissions, table)).toBe(expected);
  });
});

describe("fieldRequestSchema", () => {
  it("takes a choice column's tier from its list, so drops any visibility sent", () => {
    const listId = randomUUID();
    expect(
      fieldRequestSchema.parse({
        name: " Site ",
        listId,
        visibility: "personal",
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

  it("asks a choice column for a list, or a new one, not both", () => {
    expect(messages(fieldRequestSchema.safeParse({ name: "Site" }))).toEqual([
      "Choose a list",
    ]);
    expect(
      messages(
        fieldRequestSchema.safeParse({
          name: "Site",
          listId: randomUUID(),
          newList: { name: "Sites", choices: ["Harbourside"] },
        }),
      ),
    ).toEqual(["Choose a list or a new one, not both"]);
  });

  it("takes a new list with its choices, each once, whatever its case", () => {
    expect(
      fieldRequestSchema.parse({
        name: "Tier",
        newList: { name: " Tiers ", choices: [" Gold ", "Silver"] },
      }).newList,
    ).toEqual({ name: "Tiers", choices: ["Gold", "Silver"] });
    expect(
      messages(
        fieldRequestSchema.safeParse({
          name: "Tier",
          newList: { name: "Tiers", choices: ["Gold", "gold"] },
        }),
      ),
    ).toEqual(["A choice is in the list twice"]);
    expect(
      fieldRequestSchema.safeParse({
        name: "Tier",
        newList: { name: "Tiers", choices: [] },
      }).success,
    ).toBe(false);
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

  it("refuses a web link column with a list", () => {
    expect(
      messages(
        fieldRequestSchema.safeParse({
          name: "Profile",
          type: "link",
          visibility: "general",
          listId: randomUUID(),
        }),
      ),
    ).toEqual(["A web link column has no list"]);
  });

  it("refuses a web link column without a visibility, with a new list, or with several links", () => {
    expect(
      messages(
        fieldRequestSchema.safeParse({
          name: "Profile",
          type: "link",
          newList: { name: "Sites", choices: ["Harbourside"] },
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
      keyNumber: 1,
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

describe("newListSchema", () => {
  const most = (length: number) => "x".repeat(length);

  it.each([
    ["an empty name", { name: " ", choices: ["Gold"] }],
    [
      "a name too long",
      { name: most(listLengths.name + 1), choices: ["Gold"] },
    ],
    ["no choices", { name: "Tiers", choices: [] }],
    ["a blank choice", { name: "Tiers", choices: [" "] }],
    [
      "a choice too long",
      { name: "Tiers", choices: [most(listLengths.choice + 1)] },
    ],
    [
      "too many choices",
      {
        name: "Tiers",
        choices: Array.from(
          { length: mostChoicesAtOnce + 1 },
          (_, at) => `Choice ${String(at)}`,
        ),
      },
    ],
  ])("refuses %s", (_, list) => {
    expect(newListSchema.safeParse(list).success).toBe(false);
  });

  it("takes the longest name and choice, and the most choices", () => {
    expect(
      newListSchema.safeParse({
        name: most(listLengths.name),
        choices: Array.from(
          { length: mostChoicesAtOnce },
          (_, at) => `Choice ${String(at)}`,
        ),
      }).success,
    ).toBe(true);
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
