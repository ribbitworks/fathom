// SPDX-License-Identifier: Apache-2.0

// Tests for what the Schedules and Cycles tabs say about a schedule's cycles: how long each lasts,
// how long they last now, where its details start them, the drafts that change them, and each cycle
// beside itself as it is live.

import type { Cycle } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  changeBehind,
  cycleChanges,
  cycleTwins,
  durationWords,
  laterCyclesFrom,
  lengthNow,
  nextRelease,
  patternOn,
  startingCycle,
  unitOf,
} from "./schedules.ts";
import {
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  quarters,
  recordDraft,
  streamId,
} from "./test-support.tsx";

const cycle = (startsOn: string, endsOn: string) => ({
  startsOn,
  endsOn,
  name: "Fictional",
  months: [],
});

describe("a cycle's duration", () => {
  it.each([
    ["three whole months", "2027-01-01", "2027-03-31", "months", "3 months"],
    ["one month", "2027-02-01", "2027-02-28", "months", "1 month"],
    ["a month cut short", "2027-04-01", "2027-04-15", "months", "15 days"],
    ["four whole weeks", "2027-01-04", "2027-01-31", "weeks", "4 weeks"],
    ["one week", "2027-01-04", "2027-01-10", "weeks", "1 week"],
    ["weeks cut short", "2027-04-26", "2027-04-30", "weeks", "5 days"],
    ["one day", "2027-04-30", "2027-04-30", "weeks", "1 day"],
  ] as const)(
    "is in its pattern's unit when whole, or else in days: %s",
    (_case, startsOn, endsOn, unit, words) => {
      expect(durationWords(cycle(startsOn, endsOn), unit)).toBe(words);
    },
  );
});

describe("how long a schedule's cycles last", () => {
  const changing = fictionalStream({
    patterns: [
      fictionalPattern(),
      fictionalPattern({
        id: "20000000-0000-4000-8000-000000000002",
        startsOn: "2027-07-01",
        length: 2,
        unit: "weeks",
      }),
    ],
  });

  it("is the pattern in force on the day, or the first before any starts", () => {
    expect([
      lengthNow(changing, "2026-06-01"),
      lengthNow(changing, "2027-03-01"),
      lengthNow(changing, "2027-08-01"),
    ]).toEqual(["3 months", "3 months", "2 weeks"]);
  });

  it("is a single unit for a length of one", () => {
    expect(
      lengthNow(
        fictionalStream({ patterns: [fictionalPattern({ length: 1 })] }),
        "2027-03-01",
      ),
    ).toBe("1 month");
  });

  it("is nothing once the schedule has ended", () => {
    const ending = fictionalStream({ endsOn: "2027-05-15" });
    expect([
      lengthNow(ending, "2027-05-15"),
      lengthNow(ending, "2027-05-16"),
    ]).toEqual(["3 months", ""]);
  });

  it("is nothing for a schedule with no cycles yet", () => {
    expect(lengthNow(fictionalStream({ patterns: [] }), "2027-03-01")).toBe("");
  });

  it("names the unit of the pattern making a cycle, months for one with none", () => {
    const [first] = quarters(1);
    expect([
      first && unitOf(changing, first),
      first && unitOf(fictionalStream({ patterns: [] }), first),
    ]).toEqual(["months", "months"]);
  });
});

describe("where a schedule's details start its cycles", () => {
  const cycles = quarters(4);

  it("is the cycle holding the day, the next when none does, or the last once every one has ended", () => {
    expect([
      startingCycle(cycles, "2026-12-01"),
      startingCycle(cycles, "2027-05-15"),
      startingCycle(cycles, "2027-12-31"),
      startingCycle(cycles, "2028-01-01"),
      startingCycle([], "2028-01-01"),
    ]).toEqual([0, 1, 3, 3, 0]);
  });
});

describe("the cycles in force", () => {
  it("are the pattern started last by the day, or the first when none has started", () => {
    const later = fictionalPattern({ id: "p2", startsOn: "2027-07-01" });
    const stream = fictionalStream({ patterns: [fictionalPattern(), later] });
    expect([
      patternOn(stream, "2027-08-01")?.id,
      patternOn(stream, "2026-01-01")?.id,
    ]).toEqual(["p2", fictionalPattern().id]);
  });
});

describe("the release that ships next", () => {
  it("is the soonest on or after the day, leaving out those shipped, removed or not laid out", () => {
    const stream = fictionalStream({
      releases: [
        fictionalRelease({
          id: "r1",
          name: "Fictional Later",
          firstCycle: "2027-04-01",
          lastCycle: "2027-04-01",
        }),
        fictionalRelease({ id: "r2", name: "Fictional Sooner" }),
        fictionalRelease({
          id: "r3",
          name: "Fictional Shipped",
          shipsOn: "2027-01-15",
        }),
        fictionalRelease({
          id: "r4",
          name: "Fictional Unmade",
          firstCycle: "2031-01-01",
          lastCycle: "2031-01-01",
        }),
      ],
    });
    const next = nextRelease(stream, "2027-02-15");
    expect([next?.release.name, next?.ships]).toEqual([
      "Fictional Sooner",
      "2027-03-31",
    ]);
  });
});

