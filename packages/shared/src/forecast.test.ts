// SPDX-License-Identifier: Apache-2.0

// Tests for the forecast of work: delivered hours, the effort needed, a work's planned months and
// how its effort spreads over them.

import { describe, expect, it } from "vitest";
import {
  coverageByMonth,
  deliveredHours,
  effortNeeded,
  firstMonthEmployed,
  isForecast,
  plannedMonths,
  rampUpPercent,
  targetCycleMonths,
  allocationHours,
  hoursAllocated,
  remainingHours,
  wholeMonthHoursIn,
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

  it("gives an exact figure where dividing as it goes would drift", () => {
    // 160 h at 30%, 70% focus, in a 50% ramp-up month: 16.8 h, not 16.799999999999997.
    expect(
      deliveredHours({
        percentage: 30,
        month: "2027-01",
        firstMonth: "2027-01",
        settings: { ...settings, focusPercent: 70 },
      }),
    ).toBe(16.8);
  });
});

describe("isForecast", () => {
  it("forecasts work still to be done, and none done or cancelled", () => {
    expect(isForecast("in-progress")).toBe(true);
    expect(isForecast("planned")).toBe(true);
    expect(isForecast(null)).toBe(true);
    expect(isForecast("done")).toBe(false);
    expect(isForecast("cancelled")).toBe(false);
  });
});

describe("effortNeeded", () => {
  it("adds the buffer to the estimate", () => {
    expect(effortNeeded(100, 20)).toBe(120);
    expect(effortNeeded(100, 0)).toBe(100);
  });

  it("gives an exact figure where dividing first would drift", () => {
    expect(effortNeeded(50, 15)).toBe(57.5);
  });

  it("needs nothing known without an estimate", () => {
    expect(effortNeeded(null, 20)).toBeUndefined();
    expect(effortNeeded(undefined, 20)).toBeUndefined();
  });
});

describe("firstMonthEmployed", () => {
  it("finds the month someone starts in, after months not employed", () => {
    expect(
      firstMonthEmployed(new Set(["2027-01"]), [
        "2027-01",
        "2027-02",
        "2027-03",
      ]),
    ).toBe("2027-02");
  });

  it("finds the month someone comes back in, after months away in the middle", () => {
    expect(
      firstMonthEmployed(new Set(["2027-02"]), [
        "2027-01",
        "2027-02",
        "2027-03",
      ]),
    ).toBe("2027-03");
  });

  it("finds none for someone employed from the first month on", () => {
    expect(
      firstMonthEmployed(new Set(["2027-03"]), [
        "2027-01",
        "2027-02",
        "2027-03",
      ]),
    ).toBeUndefined();
  });
});

describe("targetCycleMonths", () => {
  const streams = [
    {
      id: "s-majors",
      cycles: [
        {
          startsOn: "2027-01-01",
          endsOn: "2027-03-31",
          name: "27.1",
          months: ["2027-01", "2027-02", "2027-03"].map((month) => ({
            month,
            share: 1,
          })),
        },
      ],
    },
  ];

  it("gives the months of the cycle a feature targets", () => {
    expect(
      targetCycleMonths(
        { targetStreamId: "s-majors", targetCycle: "2027-01-01" },
        streams,
      ),
    ).toEqual(["2027-01", "2027-02", "2027-03"]);
  });

  it("gives none for a feature with no target, or one no longer laid out", () => {
    expect(
      targetCycleMonths({ targetStreamId: null, targetCycle: null }, streams),
    ).toBeUndefined();
    expect(
      targetCycleMonths(
        { targetStreamId: "s-majors", targetCycle: "2029-01-01" },
        streams,
      ),
    ).toBeUndefined();
  });
});

