// SPDX-License-Identifier: Apache-2.0

// Tests for days as Fathom keeps them: which text is a day that exists, and a day typed as digits
// laid out as it fills, never with a digit dropped.

import { describe, expect, it } from "vitest";
import {
  dayReadingMonth,
  defaultLineFrom,
  isDay,
  isFirstOfMonth,
  isMonth,
  layOutDropsDigits,
  lineChangesFrom,
  mayDateChange,
  mayDateLineChange,
  monthNumber,
  monthOf,
  typedDay,
  typedInPlace,
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

describe("typedInPlace", () => {
  const dayTyped = typedInPlace(typedDay);

  it("leaves the other digits and the cursor where they were when a digit in the middle is deleted", () => {
    expect(dayTyped({ text: "202-11-08", cursor: 3 })).toEqual({
      text: "202-11-08",
      cursor: 3,
    });
  });

  it("takes a digit typed into the gap, with the cursor after it", () => {
    expect(dayTyped({ text: "2027-11-08", cursor: 4 })).toEqual({
      text: "2027-11-08",
      cursor: 4,
    });
  });

  it("lays out digits typed at the end, with the cursor after them", () => {
    expect(dayTyped({ text: "2026110", cursor: 7 })).toEqual({
      text: "2026-11-0",
      cursor: 9,
    });
  });

  it("drops anything but digits and dashes, keeping the cursor beside the same digits", () => {
    expect([
      dayTyped({ text: "202a-11-08", cursor: 4 }),
      dayTyped({ text: "2027x01", cursor: 7 }),
    ]).toEqual([
      { text: "202-11-08", cursor: 3 },
      { text: "2027-01", cursor: 7 },
    ]);
  });

  it("takes a box without a cursor as typed at the end", () => {
    expect(dayTyped({ text: "2026110", cursor: null })).toEqual({
      text: "2026-11-0",
      cursor: 9,
    });
  });

  it("ignores a digit typed in the middle of a day that holds all its digits", () => {
    expect(dayTyped({ text: "2026-101-08", cursor: 7 })).toEqual({
      text: "2026-11-08",
      cursor: 6,
    });
  });

  it("leaves the digits and the cursor in place when a dash in the middle is deleted", () => {
    expect(dayTyped({ text: "202611-08", cursor: 4 })).toEqual({
      text: "202611-08",
      cursor: 4,
    });
  });

  it("keeps digits pasted in the middle where they go, as pasted", () => {
    expect(dayTyped({ text: "202611-08", cursor: 6 })).toEqual({
      text: "202611-08",
      cursor: 6,
    });
  });

  it("takes back out the digits pasted in the middle past what a day holds", () => {
    expect(dayTyped({ text: "20261108-11-08", cursor: 8 })).toEqual({
      text: "2026-11-08",
      cursor: 4,
    });
  });

  it("keeps a range typed over in the middle as typed, with the cursor after the new digit", () => {
    expect(dayTyped({ text: "2026-0-08", cursor: 6 })).toEqual({
      text: "2026-0-08",
      cursor: 6,
    });
  });

  it("lays out again all the digits of text left unlaid when a digit is typed at its end", () => {
    expect(dayTyped({ text: "202-11-081", cursor: 10 })).toEqual({
      text: "2021-10-81",
      cursor: 10,
    });
  });

  it("does the same for a month", () => {
    const monthTyped = typedInPlace(typedMonth);
    expect([
      monthTyped({ text: "202-03", cursor: 3 }),
      monthTyped({ text: "202703", cursor: 6 }),
      monthTyped({ text: "2026-131", cursor: 7 }),
    ]).toEqual([
      { text: "202-03", cursor: 3 },
      { text: "2027-03", cursor: 7 },
      { text: "2026-11", cursor: 6 },
    ]);
  });
});

describe("layOutDropsDigits", () => {
  it("is true of text with more digits than the form holds", () => {
    expect(layOutDropsDigits(typedDay, "2026-101-08")).toBe(true);
    expect(layOutDropsDigits(typedMonth, "2026-113")).toBe(true);
  });

  it("is false of text whose layout moves only dashes, of anything not digits, and of nothing", () => {
    expect([
      layOutDropsDigits(typedDay, "202611-08"),
      layOutDropsDigits(typedDay, " 2026-11-08 "),
      layOutDropsDigits(typedDay, "4 Jan 2027"),
      layOutDropsDigits(typedDay, ""),
    ]).toEqual([false, false, false, false]);
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

describe("the days a change may take effect from", () => {
  it.each([
    ["today", false, "2027-03-10", true],
    ["a later day", false, "2027-04-01", true],
    ["an earlier day, without changing dates", false, "2027-03-01", false],
    ["an earlier day, changing dates", true, "2027-03-01", true],
  ])("include %s", (_, changesDates, day, may) => {
    expect(mayDateChange(changesDates, day, "2027-03-10")).toBe(may);
  });
});

describe("the days reporting lines may be changed from", () => {
  it.each([
    [true, "2026-11-07", true],
    [false, "2026-11-07", false],
    [true, "2026-11-08", false],
    [true, "2026-11-09", false],
  ])(
    "with the right to change dates %s, from %s, is %s",
    (changesDates, day, may) => {
      expect(mayDateLineChange(changesDates, day, "2026-11-08")).toBe(may);
    },
  );
});

describe("whether someone's line can change from a day", () => {
  it.each([
    [{ startDate: "2020-01-01", managerFrom: "2024-01-01" }, true],
    [{ startDate: "2020-01-01", managerFrom: "2024-03-01" }, true],
    [{ startDate: "2020-01-01", managerFrom: "2024-03-02" }, false],
    [{ startDate: "2024-03-02", managerFrom: null }, false],
    [{ startDate: null, managerFrom: null }, true],
    [{}, true],
  ])("for %o from 2024-03-01 is %s", (person, changes) => {
    expect(lineChangesFrom(person, "2024-03-01")).toBe(changes);
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
