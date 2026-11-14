// SPDX-License-Identifier: Apache-2.0

// Tests for each unit of effort's name in a column's menu, naming the conversions behind it.

import { startingEffortConversions } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { effortColumnUnits, unitLabel } from "./effort.ts";

const labels = (conversions: Parameters<typeof unitLabel>[1]) =>
  effortColumnUnits.map((unit) => unitLabel(unit, conversions));

describe("unitLabel", () => {
  it("names the conversions behind each unit after hours", () => {
    expect(labels(startingEffortConversions)).toEqual([
      "Hours",
      "Person-days (8 hours)",
      "Person-weeks (8h / PD, 5 days / PW)",
      "Person-months (8h / PD, 20 days / PM)",
      "Person-quarters (8h / PD, 60 days / PQ)",
    ]);
  });

  it("gives one hour and one day in the singular, and half hours as decimals", () => {
    expect(
      labels({ hoursPerDay: 1, daysPerWeek: 1, daysPerMonth: 1 }).slice(1, 3),
    ).toEqual(["Person-days (1 hour)", "Person-weeks (1h / PD, 1 day / PW)"]);
    expect(
      unitLabel(effortColumnUnits[0], {
        ...startingEffortConversions,
        hoursPerDay: 7.5,
      }),
    ).toBe("Hours");
    expect(labels({ ...startingEffortConversions, hoursPerDay: 7.5 })[1]).toBe(
      "Person-days (7.5 hours)",
    );
  });
});
