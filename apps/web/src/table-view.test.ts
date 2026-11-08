// SPDX-License-Identifier: Apache-2.0

// Tests for filtering, searching, and sorting any table: each kind of column's search, sort, and
// filter; empty values last; sorting by several columns; columns the table does not have; reading
// and writing the view in the page address, with the saved view it started from; comparing views;
// and rows keeping their place until the view changes.

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isDay } from "@fathom/shared";
import {
  applyView,
  emptyView,
  folded,
  isActive,
  knownView,
  narrows,
  sameView,
  savedFor,
  searchFor,
  setsApart,
  type TableColumn,
  useSteadyOrder,
  type View,
  viewFrom,
  viewProps,
  viewSearchSchema,
  widthWithin,
  withWidth,
} from "./table-view.ts";

interface Row {
  id: string;
  name: string;
  start: string;
  levels: string[];
}

const levels = [
  { id: "l1", label: "P1" },
  { id: "l2", label: "P2" },
  { id: "l3", label: "Señor" },
];

const columns: TableColumn<Row>[] = [
  {
    key: "name",
    label: "Name",
    kind: "text",
    choices: [],
    multiple: false,
    value: (row) => row.name,
  },
  {
    key: "start",
    label: "Start",
    kind: "date",
    choices: [],
    multiple: false,
    value: (row) => row.start,
  },
  {
    key: "level",
    label: "Level",
    kind: "choice",
    choices: levels,
    multiple: true,
    value: (row) => row.levels,
  },
];

const rows: Row[] = [
  { id: "a", name: "Zoë E10", start: "2024-03-01", levels: ["l2"] },
  { id: "b", name: "ann e2", start: "", levels: ["l1", "l3"] },
  { id: "c", name: "", start: "2025-01-15", levels: [] },
  { id: "d", name: "Cy", start: "2024-03-01", levels: ["l1"] },
];

const view = (changes: Partial<View>): View => ({ ...emptyView, ...changes });
const ids = (shown: readonly Row[]) => shown.map((row) => row.id);
const shownBy = (changes: Partial<View>) =>
  ids(applyView(rows, columns, view(changes)));

