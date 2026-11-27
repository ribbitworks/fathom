// SPDX-License-Identifier: Apache-2.0

// Tests for the working week: how its days are checked, which are working days, counting them,
// the start of the week a day is in, and a span of days cut into its weeks.

import { describe, expect, it } from "vitest";
import {
  isWorkingDay,
  weekStartOf,
  weekdayOf,
  weekdays,
  weeksWithin,
  weekStartsOnSchema,
  workingDaysBetween,
  workingDaysSchema,
} from "./working-week.ts";

const { monday, wednesday, friday, saturday, sunday } = weekdays;
const mondayToFriday = [0, 1, 2, 3, 4] as const;
const sundayToThursday = [6, 0, 1, 2, 3] as const;

describe("weekdayOf", () => {
  it("counts the days of the week from Monday", () => {
    expect(
      [
        "2027-03-01",
        "2027-03-02",
        "2027-03-03",
        "2027-03-04",
        "2027-03-05",
        "2027-03-06",
        "2027-03-07",
      ].map(weekdayOf),
    ).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("isWorkingDay", () => {
  it("is true for a day of the week named as working", () => {
    expect(isWorkingDay("2027-03-05", mondayToFriday)).toBe(true);
  });

  it("is false for a day of the week left out", () => {
    expect(isWorkingDay("2027-03-06", mondayToFriday)).toBe(false);
  });

  it("follows the days named, such as Sunday to Thursday", () => {
    expect(
      ["2027-03-05", "2027-03-07"].map((day) =>
        isWorkingDay(day, sundayToThursday),
      ),
    ).toEqual([false, true]);
  });
});

describe("workingDaysBetween", () => {
  it("counts the first and last days when they are working days", () => {
    expect(workingDaysBetween("2027-03-01", "2027-03-05", mondayToFriday)).toBe(
      5,
    );
  });

  it("counts one for a single working day", () => {
    expect(workingDaysBetween("2027-03-03", "2027-03-03", mondayToFriday)).toBe(
      1,
    );
  });

  it("counts none for a single day off", () => {
    expect(workingDaysBetween("2027-03-06", "2027-03-07", mondayToFriday)).toBe(
      0,
    );
  });

  it("counts whole weeks and the days left over", () => {
    // Given three weeks from a Wednesday, then Wednesday to Friday
    // When counted Monday to Friday
    // Then each whole week gives five and the days left three
    expect(workingDaysBetween("2027-03-03", "2027-03-26", mondayToFriday)).toBe(
      18,
    );
  });

  it("counts only the days named", () => {
    expect(
      workingDaysBetween("2027-03-01", "2027-03-14", sundayToThursday),
    ).toBe(10);
  });

  it("counts one working day a week", () => {
    expect(
      workingDaysBetween("2027-03-01", "2027-03-31", [weekdays.wednesday]),
    ).toBe(5);
  });

  it("counts every day when every day is a working day", () => {
    expect(
      workingDaysBetween("2027-02-01", "2027-02-28", [0, 1, 2, 3, 4, 5, 6]),
    ).toBe(28);
  });

  it("counts none when the last day is before the first", () => {
    expect(workingDaysBetween("2027-03-05", "2027-03-01", mondayToFriday)).toBe(
      0,
    );
  });
});

describe("weekStartOf", () => {
  it("is the day itself when it starts a week", () => {
    expect(weekStartOf("2027-03-01", monday)).toBe("2027-03-01");
  });

  it("is the Monday before for a week starting on Monday", () => {
    expect(weekStartOf("2027-03-07", monday)).toBe("2027-03-01");
  });

  it("is the Sunday before for a week starting on Sunday", () => {
    expect(weekStartOf("2027-03-06", sunday)).toBe("2027-02-28");
  });

  it("goes back across a month and a year", () => {
    expect(weekStartOf("2027-01-01", saturday)).toBe("2026-12-26");
  });
});

describe("weeksWithin", () => {
  it("cuts a month at each Monday, the first piece starting with the month", () => {
    // Given March 2027, which starts on a Monday and ends on a Wednesday
    // When cut into weeks starting on Monday
    // Then each piece starts its week, the last cut short by the month's end
    expect(weeksWithin("2027-03-01", "2027-04-01", monday)).toEqual([
      { from: "2027-03-01", weekStart: "2027-03-01", days: 7 },
      { from: "2027-03-08", weekStart: "2027-03-08", days: 7 },
      { from: "2027-03-15", weekStart: "2027-03-15", days: 7 },
      { from: "2027-03-22", weekStart: "2027-03-22", days: 7 },
      { from: "2027-03-29", weekStart: "2027-03-29", days: 3 },
    ]);
  });

  it("names a week cut short at the start by the day it starts on", () => {
    expect(weeksWithin("2027-03-01", "2027-03-15", sunday)).toEqual([
      { from: "2027-03-01", weekStart: "2027-02-28", days: 6 },
      { from: "2027-03-07", weekStart: "2027-03-07", days: 7 },
      { from: "2027-03-14", weekStart: "2027-03-14", days: 1 },
    ]);
  });

  it("cuts at the day chosen, such as Wednesday or Friday", () => {
    expect(
      [wednesday, friday].map((startsOn) =>
        weeksWithin("2027-03-01", "2027-03-11", startsOn).map(
          ({ from }) => from,
        ),
      ),
    ).toEqual([
      ["2027-03-01", "2027-03-03", "2027-03-10"],
      ["2027-03-01", "2027-03-05"],
    ]);
  });

  it("is empty when the span holds no days", () => {
    expect(weeksWithin("2027-03-01", "2027-03-01", monday)).toEqual([]);
  });
});

const problem = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map(({ message }) => message);

describe("workingDaysSchema", () => {
  it("takes any days of the week, each once, in any order", () => {
    expect(workingDaysSchema.safeParse(sundayToThursday).success).toBe(true);
  });

  it("refuses no working day", () => {
    expect(problem(workingDaysSchema.safeParse([]))).toEqual([
      "Working day needed",
    ]);
  });

  it("refuses a day named twice", () => {
    expect(problem(workingDaysSchema.safeParse([0, 1, 0]))).toEqual([
      "Working days: name each day once",
    ]);
  });

  it.each([[-1], [7], [2.5]])("refuses %s, not a day of the week", (day) => {
    expect(problem(workingDaysSchema.safeParse([day]))).toEqual([
      "Working days: use a day of the week",
    ]);
  });
});

describe("weekStartsOnSchema", () => {
  it("takes Monday to Sunday", () => {
    expect(
      [0, 6].map((day) => weekStartsOnSchema.safeParse(day).success),
    ).toEqual([true, true]);
  });

  it.each([[-1], [7], [0.5]])("refuses %s, not a day of the week", (day) => {
    expect(problem(weekStartsOnSchema.safeParse(day))).toEqual([
      "Week starts on: use a day of the week",
    ]);
  });
});
