// SPDX-License-Identifier: Apache-2.0

// Tests for allocations kept from a month: the percentage in force, what a change makes of the
// months, the runs of months two versions differ in, which changes a request may ask for, a
// month's total, and how it is marked.

import { describe, expect, it } from "vitest";
import {
  allocationChangeSchema,
  allocationMonthsSchema,
  allocatedTotal,
  changedSpans,
  loadMark,
  monthCapacity,
  summedCapacity,
  percentageIn,
  tidiedMonths,
  withChange,
} from "./allocations.ts";

const personId = "6f1c2a52-6d55-4a40-9b0e-3b8b0a1e2c11";
const plannedHireId = "9a3e5c71-2b14-4f0d-8e6a-5d2c7b1f4e22";
const featureId = "2d8b4f93-7c26-4e1a-9f3b-1e6d8a2c5b33";
const activityId = "4b7e1d26-8a35-4c9f-b2e1-7f3a6c8d9e44";

describe("percentageIn", () => {
  const months = { "2026-11": 50, "2027-03": 100, "2027-06": null };

  it("is none before the first month", () => {
    expect(percentageIn(months, "2026-10")).toBeNull();
  });

  it("is the percentage from the last month given then or before", () => {
    expect(percentageIn(months, "2026-11")).toBe(50);
    expect(percentageIn(months, "2027-02")).toBe(50);
    expect(percentageIn(months, "2027-04")).toBe(100);
  });

  it("is none once the allocation stops", () => {
    expect(percentageIn(months, "2028-01")).toBeNull();
  });
});

describe("tidiedMonths", () => {
  it("leaves out a stop with nothing before it, and a month that repeats the one before", () => {
    expect(
      tidiedMonths({ "2027-01": 50, "2026-10": null, "2027-04": 50 }),
    ).toEqual({ "2027-01": 50 });
  });

  it("is empty when nothing is ever allocated", () => {
    expect(tidiedMonths({ "2027-01": null })).toEqual({});
  });
});

describe("withChange", () => {
  it("allocates from a month with no end", () => {
    expect(withChange({}, { percentage: 50, from: "2027-01" })).toEqual({
      "2027-01": 50,
    });
  });

  it("saves a range as its first month and a stop the month after its last", () => {
    expect(
      withChange({}, { percentage: 50, from: "2027-01", to: "2027-06" }),
    ).toEqual({ "2027-01": 50, "2027-07": null });
  });

  it("keeps the months around one month changed within a range", () => {
    expect(
      withChange(
        { "2027-01": 50, "2027-07": null },
        { percentage: 100, from: "2027-03", to: "2027-03" },
      ),
    ).toEqual({
      "2027-01": 50,
      "2027-03": 100,
      "2027-04": 50,
      "2027-07": null,
    });
  });

  it("replaces the months a change covers, keeping a change that follows it", () => {
    expect(
      withChange(
        { "2027-01": 50, "2027-03": 75, "2027-05": 25 },
        { percentage: 100, from: "2027-02", to: "2027-04" },
      ),
    ).toEqual({ "2027-01": 50, "2027-02": 100, "2027-05": 25 });
  });

  it("stops an allocation from a month", () => {
    expect(
      withChange({ "2027-01": 50 }, { percentage: null, from: "2027-04" }),
    ).toEqual({ "2027-01": 50, "2027-04": null });
  });

  it("leaves no months once a change stops every month allocated", () => {
    expect(
      withChange(
        { "2027-01": 50, "2027-03": null },
        { percentage: null, from: "2027-01", to: "2027-02" },
      ),
    ).toEqual({});
  });

  it("changes nothing when the change gives the percentage already in force", () => {
    expect(
      withChange(
        { "2027-01": 50 },
        { percentage: 50, from: "2027-03", to: "2027-04" },
      ),
    ).toEqual({ "2027-01": 50 });
  });
});

describe("changedSpans", () => {
  it("is empty when nothing differs", () => {
    expect(changedSpans({ "2027-01": 50 }, { "2027-01": 50 })).toEqual([]);
  });

  it("gives a run with an end where the versions meet again", () => {
    expect(changedSpans({}, { "2027-01": 50, "2027-07": null })).toEqual([
      { from: "2027-01", to: "2027-06", percentage: 50 },
    ]);
  });

  it("gives a run with no end when the difference runs on", () => {
    expect(
      changedSpans({ "2027-01": 50, "2027-07": null }, { "2027-01": 50 }),
    ).toEqual([{ from: "2027-07", percentage: 50 }]);
  });

  it("gives a stop as a run with no percentage", () => {
    expect(
      changedSpans({ "2027-01": 50 }, { "2027-01": 50, "2027-04": null }),
    ).toEqual([{ from: "2027-04", percentage: null }]);
  });
});

