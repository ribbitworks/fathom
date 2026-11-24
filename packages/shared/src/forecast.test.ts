// SPDX-License-Identifier: Apache-2.0

// Tests for the forecast of work: delivered hours, the effort needed, a work's window of months and
// how its effort spreads over them.

import { describe, expect, it } from "vitest";
import {
  deliveredHours,
  effortNeeded,
  monthsThrough,
  neededByMonth,
  rampUpPercent,
  workWindow,
} from "./forecast.ts";

const settings = {
  hoursPerDay: 8,
  daysPerMonth: 20,
  focusPercent: 80,
  rampUpPercents: [50, 75],
};

describe("rampUpPercent", () => {
  it("gives each ramp-up month's share from the first month, then full output", () => {
    expect(rampUpPercent("2027-01", "2027-01", [50, 75])).toBe(50);
    expect(rampUpPercent("2027-02", "2027-01", [50, 75])).toBe(75);
    expect(rampUpPercent("2027-03", "2027-01", [50, 75])).toBe(100);
  });

  it("gives full output before the first month, or with no first month known", () => {
    expect(rampUpPercent("2026-12", "2027-01", [50, 75])).toBe(100);
    expect(rampUpPercent("2027-01", undefined, [50, 75])).toBe(100);
  });
});

describe("deliveredHours", () => {
  it("gives the month's hours at the percentage allocated and the focus", () => {
    // 8 h × 20 days = 160 h; half of it at 80% focus.
    expect(deliveredHours({ percentage: 50, month: "2027-03", settings })).toBe(
      64,
    );
  });

  it("gives less in a ramp-up month", () => {
    expect(
      deliveredHours({
        percentage: 100,
        month: "2027-01",
        firstMonth: "2027-01",
        settings,
      }),
    ).toBe(64);
  });
});

describe("effortNeeded", () => {
  it("adds the buffer to the estimate", () => {
    expect(effortNeeded(100, 20)).toBe(120);
    expect(effortNeeded(100, 0)).toBe(100);
  });

  it("needs nothing known without an estimate", () => {
    expect(effortNeeded(null, 20)).toBeUndefined();
    expect(effortNeeded(undefined, 20)).toBeUndefined();
  });
});

describe("monthsThrough", () => {
  it("lists every month from the first to the last, across a year", () => {
    expect(monthsThrough("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("lists none when the last comes first", () => {
    expect(monthsThrough("2027-02", "2027-01")).toEqual([]);
  });
});

describe("workWindow", () => {
  it("takes the target cycle's months first", () => {
    expect(
      workWindow(
        { cycleMonths: ["2027-01", "2027-02", "2027-03"], neededBy: "2027-06" },
        [],
        "2026-11",
      ),
    ).toEqual(["2027-01", "2027-02", "2027-03"]);
  });

  it("runs from the current month to Needed by with no cycle", () => {
    expect(workWindow({ neededBy: "2027-01" }, [], "2026-11")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("widens to every month allocations deliver in", () => {
    expect(
      workWindow({ cycleMonths: ["2027-02"] }, ["2026-12"], "2026-11"),
    ).toEqual(["2026-12", "2027-01", "2027-02"]);
  });

  it("is the allocations' months alone with no plan", () => {
    expect(workWindow({}, ["2027-01"], "2026-11")).toEqual(["2027-01"]);
  });

  it("is none with no plan and no allocations, so the work is done Later", () => {
    expect(workWindow({ cycleMonths: [] }, [], "2026-11")).toBeUndefined();
    expect(workWindow({ neededBy: null }, [], "2026-11")).toBeUndefined();
  });
});

describe("neededByMonth", () => {
  it("spreads what is left after past months evenly over the months to come", () => {
    // Given 120 h needed over January to March, seen in February, with 30 h allocated in January
    const coverage = neededByMonth({
      needed: 120,
      plan: { cycleMonths: ["2027-01", "2027-02", "2027-03"] },
      allocatedByMonth: new Map([
        ["2027-01", 30],
        ["2027-02", 40],
        ["2027-03", 20],
      ]),
      currentMonth: "2027-02",
    });

    // Then January shows its hours alone, and the 90 h left are split between February and March
    expect(coverage).toEqual({
      months: [
        { month: "2027-01", allocated: 30 },
        { month: "2027-02", allocated: 40, needed: 45 },
        { month: "2027-03", allocated: 20, needed: 45 },
      ],
    });
  });

  it("needs nothing more once past months have covered the effort", () => {
    const coverage = neededByMonth({
      needed: 20,
      plan: { cycleMonths: ["2027-01", "2027-02"] },
      allocatedByMonth: new Map([["2027-01", 30]]),
      currentMonth: "2027-02",
    });
    expect(coverage.months.at(-1)).toEqual({
      month: "2027-02",
      allocated: 0,
      needed: 0,
    });
  });

  it("needs what is left in the current month once the window has passed", () => {
    const coverage = neededByMonth({
      needed: 50,
      plan: { cycleMonths: ["2027-01"] },
      allocatedByMonth: new Map([["2027-01", 30]]),
      currentMonth: "2027-04",
    });
    expect(coverage.months).toEqual([
      { month: "2027-01", allocated: 30 },
      { month: "2027-04", allocated: 0, needed: 20 },
    ]);
  });

  it("shows allocated hours alone for a work with no effort", () => {
    const coverage = neededByMonth({
      needed: undefined,
      plan: { neededBy: "2026-12" },
      allocatedByMonth: new Map([["2026-11", 16]]),
      currentMonth: "2026-11",
    });
    expect(coverage.months).toEqual([
      { month: "2026-11", allocated: 16 },
      { month: "2026-12", allocated: 0 },
    ]);
  });

  it("needs all of it Later with no window", () => {
    expect(
      neededByMonth({
        needed: 80,
        plan: {},
        allocatedByMonth: new Map(),
        currentMonth: "2026-11",
      }),
    ).toEqual({ months: [], later: { allocated: 0, needed: 80 } });
    expect(
      neededByMonth({
        needed: undefined,
        plan: {},
        allocatedByMonth: new Map(),
        currentMonth: "2026-11",
      }),
    ).toEqual({ months: [], later: { allocated: 0 } });
  });
});
