// SPDX-License-Identifier: Apache-2.0

// Tests for filtering, searching, and sorting any table: each kind of column's search, sort, and
// filter, empty values last, sorting by several columns, and rows keeping their place.

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  isActive,
  narrows,
  type TableColumn,
  type View,
} from "./table-view.ts";
import { applyView, useSteadyOrder } from "./table-rows.ts";
import { folded } from "@fathom/shared";
import { decimal } from "./numbers.ts";
import {
  type Row,
  columns,
  rows,
  view,
  ids,
  shownBy,
} from "./test-table-view.ts";

describe("searching", () => {
  it("shows rows with every word somewhere, ignoring case and accents, in any kind of column", () => {
    expect(shownBy({ search: "zoe" })).toEqual(["a"]);
    expect(shownBy({ search: "  ANN   senor " })).toEqual(["b"]);
    expect(shownBy({ search: "ann p2" })).toEqual([]);
    expect(shownBy({ search: "2024-03" })).toEqual(["a", "d"]);
    expect(shownBy({ search: "jan" })).toEqual(["c"]);
    expect(shownBy({ search: "   " })).toEqual(["a", "b", "c", "d"]);
  });

  it("leaves out a column not searched, still filtering and sorting by it", () => {
    const unsearched = columns.map((column) =>
      column.key === "name" ? { ...column, searched: false as const } : column,
    );
    const shown = (changes: Partial<View>) =>
      ids(applyView(rows, unsearched, view(changes)));
    expect(shown({ search: "zoe" })).toEqual([]);
    expect(shown({ search: "2024-03" })).toEqual(["a", "d"]);
    expect(shown({ filters: { name: { contains: "cy" } } })).toEqual(["d"]);
  });

  it("folds text for matching", () => {
    expect(folded("Zoë ÉCOLE")).toBe("zoe ecole");
    expect(folded("ВЕРОНИКА Ёлкина")).toBe("вероника елкина");
    // Marks that make another letter are kept, and Korean syllables stay whole.
    expect(folded("が")).not.toBe(folded("か"));
    expect(folded("김민준")).toBe("김민준");
  });

  it("finds names in every script, part of a name, and in any letter case", () => {
    const international = [
      { id: "ko", name: "편성현", start: "", levels: [] },
      { id: "ja", name: "越智 太陽", start: "", levels: [] },
      { id: "zh", name: "陈宇泽", start: "", levels: [] },
      { id: "ru", name: "Вероника Елисеева", start: "", levels: [] },
      { id: "kana", name: "さくら が", start: "", levels: [] },
    ];
    const found = (search: string) =>
      ids(applyView(international, columns, view({ search })));
    expect(found("성현")).toEqual(["ko"]);
    expect(found("太陽")).toEqual(["ja"]);
    expect(found("宇泽")).toEqual(["zh"]);
    expect(found("вероника ЕЛИСЕЕВА")).toEqual(["ru"]);
    expect(found("か")).toEqual([]);
    expect(found("が")).toEqual(["kana"]);
    expect(
      ids(
        applyView(
          international,
          columns,
          view({ filters: { name: { contains: "елисеева" } } }),
        ),
      ),
    ).toEqual(["ru"]);
  });
});

describe("searching by key", () => {
  // Each row's key, numbered by its place, so row "a" is #FEATURE-1 and the tenth would be
  // #FEATURE-10.
  const keyOf = (row: Row) => ({
    kind: "feature" as const,
    keyNumber: rows.indexOf(row) + 1,
  });
  const keyed = (search: string) =>
    ids(applyView(rows, columns, view({ search }), [], keyOf));

  it("finds only the row with a key typed, in any letter case, with or without the #", () => {
    expect(keyed("#FEATURE-2")).toEqual(["b"]);
    expect(keyed("feature-4")).toEqual(["d"]);
  });

  it("finds nothing for a key no row has, or a key of another kind", () => {
    expect(keyed("#FEATURE-20")).toEqual([]);
    expect(keyed("#PROJECT-2")).toEqual([]);
  });

  it("searches words as usual where the table's rows have no keys", () => {
    expect(shownBy({ search: "#FEATURE-2" })).toEqual([]);
    expect(shownBy({ search: "e2" })).toEqual(["b"]);
  });
});

