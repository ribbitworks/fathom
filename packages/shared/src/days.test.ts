// SPDX-License-Identifier: Apache-2.0

// Tests for days as Fathom keeps them: which text is a day that exists, and a day typed as digits
// laid out as it fills.

import { describe, expect, it } from "vitest";
import {
  dayReadingMonth,
  defaultLineFrom,
  isDay,
  isFirstOfMonth,
  isMonth,
  monthNumber,
  monthOf,
  typedDay,
  typedMonth,
} from "./days.ts";

describe("monthOf", () => {
  it("is the year and month of a day", () => {
    expect(monthOf("2027-02-11")).toBe("2027-02");
  });
});

describe("dayReadingMonth", () => {
  it("is a month's first day, or today during the current month", () => {
    expect(dayReadingMonth("2027-03", "2027-02-11")).toBe("2027-03-01");
    expect(dayReadingMonth("2027-02", "2027-02-11")).toBe("2027-02-11");
  });
});

describe("monthNumber", () => {
  it("counts months across a year's end, from a month or a day", () => {
    expect(monthNumber("2027-01") - monthNumber("2026-12")).toBe(1);
    expect(monthNumber("2027-01-31")).toBe(monthNumber("2027-01"));
  });
});

describe("isFirstOfMonth", () => {
  it("is true only of a month's first day", () => {
    expect([
      isFirstOfMonth("2027-02-01"),
      isFirstOfMonth("2027-02-11"),
    ]).toEqual([true, false]);
  });
});

describe("isDay", () => {
  it("accepts only ISO dates that exist", () => {
    expect([
      isDay("2027-02-28"),
      isDay("2027-02-30"),
      isDay("27-2-28"),
    ]).toEqual([true, false, false]);
  });
});

describe("typedDay", () => {
  it("lays out digits as a day as they fill it", () => {
    expect([
      typedDay("2027"),
      typedDay("202701"),
      typedDay("20270104"),
    ]).toEqual(["2027", "2027-01", "2027-01-04"]);
  });

  it("keeps digits typed with their dashes in the same form", () => {
    expect(typedDay(" 2027-01-04 ")).toBe("2027-01-04");
  });

  it("stops at a whole day's digits", () => {
    expect(typedDay("2027010499")).toBe("2027-01-04");
  });

  it("leaves text that is not digits and dashes as typed, trimmed", () => {
    expect(typedDay(" 4 Jan 2027 ")).toBe("4 Jan 2027");
  });
});

describe("the day a new reporting line starts", () => {
  it("is today for someone who has started, or has no start date", () => {
    expect(defaultLineFrom("2020-01-01", "2026-11-08")).toBe("2026-11-08");
    expect(defaultLineFrom(null, "2026-11-08")).toBe("2026-11-08");
  });

  it("is their start date for someone who has not started", () => {
    expect(defaultLineFrom("2027-01-01", "2026-11-08")).toBe("2027-01-01");
  });
});

describe("months", () => {
  it.each(["2027-01", "2027-12"])("takes %s as a month", (text) => {
    expect(isMonth(text)).toBe(true);
  });

  it.each(["2027-00", "2027-13", "2027", "Mar 2027"])(
    "does not take %s as a month",
    (text) => {
      expect(isMonth(text)).toBe(false);
    },
  );

  it.each([
    ["202703", "2027-03"],
    ["2027", "2027"],
    [" 2027-03 ", "2027-03"],
    ["2027031", "2027-03"],
    ["", ""],
    ["March", "March"],
  ])("lays out %s as typed", (typed, shown) => {
    expect(typedMonth(typed)).toBe(shown);
  });
});
