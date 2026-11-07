// SPDX-License-Identifier: Apache-2.0

// Tests for working out a release stream's cycles from its patterns, which the shared package holds
// for the server and the browser alike: their days, their names, their shares of the months they
// span, and where a later pattern may start.

import { describe, expect, it } from "vitest";
import {
  cycleName,
  cyclesOf,
  horizonFrom,
  lastDayOfMonth,
  type CyclePatternLike,
  type LengthChange,
  monthShares,
  movedCycles,
  patternsForLength,
  patternStartFits,
} from "./cycles.ts";

const quarters = {
  startsOn: "2027-01-01",
  length: 3,
  unit: "months",
  naming: "{YY}.{N}",
} as const;

const days = (cycles: ReturnType<typeof cyclesOf>) =>
  cycles.map(({ startsOn, endsOn }) => `${startsOn} to ${endsOn}`);

describe("cycles", () => {
  it("are made from a pattern's start until the first that starts after the day given", () => {
    expect(days(cyclesOf([quarters], "2027-07-01"))).toEqual([
      "2027-01-01 to 2027-03-31",
      "2027-04-01 to 2027-06-30",
      "2027-07-01 to 2027-09-30",
    ]);
  });

  it("are made in weeks", () => {
    const sprints = { ...quarters, length: 2, unit: "weeks" } as const;
    expect(days(cyclesOf([sprints], "2027-01-15"))).toEqual([
      "2027-01-01 to 2027-01-14",
      "2027-01-15 to 2027-01-28",
    ]);
  });

  it("follow a later pattern from the day it starts", () => {
    const halves = { ...quarters, startsOn: "2027-07-01", length: 6 };
    expect(days(cyclesOf([halves, quarters], "2028-01-01"))).toEqual([
      "2027-01-01 to 2027-03-31",
      "2027-04-01 to 2027-06-30",
      "2027-07-01 to 2027-12-31",
      "2028-01-01 to 2028-06-30",
    ]);
  });

  it("are cut short where a later pattern starts within one", () => {
    const later = { ...quarters, startsOn: "2027-02-15", length: 1 };
    expect(days(cyclesOf([quarters, later], "2027-02-15"))[0]).toBe(
      "2027-01-01 to 2027-02-14",
    );
  });

  it("are named by the year they end in and their number within it", () => {
    const names = cyclesOf(
      [{ ...quarters, startsOn: "2026-10-01" }],
      "2027-04-01",
    ).map(({ name }) => name);
    expect(names).toEqual(["26.1", "27.1", "27.2"]);
  });

  it("keep the same day of the month, or the month's last day when it is shorter", () => {
    const monthly = { ...quarters, startsOn: "2027-01-31", length: 1 };
    expect(
      cyclesOf([monthly], "2027-03-31").map(({ startsOn }) => startsOn),
    ).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("know their share of each month they span, by its days", () => {
    expect(monthShares("2027-01-16", "2027-02-28")).toEqual([
      { month: "2027-01", share: 16 / 31 },
      { month: "2027-02", share: 1 },
    ]);
  });
});

describe("cycle names", () => {
  it("fill in the year, its last two digits, and the number", () => {
    expect(cycleName("Release {YYYY} ({YY}) #{N}", "2027-06-30", 2, 7)).toBe(
      "Release 2027 (27) #2",
    );
  });

  it("count on through the stream's cycles, whatever year they end in", () => {
    const sprints = {
      ...quarters,
      startsOn: "2026-10-01",
      naming: "Sprint {#}",
    };
    expect(cyclesOf([sprints], "2027-04-01").map(({ name }) => name)).toEqual([
      "Sprint 1",
      "Sprint 2",
      "Sprint 3",
    ]);
  });
});

describe("patterns", () => {
  it("may start on any day when a stream has no other", () => {
    expect(patternStartFits([], "2027-02-17")).toBe(true);
  });

  it("may start on the start of one of the cycles the others make", () => {
    expect(patternStartFits([quarters], "2027-10-01")).toBe(true);
  });

  it("may not start within one of the cycles the others make", () => {
    expect(patternStartFits([quarters], "2027-11-01")).toBe(false);
  });
});

describe("a new stream's cycles", () => {
  it("are made until two years from the day it is drafted", () => {
    expect(horizonFrom("2026-11-03")).toBe("2028-11-03");
  });
});

describe("changing one cycle's length", () => {
  const halves = { ...quarters, startsOn: "2027-07-01", length: 6 };
  const change = (
    patterns: readonly CyclePatternLike[],
    wanted: LengthChange,
    until = "2028-01-01",
  ) => {
    const made = patternsForLength(patterns, wanted);
    if ("problem" in made) throw new Error(made.problem);
    return {
      patterns: made.patterns,
      cycles: days(cyclesOf(made.patterns, until)),
    };
  };
  const problemOf = (
    patterns: readonly CyclePatternLike[],
    wanted: LengthChange,
  ) => {
    const made = patternsForLength(patterns, wanted);
    return "problem" in made ? made.problem : undefined;
  };

  it("moves the cycles after it by the change", () => {
    expect(
      change([quarters], { startsOn: "2027-04-01", length: 4, later: "move" })
        .cycles,
    ).toEqual([
      "2027-01-01 to 2027-03-31",
      "2027-04-01 to 2027-07-31",
      "2027-08-01 to 2027-10-31",
      "2027-11-01 to 2028-01-31",
    ]);
  });

  it("keeps the next cycle's end date, so only the next cycle changes", () => {
    expect(
      change([quarters], { startsOn: "2027-04-01", length: 2, later: "keep" })
        .cycles,
    ).toEqual([
      "2027-01-01 to 2027-03-31",
      "2027-04-01 to 2027-05-31",
      "2027-06-01 to 2027-09-30",
      "2027-10-01 to 2027-12-31",
      "2028-01-01 to 2028-03-31",
    ]);
  });

  it("moves later patterns to where the cycles they started on now start", () => {
    const later = { ...halves, startsOn: "2027-10-01" };
    const { patterns, cycles } = change([quarters, later], {
      startsOn: "2027-04-01",
      length: 2,
      later: "move",
    });
    expect(patterns.at(-1)).toEqual({ ...later, startsOn: "2027-09-01" });
    expect(cycles).toEqual([
      "2027-01-01 to 2027-03-31",
      "2027-04-01 to 2027-05-31",
      "2027-06-01 to 2027-08-31",
      "2027-09-01 to 2028-02-29",
    ]);
  });

  it("may start a pattern on the day a later one moves away from", () => {
    const { patterns } = change([quarters, halves], {
      startsOn: "2027-01-01",
      length: 6,
      later: "move",
    });
    expect(patterns.map(({ startsOn, length }) => [startsOn, length])).toEqual([
      ["2027-01-01", 6],
      ["2027-07-01", 3],
      ["2027-10-01", 6],
    ]);
  });

  it("leaves no pattern that only carries on the one before", () => {
    const shortened = change([quarters], {
      startsOn: "2027-04-01",
      length: 2,
      later: "move",
    }).patterns;
    const back = change(shortened, {
      startsOn: "2027-04-01",
      length: 3,
      later: "move",
    });
    expect(back.patterns).toEqual([quarters]);
  });

  it("keeps a pattern that starts where the next cycle ends", () => {
    const { patterns, cycles } = change([quarters, halves], {
      startsOn: "2027-01-01",
      length: 2,
      later: "keep",
    });
    expect(patterns.at(-1)).toEqual(halves);
    expect(cycles.slice(0, 3)).toEqual([
      "2027-01-01 to 2027-02-28",
      "2027-03-01 to 2027-06-30",
      "2027-07-01 to 2027-12-31",
    ]);
  });

  it("works in weeks", () => {
    const sprints = { ...quarters, length: 2, unit: "weeks" } as const;
    expect(
      change(
        [sprints],
        { startsOn: "2027-01-15", length: 1, later: "keep" },
        "2027-02-12",
      ).cycles,
    ).toEqual([
      "2027-01-01 to 2027-01-14",
      "2027-01-15 to 2027-01-21",
      "2027-01-22 to 2027-02-11",
      "2027-02-12 to 2027-02-25",
    ]);
  });

  it("is refused when the cycle is already that long", () => {
    expect(
      problemOf([quarters], {
        startsOn: "2027-04-01",
        length: 3,
        later: "move",
      }),
    ).toBe("Choose a new length.");
  });

  it("counts a whole cycle cut short by a short month as its pattern's length", () => {
    const monthly = { ...quarters, startsOn: "2027-01-31", length: 1 };
    expect(
      problemOf([monthly], {
        startsOn: "2027-02-28",
        length: 1,
        later: "move",
      }),
    ).toBe("Choose a new length.");
  });

  it("is refused when the next cycle cannot keep its end date in whole units", () => {
    const sprints = {
      ...quarters,
      startsOn: "2027-04-01",
      length: 2,
      unit: "weeks",
    } as const;
    expect(
      problemOf([quarters, sprints], {
        startsOn: "2027-01-01",
        length: 2,
        later: "keep",
      }),
    ).toBe("The next cycle can't keep its end date in whole weeks.");
  });

  it("is refused when the next cycle would have no days left", () => {
    expect(
      problemOf([quarters], {
        startsOn: "2027-04-01",
        length: 6,
        later: "keep",
      }),
    ).toBe("The next cycle would have no days left.");
  });

  it("is refused for a day no cycle starts on", () => {
    expect(
      problemOf([quarters], {
        startsOn: "2027-04-02",
        length: 2,
        later: "move",
      }),
    ).toBe("No cycle starts on that day.");
  });

  it("matches each cycle to where it now starts, one for one", () => {
    const before = cyclesOf([quarters], "2027-07-01");
    const after = cyclesOf(
      [quarters, { ...quarters, startsOn: "2027-04-01", length: 4 }],
      "2027-07-01",
    );
    expect(movedCycles(before, after)).toEqual(
      new Map([
        ["2027-01-01", "2027-01-01"],
        ["2027-04-01", "2027-04-01"],
        ["2027-07-01", undefined],
      ]),
    );
  });
});

describe("the last day of a month", () => {
  it("is found for short months, leap years and year ends", () => {
    expect([
      lastDayOfMonth("2027-02-03"),
      lastDayOfMonth("2028-02-29"),
      lastDayOfMonth("2026-12-01"),
      lastDayOfMonth("2027-04-30"),
    ]).toEqual(["2027-02-28", "2028-02-29", "2026-12-31", "2027-04-30"]);
  });
});