describe("the drafts that change a schedule's cycles", () => {
  const waiting = recordDraft();
  const rejected = recordDraft({ state: "rejected" });
  const stream = fictionalStream({
    draft: recordDraft({ changed: ["endsOn"] }),
    heldBy: "Fictional Colleague",
    patterns: [
      fictionalPattern({ id: "p1", draft: waiting }),
      fictionalPattern({ id: "p2", startsOn: "2027-07-01" }),
      fictionalPattern({ id: "p3", startsOn: "2027-10-01", draft: rejected }),
    ],
  });

  it("are the schedule's own, where it changes its end, then each pattern's, rejected ones left out where asked", () => {
    expect(
      [true, false].map((leaveOut) =>
        cycleChanges(stream, leaveOut).map(({ ref, startsOn, record }) => [
          ref.type,
          ref.id,
          startsOn,
          record.heldBy,
        ]),
      ),
    ).toEqual([
      [
        ["release-stream", streamId, undefined, "Fictional Colleague"],
        ["cycle-pattern", "p1", "2027-01-01", undefined],
      ],
      [
        ["release-stream", streamId, undefined, "Fictional Colleague"],
        ["cycle-pattern", "p1", "2027-01-01", undefined],
        ["cycle-pattern", "p3", "2027-10-01", undefined],
      ],
    ]);
  });

  it("leave out the schedule's own draft where it changes anything but its end", () => {
    expect(
      cycleChanges(
        fictionalStream({ draft: recordDraft({ changed: ["name"] }) }),
        false,
      ),
    ).toEqual([]);
  });

  it("put behind a cycle the last pattern starting on or before it, or else the first change", () => {
    const changes = cycleChanges(stream, false);
    expect(
      ["2026-10-01", "2027-04-01", "2027-10-01"].map(
        (startsOn) => changeBehind(changes, { startsOn })?.ref.id,
      ),
    ).toEqual([streamId, "p1", "p3"]);
  });
});

describe("each cycle beside itself as it is live", () => {
  const cycle = (name: string, startsOn: string, endsOn: string) => ({
    name,
    startsOn,
    endsOn,
    months: [],
  });

  it("is matched by name where the name is its own on both sides, else by its first day, with each live cycle no longer shown on its own", () => {
    const shown = [
      cycle("27.1", "2027-01-01", "2027-03-31"),
      cycle("27.2", "2027-04-01", "2027-05-31"),
      cycle("Freeze", "2027-06-01", "2027-06-30"),
      cycle("Freeze", "2027-07-01", "2027-07-31"),
      cycle("27.9", "2027-08-01", "2027-08-31"),
    ];
    const live = [
      cycle("27.1", "2027-01-01", "2027-03-31"),
      cycle("27.2", "2027-04-01", "2027-06-30"),
      cycle("Freeze", "2027-07-01", "2027-07-31"),
      cycle("27.3", "2027-09-01", "2027-09-30"),
    ];
    expect(
      cycleTwins(shown, live).map(({ cycle: one, twin }) => [
        one?.startsOn,
        twin?.startsOn,
      ]),
    ).toEqual([
      ["2027-01-01", "2027-01-01"],
      ["2027-04-01", "2027-04-01"],
      ["2027-06-01", undefined],
      ["2027-07-01", "2027-07-01"],
      ["2027-08-01", undefined],
      [undefined, "2027-09-01"],
    ]);
  });

  it("is the same cycle moved by a new length, by its name", () => {
    const [twin] = cycleTwins(
      [cycle("27.3", "2027-06-01", "2027-09-30")],
      [cycle("27.3", "2027-07-01", "2027-09-30")],
    );
    expect(twin?.twin?.startsOn).toBe("2027-07-01");
  });

  it("is the cycle starting the same day, once renamed", () => {
    expect(
      cycleTwins(quarters(1), [
        { ...(quarters(1)[0] as Cycle), name: "Old" },
      ]).map(({ twin }) => twin?.name),
    ).toEqual(["Old"]);
  });
});

describe("where later cycles start", () => {
  it.each([
    ["the quarter's first day", "2027-04-01", "2027-10-01"],
    ["its middle", "2027-05-15", "2027-10-01"],
    ["its last day", "2027-06-30", "2027-10-01"],
    ["the last quarter of a year", "2027-11-15", "2028-04-01"],
  ])("is the quarter after next's first day, from %s", (_case, day, from) => {
    expect(laterCyclesFrom(day)).toBe(from);
  });
});
