// SPDX-License-Identifier: Apache-2.0

// Tests for working out a release stream's cycles from its patterns, which the shared package holds
// for the server and the browser alike: their days, their names, their shares of the months they
// span, and where a later pattern may start.

import { describe, expect, it } from "vitest";
import {
  cycleName,
  cyclesOf,
  horizonFrom,
  monthShares,
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
