// SPDX-License-Identifier: Apache-2.0

// Tests for the planning settings: what each setting accepts, and changing some of them alone.

import { describe, expect, it } from "vitest";
import {
  planningSettingsChangeSchema,
  planningSettingsSchema,
  startingPlanningSettings,
  changedSettings,
} from "./planning-settings.ts";

describe("planningSettingsSchema", () => {
  it("accepts the starting settings", () => {
    expect(planningSettingsSchema.parse(startingPlanningSettings)).toEqual(
      startingPlanningSettings,
    );
  });

  it.each([
    [
      "full focus and the largest buffer",
      { focusPercent: 100, bufferPercent: 100 },
    ],
    ["no ramp-up", { rampUpPercents: [] }],
    [
      "a year of ramp-up",
      { rampUpPercents: Array.from({ length: 12 }, () => 50) },
    ],
  ])("accepts %s", (_case, change) => {
    expect(
      planningSettingsSchema.safeParse({
        ...startingPlanningSettings,
        ...change,
      }).success,
    ).toBe(true);
  });

  it.each([
    [
      "part of a percent of focus",
      { focusPercent: 80.5 },
      "Default focus: use a whole percentage",
    ],
    ["no focus", { focusPercent: 0 }, "Default focus: use 1% to 100%"],
    ["too much focus", { focusPercent: 101 }, "Default focus: use 1% to 100%"],
    [
      "a buffer below nothing",
      { bufferPercent: -1 },
      "Default buffer: use 0% to 100%",
    ],
    [
      "too large a buffer",
      { bufferPercent: 101 },
      "Default buffer: use 0% to 100%",
    ],
    [
      "a month of no ramp-up",
      { rampUpPercents: [0, 75] },
      "Ramp-up: use 1% to 100%",
    ],
    [
      "a month beyond full",
      { rampUpPercents: [50, 101] },
      "Ramp-up: use 1% to 100%",
    ],
    [
      "ramp-up longer than a year",
      { rampUpPercents: Array.from({ length: 13 }, () => 50) },
      "Ramp-up: use up to 12 months",
    ],
  ])("refuses %s", (_case, change, message) => {
    const result = planningSettingsSchema.safeParse({
      ...startingPlanningSettings,
      ...change,
    });
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      message,
    );
  });
});

describe("planningSettingsChangeSchema", () => {
  it("accepts one setting alone", () => {
    expect(planningSettingsChangeSchema.parse({ bufferPercent: 20 })).toEqual({
      bufferPercent: 20,
    });
  });

  it("checks the settings it changes", () => {
    expect(
      planningSettingsChangeSchema.safeParse({ hoursPerDay: 25 }).success,
    ).toBe(false);
  });
});

describe("changedSettings", () => {
  it("changes the settings given, leaving the rest", () => {
    expect(
      changedSettings(startingPlanningSettings, {
        hoursPerDay: 7.5,
        rampUpPercents: [],
      }),
    ).toEqual({
      ...startingPlanningSettings,
      hoursPerDay: 7.5,
      rampUpPercents: [],
    });
  });

  it("keeps every setting for no change", () => {
    expect(changedSettings(startingPlanningSettings, {})).toEqual(
      startingPlanningSettings,
    );
  });
});
