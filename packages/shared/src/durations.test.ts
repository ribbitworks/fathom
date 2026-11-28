// SPDX-License-Identifier: Apache-2.0

// Tests for a Duration column's lengths: a day moved by one, the length between two days, one unit
// shown in another, and a length as typed, read, refused and written.

import { describe, expect, it } from "vitest";
import {
  type Duration,
  durationIn,
  durationRefusalWords,
  durationText,
  parseDuration,
  plusDuration,
  spanBetween,
} from "./durations.ts";
import { startingWorkingWeek } from "./working-week.ts";

const monToFri = startingWorkingWeek.workingDays;
const of = (amount: number, unit: Duration["unit"]): Duration => ({
  amount,
  unit,
});

describe("plusDuration", () => {
  it.each([
    ["Monday + 5 wd is Friday", "2027-01-11", of(5, "wd"), "2027-01-15"],
    ["5 wd skip the weekend", "2027-01-14", of(5, "wd"), "2027-01-20"],
    ["Jan 11 + 2 wk is Jan 24", "2027-01-11", of(2, "wk"), "2027-01-24"],
    ["Jan 11 + 10 d is Jan 20", "2027-01-11", of(10, "d"), "2027-01-20"],
    ["Mar 1 + 2 mo is Apr 30", "2027-03-01", of(2, "mo"), "2027-04-30"],
    ["Jan 31 + 1 mo is Feb 28", "2027-01-31", of(1, "mo"), "2027-02-28"],
    [
      "Jan 31 + 1 mo is Feb 29 in a leap year",
      "2028-01-31",
      of(1, "mo"),
      "2028-02-29",
    ],
    ["Jan 11 + 3 mo is Apr 10", "2027-01-11", of(3, "mo"), "2027-04-10"],
    ["Nov 15 + 3 mo is Feb 14", "2027-11-15", of(3, "mo"), "2028-02-14"],
    [
      "a start on a day off begins on the next working day",
      "2027-01-16",
      of(1, "wd"),
      "2027-01-18",
    ],
    ["Jan 18 − 1 wk is Jan 12", "2027-01-18", of(-1, "wk"), "2027-01-12"],
    ["Jan 18 − 2 d is Jan 17", "2027-01-18", of(-2, "d"), "2027-01-17"],
    ["Friday − 5 wd is Monday", "2027-01-15", of(-5, "wd"), "2027-01-11"],
    [
      "a start on a day off counts back from the working day before",
      "2027-01-17",
      of(-1, "wd"),
      "2027-01-15",
    ],
    ["Apr 30 − 2 mo is Mar 1", "2027-04-30", of(-2, "mo"), "2027-03-01"],
    ["Mar 31 − 1 mo is Mar 1", "2027-03-31", of(-1, "mo"), "2027-03-01"],
    ["nothing added is the start", "2027-01-11", of(0, "mo"), "2027-01-11"],
  ])("%s", (_rule, start, duration, end) => {
    expect(plusDuration(start, duration, monToFri)).toBe(end);
  });

  it("counts working days by the working week given", () => {
    // Sunday to Thursday: Thursday + 2 wd skips Friday and Saturday.
    expect(plusDuration("2027-01-14", of(2, "wd"), [6, 0, 1, 2, 3])).toBe(
      "2027-01-17",
    );
  });
});

describe("spanBetween", () => {
  it("gives back the amount a date was moved by", () => {
    const end = plusDuration("2027-01-11", of(2, "wk"), monToFri);
    expect(spanBetween("2027-01-11", end, "wk", monToFri)).toBe(2);
  });

  it.each([
    ["calendar days, both ends counted", "d", 10],
    ["working days", "wd", 8],
    ["weeks of 7 days", "wk", 10 / 7],
    ["months of a twelfth of a year", "mo", 10 / (365.25 / 12)],
  ] as const)("in %s", (_unit, unit, amount) => {
    expect(spanBetween("2027-01-11", "2027-01-20", unit, monToFri)).toBe(
      amount,
    );
  });

  it("is one day from a day to itself", () => {
    expect(spanBetween("2027-01-11", "2027-01-11", "d", monToFri)).toBe(1);
  });

  it("is reversed where the end is before the start", () => {
    expect(spanBetween("2027-01-20", "2027-01-11", "d", monToFri)).toBe(
      "reversed",
    );
  });
});

describe("durationIn", () => {
  it.each([
    ["weeks from months", of(2, "mo"), "wk", (2 * 365.25) / 12 / 7],
    ["weeks from working days", of(5, "wd"), "wk", 1],
    ["calendar days from weeks", of(-1, "wk"), "d", -7],
    ["the same unit", of(3, "mo"), "mo", 3],
  ] as const)("%s", (_case, duration, unit, amount) => {
    expect(durationIn(duration, unit)).toBeCloseTo(amount, 10);
  });
});

describe("parseDuration", () => {
  it.each([
    ["1 wk", of(1, "wk")],
    ["3 weeks", of(3, "wk")],
    ["2 MO", of(2, "mo")],
    ["5 working days", of(5, "wd")],
    ["1 calendar day", of(1, "d")],
    ["4w", of(4, "wk")],
    ["−5 wd", of(-5, "wd")],
    ["-2 d", of(-2, "d")],
    ["10", of(10, "wk")],
  ])("reads %s", (text, duration) => {
    expect(parseDuration(text, "wk")).toEqual({ duration });
  });

  it("reads nothing typed as empty", () => {
    expect(parseDuration("  ", "wk")).toEqual({ empty: true });
  });

  it.each([
    ["2027-04-12", "amount"],
    ["Apr 12, 2027", "amount"],
    ["4/12/2027", "amount"],
    ["1 mo 2 wk", "oneUnit"],
    ["1.5 mo", "whole"],
    ["2,5 wk", "whole"],
    ["6 sprints", "unit"],
    ["soon", "unit"],
  ])("refuses %s", (text, refused) => {
    expect(parseDuration(text, "wk")).toEqual({ refused });
  });
});

describe("durationText", () => {
  it.each([
    [of(2, "wk"), "2 wk"],
    [of(-1, "mo"), "−1 mo"],
    [of(0, "d"), "0 d"],
  ])("writes a length as typed", (duration, text) => {
    expect(durationText(duration)).toBe(text);
  });

  it("reads back what it writes", () => {
    expect(parseDuration(durationText(of(-5, "wd")), "wk")).toEqual({
      duration: of(-5, "wd"),
    });
  });
});

describe("durationRefusalWords", () => {
  it.each([
    ["amount", "Type an amount for Kick-off after, such as 2 wk"],
    ["oneUnit", "Type one unit for Kick-off after, such as 3 mo"],
    ["whole", "Type a whole number for Kick-off after, such as 2 wk"],
    ["unit", "Type d, wd, wk or mo for Kick-off after, such as 2 wk"],
  ] as const)("names the column for %s", (refusal, words) => {
    expect(durationRefusalWords(refusal, "Kick-off after")).toBe(words);
  });
});
