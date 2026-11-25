// SPDX-License-Identifier: Apache-2.0

// Tests for the parts of a view the Save view dialog names, and what a view its maker can no
// longer use is missing.

import { describe, expect, it } from "vitest";
import {
  describeFilter,
  missingWords,
  type ViewChoice,
  viewParts,
} from "./table-controls.tsx";
import { type ColumnUnit, emptyView } from "./table-view.ts";

const weeks: ColumnUnit = {
  key: "person-weeks",
  label: "Person-weeks",
  code: "PW",
  name: "person-weeks",
  one: "person-week",
};

const column = (more: object) => ({
  key: "effort",
  label: "Effort",
  kind: "number" as const,
  choices: [],
  multiple: false,
  ...more,
});

describe("viewParts", () => {
  it("names no sum while the metrics add up the table's own", () => {
    const effort = column({});
    expect(
      viewParts({ ...emptyView, breakdown: ["effort"] }, [effort]),
    ).toEqual([{ name: "Metrics", value: "Effort" }]);
  });

  it("names Nothing when the metrics add nothing up, with or without a breakdown", () => {
    const effort = column({});
    expect(viewParts({ ...emptyView, sum: "" }, [effort])).toEqual([
      { name: "Measure", value: "Nothing" },
    ]);
    expect(
      viewParts({ ...emptyView, breakdown: ["effort"], sum: "" }, [effort]),
    ).toEqual([
      { name: "Metrics", value: "Effort" },
      { name: "Measure", value: "Nothing" },
    ]);
  });

  it("names each part of a view, in order", () => {
    const name = column({ key: "name", label: "Name", kind: "text" });
    const effort = column({ unit: weeks, places: 2 });
    expect(
      viewParts(
        {
          search: " fictional ",
          show: "drafts",
          filters: { name: { contains: "Atlas" } },
          sort: [
            { key: "name", descending: false },
            { key: "effort", descending: true },
          ],
          breakdown: ["name"],
          sum: "effort",
          frozen: 1,
          order: ["effort", "name"],
          widths: { name: 240 },
          units: { effort: "person-weeks" },
        },
        [name, effort],
      ),
    ).toEqual([
      { name: "Search", value: "“fictional”" },
      { name: "Filter", value: "Name: contains “Atlas”" },
      { name: "Sort", value: "Name ↑, Effort ↓" },
      { name: "Draft", value: "Drafts applied" },
      { name: "Metrics", value: "Name" },
      { name: "Measure", value: "Effort" },
      { name: "Frozen", value: "Up to Name" },
      { name: "Column order", value: "Moved" },
      { name: "Widths", value: "Name" },
      { name: "Units", value: "Effort in person-weeks" },
    ]);
  });

  it("names a text filter on empty values alone", () => {
    expect(
      viewParts({ ...emptyView, filters: { name: { empty: true } } }, [
        column({ key: "name", label: "Name", kind: "text" }),
      ]),
    ).toEqual([{ name: "Filter", value: "Name: Empty" }]);
  });

  it("names the unit and decimal places a column is shown in", () => {
    expect(
      viewParts(
        {
          ...emptyView,
          units: { effort: "person-weeks" },
          places: { effort: 1 },
        },
        [column({ unit: weeks, places: 1 })],
      ),
    ).toEqual([
      { name: "Units", value: "Effort in person-weeks to 1 decimal place" },
    ]);
  });

  it("names a column hidden at first only once the view shows it", () => {
    const key = column({ key: "key", label: "Key", hiddenAtFirst: true });
    const code = column({ key: "code", label: "Code", kind: "text" });
    expect(viewParts(emptyView, [key, code])).toEqual([]);
    expect(
      viewParts({ ...emptyView, hidden: ["code"], shown: ["key"] }, [
        key,
        code,
      ]),
    ).toEqual([
      { name: "Hidden", value: "Code" },
      { name: "Shown", value: "Key" },
    ]);
  });

  it("names decimal places alone, and nothing for a unit a column does not take", () => {
    expect(
      viewParts(
        { ...emptyView, units: { effort: "hours" }, places: { effort: 0 } },
        [column({ places: 0 })],
      ),
    ).toEqual([{ name: "Units", value: "Effort to 0 decimal places" }]);
  });
});