describe("plannedMonths", () => {
  it("takes the target cycle's months first", () => {
    expect(
      plannedMonths(
        { cycleMonths: ["2027-01", "2027-02", "2027-03"], neededBy: "2027-06" },
        "2026-11",
      ),
    ).toEqual(["2027-01", "2027-02", "2027-03"]);
  });

  it("runs from the current month to Needed by with no cycle", () => {
    expect(plannedMonths({ neededBy: "2027-01" }, "2026-11")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("is the current month alone once Needed by has passed", () => {
    expect(plannedMonths({ neededBy: "2026-06" }, "2026-11")).toEqual([
      "2026-11",
    ]);
  });

  it("is none with no plan", () => {
    expect(plannedMonths({ cycleMonths: [] }, "2026-11")).toBeUndefined();
    expect(plannedMonths({ neededBy: null }, "2026-11")).toBeUndefined();
  });
});

describe("coverageByMonth", () => {
  it("spreads what is left after past months evenly over the months to come", () => {
    // Given 120 h needed over January to March, seen in February, with 30 h allocated in January
    const coverage = coverageByMonth({
      effort: 120,
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

  it("spreads the effort over a cycle wholly to come", () => {
    const coverage = coverageByMonth({
      effort: 60,
      plan: { cycleMonths: ["2027-03", "2027-04"] },
      allocatedByMonth: new Map(),
      currentMonth: "2027-01",
    });
    expect(coverage.months).toEqual([
      { month: "2027-03", allocated: 0, needed: 30 },
      { month: "2027-04", allocated: 0, needed: 30 },
    ]);
  });

  it("shows a month allocated outside the plan with its hours alone, the need kept to the plan", () => {
    // Given 90 h planned over January to March, seen in January, with 10 h allocated in June
    const coverage = coverageByMonth({
      effort: 90,
      plan: { cycleMonths: ["2027-01", "2027-02", "2027-03"] },
      allocatedByMonth: new Map([["2027-06", 10]]),
      currentMonth: "2027-01",
    });

    // Then each planned month needs 30 h, and June shows its 10 h alone
    expect(coverage.months).toEqual([
      { month: "2027-01", allocated: 0, needed: 30 },
      { month: "2027-02", allocated: 0, needed: 30 },
      { month: "2027-03", allocated: 0, needed: 30 },
      { month: "2027-06", allocated: 10 },
    ]);
  });

  it("needs nothing more once past months have covered the effort", () => {
    const coverage = coverageByMonth({
      effort: 20,
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

  it("needs what is left in the current month once the plan has passed", () => {
    const coverage = coverageByMonth({
      effort: 50,
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
    const coverage = coverageByMonth({
      effort: undefined,
      plan: { neededBy: "2026-12" },
      allocatedByMonth: new Map([["2026-11", 16]]),
      currentMonth: "2026-11",
    });
    expect(coverage).toEqual({
      months: [
        { month: "2026-11", allocated: 16 },
        { month: "2026-12", allocated: 0 },
      ],
    });
  });

  it("needs what is left Later with no months planned, its allocated months shown alone", () => {
    expect(
      coverageByMonth({
        effort: 80,
        plan: {},
        allocatedByMonth: new Map([
          ["2026-10", 30],
          ["2026-12", 8],
        ]),
        currentMonth: "2026-11",
      }),
    ).toEqual({
      months: [
        { month: "2026-10", allocated: 30 },
        { month: "2026-12", allocated: 8 },
      ],
      later: { needed: 50 },
    });
    expect(
      coverageByMonth({
        effort: undefined,
        plan: {},
        allocatedByMonth: new Map(),
        currentMonth: "2026-11",
      }),
    ).toEqual({ months: [] });
  });
});

describe("allocationHours", () => {
  it("gives a whole month's hours after focus, and each ramp-up month's from the first month", () => {
    expect(allocationHours("2027-03", settings)).toEqual({
      full: 128,
      rampUp: { "2027-03": 64, "2027-04": 96 },
    });
  });

  it("gives no ramp-up without a first month", () => {
    expect(allocationHours(undefined, settings)).toEqual({
      full: 128,
      rampUp: {},
    });
  });
});

describe("hoursAllocated", () => {
  const hours = { full: 128, rampUp: { "2027-03": 64 } };

  it("counts every month at the percentage in force, between the months it changes in, and none after it stops", () => {
    expect(
      hoursAllocated({ "2027-03": 50, "2027-05": null }, hours, [
        "2027-02",
        "2027-03",
        "2027-04",
        "2027-05",
      ]),
    ).toBe(32 + 64);
  });

  it("reads a ramp-up month's hours, then full output", () => {
    expect([
      wholeMonthHoursIn(hours, "2027-03"),
      wholeMonthHoursIn(hours, "2027-04"),
    ]).toEqual([64, 128]);
  });
});

describe("remainingHours", () => {
  it("takes the hours allocated off those needed, below zero once over, and none without an estimate", () => {
    expect([
      remainingHours(384, 256),
      remainingHours(144, 150),
      remainingHours(null, 40),
    ]).toEqual([128, -6, undefined]);
  });
});
