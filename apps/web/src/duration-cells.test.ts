// SPDX-License-Identifier: Apache-2.0

// Tests for a Duration column's cells: a length's size, its amount in the column's unit, how it is
// shown, read, pasted and exported, empty or not.

import { describe, expect, it } from "vitest";
import { cellKinds } from "./cell-kinds.tsx";
import {
  lengthDays,
  lengthIn,
  lengthUnit,
  shownLength,
  unitName,
} from "./duration-cells.ts";
import { exportValue } from "./exports.ts";

const inWeeks = { lengths: { own: "d", shown: "wk" } } as const;
const asTyped = { lengths: { own: "mo", shown: undefined } } as const;

describe("a length's size and amount", () => {
  it("is nothing for an empty cell", () => {
    expect(lengthDays("")).toBe(0);
    expect(lengthIn(inWeeks, "")).toBe(0);
  });

  it("is in the unit shown, or the column's own while shown as typed, or days for neither", () => {
    expect(lengthUnit(inWeeks)).toBe("wk");
    expect(lengthUnit(asTyped)).toBe("mo");
    expect(lengthUnit({})).toBe("d");
    expect(lengthIn(inWeeks, "14 d")).toBe(2);
  });

  it("is shown as typed while the column shows lengths as typed, or for an empty cell", () => {
    expect(shownLength(asTyped, "2 wk", 1)).toBe("2 wk");
    expect(shownLength(inWeeks, "", 1)).toBe("");
    expect(shownLength(inWeeks, "10 d", 1)).toBe("1.4 wk");
  });
});

describe("a unit's name", () => {
  it.each([
    ["d", "calendar days"],
    ["wd", "working days"],
    ["wk", "weeks"],
    ["mo", "months"],
  ] as const)("names %s as %s", (unit, name) => {
    expect(unitName(unit)).toBe(name);
  });
});

describe("a Duration cell", () => {
  const { duration } = cellKinds;
  const column = {
    key: "f1",
    label: "Notice given",
    choices: [],
    multiple: false,
    required: false,
  };

  it("shows a length as typed in a draft's details", () => {
    expect(duration.inDetail(column, "−1 mo")).toBe("−1 mo");
  });

  it("takes pasted text as typed, trimmed", () => {
    expect(duration.pasted(column, " 2 wk ")).toEqual({ value: "2 wk" });
  });

  it("saves a bare number in days for a column naming no unit", () => {
    expect(duration.change("f1", "3")).toEqual({
      durations: { f1: { amount: 3, unit: "d" } },
    });
  });

  it("is exported as an amount of the unit shown, whole for a column naming no places", () => {
    expect(
      exportValue(
        {
          ...column,
          kind: "duration",
          value: () => "10 d",
          lengths: inWeeks.lengths,
        },
        {},
      ),
    ).toBe("1");
  });
});
