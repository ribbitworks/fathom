// SPDX-License-Identifier: Apache-2.0

// Tests for a table's view: reading and writing it in the page address, comparing views, its
// columns' order and hiding, a page's own choices, columns and filters the table does not have,
// and which groupings it uses.

import { describe, expect, it, vi } from "vitest";
import { isDay } from "@fathom/shared";
import {
  activeGrouping,
  activeThenBy,
  alwaysShowing,
  hiddenColumnsOf,
  shownColumnsOf,
  notGrouped,
  emptyView,
  fieldLabel,
  knownView,
  sameView,
  savedFor,
  searchFor,
  setsApart,
  type TableColumn,
  type View,
  viewFrom,
  viewProps,
  type ViewSearch,
  viewSearchSchema,
  widthWithin,
  withPlaces,
  withChoice,
  withUnit,
  withoutFilters,
  withHidden,
  withWidth,
  orderAfterMove,
} from "./table-view.ts";
import { applyView } from "./table-rows.ts";
import { type Row, columns, rows, view, ids } from "./test-table-view.ts";

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
            ["k".repeat(129)]: { empty: true },
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

  it("reads an older grouping of none, and a second grouping with no first, as no grouping", () => {
    expect(viewFrom({ grouping: "none", thenBy: "site" })).toEqual(emptyView);
    expect(viewFrom({ thenBy: "site" })).toEqual(emptyView);
    expect(setsApart(viewFrom({ grouping: "none" }))).toBe(false);
  });

  it("reads and writes the columns the metrics break down by, kept while the metrics show with none", () => {
    expect(viewFrom({ breakdown: [] })).toEqual(view({ breakdown: [] }));
    expect(viewFrom({ grouping: "site", thenBy: "grade" })).toEqual(
      view({ grouping: "site", thenBy: "grade" }),
    );
    expect(searchFor(view({ grouping: "site", thenBy: "grade" }))).toEqual({
      grouping: "site",
      thenBy: "grade",
    });
    expect(setsApart(view({ grouping: "site" }))).toBe(true);
    expect(knownView(view({ thenBy: "site" }), []).thenBy).toBe("site");
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

  it("leaves out the filters it does not keep, keeping the rest of the view", () => {
    const filtered = view({
      search: "Avery",
      filters: { name: { contains: "A" }, level: { any: ["l1"] } },
    });

    expect(withoutFilters(filtered, (key) => key !== "level")).toEqual(
      view({ search: "Avery", filters: { name: { contains: "A" } } }),
    );
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

  it("sets a column's unit and decimal places, keeping the others, and drops them once back as they start", () => {
    const shown = withPlaces(
      withUnit(view({ units: { other: "hours" } }), "effort", "person-weeks"),
      "effort",
      1,
    );
    expect(shown.units).toEqual({ other: "hours", effort: "person-weeks" });
    expect(shown.places).toEqual({ effort: 1 });
    expect(searchFor(shown)).toEqual({
      units: { other: "hours", effort: "person-weeks" },
      places: { effort: 1 },
    });
    expect(viewFrom(searchFor(shown))).toEqual(shown);
    expect(setsApart(shown)).toBe(true);
    const back = withPlaces(
      withUnit(withUnit(shown, "effort", undefined), "other", undefined),
      "effort",
      undefined,
    );
    expect(sameView(back, emptyView)).toBe(true);
  });

  it("keeps only the units and decimal places of columns the table has", () => {
    const known = knownView(
      view({
        units: { effort: "person-weeks", gone: "hours" },
        places: { gone: 1 },
      }),
      [{ key: "effort" }],
    );
    expect(known.units).toEqual({ effort: "person-weeks" });
    expect(known.places).toBeUndefined();
  });

  it("names a field for a column in a unit by the unit's words", () => {
    expect(fieldLabel({ label: "Effort" })).toBe("Effort");
    expect(
      fieldLabel({
        label: "Effort",
        unit: {
          key: "person-days",
          label: "Person-days",
          code: "PD",
          name: "person-days",
          one: "person-day",
        },
      }),
    ).toBe("Effort in person-days");
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

describe("a view's order of columns", () => {
  const known = [{ key: "a" }, { key: "b" }];

  it("is read from and written to the address, leaving out an empty one", () => {
    expect(viewFrom({ order: ["b", "a"] }).order).toEqual(["b", "a"]);
    expect(viewFrom({ order: [] })).not.toHaveProperty("order");
    expect(searchFor({ ...emptyView, order: ["b", "a"] }).order).toEqual([
      "b",
      "a",
    ]);
    expect(searchFor(emptyView)).not.toHaveProperty("order");
  });

  it("counts as set apart", () => {
    expect(setsApart({ ...emptyView, order: ["b", "a"] })).toBe(true);
  });

  it("keeps the places of columns not shown for now, and goes once it names none the table has", () => {
    expect(
      knownView({ ...emptyView, order: ["hidden", "b", "a"] }, known).order,
    ).toEqual(["hidden", "b", "a"]);
    expect(
      knownView({ ...emptyView, order: ["gone"] }, known),
    ).not.toHaveProperty("order");
    expect(knownView(emptyView, known)).not.toHaveProperty("order");
  });

  it("moves a column shown, leaving those not shown where they are", () => {
    expect(
      orderAfterMove(["a", "c"], 1, 0, ["a", "b", "c"], undefined),
    ).toEqual(["c", "b", "a"]);
    expect(
      orderAfterMove(["c", "a"], 0, 1, ["a", "b", "c"], ["c", "b", "a"]),
    ).toBeUndefined();
  });

  it("puts a column the order does not name after the rest", () => {
    expect(orderAfterMove(["n", "a"], 0, 1, ["a"], undefined)).toEqual([
      "a",
      "n",
    ]);
  });
});

describe("a view's hidden columns", () => {
  const ordered = ["name", "code", "colour", "size"].map((key) => ({ key }));

  it("is read from and written to the address, leaving out an empty one", () => {
    expect(viewFrom({ hidden: ["code"] }).hidden).toEqual(["code"]);
    expect(viewFrom({ hidden: [] })).not.toHaveProperty("hidden");
    expect(searchFor({ ...emptyView, hidden: ["code"] }).hidden).toEqual([
      "code",
    ]);
    expect(searchFor(emptyView)).not.toHaveProperty("hidden");
  });

  it("counts as set apart", () => {
    expect(setsApart({ ...emptyView, hidden: ["code"] })).toBe(true);
  });

  it("keeps the hidden columns not shown for now, and goes once it names none the table has", () => {
    const known = [{ key: "name" }, { key: "code" }];
    expect(
      knownView({ ...emptyView, hidden: ["drafted", "code"] }, known).hidden,
    ).toEqual(["drafted", "code"]);
    expect(
      knownView({ ...emptyView, hidden: ["gone"] }, known),
    ).not.toHaveProperty("hidden");
  });

  it("keeps a hidden column not shown for now when another is hidden or shown again", () => {
    const withDrafted = { ...emptyView, hidden: ["drafted"] };
    expect(withHidden(withDrafted, ordered, ["code"], true).hidden).toEqual([
      "code",
      "drafted",
    ]);
    expect(
      withHidden(
        { ...withDrafted, hidden: ["code", "drafted"] },
        ordered,
        ["code"],
        false,
      ).hidden,
    ).toEqual(["drafted"]);
  });

  it("tells the columns shown from those hidden, in the table's order", () => {
    const columns = ordered;
    const view = { ...emptyView, hidden: ["size", "code"] };
    expect(shownColumnsOf(view, columns).map(({ key }) => key)).toEqual([
      "name",
      "colour",
    ]);
    expect(hiddenColumnsOf(view, columns).map(({ key }) => key)).toEqual([
      "code",
      "size",
    ]);
    expect(shownColumnsOf(emptyView, columns)).toEqual(columns);
  });

  it("never hides a column that is always shown", () => {
    expect(
      alwaysShowing({ ...emptyView, hidden: ["name", "code"] }, "name").hidden,
    ).toEqual(["code"]);
    expect(
      alwaysShowing({ ...emptyView, hidden: ["name"] }, "name").hidden,
    ).toBeUndefined();
    expect(alwaysShowing(emptyView, "name").hidden).toBeUndefined();
  });

  it("hides columns in the table's order, and shows them again, leaving none once none is hidden", () => {
    const hidden = withHidden(emptyView, ordered, ["size", "code"], true);
    expect(hidden.hidden).toEqual(["code", "size"]);
    expect(withHidden(hidden, ordered, ["code"], false).hidden).toEqual([
      "size",
    ]);
    expect(
      withHidden(hidden, ordered, ["code", "size"], false).hidden,
    ).toBeUndefined();
  });

  it("leaves one fewer column frozen when a frozen one is hidden, and none fewer for another", () => {
    const threeFrozen = { ...emptyView, frozen: 3 };
    expect(withHidden(threeFrozen, ordered, ["code"], true).frozen).toBe(2);
    expect(withHidden(threeFrozen, ordered, ["size"], true).frozen).toBe(3);
  });

  it("freezes a column shown again among the frozen ones, as it was", () => {
    const hidden = { ...emptyView, frozen: 2, hidden: ["code"] };
    expect(withHidden(hidden, ordered, ["code"], false).frozen).toBe(3);
    expect(
      withHidden({ ...hidden, frozen: undefined }, ordered, ["code"], false)
        .frozen,
    ).toBeUndefined();
  });

  it("keeps no column frozen while none is, and the first while frozen columns are the default", () => {
    expect(
      withHidden({ ...emptyView, frozen: 0 }, ordered, ["code"], true).frozen,
    ).toBe(0);
    expect(
      withHidden(emptyView, ordered, ["code"], true).frozen,
    ).toBeUndefined();
  });

  describe("hidden at first", () => {
    const columns = [
      { key: "name" },
      { key: "state", hiddenAtFirst: true },
      { key: "code" },
    ];

    it("is hidden until the view shows it, and only then named in the address", () => {
      expect(hiddenColumnsOf(emptyView, columns).map(({ key }) => key)).toEqual(
        ["state"],
      );
      const shown = withHidden(emptyView, columns, ["state"], false);
      expect(shown.shown).toEqual(["state"]);
      expect(shown.hidden).toBeUndefined();
      expect(shownColumnsOf(shown, columns)).toEqual(columns);
      expect(searchFor(shown).shown).toEqual(["state"]);
      expect(viewFrom({ shown: ["state"] }).shown).toEqual(["state"]);
      expect(setsApart(shown)).toBe(true);
    });

    it("is hidden again by no longer being named shown, leaving the view as it started", () => {
      const shown = withHidden(emptyView, columns, ["state"], false);
      expect(withHidden(shown, columns, ["state"], true)).toEqual({
        ...emptyView,
        hidden: undefined,
        shown: undefined,
        frozen: undefined,
      });
    });

    it("stays hidden while others are hidden and shown again", () => {
      const hidden = withHidden(emptyView, columns, ["code"], true);
      expect(hidden).toMatchObject({ hidden: ["code"], shown: undefined });
      expect(
        hiddenColumnsOf(
          withHidden(hidden, columns, ["code"], false),
          columns,
        ).map(({ key }) => key),
      ).toEqual(["state"]);
    });

    it("is shown with every other column by Show all columns", () => {
      const hidden = withHidden(emptyView, columns, ["code"], true);
      const all = withHidden(hidden, columns, ["state", "code"], false);
      expect(all).toMatchObject({ hidden: undefined, shown: ["state"] });
    });

    it("keeps the columns shown while it names any the table has", () => {
      expect(
        knownView({ ...emptyView, shown: ["state"] }, columns).shown,
      ).toEqual(["state"]);
      expect(
        knownView({ ...emptyView, shown: ["gone"] }, columns),
      ).not.toHaveProperty("shown");
    });
  });
});

describe("a page's own choices", () => {
  it("are kept in the address under their own names, and in the view's choices", () => {
    const go = vi.fn();
    const search: ViewSearch & {
      mode?: string;
      hide?: string[];
      other?: string;
      missing?: string;
    } = { mode: "board", hide: ["status"], other: "kept out" };
    const props = viewProps(search, go, ["mode", "hide", "missing"]);
    expect(props.view.choices).toEqual({ mode: "board", hide: ["status"] });
    props.onView({ ...emptyView, choices: { mode: "table" } });
    expect(go).toHaveBeenLastCalledWith({ mode: "table" }, false);
    props.onApply({ ...emptyView, choices: { mode: "board" } }, "saved");
    expect(go).toHaveBeenLastCalledWith(
      { mode: "board", view: "saved" },
      false,
    );
  });

  it("are read from and written to a saved view's choices, and count as set apart", () => {
    const chosen = { ...emptyView, choices: { mode: "board" } };
    expect(searchFor(chosen)).toEqual({ choices: { mode: "board" } });
    expect(viewFrom({ choices: { mode: "board" } })).toEqual(chosen);
    expect(viewFrom({ choices: {} })).toEqual(emptyView);
    expect(setsApart(chosen)).toBe(true);
  });

  it("are set one at a time, keeping the others", () => {
    const chosen = { ...emptyView, choices: { mode: "board" } };
    expect(withChoice(chosen, "shipped", "shown").choices).toEqual({
      mode: "board",
      shipped: "shown",
    });
  });

  it("are taken out one at a time, leaving none once the last goes", () => {
    const chosen = {
      ...emptyView,
      choices: { mode: "board", shipped: "shown" },
    };
    const fewer = withChoice(chosen, "shipped", undefined);
    expect([
      fewer.choices,
      sameView(withChoice(fewer, "mode", undefined), emptyView),
    ]).toEqual([{ mode: "board" }, true]);
  });

  it("are kept, with whether retired records show, when the view is fitted to the table's columns", () => {
    expect(
      knownView(
        { ...emptyView, retired: true, choices: { mode: "board" } },
        [],
      ),
    ).toEqual({ ...emptyView, retired: true, choices: { mode: "board" } });
  });
});

describe("showing retired records", () => {
  it("is read from and written to the address only while asked for", () => {
    expect([
      viewFrom({ retired: true }).retired,
      viewFrom({}),
      searchFor({ ...emptyView, retired: true }).retired,
      searchFor(emptyView),
    ]).toEqual([true, emptyView, true, {}]);
  });

  it("counts as set apart", () => {
    expect(setsApart({ ...emptyView, retired: true })).toBe(true);
  });
});

describe("the column Metrics adds up", () => {
  it("is kept in the address, and by a saved view only with the metrics' breakdown", () => {
    const summing = viewFrom({ breakdown: ["level"], sum: "start" });
    expect(summing.sum).toBe("start");
    expect(searchFor(summing).sum).toBe("start");
    expect(savedFor(summing)).toEqual({ breakdown: ["level"], sum: "start" });
    expect(savedFor({ ...summing, breakdown: [] }).sum).toBeUndefined();
    expect(savedFor(viewFrom({ breakdown: ["level"] })).sum).toBeUndefined();
  });

  it("is kept when the table has it, or as nothing, and dropped otherwise", () => {
    expect(knownView(view({ sum: "start" }), columns).sum).toBe("start");
    expect(knownView(view({ sum: "" }), columns).sum).toBe("");
    expect(knownView(view({ sum: "gone" }), columns).sum).toBeUndefined();
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

describe("which grouping a view uses", () => {
  const groupings = [{ key: "cycle" }, { key: "month" }];

  it("uses none when the view names none", () => {
    expect(activeGrouping({}, groupings)).toBeUndefined();
  });

  it("uses the one the view names", () => {
    expect(activeGrouping({ grouping: "month" }, groupings)).toEqual({
      key: "month",
    });
  });

  it("uses none for a grouping the table does not have", () => {
    expect(activeGrouping({ grouping: "gone" }, groupings)).toBeUndefined();
  });

  it("uses none for a view showing one list", () => {
    expect(activeGrouping({ grouping: notGrouped }, groupings)).toBeUndefined();
  });

  it("uses none for a table that has no groupings", () => {
    expect(activeGrouping({}, undefined)).toBeUndefined();
  });
});

describe("which grouping a view uses under each heading", () => {
  const groupings = [{ key: "cycle" }, { key: "status" }, { key: "size" }];

  it("uses the one the view names under the first", () => {
    expect(
      activeThenBy({ grouping: "cycle", thenBy: "status" }, groupings),
    ).toEqual({ key: "status" });
    expect(
      activeThenBy({ grouping: "size", thenBy: "cycle" }, groupings),
    ).toEqual({ key: "cycle" });
  });

  it("uses none when the view names none, or one the table does not have", () => {
    expect(activeThenBy({}, groupings)).toBeUndefined();
    expect(activeThenBy({ thenBy: "gone" }, groupings)).toBeUndefined();
  });

  it("uses none when it is the first grouping, or the rows show as one list", () => {
    expect(
      activeThenBy({ grouping: "cycle", thenBy: "cycle" }, groupings),
    ).toBeUndefined();
    expect(
      activeThenBy({ grouping: notGrouped, thenBy: "status" }, groupings),
    ).toBeUndefined();
    expect(activeThenBy({ thenBy: "status" }, groupings)).toBeUndefined();
  });
});
