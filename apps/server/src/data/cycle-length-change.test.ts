// SPDX-License-Identifier: Apache-2.0

// Unit tests for one cycle's new length: the cycle it changes, how long a cycle may be, the pattern
// drafts that give it, the releases and features moved with later cycles or left where they are,
// and each refusal's words.

import type { LaterCycles, Permission } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { cycleLengthChange } from "./cycle-length-change.ts";
import type { Recorded } from "./draft-records.ts";
import type { KindState, RecordsState } from "./record-state.ts";
import type { Wanted } from "./record-drafting.ts";
import {
  draft,
  feature,
  kindState,
  pattern,
  patternId,
  recordsState,
  release,
  stream,
  twoStreams,
} from "./test-records-state.ts";

const today = "2026-06-15";
const seesWork: Permission[] = ["features:view"];
const seesConfigurationAlone: Permission[] = [
  "configuration:view",
  "configuration:edit",
];

// Two live streams with cycles in quarters from 2027, the first ending on the day given, with its
// patterns, if not the quarters, and the releases and features given.
function plan({
  endsOn = null,
  patterns,
  releases = kindState(),
  features = kindState(),
}: {
  endsOn?: string | null;
  patterns?: KindState;
  releases?: KindState;
  features?: KindState;
} = {}): RecordsState {
  return recordsState({
    ...twoStreams({ endsOn }),
    ...(patterns === undefined ? {} : { "cycle-pattern": patterns }),
    release: releases,
    feature: features,
  });
}

// The first stream's cycle starting on the day given changed to the length given, with new pattern
// ids numbered from 1.
function lengthChanged(
  state: RecordsState,
  startsOn: string,
  length: number,
  later: LaterCycles = "move",
  permissions: readonly Permission[] = seesWork,
) {
  let count = 0;
  return cycleLengthChange(
    state,
    stream,
    startsOn,
    { length, later },
    {
      today,
      permissions,
      newId: () => {
        count += 1;
        return `pattern-new-${String(count)}`;
      },
    },
  );
}

const added = (number: number, fields: Recorded): Wanted => ({
  type: "cycle-pattern",
  id: `pattern-new-${String(number)}`,
  record: pattern(fields),
});

// The patterns that give the second quarter of 2027 two months, moving the cycles after it.
const secondCycleOfTwoMonths: Wanted[] = [
  added(1, { startsOn: "2027-04-01", length: 2 }),
  added(2, { startsOn: "2027-06-01" }),
];

const later = release("Fictional Later", "2027-07-01", "2027-10-01");
const one = (id: string, record: Recorded) => kindState([[id, record]]);
const weekly = pattern({ unit: "weeks", length: 2 });

describe("the cycle changed", () => {
  it.each([
    ["no cycle starts", plan(), "2027-04-02"],
    [
      "is past the schedule's last day",
      plan({ endsOn: "2027-08-15" }),
      "2027-10-01",
    ],
    ["is past two years from today with nothing on it", plan(), "2028-07-01"],
  ])("is missing when the day given %s", (_, state, startsOn) => {
    expect(lengthChanged(state, startsOn, 1)).toEqual({
      missing: "There is no such cycle in this schedule",
    });
  });

  it("is found past two years from today when a release reaches it", () => {
    // Given a release on a cycle past two years from today
    const state = plan({
      releases: one("far", release("Fictional Far", "2028-07-01")),
    });

    // When that cycle is shortened, keeping the next cycle's end
    const change = lengthChanged(state, "2028-07-01", 1, "keep");

    // Then that cycle and the next change, and the release stays on it
    expect(change).toEqual({
      drafts: [
        added(1, { startsOn: "2028-07-01", length: 1 }),
        added(2, { startsOn: "2028-08-01", length: 5 }),
        added(3, { startsOn: "2029-01-01" }),
      ],
    });
  });
});

