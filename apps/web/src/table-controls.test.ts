// SPDX-License-Identifier: Apache-2.0

// Tests for the parts of a view the Save view dialog names, for those the table's other tests do
// not reach: the units and decimal places columns are shown in.

import { describe, expect, it } from "vitest";
import { viewParts } from "./table-controls.tsx";
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
          frozen: 1,
          order: ["effort", "name"],
          widths: { name: 240 },
          units: { effort: "person-weeks" },
        },
        [name, effort],
      ),
    ).toEqual([
      { name: "Search", value: "“fictional”" },
      { name: "Filter", value: "Name contains “Atlas”" },
      { name: "Sort", value: "Name ↑, Effort ↓" },
      { name: "Draft", value: "Drafts applied" },
      { name: "Metrics", value: "Name" },
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
    ).toEqual([{ name: "Filter", value: "Name empty" }]);
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

  it("names decimal places alone, and nothing for a unit a column does not take", () => {
    expect(
      viewParts(
        { ...emptyView, units: { effort: "hours" }, places: { effort: 0 } },
        [column({ places: 0 })],
      ),
    ).toEqual([{ name: "Units", value: "Effort to 0 decimal places" }]);
  });
});
