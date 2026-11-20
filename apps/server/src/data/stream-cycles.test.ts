// SPDX-License-Identifier: Apache-2.0

// Unit tests for what is on a release stream's cycles as drafts make them: its patterns, releases
// and features, its last day, how far its cycles are laid out, and the drafts of its cycles a
// record's draft uses.

import { cyclesOf } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  draftsOfCycles,
  endsOnIn,
  endsOnOf,
  laidOutUntil,
  livePatterns,
  patternDrafts,
  reachOf,
  releaseFits,
  streamFeatures,
  streamPatterns,
  streamReleases,
} from "./stream-cycles.ts";
import {
  draft,
  feature,
  kindState,
  otherStream,
  pattern,
  quarters,
  recordsState,
  release,
  schedule,
  stream,
} from "./test-records-state.ts";

const today = "2026-06-15";
const twoYearsOn = "2028-06-15";
describe("a stream's patterns", () => {
  const state = recordsState({
    "cycle-pattern": kindState(
      [
        ["kept", pattern()],
        ["changed", pattern({ startsOn: "2028-01-01" })],
        ["removed", pattern({ startsOn: "2029-01-01" })],
        ["elsewhere", pattern({ streamId: otherStream })],
      ],
      [
        ["changed", draft("changed", { length: 6 })],
        ["removed", draft("deleted")],
        ["added", draft("created", pattern({ startsOn: "2030-01-01" }))],
        ["elsewhere", draft("changed", { length: 1 })],
      ],
    ),
  });

  it("are as their drafts make them, those drafted to be removed and those of other streams left out", () => {
    expect(streamPatterns(state, stream)).toEqual([
      { id: "kept", pattern: quarters },
      {
        id: "changed",
        pattern: { ...quarters, startsOn: "2028-01-01", length: 6 },
      },
      { id: "added", pattern: { ...quarters, startsOn: "2030-01-01" } },
    ]);
  });

  it("are as they are live when asked for live", () => {
    expect(livePatterns(state, stream).map(({ startsOn }) => startsOn)).toEqual(
      ["2027-01-01", "2028-01-01", "2029-01-01"],
    );
  });

  it("have their drafts on that stream named, those of live patterns and of patterns only drafted", () => {
    expect(patternDrafts(state, stream).map(({ id }) => id)).toEqual([
      "changed",
      "removed",
      "added",
    ]);
  });

  it("read a unit Fathom doesn't know as months", () => {
    const odd = recordsState({
      "cycle-pattern": kindState([["odd", pattern({ unit: "fortnights" })]]),
    });

    expect(streamPatterns(odd, stream)[0]?.pattern.unit).toBe("months");
  });
});

describe("what is on a stream's cycles", () => {
  it("is its releases as their drafts make them, in the order of their first cycles, those drafted to be removed left out", () => {
    const state = recordsState({
      release: kindState(
        [
          ["later", release("Fictional Later", "2027-07-01")],
          ["moved", release("Fictional Moved", "2027-10-01")],
          ["removed", release("Fictional Removed", "2027-04-01")],
          [
            "elsewhere",
            release(
              "Fictional Elsewhere",
              "2027-01-01",
              "2027-01-01",
              otherStream,
            ),
          ],
        ],
        [
          ["moved", draft("changed", { firstCycle: "2028-01-01" })],
          ["removed", draft("deleted")],
          [
            "sooner",
            draft("created", release("Fictional Sooner", "2027-01-01")),
          ],
        ],
      ),
    });

    expect(
      streamReleases(state, stream).map(({ id, release }) => [
        id,
        release.firstCycle,
      ]),
    ).toEqual([
      ["sooner", "2027-01-01"],
      ["later", "2027-07-01"],
      ["moved", "2028-01-01"],
    ]);
  });

  it("is the features that target its cycles as their drafts make them", () => {
    const state = recordsState({
      feature: kindState(
        [
          ["kept", feature("2027-01-01")],
          ["arriving", feature("2027-04-01", otherStream)],
          ["leaving", feature("2027-07-01")],
          ["removed", feature("2027-10-01")],
        ],
        [
          ["arriving", draft("changed", { targetStreamId: stream })],
          ["leaving", draft("changed", { targetStreamId: null })],
          ["removed", draft("deleted")],
        ],
      ),
    });

    expect(streamFeatures(state, stream).map(({ id }) => id)).toEqual([
      "kept",
      "arriving",
    ]);
  });
});