describe("a cycle's new length", () => {
  const monthsThenWeeks = kindState([
    [patternId, pattern()],
    ["weeks", pattern({ startsOn: "2028-01-01", unit: "weeks", length: 2 })],
  ]);

  it.each<[string, KindState, string, number, Wanted[]]>([
    [
      "may be 24 months",
      kindState([[patternId, pattern()]]),
      "2027-04-01",
      24,
      [
        added(1, { startsOn: "2027-04-01", length: 24 }),
        added(2, { startsOn: "2029-04-01" }),
      ],
    ],
    [
      "may be 104 weeks",
      kindState([[patternId, weekly]]),
      "2027-01-15",
      104,
      [
        added(1, { startsOn: "2027-01-15", length: 104, unit: "weeks" }),
        added(2, { startsOn: "2029-01-12", length: 2, unit: "weeks" }),
      ],
    ],
    [
      "may be 30 weeks for a cycle a pattern in weeks makes",
      monthsThenWeeks,
      "2028-01-15",
      30,
      [
        added(1, { startsOn: "2028-01-15", length: 30, unit: "weeks" }),
        added(2, { startsOn: "2028-08-12", length: 2, unit: "weeks" }),
      ],
    ],
  ])("%s", (_, patterns, startsOn, length, drafts) => {
    expect(lengthChanged(plan({ patterns }), startsOn, length)).toEqual({
      drafts,
    });
  });

  it.each<[string, KindState, string, number]>([
    [
      "is refused past 24 months",
      kindState([[patternId, pattern()]]),
      "2027-04-01",
      25,
    ],
    [
      "is refused past 104 weeks",
      kindState([[patternId, weekly]]),
      "2027-01-15",
      105,
    ],
    [
      "is refused past 24 for a cycle a pattern in months makes, though weeks follow",
      monthsThenWeeks,
      "2027-04-01",
      30,
    ],
  ])("%s", (_, patterns, startsOn, length) => {
    expect(lengthChanged(plan({ patterns }), startsOn, length)).toEqual({
      refusal: "A cycle can be at most two years long.",
    });
  });
});

describe("the pattern drafts", () => {
  it("add the patterns that give the cycle its length and move the cycles after it", () => {
    expect(lengthChanged(plan(), "2027-04-01", 2)).toEqual({
      drafts: secondCycleOfTwoMonths,
    });
  });

  it("change the pattern that starts on a day wanted, keeping its record", () => {
    // Given cycles of two months from April 2027
    const patterns = kindState([
      [patternId, pattern()],
      ["april", pattern({ startsOn: "2027-04-01", length: 2 })],
    ]);

    // When April's cycle is shortened to one month
    const change = lengthChanged(plan({ patterns }), "2027-04-01", 1);

    // Then April's pattern changes, and a new one starts in May
    expect(change).toEqual({
      drafts: [
        {
          type: "cycle-pattern",
          id: "april",
          record: pattern({ startsOn: "2027-04-01", length: 1 }),
        },
        added(1, { startsOn: "2027-05-01", length: 2 }),
      ],
    });
  });

  it("remove the patterns a change back no longer needs", () => {
    // Given the second quarter of 2027 made two months long
    const patterns = kindState([
      [patternId, pattern()],
      ["april", pattern({ startsOn: "2027-04-01", length: 2 })],
      ["june", pattern({ startsOn: "2027-06-01" })],
    ]);

    // When it is made three months long again
    const change = lengthChanged(plan({ patterns }), "2027-04-01", 3);

    // Then both patterns it needed are removed
    expect(change).toEqual({
      drafts: [
        { type: "cycle-pattern", id: "april", record: undefined },
        { type: "cycle-pattern", id: "june", record: undefined },
      ],
    });
  });

  it("move a pattern drafted to start later, as its draft makes it", () => {
    // Given a pattern drafted to start in 2028
    const patterns = kindState(
      [[patternId, pattern()]],
      [
        [
          "drafted",
          draft("created", pattern({ startsOn: "2028-01-01", length: 1 })),
        ],
      ],
    );

    // When the second quarter of 2027 is made two months long
    const change = lengthChanged(plan({ patterns }), "2027-04-01", 2);

    // Then the drafted pattern starts a month sooner instead
    expect(change).toEqual({
      drafts: [
        { type: "cycle-pattern", id: "drafted", record: undefined },
        ...secondCycleOfTwoMonths,
        added(3, { startsOn: "2027-12-01", length: 1 }),
      ],
    });
  });
});