describe("allocationMonthsSchema", () => {
  it("accepts any whole percentage up to a whole month, and stops", () => {
    expect(
      allocationMonthsSchema.safeParse({ "2027-01": 35, "2027-02": null })
        .success,
    ).toBe(true);
  });

  it.each([
    ["no percentage", { "2027-01": 0 }],
    ["more than a whole month", { "2027-01": 101 }],
    ["part of a percent", { "2027-01": 12.5 }],
    ["a day for a month", { "2027-01-01": 50 }],
  ])("rejects %s", (_, months) => {
    expect(allocationMonthsSchema.safeParse(months).success).toBe(false);
  });
});

describe("allocationChangeSchema", () => {
  const change = { personId, featureId, percentage: 50, from: "2027-01" };

  it("accepts a person or a planned hire, with or without a last month", () => {
    expect(allocationChangeSchema.safeParse(change).success).toBe(true);
    expect(
      allocationChangeSchema.safeParse({
        plannedHireId,
        featureId,
        percentage: null,
        from: "2027-01",
        to: "2027-01",
      }).success,
    ).toBe(true);
  });

  it("accepts an activity in place of a feature", () => {
    expect(
      allocationChangeSchema.safeParse({
        ...change,
        featureId: undefined,
        activityId,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["both a person and a planned hire", { ...change, plannedHireId }],
    ["both a feature and an activity", { ...change, activityId }],
    ["neither a feature nor an activity", { ...change, featureId: undefined }],
    ["neither a person nor a planned hire", { ...change, personId: undefined }],
    ["a percentage not offered", { ...change, percentage: 35 }],
    ["a last month before the first", { ...change, to: "2026-12" }],
    ["a feature that is not an identifier", { ...change, featureId: "x" }],
  ])("rejects %s", (_, asked) => {
    expect(allocationChangeSchema.safeParse(asked).success).toBe(false);
  });
});

describe("allocatedTotal", () => {
  it("adds up a month's allocations, leaving out Possible features", () => {
    expect(
      allocatedTotal([
        { percentage: 50, meaning: "in-progress" },
        { percentage: 25, meaning: "possible" },
        { percentage: 10, meaning: null },
      ]),
    ).toBe(60);
  });

  it("counts done and cancelled features, whose allocations are time spent", () => {
    expect(
      allocatedTotal([
        { percentage: 75, meaning: "done" },
        { percentage: 50, meaning: "cancelled" },
      ]),
    ).toBe(125);
  });

  it("is nothing for a month with no allocations", () => {
    expect(allocatedTotal([])).toBe(0);
  });
});

describe("loadMark", () => {
  const current = { month: "2027-03", currentMonth: "2027-03" };

  it("marks a total over a whole month as over", () => {
    expect(loadMark({ ...current, total: 125, allocatable: true })).toBe(
      "over",
    );
  });

  it("marks over even in a month someone cannot be allocated in", () => {
    expect(loadMark({ ...current, total: 110, allocatable: false })).toBe(
      "over",
    );
  });

  it("marks a total under a whole month as under, nothing allocated included", () => {
    expect(loadMark({ ...current, total: 75, allocatable: true })).toBe(
      "under",
    );
    expect(loadMark({ ...current, total: 0, allocatable: true })).toBe("under");
  });

  it("leaves a whole month unmarked", () => {
    expect(
      loadMark({ ...current, total: 100, allocatable: true }),
    ).toBeUndefined();
  });

  it("leaves a month someone cannot be allocated in unmarked when under", () => {
    expect(
      loadMark({ ...current, total: 0, allocatable: false }),
    ).toBeUndefined();
  });

  it("marks later months, and leaves past months unmarked", () => {
    expect(
      loadMark({
        total: 150,
        month: "2027-04",
        currentMonth: "2027-03",
        allocatable: true,
      }),
    ).toBe("over");
    expect(
      loadMark({
        total: 150,
        month: "2027-02",
        currentMonth: "2027-03",
        allocatable: true,
      }),
    ).toBeUndefined();
  });
});

describe("monthCapacity", () => {
  it("holds a whole month with its total when someone can be allocated in it", () => {
    expect(monthCapacity({ total: 75, allocatable: true })).toEqual({
      allocated: 75,
      available: 100,
    });
  });

  it("holds nothing, not even its allocations, when they cannot be", () => {
    expect(monthCapacity({ total: 50, allocatable: false })).toEqual({
      allocated: 0,
      available: 0,
    });
  });
});

describe("summedCapacity", () => {
  it("adds up what is allocated and what is available", () => {
    expect(
      summedCapacity([
        { allocated: 75, available: 100 },
        { allocated: 120, available: 100 },
      ]),
    ).toEqual({ allocated: 195, available: 200 });
  });

  it("is nothing for no months", () => {
    expect(summedCapacity([])).toEqual({ allocated: 0, available: 0 });
  });
});