describe("filtering", () => {
  it("matches text that contains what is typed, or is empty", () => {
    expect(shownBy({ filters: { name: { contains: " E " } } })).toEqual([
      "a",
      "b",
    ]);
    expect(shownBy({ filters: { name: { empty: true } } })).toEqual(["c"]);
    expect(
      shownBy({ filters: { name: { contains: "cy", empty: true } } }),
    ).toEqual(["c", "d"]);
  });

  it("matches every value that isn't empty, whatever else the filter holds", () => {
    expect(shownBy({ filters: { name: { notEmpty: true } } })).toEqual([
      "a",
      "b",
      "d",
    ]);
    expect(
      shownBy({ filters: { start: { notEmpty: true, from: "2030-01-01" } } }),
    ).toEqual(["a", "c", "d"]);
    expect(isActive({ notEmpty: true })).toBe(true);
  });

  it("matches dates between from and to, either left open, or no date", () => {
    expect(shownBy({ filters: { start: { from: "2024-03-02" } } })).toEqual([
      "c",
    ]);
    expect(shownBy({ filters: { start: { to: "2024-03-01" } } })).toEqual([
      "a",
      "d",
    ]);
    expect(
      shownBy({
        filters: { start: { from: "2024-01-01", to: "2024-12-31" } },
      }),
    ).toEqual(["a", "d"]);
    expect(shownBy({ filters: { start: { empty: true } } })).toEqual(["b"]);
  });

  it("matches any of the picked choices, or none chosen, and needs every filter", () => {
    expect(shownBy({ filters: { level: { any: ["l1"] } } })).toEqual([
      "b",
      "d",
    ]);
    expect(shownBy({ filters: { level: { empty: true } } })).toEqual(["c"]);
    expect(
      shownBy({ filters: { level: { any: ["l2"], empty: true } } }),
    ).toEqual(["a", "c"]);
    expect(
      shownBy({
        filters: { level: { any: ["l1"] }, name: { contains: "cy" } },
      }),
    ).toEqual(["d"]);
  });

  it("leaves out filters that set nothing, and on columns the table does not have", () => {
    expect(
      shownBy({
        filters: {
          name: { contains: " " },
          level: { any: [] },
          hidden: { contains: "x" },
        },
      }),
    ).toEqual(["a", "b", "c", "d"]);
    expect(isActive(undefined)).toBe(false);
    expect(isActive({ empty: false })).toBe(false);
    expect(isActive({ to: "2024-01-01" })).toBe(true);
  });

  it("knows when the view hides rows rather than only sorting them", () => {
    expect(narrows(view({ sort: [{ key: "name", descending: true }] }))).toBe(
      false,
    );
    expect(narrows(view({ search: "x" }))).toBe(true);
    expect(narrows(view({ filters: { name: { empty: true } } }))).toBe(true);
    expect(narrows(view({ filters: { name: {} } }))).toBe(false);
  });
});

describe("sorting", () => {
  it("sorts names in every script, Latin first, then Cyrillic, then the rest", () => {
    const names = [
      "陈宇泽",
      "Вероника",
      "Ann",
      "편성현",
      "Zoë",
      "Анна",
      "越智 太陽",
    ];
    const sorted = ids(
      applyView(
        names.map((name) => ({ id: name, name, start: "", levels: [] })),
        columns,
        view({ sort: [{ key: "name", descending: false }] }),
      ),
    );
    expect(sorted.slice(0, 4)).toEqual(["Ann", "Zoë", "Анна", "Вероника"]);
    expect(sorted.slice(4).toSorted()).toEqual(
      ["편성현", "陈宇泽", "越智 太陽"].toSorted(),
    );
  });

  it("sorts text naturally, ignoring case, with empty values last either way", () => {
    const named = [...rows, { id: "e", name: "Zoe E2", start: "", levels: [] }];
    const by = (descending: boolean) =>
      ids(
        applyView(
          named,
          columns,
          view({ sort: [{ key: "name", descending }] }),
        ),
      );
    expect(by(false)).toEqual(["b", "d", "e", "a", "c"]);
    expect(by(true)).toEqual(["a", "e", "d", "b", "c"]);
  });

  it("sorts dates, and choices in their list's order, by several columns in turn", () => {
    expect(
      shownBy({
        sort: [
          { key: "start", descending: false },
          { key: "name", descending: true },
        ],
      }),
    ).toEqual(["a", "d", "c", "b"]);
    expect(shownBy({ sort: [{ key: "level", descending: false }] })).toEqual([
      "d",
      "b",
      "a",
      "c",
    ]);
    expect(shownBy({ sort: [{ key: "level", descending: true }] })).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
  });

  it("sorts and filters a checkbox either way, and finds a checked one by its choice", () => {
    const manager: TableColumn<Row> = {
      key: "manager",
      label: "Manager?",
      kind: "flag",
      choices: [{ id: "yes", label: "Yes" }],
      multiple: false,
      emptyLabel: "No",
      value: (row) => (row.name.startsWith("C") ? ["yes"] : []),
    };
    const flagged = (changes: Partial<View>) =>
      ids(applyView(rows, [...columns, manager], view(changes)));
    expect(flagged({ sort: [{ key: "manager", descending: false }] })).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
    expect(flagged({ sort: [{ key: "manager", descending: true }] })).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(flagged({ filters: { manager: { any: ["yes"] } } })).toEqual(["d"]);
    expect(flagged({ filters: { manager: { empty: true } } })).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(flagged({ search: "yes" })).toEqual(["d"]);
  });

  it("keeps empty values in the order given", () => {
    const blank = [...rows, { id: "e", name: "", start: "", levels: [] }];
    expect(
      ids(
        applyView(
          blank,
          columns,
          view({ sort: [{ key: "name", descending: false }] }),
        ),
      ),
    ).toEqual(["b", "d", "a", "c", "e"]);
  });

  it("keeps the order given when values tie, and leaves out columns the table does not have", () => {
    expect(
      shownBy({
        sort: [
          { key: "hidden", descending: false },
          { key: "start", descending: false },
        ],
      }),
    ).toEqual(["a", "d", "c", "b"]);
  });
});

