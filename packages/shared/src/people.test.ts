// SPDX-License-Identifier: Apache-2.0

// Tests for the requests that change people and the People table's columns.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canBeRequired,
  columnTableOf,
  editsColumnsOf,
  fieldRequestSchema,
  fieldTypeSchema,
  newListSchema,
  personChangeSchema,
  personRequestSchema,
  personSchema,
} from "./people.ts";
import { listLengths, mostChoicesAtOnce } from "./lists.ts";

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("columnTableOf", () => {
  it("names the table a column is on, and People for one recorded before columns had tables", () => {
    expect(columnTableOf("features")).toBe("features");
    expect(columnTableOf("activities")).toBe("activities");
    expect(columnTableOf("people")).toBe("people");
    expect(columnTableOf(null)).toBe("people");
    expect(columnTableOf(undefined)).toBe("people");
  });

  it.each(["private", "planets"])(
    "refuses a column on %s rather than taking it for People",
    (tableName) => {
      expect(() => columnTableOf(tableName)).toThrow(
        "A column is on a table that takes no added columns",
      );
    },
  );
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
          newList: { name: "Sites", choices: [{ label: "Harbourside" }] },
        }),
      ),
    ).toEqual(["Choose a list or a new one, not both"]);
  });

  it("takes a new list with its choices, each once, whatever its case", () => {
    expect(
      fieldRequestSchema.parse({
        name: "Tier",
        newList: {
          name: " Tiers ",
          choices: [
            { label: " Gold ", description: "Top" },
            { label: "Silver" },
          ],
        },
      }).newList,
    ).toEqual({
      name: "Tiers",
      choices: [
        { label: "Gold", description: "Top" },
        { label: "Silver", description: "" },
      ],
    });
    expect(
      messages(
        fieldRequestSchema.safeParse({
          name: "Tier",
          newList: {
            name: "Tiers",
            choices: [{ label: "Gold" }, { label: "gold" }],
          },
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
          newList: { name: "Sites", choices: [{ label: "Harbourside" }] },
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

describe("checkbox columns", () => {
  it("keep a visibility of their own", () => {
    expect(
      fieldRequestSchema.parse({
        name: "First aider",
        type: "flag",
        visibility: "personal",
      }),
    ).toMatchObject({ type: "flag", visibility: "personal", required: false });
  });

  it("refuse no visibility, a list, several boxes, or being required", () => {
    expect(
      messages(
        fieldRequestSchema.safeParse({
          name: "First aider",
          type: "flag",
          listId: randomUUID(),
          multiple: true,
          required: true,
        }),
      ),
    ).toEqual([
      "Choose a visibility",
      "A checkbox column has no list",
      "A checkbox column holds one box",
      "A checkbox column can't be required",
    ]);
  });

  it("are ticked by column, with null unticking one", () => {
    const column = randomUUID();
    expect(
      personChangeSchema.parse({ flags: { [column]: true } }).flags,
    ).toEqual({ [column]: true });
    expect(
      personChangeSchema.parse({ flags: { [column]: null } }).flags,
    ).toEqual({ [column]: null });
    expect(
      personChangeSchema.safeParse({ flags: { [column]: false } }).success,
    ).toBe(false);
  });

  it("are the one type that can't be required", () => {
    expect(
      fieldTypeSchema.options.filter((type) => !canBeRequired(type)),
    ).toEqual(["flag"]);
  });
});

describe("date columns", () => {
  it("keep a visibility of their own, and may be required", () => {
    expect(
      fieldRequestSchema.parse({
        name: "Last review",
        type: "date",
        visibility: "personal",
        required: true,
      }),
    ).toMatchObject({ type: "date", visibility: "personal", required: true });
  });

  it("refuse a list, several days, or no visibility", () => {
    expect(
      messages(
        fieldRequestSchema.safeParse({
          name: "Last review",
          type: "date",
          listId: randomUUID(),
          multiple: true,
        }),
      ),
    ).toEqual([
      "Choose a visibility",
      "A date column has no list",
      "A date column holds one date",
    ]);
  });

  it("are asked for by column as a day that exists, with null removing one", () => {
    const column = randomUUID();
    expect(
      personChangeSchema.parse({ days: { [column]: "2028-02-29" } }).days,
    ).toEqual({ [column]: "2028-02-29" });
    expect(personChangeSchema.parse({ days: { [column]: null } }).days).toEqual(
      { [column]: null },
    );
    for (const refused of ["2026-02-30", "2026-3-14", "14/03/2026", ""]) {
      expect(
        personChangeSchema.safeParse({ days: { [column]: refused } }).success,
      ).toBe(false);
    }
  });
});

describe("text columns", () => {
  it("keep a visibility of their own, and may be required", () => {
    expect(
      fieldRequestSchema.parse({
        name: "Desk",
        type: "text",
        visibility: "general",
        required: true,
      }),
    ).toMatchObject({ type: "text", visibility: "general", required: true });
  });

  it("are asked for by column, with null removing one", () => {
    const column = randomUUID();
    expect(
      personChangeSchema.parse({ texts: { [column]: " North 4-12 " } }).texts,
    ).toEqual({ [column]: "North 4-12" });
    expect(
      personChangeSchema.parse({ texts: { [column]: null } }).texts,
    ).toEqual({ [column]: null });
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
    ["an empty name", { name: " ", choices: [{ label: "Gold" }] }],
    [
      "a name too long",
      { name: most(listLengths.name + 1), choices: [{ label: "Gold" }] },
    ],
    ["no choices", { name: "Tiers", choices: [] }],
    ["a blank choice", { name: "Tiers", choices: [{ label: " " }] }],
    [
      "a description too long",
      {
        name: "Tiers",
        choices: [
          { label: "Gold", description: most(listLengths.description + 1) },
        ],
      },
    ],
    [
      "a choice too long",
      { name: "Tiers", choices: [{ label: most(listLengths.choice + 1) }] },
    ],
    [
      "too many choices",
      {
        name: "Tiers",
        choices: Array.from({ length: mostChoicesAtOnce + 1 }, (_, at) => ({
          label: `Choice ${String(at)}`,
        })),
      },
    ],
  ])("refuses %s", (_, list) => {
    expect(newListSchema.safeParse(list).success).toBe(false);
  });

  it("trims each choice's name and description, and gives a missing description none", () => {
    expect(
      newListSchema.parse({
        name: "Tiers",
        choices: [
          { label: " Gold ", description: " Top " },
          { label: "Silver" },
        ],
      }).choices,
    ).toEqual([
      { label: "Gold", description: "Top" },
      { label: "Silver", description: "" },
    ]);
  });

  it("takes the longest name and choice, and the most choices", () => {
    expect(
      newListSchema.safeParse({
        name: most(listLengths.name),
        choices: Array.from({ length: mostChoicesAtOnce }, (_, at) => ({
          label: `Choice ${String(at)}`,
        })),
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
