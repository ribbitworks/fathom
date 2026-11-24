// SPDX-License-Identifier: Apache-2.0

// Tests for the Lists page's table: each list's row and its drafts, the table's columns, the
// problems a name typed in a row has, and grouping by kind.

import type { Choice, List } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  listColumnOrder,
  listColumns,
  type ListRow,
  listRows,
  listTable,
} from "./lists-table.tsx";

const made = (madeBy: string, madeAt: string) => ({
  state: "waiting" as const,
  madeBy,
  madeAt,
});

const choice = (id: string, label: string, more: Partial<Choice> = {}) => ({
  id,
  label,
  description: "",
  retired: false,
  ...more,
});

const list = (id: string, more: Partial<List> = {}): List => ({
  id,
  keyNumber: 1,
  name: `List ${id}`,
  description: "",
  visibility: "general",
  retired: false,
  choices: [],
  ...more,
});

const renamed = (state: "waiting" | "rejected" = "waiting") => ({
  ...made("Fictional Editor", "2026-11-01T10:00:00.000Z"),
  state,
  action: "changed" as const,
  changed: ["name"],
  live: { name: "Sites" },
});

const addedChoice = (madeBy: string, madeAt: string, more: object = {}) => ({
  ...made(madeBy, madeAt),
  action: "created" as const,
  changed: ["label"],
  live: {},
  ...more,
});

const rowOf = (one: List, show: "both" | "drafts" = "both") =>
  listRows([one], show)[0] as ListRow;

describe("the rows of lists", () => {
  it("puts the lists Fathom builds in first, keeping the order given within each kind", () => {
    const rows = listRows(
      [list("a"), list("b", { builtIn: "positions" }), list("c")],
      "both",
    );
    expect(rows.map(({ id }) => id)).toEqual(["b", "a", "c"]);
  });

  it("shows a list's offered choices and the columns that use it, with no draft when nothing is drafted", () => {
    const one = list("l1", {
      name: "Locations",
      description: "Offices.",
      visibility: "personal",
      choices: [
        choice("c1", "Kestrel Bay"),
        choice("c2", "Old Mill", { retired: true }),
      ],
      usedBy: [{ page: "People", column: "Office" }],
    });
    expect(rowOf(one)).toEqual({
      id: "l1",
      name: "Locations",
      visibility: "personal",
      description: "Offices.",
      choices: ["Kestrel Bay"],
      usedBy: ["People: Office"],
      heldBy: undefined,
      draft: undefined,
      list: one,
      original: one,
      live: false,
    });
  });

  it("marks a row with the list's own draft, with its live values beside", () => {
    const row = rowOf(list("l1", { name: "Locations", draft: renamed() }));
    expect([row.name, row.draft?.changed, row.draft?.live.name]).toEqual([
      "Locations",
      ["name"],
      "Sites",
    ]);
  });

  it("adds the choices to what a list's own draft changes when its choices have drafts too", () => {
    const row = rowOf(
      list("l1", {
        draft: renamed(),
        choices: [
          choice("c1", "Northmere", {
            draft: addedChoice("Fictional Editor", "2026-11-01T11:00:00.000Z"),
          }),
        ],
      }),
    );
    expect(row.draft?.changed).toEqual(["name", "choices"]);
  });

  it("says when a list's own draft retires it", () => {
    const row = rowOf(
      list("l1", {
        retired: true,
        draft: { ...renamed(), changed: ["retired"], live: { retired: false } },
      }),
    );
    expect(row.draft).toMatchObject({ retiring: true });
  });

  it("stands one draft for its choices' and order's drafts, credited to whoever changed them last", () => {
    const row = rowOf(
      list("l1", {
        choices: [
          choice("c1", "Northmere", {
            draft: addedChoice("Fictional Editor", "2026-11-01T10:00:00.000Z"),
          }),
        ],
        orderDraft: {
          ...made("Fictional Planner", "2026-11-01T11:00:00.000Z"),
          madeAs: "Planner",
          live: [],
        },
      }),
    );
    expect(row.draft).toEqual({
      action: "changed",
      state: "waiting",
      changed: ["choices"],
      madeBy: "Fictional Planner",
      madeAs: "Planner",
      unpublished: false,
      live: {
        name: "List l1",
        visibility: "general",
        description: "",
        choices: [],
        usedBy: [],
      },
    });
  });

  it("counts the draft standing for its choices' drafts unpublished only when every one is", () => {
    const row = rowOf(
      list("l1", {
        choices: [
          choice("c1", "Northmere", {
            draft: addedChoice("Fictional Editor", "2026-11-01T10:00:00.000Z", {
              unpublished: true,
            }),
          }),
        ],
      }),
    );
    expect(row.draft?.unpublished).toBe(true);
  });

  it("keeps a list only drafted to be added's own values as its live ones", () => {
    const row = rowOf(
      list("l1", {
        name: "Teams",
        draft: {
          ...renamed(),
          action: "created",
          changed: ["name"],
          live: {},
        },
      }),
    );
    expect(row.draft?.live.name).toBe("Teams");
  });

  it("keeps rejected drafts beside live, and leaves them out with the drafts applied", () => {
    const one = list("l1", {
      name: "Locations",
      draft: renamed("rejected"),
      choices: [
        choice("c1", "Northmere", {
          draft: addedChoice("Fictional Editor", "2026-11-01T10:00:00.000Z", {
            state: "rejected",
          }),
        }),
      ],
    });
    expect(rowOf(one).draft?.state).toBe("rejected");
    const applied = rowOf(one, "drafts");
    expect([applied.name, applied.choices, applied.draft]).toEqual([
      "Sites",
      [],
      undefined,
    ]);
  });
});