describe("the work on the cycles", () => {
  it("moves a release on cycles that move, keeping its other fields", () => {
    const kept = { ...later, note: "Fictional note", colour: "teal" };

    expect(
      lengthChanged(plan({ releases: one("later", kept) }), "2027-04-01", 2),
    ).toEqual({
      drafts: [
        ...secondCycleOfTwoMonths,
        {
          type: "release",
          id: "later",
          record: {
            ...kept,
            firstCycle: "2027-06-01",
            lastCycle: "2027-09-01",
          },
        },
      ],
    });
  });

  it("moves a feature with its one cycle", () => {
    expect(
      lengthChanged(
        plan({ features: one("moved", feature("2027-07-01")) }),
        "2027-04-01",
        2,
      ),
    ).toEqual({
      drafts: [
        ...secondCycleOfTwoMonths,
        {
          type: "feature",
          id: "moved",
          record: feature("2027-06-01"),
        },
      ],
    });
  });

  it("leaves work on the changed cycle and those before it where it is", () => {
    const state = plan({
      releases: one(
        "alpha",
        release("Fictional Alpha", "2027-01-01", "2027-04-01"),
      ),
      features: one("first", feature("2027-01-01")),
    });

    expect(lengthChanged(state, "2027-04-01", 2)).toEqual({
      drafts: secondCycleOfTwoMonths,
    });
  });

  it("moves a release as its waiting draft places it", () => {
    // Given a release drafted onto the third quarter
    const releases = kindState(
      [["alpha", release("Fictional Alpha", "2027-01-01")]],
      [
        [
          "alpha",
          draft("changed", {
            firstCycle: "2027-07-01",
            lastCycle: "2027-07-01",
          }),
        ],
      ],
    );

    // When the second quarter is made two months long
    const change = lengthChanged(plan({ releases }), "2027-04-01", 2);

    // Then the release moves from where its draft puts it
    expect(change).toEqual({
      drafts: [
        ...secondCycleOfTwoMonths,
        {
          type: "release",
          id: "alpha",
          record: release("Fictional Alpha", "2027-06-01"),
        },
      ],
    });
  });

  it("moves a release past two years from today on a schedule that keeps going", () => {
    // Given a release on the last cycle laid out before two years from today
    const state = plan({
      releases: one("last", release("Fictional Last", "2028-04-01")),
    });

    // When the first quarter is made six months long
    const change = lengthChanged(state, "2027-01-01", 6);

    // Then the release moves a quarter later, past two years from today
    expect(change).toEqual({
      drafts: [
        {
          type: "cycle-pattern",
          id: patternId,
          record: pattern({ length: 6 }),
        },
        added(1, { startsOn: "2027-07-01" }),
        {
          type: "release",
          id: "last",
          record: release("Fictional Last", "2028-07-01"),
        },
      ],
    });
  });

  it.each<[string, string | null, KindState, number, Permission[], string]>([
    [
      "a release past the schedule's last day, naming it",
      "2027-10-15",
      one("late", release("Fictional Late", "2027-10-01")),
      6,
      seesWork,
      "Fictional Late would move past 2027-10-15, the day Fictional Stream ends.",
    ],
    [
      "work past the schedule's last day, naming none to one who doesn't see features",
      "2027-10-15",
      one("late", release("Fictional Late", "2027-10-01")),
      6,
      seesConfigurationAlone,
      "Work planned on these cycles would move past 2027-10-15, the day Fictional Stream ends.",
    ],
  ])(
    "refuses moving %s",
    (_, endsOn, releases, length, permissions, refusal) => {
      const state = plan({ endsOn, releases });

      expect(
        lengthChanged(state, "2027-04-01", length, "move", permissions),
      ).toEqual({ refusal });
    },
  );

  it("leaves a release someone else holds to be refused as any held record is", () => {
    // Given a release on cycles that move, held in someone else's unpublished changes
    const releases = kindState(
      [["later", later]],
      [],
      new Map([
        [
          "later",
          {
            holderId: "user-2",
            holder: "Fictional Holder",
            draft: draft("changed", { name: "Fictional Held" }),
          },
        ],
      ]),
    );

    // When the cycles before it change
    const changing = () => lengthChanged(plan({ releases }), "2027-04-01", 2);

    // Then the change is refused, naming who holds the release
    expect(changing).toThrow(
      "Fictional Holder is changing this; it can be changed once they publish or discard their changes",
    );
  });
});