describe("a schedule's last day", () => {
  it.each([
    ["is the day its record holds", "2027-09-30"],
    ["is none while the schedule keeps going", null],
  ])("%s", (_, endsOn) => {
    expect(endsOnIn({ endsOn })).toBe(endsOn);
  });

  it("is as the schedule's draft makes it", () => {
    const state = recordsState({
      "release-stream": kindState(
        [[stream, schedule()]],
        [[stream, draft("changed", { endsOn: "2027-09-30" })]],
      ),
    });

    expect(endsOnOf(state, stream)).toBe("2027-09-30");
  });

  it("is none for a schedule with no record", () => {
    expect(endsOnOf(recordsState({}), stream)).toBeNull();
  });
});

describe("how far a schedule's cycles are laid out", () => {
  it("is two years from today with nothing on the cycles", () => {
    const state = recordsState({});

    expect([
      reachOf(state, stream),
      laidOutUntil(state, stream, today),
    ]).toEqual(["", twoYearsOn]);
  });

  it("reaches the start of the furthest cycle a release includes", () => {
    const state = recordsState({
      release: kindState([
        ["far", release("Fictional Far", "2028-07-01", "2029-01-01")],
        ["near", release("Fictional Near", "2027-07-01")],
      ]),
    });

    expect(laidOutUntil(state, stream, today)).toBe("2029-01-01");
  });

  it("reaches the furthest cycle a feature targets, as drafts make it", () => {
    const state = recordsState({
      feature: kindState(
        [["far", feature("2027-04-01")]],
        [["far", draft("changed", { targetCycle: "2029-04-01" })]],
      ),
    });

    expect(laidOutUntil(state, stream, today)).toBe("2029-04-01");
  });
});

describe("whether a release fits its stream's cycles", () => {
  const cycles = cyclesOf([quarters], "2027-12-31");

  it("fits when its first and last cycles are the stream's, in order", () => {
    expect(
      releaseFits(
        cycles,
        release("Fictional Release", "2027-01-01", "2027-07-01"),
      ),
    ).toBe(true);
  });

  it.each([
    ["its first cycle is none of the stream's", "2027-02-01", "2027-07-01"],
    ["its last cycle is none of the stream's", "2027-01-01", "2027-08-01"],
    ["its last cycle comes before its first", "2027-07-01", "2027-01-01"],
  ])("does not fit when %s", (_, firstCycle, lastCycle) => {
    expect(
      releaseFits(cycles, release("Fictional Release", firstCycle, lastCycle)),
    ).toBe(false);
  });
});

describe("the drafts of a stream's cycles a record's draft uses", () => {
  const live = release("Fictional Release", "2027-04-01");
  const state = recordsState({
    "cycle-pattern": kindState(
      [["live", pattern()]],
      [
        ["added", draft("created", pattern({ startsOn: "2027-08-01" }))],
        ["elsewhere", draft("created", pattern({ streamId: otherStream }))],
      ],
    ),
  });

  it("are none for a live record kept on its cycles", () => {
    expect(
      draftsOfCycles(state, { ...live, name: "Fictional Renamed" }, live),
    ).toEqual([]);
  });

  it.each([
    ["first cycle", { firstCycle: "2027-01-01" }],
    ["last cycle", { lastCycle: "2027-07-01" }],
  ])(
    "are the stream's pattern drafts for a live record given another %s",
    (_, moved) => {
      expect(draftsOfCycles(state, { ...live, ...moved }, live)).toEqual([
        { type: "cycle-pattern", id: "added" },
      ]);
    },
  );

  it("are the new stream's pattern drafts for a live record moved to another stream", () => {
    expect(
      draftsOfCycles(state, { ...live, streamId: otherStream }, live),
    ).toEqual([{ type: "cycle-pattern", id: "elsewhere" }]);
  });

  it("are the stream's pattern drafts for a record added on a cycle only those drafts make", () => {
    expect(
      draftsOfCycles(
        state,
        release("Fictional Release", "2027-08-01"),
        undefined,
      ),
    ).toEqual([{ type: "cycle-pattern", id: "added" }]);
  });

  it("are none for a record added on a live cycle", () => {
    expect(
      draftsOfCycles(
        state,
        release("Fictional Release", "2027-04-01"),
        undefined,
      ),
    ).toEqual([]);
  });
});
