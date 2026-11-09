// SPDX-License-Identifier: Apache-2.0

// Tests for the months a monthly table shows: listing them, and which ranges a reader may ask for.

import { describe, expect, it } from "vitest";
import {
  earliestGridMonth,
  latestGridMonth,
  monthRangeQuerySchema,
  monthsBetween,
} from "./monthly-grid.ts";

describe("monthsBetween", () => {
  it("lists each month, both ends included, across a year's end", () => {
    expect(monthsBetween("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("is one month when the ends are the same", () => {
    expect(monthsBetween("2026-11", "2026-11")).toEqual(["2026-11"]);
  });

  it("lists the latest months a range may reach", () => {
    expect(monthsBetween("2999-11", "2999-12")).toEqual(["2999-11", "2999-12"]);
  });
});

describe("monthRangeQuerySchema", () => {
  const valid = (from: string, to: string) =>
    monthRangeQuerySchema.safeParse({ from, to }).success;

  it("accepts a range up to the most a table shows", () => {
    expect(valid("2025-01", "2025-01")).toBe(true);
    expect(valid("2025-01", "2029-12")).toBe(true);
  });

  it("accepts the earliest and the latest months", () => {
    expect(valid(earliestGridMonth, earliestGridMonth)).toBe(true);
    expect(valid(latestGridMonth, latestGridMonth)).toBe(true);
  });

  it("refuses years that date arithmetic gets wrong or can't write", () => {
    expect(valid("0050-01", "0050-02")).toBe(false);
    expect(valid("1899-12", "1899-12")).toBe(false);
    expect(valid("3000-01", "3000-01")).toBe(false);
    expect(valid("9999-11", "9999-12")).toBe(false);
  });

  it("refuses a range that is backwards, too long, or not of months", () => {
    expect(valid("2025-02", "2025-01")).toBe(false);
    expect(valid("2025-01", "2030-01")).toBe(false);
    expect(valid("2025-13", "2026-01")).toBe(false);
  });
});