describe("the table's columns", () => {
  it("are in the table's order", () => {
    expect(listColumns([]).map(({ key }) => key)).toEqual(listColumnOrder);
  });

  it("offer each column that uses a list once to filter by, A to Z", () => {
    const rows = listRows(
      [
        list("l1", { usedBy: [{ page: "People", column: "Office" }] }),
        list("l2", {
          usedBy: [
            { page: "Features", column: "Site" },
            { page: "People", column: "Office" },
          ],
        }),
      ],
      "both",
    );
    const usedBy = listColumns(rows).find(({ key }) => key === "usedBy");
    expect(usedBy?.choices.map(({ label }) => label)).toEqual([
      "Features: Site",
      "People: Office",
    ]);
  });

  it("take a name typed in a row as the list's new name", () => {
    const [name] = listColumns([]);
    expect([name?.change("Sites"), name?.change(null)]).toEqual([
      { name: "Sites" },
      { name: "" },
    ]);
  });
});

describe("the table of lists", () => {
  const hidden = list("l9", { name: "Positions", builtIn: "positions" });
  const table = listTable({
    lists: [hidden],
    shown: [],
    unchangeable: new Map(),
    onOpen: () => undefined,
    menuItems: () => null,
  });

  it.each([
    ["no problem in a name of its own", "Sites", undefined],
    ["a blank name", "  ", { message: "Name needed", column: "name" }],
    [
      "another list's name, in any case and spacing",
      " locations ",
      { message: "Another list already has that name", column: "name" },
    ],
    [
      "the name of a list the table doesn't show",
      "positions",
      { message: "Another list already has that name", column: "name" },
    ],
  ])("finds %s", (_case, name, problem) => {
    expect(
      table.recordProblem({ name }, () => [{ name: "Locations" }]),
    ).toEqual(problem);
  });

  it("groups lists by kind, those built in first", () => {
    const [kind] = table.groupings ?? [];
    const groups = listRows(
      [list("l1"), list("l2", { builtIn: "positions" })],
      "both",
    ).map((row) => kind?.of(row));
    expect(groups).toEqual([
      [{ key: "built-in", label: "Built in", rank: 0 }],
      [{ key: "custom", label: "Custom", rank: 1 }],
    ]);
  });
});