describe("viewParts of a grouping and a page's choices", () => {
  const toggle: ViewChoice = {
    label: "Show retired",
    count: 1,
    on: (view) => view.retired === true,
    turned: (view) => view,
    part: { name: "Show", value: "Retired schedules" },
  };
  const groupings = [
    { key: "status", label: "Status", holds: "list" as const },
    { key: "site", label: "Site", holds: "names" as const },
  ];

  it("names the choices first, each only when set, then the grouping", () => {
    expect(
      viewParts(
        {
          ...emptyView,
          retired: true,
          grouping: "site",
        },
        [],
        [],
        { groupings, choices: [toggle] },
      ),
    ).toEqual([
      { name: "Show", value: "Retired schedules" },
      { name: "Group by", value: "Site" },
    ]);
    expect(
      viewParts(emptyView, [], [], { groupings, choices: [toggle] }),
    ).toEqual([]);
  });

  it("names no grouping for rows in one list", () => {
    expect(
      viewParts({ ...emptyView, grouping: "none" }, [], [], { groupings }),
    ).toEqual([]);
  });

  it("names both groupings once rows are grouped again under each heading", () => {
    expect(
      viewParts({ ...emptyView, grouping: "site", thenBy: "status" }, [], [], {
        groupings,
      }),
    ).toEqual([{ name: "Group by", value: "Site, then Status" }]);
  });

  it("names the groups' order once they run the other way, in the first grouping's words", () => {
    expect(
      viewParts(
        {
          ...emptyView,
          grouping: "site",
          thenBy: "status",
          groupsReversed: true,
        },
        [],
        [],
        { groupings },
      ),
    ).toEqual([
      { name: "Group by", value: "Site, then Status" },
      { name: "Group order", value: "Z to A" },
    ]);
  });

  it("leaves out a second grouping the rows can't be under", () => {
    expect(
      viewParts({ ...emptyView, thenBy: "site" }, [], [], { groupings }),
    ).toEqual([]);
    expect(
      viewParts({ ...emptyView, grouping: "site", thenBy: "site" }, [], [], {
        groupings,
      }),
    ).toEqual([{ name: "Group by", value: "Site" }]);
  });
});

describe("viewParts of hidden columns", () => {
  const name = column({ key: "name", label: "Name", kind: "text" });
  const site = column({ key: "site", label: "Site", kind: "text" });
  const grade = column({ key: "grade", label: "Grade", kind: "text" });

  it("names the hidden columns in the table's order, and the frozen ones among those shown", () => {
    expect(
      viewParts({ ...emptyView, hidden: ["site", "grade"], frozen: 2 }, [
        name,
        grade,
        site,
        column({}),
      ]),
    ).toEqual([
      { name: "Frozen", value: "Up to Effort" },
      { name: "Hidden", value: "Grade, Site" },
    ]);
  });
});

describe("describeFilter of every value that isn't empty", () => {
  it("names it in words matching the column's Empty box, alone", () => {
    expect(
      describeFilter(column({ label: "Onboarding", kind: "note" }), {
        notEmpty: true,
        contains: "plan",
      }),
    ).toBe("Onboarding: Not empty");
    expect(
      describeFilter(column({ label: "Start", kind: "date" }), {
        notEmpty: true,
      }),
    ).toBe("Start: Any date");
    expect(describeFilter(column({}), { notEmpty: true })).toBe(
      "Effort: Any number",
    );
  });
});

describe("missingWords", () => {
  it("names the columns a view uses that the role can't see, then its groupings", () => {
    expect(
      missingWords({
        id: "v1",
        name: "Fictional",
        missing: { columns: ["Site", "Grade"], groupings: ["Manager"] },
      }),
    ).toEqual([
      "Uses Site and Grade, which this role can't see.",
      "Grouped by Manager, which this role can't see.",
    ]);
    expect(
      missingWords({
        id: "v1",
        name: "Fictional",
        missing: { columns: [], groupings: ["Manager", "Site"] },
      }),
    ).toEqual(["Grouped by Manager and Site, which this role can't see."]);
    expect(
      missingWords({
        id: "v1",
        name: "Fictional",
        missing: { columns: [], groupings: [] },
      }),
    ).toEqual([]);
  });
});
