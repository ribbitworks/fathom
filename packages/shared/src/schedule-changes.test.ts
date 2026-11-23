// SPDX-License-Identifier: Apache-2.0

// Tests for the rules for ending a schedule, and for what one cycle's new length makes of a
// schedule and the releases and features on its cycles.

import { describe, expect, it } from "vitest";
import { cyclesOf, endsBeforeFirstCycle, patternsForLength } from "./cycles.ts";
import { cycleLengthMoves, scheduleEndProblem } from "./schedule-changes.ts";

const quarters = {
  startsOn: "2027-01-01",
  length: 3,
  unit: "months",
  naming: "{YY}.{N}",
} as const;

const seesFeatures = ["features:view"] as const;
const seesConfiguration = ["configuration:view", "configuration:edit"] as const;

describe("ending a schedule", () => {
  const release = {
    type: "release",
    name: "Fictional Late",
    lastCycle: "2027-07-01",
  } as const;
  const feature = {
    type: "feature",
    name: "Fictional Feature",
    lastCycle: "2027-10-01",
  } as const;
  const releaseNamed = (name: string) =>
    `The release ${name} includes cycles after that day; change it first`;

  it("lets a schedule keep going, whatever is planned on it", () => {
    expect(
      scheduleEndProblem([quarters], null, [release, feature], seesFeatures),
    ).toBeUndefined();
  });

  it("refuses a day before the first cycle starts, before anything planned", () => {
    expect(
      scheduleEndProblem([quarters], "2026-12-31", [release], seesFeatures),
    ).toBe(endsBeforeFirstCycle);
  });

  it("lets a schedule with no cycles end on any day", () => {
    expect(
      scheduleEndProblem([], "2026-12-31", [], seesFeatures),
    ).toBeUndefined();
  });

  it("refuses a day before the last cycle a release includes", () => {
    expect(
      scheduleEndProblem([quarters], "2027-06-30", [release], seesFeatures),
    ).toBe(releaseNamed("Fictional Late"));
  });

  it("refuses a day before the cycle a feature targets", () => {
    expect(
      scheduleEndProblem([quarters], "2027-09-30", [feature], seesFeatures),
    ).toBe(
      "The feature Fictional Feature targets a cycle after that day; change it first",
    );
  });

  it("names a release before a feature, whatever the order listed", () => {
    expect(
      scheduleEndProblem(
        [quarters],
        "2027-06-30",
        [feature, release],
        seesFeatures,
      ),
    ).toBe(releaseNamed("Fictional Late"));
  });

  it("names the release with the latest last cycle, whatever the order listed", () => {
    const latest = {
      ...release,
      name: "Fictional Latest",
      lastCycle: "2027-10-01",
    };
    expect(
      [
        [release, latest],
        [latest, release],
      ].map((planned) =>
        scheduleEndProblem([quarters], "2027-06-30", planned, seesFeatures),
      ),
    ).toEqual([
      releaseNamed("Fictional Latest"),
      releaseNamed("Fictional Latest"),
    ]);
  });

  it("names the first by name of those on the same last cycle, whatever the order listed", () => {
    const other = { ...release, name: "Fictional Alpha" };
    expect(
      [
        [release, other],
        [other, release],
      ].map((planned) =>
        scheduleEndProblem([quarters], "2027-06-30", planned, seesFeatures),
      ),
    ).toEqual([
      releaseNamed("Fictional Alpha"),
      releaseNamed("Fictional Alpha"),
    ]);
  });

  it("lets a schedule end on the day its last planned cycle starts", () => {
    expect(
      scheduleEndProblem(
        [quarters],
        "2027-10-01",
        [release, feature],
        seesFeatures,
      ),
    ).toBeUndefined();
  });

  it("names no release or feature to a role that can't see features", () => {
    expect(
      scheduleEndProblem(
        [quarters],
        "2027-09-30",
        [feature],
        seesConfiguration,
      ),
    ).toBe("Work is planned on cycles after that day");
  });
});

describe("one cycle's new length", () => {
  const until = "2027-12-31";
  const schedule = {
    name: "Fictional Majors",
    patterns: [quarters],
    cycles: cyclesOf([quarters], until),
    until,
    endsOn: null,
  };
  const later = {
    name: "Fictional Later",
    firstCycle: "2027-07-01",
    lastCycle: "2027-10-01",
    shipsOn: null,
  };
  const shorter = { startsOn: "2027-04-01", length: 2, later: "move" } as const;

  it("gives the patterns for the length, and moves what is on later cycles", () => {
    const change = cycleLengthMoves(schedule, shorter, [later], seesFeatures);
    expect(change).toEqual({
      patterns: (
        patternsForLength([quarters], shorter) as { patterns: unknown[] }
      ).patterns,
      cycles: expect.any(Array) as unknown,
      moved: expect.any(Map) as unknown,
      moves: [
        { release: later, firstCycle: "2027-06-01", lastCycle: "2027-09-01" },
      ],
    });
  });

  it("refuses a day no cycle starts on, with no cycles made", () => {
    expect(
      cycleLengthMoves(
        schedule,
        { ...shorter, startsOn: "2027-02-01" },
        [later],
        seesFeatures,
      ),
    ).toEqual({ problem: "No cycle starts on that day." });
  });

  it("refuses moving work past the schedule's last day, with the cycles made", () => {
    const ending = {
      ...schedule,
      cycles: cyclesOf([quarters], until, until),
      endsOn: until,
    };
    const change = cycleLengthMoves(
      ending,
      { ...shorter, length: 6 },
      [later],
      seesFeatures,
    );
    expect([
      "problem" in change ? change.problem : undefined,
      change.cycles?.map(({ startsOn }) => startsOn),
    ]).toEqual([
      "Fictional Later would move past 2027-12-31, the day Fictional Majors ends.",
      ["2027-01-01", "2027-04-01", "2027-10-01"],
    ]);
  });
});