describe("searching", () => {
  it("shows rows with every word somewhere, ignoring case and accents, in any kind of column", () => {
    expect(shownBy({ search: "zoe" })).toEqual(["a"]);
    expect(shownBy({ search: "  ANN   senor " })).toEqual(["b"]);
    expect(shownBy({ search: "ann p2" })).toEqual([]);
    expect(shownBy({ search: "2024-03" })).toEqual(["a", "d"]);
    expect(shownBy({ search: "jan" })).toEqual(["c"]);
    expect(shownBy({ search: "   " })).toEqual(["a", "b", "c", "d"]);
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

describe("the view in the page address", () => {
  it("reads and writes the search, filters, and sort, leaving out what is not set", () => {
    const written = searchFor(
      view({
        search: "ann",
        filters: { name: { contains: "a" }, start: {} },
        sort: [
          { key: "level", descending: true },
          { key: "name", descending: false },
        ],
      }),
    );
    expect(written).toEqual({
      search: "ann",
      filters: { name: { contains: "a" } },
      sort: ["-level", "name"],
    });
    expect(viewFrom(viewSearchSchema.parse(written))).toEqual(
      view({
        search: "ann",
        filters: { name: { contains: "a" } },
        sort: [
          { key: "level", descending: true },
          { key: "name", descending: false },
        ],
      }),
    );
    expect(searchFor(view({ search: "  " }))).toEqual({});
    expect(viewFrom({})).toEqual(emptyView);
  });

  it("drops a filter that does not fit, keeping the others", () => {
    expect(
      viewFrom(
        viewSearchSchema.parse({
          filters: {
            start: { from: "2026-02-30" },
            name: { contains: "a" },
            ["k".repeat(70)]: { empty: true },
          },
        }),
      ).filters,
    ).toEqual({ name: { contains: "a" } });
  });

  it("drops a sort level that does not fit, keeping the others, up to ten", () => {
    expect(
      viewSearchSchema.parse({ sort: ["name", "a b", 3, "-start"] }).sort,
    ).toEqual(["name", "-start"]);
    expect(
      viewSearchSchema.parse({
        sort: Array.from({ length: 12 }, (_, at) => `k${String(at)}`),
      }).sort,
    ).toHaveLength(10);
  });

  it("reads and writes the columns the metrics break down by, kept while the metrics show with none", () => {
    expect(viewFrom({ breakdown: [] })).toEqual(view({ breakdown: [] }));
    expect(viewFrom({ ungrouped: true })).toEqual(view({ ungrouped: true }));
    expect(searchFor(view({ ungrouped: true }))).toEqual({ ungrouped: true });
    expect(setsApart(view({ ungrouped: true }))).toBe(true);
    expect(searchFor(view({ breakdown: ["level", "start"] }))).toEqual({
      breakdown: ["level", "start"],
    });
    expect(searchFor(view({ breakdown: [] }))).toEqual({ breakdown: [] });
    expect(searchFor(emptyView)).toEqual({});
    expect(
      viewSearchSchema.parse({
        breakdown: ["level", "a b", 3, "level", "x", "y"],
      }).breakdown,
    ).toEqual(["level", "x"]);
    expect(viewSearchSchema.parse({ breakdown: "level" }).breakdown).toBe(
      undefined,
    );
    // An empty Metrics panel is nothing to save, and saving leaves it out.
    expect(sameView(view({ breakdown: [] }), emptyView)).toBe(true);
    expect(savedFor(view({ breakdown: [], search: "a" }))).toEqual({
      search: "a",
    });
    expect(savedFor(view({ breakdown: ["level"] }))).toEqual({
      breakdown: ["level"],
    });
    expect(
      sameView(view({ breakdown: ["level"] }), view({ breakdown: ["start"] })),
    ).toBe(false);
  });

  it("reads and writes how many columns are frozen, and saves them, unless the table's own default", () => {
    expect(viewFrom({ frozen: 0 })).toEqual(view({ frozen: 0 }));
    expect(searchFor(view({ frozen: 3 }))).toEqual({ frozen: 3 });
    expect(searchFor(view({ frozen: undefined }))).toEqual({});
    expect(viewSearchSchema.parse({ frozen: "x" }).frozen).toBe(undefined);
    expect(savedFor(view({ frozen: 0 }))).toEqual({ frozen: 0 });
    expect(sameView(view({ frozen: 2 }), emptyView)).toBe(false);
    expect(sameView(view({ frozen: 2 }), view({ frozen: 2 }))).toBe(true);
  });

  it("reads, writes, and saves the widths set for columns, leaving out none set", () => {
    expect(viewFrom({ widths: { name: 240 } })).toEqual(
      view({ widths: { name: 240 } }),
    );
    expect(viewFrom({ widths: {} })).toEqual(view({}));
    expect(searchFor(view({ widths: { name: 240 } }))).toEqual({
      widths: { name: 240 },
    });
    expect(searchFor(view({ widths: {} }))).toEqual({});
    expect(savedFor(view({ widths: { name: 240 } }))).toEqual({
      widths: { name: 240 },
    });
    expect(sameView(view({ widths: { name: 240 } }), emptyView)).toBe(false);
  });

  it("sets a column's width, keeping the others, and leaves it to fit its cells again", () => {
    const wide = withWidth(view({ widths: { name: 240 } }), "level", 120);
    expect(wide.widths).toEqual({ name: 240, level: 120 });
    expect(withWidth(wide, "level", 160).widths).toEqual({
      name: 240,
      level: 160,
    });
    expect(withWidth(wide, "level", undefined).widths).toEqual({ name: 240 });
    expect(
      sameView(
        withWidth(view({ widths: { name: 240 } }), "name", undefined),
        emptyView,
      ),
    ).toBe(true);
  });

  it("sets things apart from the rows it shows when it sorts, freezes, or sets widths", () => {
    expect(setsApart(emptyView)).toBe(false);
    expect(setsApart(view({ search: "a" }))).toBe(false);
    expect(
      setsApart(view({ sort: [{ key: "name", descending: false }] })),
    ).toBe(true);
    expect(setsApart(view({ frozen: 0 }))).toBe(true);
    expect(setsApart(view({ widths: { name: 200 } }))).toBe(true);
  });

  it("keeps a width whole, within its limits, and no wider than asked", () => {
    expect(widthWithin(200.4)).toBe(200);
    expect(widthWithin(1)).toBe(64);
    expect(widthWithin(5000)).toBe(1600);
    expect(widthWithin(400, 250.6)).toBe(251);
    expect(widthWithin(400, 10)).toBe(64);
  });

  it("names the saved view the view started from, until it is cleared", () => {
    const id = "00000000-0000-4000-8000-0000000000a1";
    expect(viewSearchSchema.parse({ view: id }).view).toBe(id);
    expect(viewSearchSchema.parse({ view: "not a view" }).view).toBeUndefined();
    const go = vi.fn();
    const props = viewProps({ search: "a", view: id }, go);
    expect(props.applied).toBe(id);
    props.onView(view({ search: "b" }), true);
    expect(go).toHaveBeenLastCalledWith({ search: "b", view: id }, true);
    props.onView(emptyView);
    expect(go).toHaveBeenLastCalledWith({}, false);
    props.onApply(view({ search: "c" }), "other");
    expect(go).toHaveBeenLastCalledWith({ search: "c", view: "other" }, false);
    viewProps({}, go).onView(view({ search: "d" }));
    expect(go).toHaveBeenLastCalledWith({ search: "d" }, false);
  });

  it("knows views that show the same rows in the same order, however they were written", () => {
    expect(
      sameView(
        view({
          filters: { name: { empty: true, contains: "a" }, start: {} },
          sort: [{ key: "name", descending: false }],
        }),
        view({
          filters: { name: { contains: "a", empty: true, to: undefined } },
          sort: [{ key: "name", descending: false }],
        }),
      ),
    ).toBe(true);
    expect(
      sameView(
        view({ sort: [{ key: "name", descending: false }] }),
        view({ sort: [{ key: "name", descending: true }] }),
      ),
    ).toBe(false);
  });

  it("knows a whole date that exists", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-2-3")).toBe(false);
  });

  it("drops what does not fit", () => {
    expect(
      viewSearchSchema.parse({
        search: 3,
        filters: "name",
        sort: ["a b"],
      }),
    ).toEqual({ sort: [] });
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

describe("columns the user may not see", () => {
  it("are left out of the view", () => {
    expect(
      knownView(
        view({
          search: "a",
          filters: { name: { empty: true }, hidden: { empty: true } },
          sort: [
            { key: "hidden", descending: false },
            { key: "start", descending: true },
          ],
          breakdown: ["hidden", "level"],
          frozen: 2,
          widths: { hidden: 200, name: 240 },
        }),
        columns,
      ),
    ).toEqual(
      view({
        search: "a",
        filters: { name: { empty: true } },
        sort: [{ key: "start", descending: true }],
        breakdown: ["level"],
        frozen: 2,
        widths: { name: 240 },
      }),
    );
    expect(knownView(view({ widths: { hidden: 200 } }), columns)).toEqual(
      view({}),
    );
    expect(knownView(view({ breakdown: ["hidden"] }), columns)).toEqual(
      view({ breakdown: [] }),
    );
    // Nor are columns the metrics do not offer kept in the breakdown.
    expect(
      knownView(
        view({ breakdown: ["name", "level"] }),
        columns,
        [],
        [{ key: "level" }],
      ),
    ).toEqual(view({ breakdown: ["level"] }));
  });
});

describe("filters that are not columns", () => {
  // Whether a row's name is long, standing for what a table filters by but does not show.
  const long: TableColumn<Row> = {
    key: "long",
    label: "Long",
    kind: "choice",
    choices: [{ id: "yes", label: "Yes" }],
    multiple: false,
    value: (row) => (row.name.length > 3 ? ["yes"] : []),
  };

  it("filter the rows, but are neither searched nor sorted on", () => {
    const shown = (changes: Partial<View>) =>
      ids(applyView(rows, columns, view(changes), [long]));
    expect(shown({ filters: { long: { any: ["yes"] } } })).toEqual(["a", "b"]);
    expect(shown({ filters: { long: { empty: true } } })).toEqual(["c", "d"]);
    expect(shown({ search: "yes" })).toEqual([]);
    expect(shown({ sort: [{ key: "long", descending: true }] })).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("are kept in the view, but not as a sort", () => {
    expect(
      knownView(
        view({
          filters: { long: { any: ["yes"] } },
          sort: [{ key: "long", descending: false }],
        }),
        columns,
        [long],
      ),
    ).toEqual(view({ filters: { long: { any: ["yes"] } } }));
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