describe("rows keeping their place", () => {
  const byName = view({ sort: [{ key: "name", descending: false }] });
  const useSteady = (all: Row[], shown: View, added = new Set<string>()) =>
    ids(
      useSteadyOrder(
        all,
        shown,
        (some) => applyView(some, columns, shown),
        (r) => r.id,
        added,
      ),
    );

  it("keeps rows where they were until the view changes, dropping deleted rows and adding new ones at the end", () => {
    const { result, rerender } = renderHook(
      ({ all, shown }: { all: Row[]; shown: View }) => useSteady(all, shown),
      { initialProps: { all: rows, shown: byName } },
    );
    expect(result.current).toEqual(["b", "d", "a", "c"]);
    const renamed = rows.map((row) =>
      row.id === "b" ? { ...row, name: "Zz" } : row,
    );
    rerender({ all: renamed, shown: byName });
    expect(result.current).toEqual(["b", "d", "a", "c"]);
    const added = [
      ...renamed.filter((row) => row.id !== "d"),
      { id: "e", name: "Ab", start: "", levels: [] },
    ];
    rerender({ all: added, shown: byName });
    expect(result.current).toEqual(["b", "a", "c", "e"]);
    rerender({ all: added, shown: { ...byName, search: "z" } });
    expect(result.current).toEqual(["a", "b"]);
  });

  it("puts a deleted row back in its place when it returns", () => {
    const { result, rerender } = renderHook(
      ({ all }: { all: Row[] }) => useSteady(all, byName),
      { initialProps: { all: rows } },
    );
    rerender({ all: rows.filter((row) => row.id !== "d") });
    expect(result.current).toEqual(["b", "a", "c"]);
    rerender({ all: rows });
    expect(result.current).toEqual(["b", "d", "a", "c"]);
  });

  it("shows rows added since only when the view shows them, unless the user added them", () => {
    const named = view({ search: "y" });
    const { result, rerender } = renderHook(
      ({ all, mine }: { all: Row[]; mine: Set<string> }) =>
        useSteady(all, named, mine),
      { initialProps: { all: rows, mine: new Set<string>() } },
    );
    expect(result.current).toEqual(["d"]);
    const more = [
      ...rows,
      { id: "e", name: "Mine", start: "", levels: [] },
      { id: "f", name: "Theirs", start: "", levels: [] },
      { id: "g", name: "Yves", start: "", levels: [] },
    ];
    rerender({ all: more, mine: new Set(["e"]) });
    expect(result.current).toEqual(["d", "e", "g"]);
  });

  it("shows rows the user added in the order they added them, whatever order they come in", () => {
    const named = view({ search: "y" });
    const { result, rerender } = renderHook(
      ({ all, mine }: { all: Row[]; mine: Set<string> }) =>
        useSteady(all, named, mine),
      { initialProps: { all: rows, mine: new Set<string>() } },
    );
    rerender({
      all: [
        ...rows,
        { id: "e", name: "Ab", start: "", levels: [] },
        { id: "f", name: "Zz", start: "", levels: [] },
      ],
      mine: new Set(["f", "e"]),
    });
    expect(result.current).toEqual(["d", "f", "e"]);
  });
});

