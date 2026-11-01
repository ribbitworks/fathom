// SPDX-License-Identifier: Apache-2.0

// Tests for filtering, searching, and sorting any table: each kind of column's search, sort, and
// filter; empty values last; sorting by several columns; columns the table does not have; reading
// and writing the view in the page address; and rows keeping their place until the view changes.

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  applyView,
  emptyView,
  folded,
  isActive,
  isDay,
  knownView,
  narrows,
  searchFor,
  type TableColumn,
  useSteadyOrder,
  type View,
  viewFrom,
  viewSearchSchema,
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
        }),
        columns,
      ),
    ).toEqual(
      view({
        search: "a",
        filters: { name: { empty: true } },
        sort: [{ key: "start", descending: true }],
      }),
    );
  });
});
