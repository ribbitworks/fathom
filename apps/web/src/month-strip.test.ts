// SPDX-License-Identifier: Apache-2.0

// Tests for the strip of quarters above a month grid: the quarters its months fall in, the quarters
// the arrows step to, which columns are on screen, the month a grid's count is for, and where the
// grid scrolls to show a month.

import { describe, expect, it } from "vitest";
import {
  columnsOnScreen,
  countedColumn,
  monthQuarters,
  quarterSteps,
  scrollTargetFor,
} from "./month-strip.ts";

const months = [
  "2026-11",
  "2026-12",
  "2027-01",
  "2027-02",
  "2027-03",
  "2027-04",
];

describe("monthQuarters", () => {
  it("lists the quarters the months fall in, with their months, cut short at the ends", () => {
    expect(monthQuarters(months)).toEqual([
      {
        start: "2026-10",
        label: "Q4 2026",
        short: "Q4",
        months: ["2026-11", "2026-12"],
      },
      {
        start: "2027-01",
        label: "Q1 2027",
        short: "Q1",
        months: ["2027-01", "2027-02", "2027-03"],
      },
      { start: "2027-04", label: "Q2 2027", short: "Q2", months: ["2027-04"] },
    ]);
  });

  it("has no quarters without months", () => {
    expect(monthQuarters([])).toEqual([]);
  });
});

describe("quarterSteps", () => {
  const quarters = monthQuarters(months);
  const starts = (firstOnScreen: string) => {
    const { previous, next } = quarterSteps(quarters, firstOnScreen);
    return [previous?.start, next?.start];
  };

  it("steps from a quarter's start to the quarters before and after it", () => {
    expect(starts("2027-01")).toEqual(["2026-10", "2027-04"]);
  });

  it("steps back to the start of the quarter on screen when partway into it", () => {
    expect(starts("2027-02")).toEqual(["2027-01", "2027-04"]);
  });

  it("steps on to the first quarter from a month before every quarter", () => {
    expect(starts("2026-01")).toEqual([undefined, "2026-10"]);
  });

  it("has nothing to step to beyond the first and last quarters", () => {
    expect(starts("2026-11")).toEqual([undefined, "2027-01"]);
    expect(starts("2027-04")).toEqual(["2027-01", undefined]);
  });
});

describe("columnsOnScreen", () => {
  // A frozen column 150 wide, then columns 100 wide.
  const columns = [
    { key: "name", left: 0, width: 150 },
    { key: "a", left: 150, width: 100 },
    { key: "b", left: 250, width: 100 },
    { key: "c", left: 350, width: 100 },
    { key: "d", left: 450, width: 100 },
  ];

  it("counts the frozen columns, and those at least half in view beside them", () => {
    expect(
      columnsOnScreen(columns, { scrolled: 0, room: 400, frozenWidth: 150 }),
    ).toEqual(["name", "a", "b", "c"]);
  });

  it("leaves out a column scrolled more than half under the frozen ones", () => {
    expect(
      columnsOnScreen(columns, { scrolled: 60, room: 400, frozenWidth: 150 }),
    ).toEqual(["name", "b", "c"]);
  });

  it("counts every column in view when none is frozen", () => {
    expect(
      columnsOnScreen(columns, { scrolled: 210, room: 300, frozenWidth: 0 }),
    ).toEqual(["b", "c", "d"]);
  });
});

describe("countedColumn", () => {
  // Months 100 wide after a frozen column 150 wide.
  const months = [
    { key: "a", left: 150, width: 100 },
    { key: "b", left: 250, width: 100 },
    { key: "c", left: 350, width: 100 },
  ];

  it("is the grid's first month while it is wholly in view", () => {
    expect(countedColumn(months, { scrolled: 0, frozenWidth: 150 })).toBe("a");
  });

  it("is the month after the one just at the frozen columns' edge, which shows the month before it", () => {
    expect(countedColumn(months, { scrolled: 100, frozenWidth: 150 })).toBe(
      "c",
    );
  });

  it("is the first whole month when the month before it is partly hidden", () => {
    expect(countedColumn(months, { scrolled: 10, frozenWidth: 150 })).toBe("b");
  });

  it("is the last month when it is the only one wholly in view", () => {
    expect(countedColumn(months, { scrolled: 200, frozenWidth: 150 })).toBe(
      "c",
    );
  });

  it("is none before the grid is laid out", () => {
    expect(countedColumn([], { scrolled: 0, frozenWidth: 0 })).toBeUndefined();
  });
});

describe("scrollTargetFor", () => {
  it("scrolls to the month before, so it shows beside the month", () => {
    expect(scrollTargetFor("2027-04", "2026-01")).toBe("2027-03");
  });

  it("scrolls to the grid's first month itself, with none before it", () => {
    expect(scrollTargetFor("2026-01", "2026-01")).toBe("2026-01");
  });
});
