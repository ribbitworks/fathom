// SPDX-License-Identifier: Apache-2.0

// Tests for effort: the conversions between units and rounding up to each unit's step.

import { describe, expect, it } from "vitest";
import {
  type EffortConversions,
  effortConversionsSchema,
  type EffortUnit,
  effortUnits,
  enteredHours,
  exactEffort,
  largestIn,
  shownEffort,
  startingEffortConversions,
} from "./effort.ts";

const starting: EffortConversions = { ...startingEffortConversions };
const shortDays: EffortConversions = {
  hoursPerDay: 7.5,
  daysPerWeek: 5,
  daysPerMonth: 21,
};

describe("enteredHours", () => {
  it.each<[number, EffortUnit, number]>([
    [12, "hours", 12],
    [0, "hours", 0],
    [1, "person-days", 8],
    [2, "person-weeks", 80],
    [1.5, "person-months", 240],
    [1, "person-quarters", 480],
  ])("keeps %d %s as %d hours", (amount, unit, hours) => {
    expect(enteredHours(amount, unit, starting)).toBe(hours);
  });

  it.each<[number, EffortUnit, number]>([
    [0.1, "hours", 1],
    [12.01, "hours", 13],
    [0.2, "person-days", 4],
    [1.6, "person-days", 16],
    [0.1, "person-weeks", 8],
    [0.01, "person-months", 8],
    [0.3, "person-quarters", 144],
  ])("rounds %d %s up to %d hours", (amount, unit, hours) => {
    expect(enteredHours(amount, unit, starting)).toBe(hours);
  });

  it("keeps half a day exactly when a day is not a whole number of hours", () => {
    expect(enteredHours(0.5, "person-days", shortDays)).toBe(3.75);
    expect(enteredHours(1, "person-days", shortDays)).toBe(7.5);
    expect(enteredHours(1, "person-weeks", shortDays)).toBe(37.5);
    expect(enteredHours(1, "person-months", shortDays)).toBe(157.5);
  });

  it("does not round up what floating point adds", () => {
    expect(enteredHours(0.3, "person-months", starting)).toBe(48);
    expect(enteredHours(0.7, "person-weeks", starting)).toBe(32);
  });
});

describe("shownEffort", () => {
  it.each<[number, EffortUnit, number]>([
    [12, "hours", 12],
    [80, "person-days", 10],
    [80, "person-weeks", 2],
    [240, "person-months", 1.5],
    [480, "person-quarters", 1],
    [0, "person-months", 0],
  ])("shows %d hours as %d %s", (hours, unit, amount) => {
    expect(shownEffort(hours, unit, starting)).toBe(amount);
  });

  it.each<[number, EffortUnit, number]>([
    [3, "person-days", 0.5],
    [9, "person-days", 1.5],
    [1, "person-weeks", 0.2],
    [1, "person-months", 0.05],
    [7.5, "hours", 8],
  ])("rounds %d hours up to %d %s", (hours, unit, amount) => {
    expect(shownEffort(hours, unit, starting)).toBe(amount);
  });

  it.each<[number, EffortUnit]>([
    [0.5, "person-days"],
    [1, "person-days"],
    [2.5, "person-days"],
    [1, "person-weeks"],
    [0.2, "person-weeks"],
    [1, "person-months"],
    [2, "person-quarters"],
  ])("reads %d %s back as entered", (amount, unit) => {
    for (const conversions of [starting, shortDays]) {
      expect(
        shownEffort(enteredHours(amount, unit, conversions), unit, conversions),
      ).toBe(amount);
    }
  });

  it("reads every estimate kept to a step back as the same hours, for any conversions", () => {
    // Given conversions whose units hold steps that give repeating decimals, such as sevenths
    const hoursInDays = [0.5, 7, 7.5, 8, 24];
    const mismatches: string[] = [];
    for (const hoursPerDay of hoursInDays) {
      for (let daysPerWeek = 1; daysPerWeek <= 7; daysPerWeek += 1) {
        for (let daysPerMonth = 1; daysPerMonth <= 31; daysPerMonth += 1) {
          const conversions = { hoursPerDay, daysPerWeek, daysPerMonth };
          for (const unit of effortUnits) {
            const step =
              unit === "hours"
                ? 1
                : unit === "person-days"
                  ? hoursPerDay / 2
                  : hoursPerDay;
            for (let steps = 1; steps <= 100; steps += 1) {
              // When an estimate is shown in the unit and the amount shown is typed back
              const hours = steps * step;
              const shown = shownEffort(hours, unit, conversions);
              const typedBack = enteredHours(shown, unit, conversions);
              // Then it is kept as the same hours, to the hundredth
              if (Math.abs(typedBack - hours) > 0.001) {
                mismatches.push(
                  `${String(hours)} hours as ${String(shown)} ${unit} with ${JSON.stringify(conversions)}`,
                );
              }
            }
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("shows an amount to no more places than a number is typed with", () => {
    expect(
      shownEffort(8, "person-weeks", { ...starting, daysPerWeek: 7 }),
    ).toBe(0.142857);
  });
});

describe("exactEffort", () => {
  it("gives an estimate's hours in a unit before any rounding", () => {
    expect(exactEffort(316, "person-weeks", starting)).toBe(7.9);
    expect(exactEffort(1, "person-days", starting)).toBe(0.125);
    expect(exactEffort(37.5, "person-weeks", shortDays)).toBe(1);
  });
});

describe("largestIn", () => {
  it("gives the largest amount of a unit, kept to its step, within a number of hours", () => {
    expect(largestIn(999_999, "hours", starting)).toBe(999_999);
    expect(largestIn(999_999, "person-days", starting)).toBe(124_999.5);
    expect(largestIn(999_999, "person-weeks", starting)).toBe(24_999.8);
    expect(largestIn(999_999, "person-quarters", starting)).toBe(2083.316667);
  });
});

describe("effortConversionsSchema", () => {
  it("accepts the starting conversions and half hours", () => {
    expect(effortConversionsSchema.parse(starting)).toEqual(starting);
    expect(effortConversionsSchema.parse(shortDays)).toEqual(shortDays);
  });

  it.each([
    [
      "hours not whole or half",
      { hoursPerDay: 7.25 },
      "Hours in a person-day must be whole or half hours",
    ],
    [
      "too few hours",
      { hoursPerDay: 0 },
      "Hours in a person-day must be from 0.5 to 24",
    ],
    [
      "too many hours",
      { hoursPerDay: 24.5 },
      "Hours in a person-day must be from 0.5 to 24",
    ],
    [
      "part of a day in a week",
      { daysPerWeek: 4.5 },
      "Person-days in a person-week must be whole days",
    ],
    [
      "too few days in a week",
      { daysPerWeek: 0 },
      "Person-days in a person-week must be from 1 to 7",
    ],
    [
      "too many days in a week",
      { daysPerWeek: 8 },
      "Person-days in a person-week must be from 1 to 7",
    ],
    [
      "part of a day in a month",
      { daysPerMonth: 21.5 },
      "Person-days in a person-month must be whole days",
    ],
    [
      "too few days in a month",
      { daysPerMonth: 0 },
      "Person-days in a person-month must be from 1 to 31",
    ],
    [
      "too many days in a month",
      { daysPerMonth: 32 },
      "Person-days in a person-month must be from 1 to 31",
    ],
  ])("refuses %s", (_case, change, message) => {
    const result = effortConversionsSchema.safeParse({
      ...starting,
      ...change,
    });
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      message,
    );
  });
});