describe("web link columns", () => {
  interface Linked {
    id: string;
    link: { address: string; text: string } | null;
  }
  const linkColumns: TableColumn<Linked>[] = [
    {
      key: "page",
      label: "Page",
      kind: "link",
      choices: [],
      multiple: false,
      value: (row) => row.link,
    },
  ];
  const linked: Linked[] = [
    { id: "a", link: { address: "https://b.example.test/", text: "" } },
    { id: "b", link: { address: "https://z.example.test/", text: "Alpha" } },
    { id: "c", link: null },
  ];
  const shown = (changes: Partial<View>) =>
    applyView(linked, linkColumns, view(changes)).map((row) => row.id);

  it("are searched by their text and their address", () => {
    expect(shown({ search: "alpha" })).toEqual(["b"]);
    expect(shown({ search: "b.example" })).toEqual(["a"]);
  });

  it("are filtered by what their text or address contains, or by being empty", () => {
    expect(shown({ filters: { page: { contains: "z.example" } } })).toEqual([
      "b",
    ]);
    expect(shown({ filters: { page: { empty: true } } })).toEqual(["c"]);
  });

  it("are sorted by what they show, with empty ones last", () => {
    expect(shown({ sort: [{ key: "page", descending: false }] })).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
});

describe("number columns", () => {
  interface Scored {
    id: string;
    score: string;
  }
  const scoreColumns: TableColumn<Scored>[] = [
    {
      key: "score",
      label: "Score",
      kind: "number",
      choices: [],
      multiple: false,
      value: (row) => row.score,
    },
  ];
  const scored: Scored[] = [
    { id: "a", score: "9" },
    { id: "b", score: "1234.5" },
    { id: "c", score: "" },
    { id: "d", score: "0" },
  ];
  const shown = (changes: Partial<View>) =>
    applyView(scored, scoreColumns, view(changes)).map((row) => row.id);

  it("sort as numbers, not text, with no number last either way", () => {
    const sort = [{ key: "score", descending: false }];
    expect(shown({ sort })).toEqual(["d", "a", "b", "c"]);
    expect(shown({ sort: [{ key: "score", descending: true }] })).toEqual([
      "b",
      "a",
      "d",
      "c",
    ]);
  });

  it("are filtered between bounds, either left open, or by having none", () => {
    const filtered = (filter: object) => shown({ filters: { score: filter } });
    expect(filtered({ atLeast: 9 })).toEqual(["a", "b"]);
    expect(filtered({ atMost: 0 })).toEqual(["d"]);
    expect(filtered({ atLeast: 1, atMost: 10 })).toEqual(["a"]);
    expect(filtered({ empty: true })).toEqual(["c"]);
  });

  it("are searched as typed and as shown", () => {
    expect(shown({ search: "1234.5" })).toEqual(["b"]);
    expect(shown({ search: decimal(1234.5) })).toEqual(["b"]);
  });
});

describe("note columns", () => {
  interface Noted {
    id: string;
    note: string;
  }
  const noteColumns: TableColumn<Noted>[] = [
    {
      key: "background",
      label: "Background",
      kind: "note",
      choices: [],
      multiple: false,
      value: (row) => row.note,
    },
  ];
  const noted: Noted[] = [
    { id: "a", note: "**Zoned** in" },
    { id: "b", note: '<span data-colour="teal">Alpha</span> team' },
    { id: "c", note: "" },
  ];
  const shown = (changes: Partial<View>) =>
    applyView(noted, noteColumns, view(changes)).map((row) => row.id);

  it("are searched and filtered by their words, not their formatting", () => {
    expect(shown({ search: "alpha" })).toEqual(["b"]);
    expect(shown({ search: "teal" })).toEqual([]);
    expect(
      shown({ filters: { background: { contains: "zoned in" } } }),
    ).toEqual(["a"]);
    expect(shown({ filters: { background: { empty: true } } })).toEqual(["c"]);
  });

  it("are sorted by their words, with empty ones last", () => {
    expect(shown({ sort: [{ key: "background", descending: false }] })).toEqual(
      ["b", "a", "c"],
    );
  });
});

describe("a month column", () => {
  const [row = {} as Row] = rows;
  const months = ["2027-03", "2027-11", ""].map((start, place) => ({
    ...row,
    id: `m${String(place)}`,
    start,
  }));
  const monthColumn: TableColumn<Row> = {
    key: "start",
    label: "Needed by",
    kind: "month",
    choices: [],
    multiple: false,
    value: (shown) => shown.start,
  };
  const shownIds = (changes: Partial<View>) =>
    applyView(months, [monthColumn], view(changes)).map(({ id }) => id);

  it("is found by its name", () => {
    expect(shownIds({ search: "Mar 2027" })).toEqual(["m0"]);
  });

  it("is found by its digits", () => {
    expect(shownIds({ filters: { start: { contains: "2027-11" } } })).toEqual([
      "m1",
    ]);
  });

  it("sorts by date, with no month last", () => {
    expect(shownIds({ sort: [{ key: "start", descending: true }] })).toEqual([
      "m1",
      "m0",
      "m2",
    ]);
  });
});
