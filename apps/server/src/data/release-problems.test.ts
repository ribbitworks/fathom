// SPDX-License-Identifier: Apache-2.0

// Unit tests for the rules across a release stream's records: which records a change has judged,
// each refusal of patterns, the stream's last day and releases' and features' cycles, in words the
// role acting can see, the order that decides whose words win, and a retired stream's cycles.

import {
  endsBeforeFirstCycle,
  type Permission,
  type RecordType,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { Recorded } from "./draft-records.ts";
import {
  type RecordsState,
  stateOf,
  type Touched,
  withVersion,
} from "./record-state.ts";
import { releaseProblem, retiredTargetProblem } from "./release-problems.ts";
import {
  feature,
  kindState,
  otherPatternId,
  otherStream,
  pattern,
  patternId,
  recordsState,
  release,
  schedule,
  stream,
  twoStreams,
} from "./test-records-state.ts";

const seesWork: Permission[] = ["features:view", "configuration:view"];
const seesConfigurationAlone: Permission[] = [
  "configuration:view",
  "configuration:edit",
];

const patternStart =
  "Cycles can change only from the start of one of the schedule's cycles";
const releaseNotOfStream =
  "Choose a first and last cycle of the release's schedule";
const featureNotOfStream = "Choose a cycle of the feature's schedule";
const alphaAfterPlan =
  "The release Fictional Alpha includes cycles after that day; change it first";
const alphaOffCycles =
  "The release Fictional Alpha would no longer start and end with cycles of its schedule; change it first";
const clashWithAlpha =
  "The release Fictional Alpha already includes some of those cycles";

// Two live streams with cycles in quarters from 2027, the first with the end, releases and features
// given, live.
function plan({
  endsOn = null,
  releases = [],
  features = [],
}: {
  endsOn?: string | null;
  releases?: [string, Recorded][];
  features?: [string, Recorded][];
} = {}): RecordsState {
  return recordsState({
    ...twoStreams({ endsOn }),
    release: kindState(releases),
    feature: kindState(features),
  });
}

const alpha: [string, Recorded] = [
  "alpha",
  release("Fictional Alpha", "2027-01-01", "2027-04-01"),
];
const withAlpha = () => plan({ releases: [alpha] });

// A record a change makes as wanted, or removes when undefined.
type Change = [type: RecordType, id: string, wanted: Recorded | undefined];

// The records after the changes are drafted, and what the changes touch.
function changed(
  state: RecordsState,
  changes: readonly Change[],
): { after: RecordsState; touched: Touched[] } {
  let after = state;
  const touched = changes.map(([type, id, wanted]): Touched => {
    after = withVersion(after, type, id, wanted);
    return {
      type,
      id,
      record: wanted ?? stateOf(state, type).live.get(id) ?? {},
    };
  });
  return { after, touched };
}

function problemOf(
  state: RecordsState,
  changes: readonly Change[],
  permissions: readonly Permission[] = seesWork,
): string | undefined {
  const { after, touched } = changed(state, changes);
  return releaseProblem(after, touched, permissions);
}

const endingOn = (endsOn: string): Change => [
  "release-stream",
  stream,
  schedule({ endsOn }),
];

const patternFrom = (startsOn: string, fields: Recorded = {}): Change => [
  "cycle-pattern",
  "pattern-new",
  pattern({ startsOn, ...fields }),
];

const twoMonthCycles: Change = [
  "cycle-pattern",
  patternId,
  pattern({ length: 2 }),
];

const adding = (record: Recorded, id = "new"): Change => [
  "streamId" in record ? "release" : "feature",
  id,
  record,
];

const removing = (type: RecordType, id: string): Change => [
  type,
  id,
  undefined,
];

describe("the records a change has judged", () => {
  it("are only those touched when no pattern or end is", () => {
    // Given a live feature off its stream's cycles
    const state = plan({ features: [["off", feature("2027-02-01")]] });

    // When another feature on the stream is added
    const problem = problemOf(state, [adding(feature("2027-04-01"))]);

    // Then the feature off the cycles is not judged
    expect(problem).toBeUndefined();
  });

  it("include every release and feature on a stream one of whose patterns is touched", () => {
    // Given a release on the first two quarters
    const state = withAlpha();

    // When the stream's cycles become two months long
    const problem = problemOf(state, [twoMonthCycles]);

    // Then the release, off the cycles, is refused by name
    expect(problem).toBe(alphaOffCycles);
  });

  it("include every release and feature on a stream that is touched", () => {
    // Given a feature live on a day no cycle starts
    const state = plan({ features: [["off", feature("2027-02-01")]] });

    // When the stream is renamed
    const problem = problemOf(state, [
      ["release-stream", stream, schedule({ name: "Fictional Renamed" })],
    ]);

    // Then the feature is refused as not of the stream's cycles
    expect(problem).toBe(featureNotOfStream);
  });

  it("leave out what is on a stream the change doesn't touch", () => {
    // Given a release off the cycles of one stream
    const state = plan({
      releases: [["off", release("Fictional Off", "2027-02-01")]],
    });

    // When the other stream's cycles change
    const problem = problemOf(state, [
      [
        "cycle-pattern",
        otherPatternId,
        pattern({ streamId: otherStream, length: 2 }),
      ],
    ]);

    // Then nothing is refused
    expect(problem).toBeUndefined();
  });

  it("include every stream a change touches, a feature's being the one it targets", () => {
    // When a change adds a fitting release to one stream and a feature off the other's cycles
    const problem = problemOf(plan(), [
      adding(release("Fictional Fits", "2027-01-01")),
      adding(feature("2027-02-01", otherStream)),
    ]);

    // Then the feature on the second stream is refused
    expect(problem).toBe(featureNotOfStream);
  });

  it("are none for a feature moved to Later", () => {
    const state = plan({ features: [["moved", feature("2027-04-01")]] });

    expect(
      problemOf(state, [["feature", "moved", feature(null, null)]]),
    ).toBeUndefined();
  });

  it("leave out a release a change removes, and the schedule's end", () => {
    // Given a schedule ending before its first cycle, as data made before the rule might be
    const state = plan({
      endsOn: "2026-12-31",
      releases: [["removed", release("Fictional Removed", "2027-02-01")]],
    });

    // When a release on it is removed
    const problem = problemOf(state, [removing("release", "removed")]);

    // Then neither the release nor the schedule's end is judged
    expect(problem).toBeUndefined();
  });

  it.each<[string, Change, string]>([
    [
      "a release",
      adding(release("Fictional Beta", "2027-02-01")),
      "The release Fictional Beta would no longer start and end with cycles of its schedule; change it first",
    ],
    [
      "a feature",
      adding(feature("2027-02-01")),
      "The feature Fictional Feature would no longer target a cycle of its schedule; change it first",
    ],
  ])(
    "judge %s touched with a pattern of its stream as left off the cycles, naming it",
    (_, change, refusal) => {
      expect(problemOf(plan(), [twoMonthCycles, change])).toBe(refusal);
    },
  );

  it("judge a record past the end as off the cycles when a pattern is touched and the stream isn't", () => {
    // Given a schedule ending before a release's last cycle, as data made before the rule might be
    const state = plan({ endsOn: "2027-03-31", releases: [alpha] });

    // When the stream's cycles are renamed
    const problem = problemOf(state, [
      ["cycle-pattern", patternId, pattern({ naming: "Q{N} {YYYY}" })],
    ]);

    // Then the release is refused as off the cycles, not as past the end
    expect(problem).toBe(alphaOffCycles);
  });
});

describe("a pattern's start", () => {
  it.each([
    [
      "may be a day no cycle starts on for the stream's earliest pattern",
      patternFrom("2026-12-01", { length: 1 }),
      undefined,
    ],
    [
      "may be the start of a cycle the other patterns make",
      patternFrom("2027-07-01", { length: 6 }),
      undefined,
    ],
    [
      "is refused within one of the cycles",
      patternFrom("2027-08-01"),
      patternStart,
    ],
  ])("%s", (_, change, refusal) => {
    expect(problemOf(plan(), [change])).toBe(refusal);
  });
});

describe("a schedule's last day", () => {
  const lateFeature = () =>
    plan({ features: [["late", feature("2027-10-01")]] });

  it.each([
    [
      "is refused before the first cycle starts",
      plan,
      "2026-12-31",
      seesWork,
      endsBeforeFirstCycle,
    ],
    [
      "is refused before a release's last cycle starts, naming the release",
      withAlpha,
      "2027-03-31",
      seesWork,
      alphaAfterPlan,
    ],
    [
      "may be the day a release's last cycle starts",
      withAlpha,
      "2027-04-01",
      seesWork,
      undefined,
    ],
    [
      "is refused before a cycle a feature targets, naming the feature",
      lateFeature,
      "2027-09-30",
      seesWork,
      "The feature Fictional Feature targets a cycle after that day; change it first",
    ],
    [
      "names no release or feature to one who doesn't see features",
      lateFeature,
      "2027-09-30",
      seesConfigurationAlone,
      "Work is planned on cycles after that day",
    ],
  ])("%s", (_, state, endsOn, permissions, refusal) => {
    expect(problemOf(state(), [endingOn(endsOn)], permissions)).toBe(refusal);
  });

  it("refuses a first pattern starting after it", () => {
    // Given a schedule with no cycles yet, ending in 2026
    const state = recordsState({
      "release-stream": kindState([
        [stream, schedule({ endsOn: "2026-12-31" })],
      ]),
    });

    // When its first cycles are drafted to start in 2027
    const problem = problemOf(state, [patternFrom("2027-01-01")]);

    // Then the schedule's end is refused
    expect(problem).toBe(endsBeforeFirstCycle);
  });

  it.each([
    ["before its first cycle", "2026-12-31", "2027-01-01"],
    ["before the release's cycle", "2027-05-15", "2027-07-01"],
  ])(
    "is not judged when only a release is added to a schedule ending %s, which is refused as off its cycles",
    (_, endsOn, cycle) => {
      expect(
        problemOf(plan({ endsOn }), [adding(release("Fictional Late", cycle))]),
      ).toBe(releaseNotOfStream);
    },
  );
});

describe("the cycles of releases and features", () => {
  it.each([
    [
      "refuse a pattern that leaves a feature off them, naming it",
      () => plan({ features: [["kept", feature("2027-07-01")]] }),
      patternFrom("2027-04-01", { length: 2 }),
      seesWork,
      "The feature Fictional Feature would no longer target a cycle of its schedule; change it first",
    ],
    [
      "refuse a pattern removed that leaves a release off them, naming it",
      withAlpha,
      removing("cycle-pattern", patternId),
      seesWork,
      alphaOffCycles,
    ],
    [
      "name no release or feature a pattern leaves off them to one who doesn't see features",
      withAlpha,
      twoMonthCycles,
      seesConfigurationAlone,
      "Work planned on these cycles would no longer fit the schedule's cycles",
    ],
    [
      "keep their words to one who doesn't see features when the release itself is touched",
      plan,
      adding(release("Fictional Release", "2027-02-01")),
      seesConfigurationAlone,
      releaseNotOfStream,
    ],
    [
      "refuse a release on a cycle another release includes, naming the other",
      withAlpha,
      adding(release("Fictional Beta", "2027-04-01", "2027-07-01")),
      seesWork,
      clashWithAlpha,
    ],
    [
      "name the release a clash is with to one who doesn't see features too",
      withAlpha,
      adding(release("Fictional Beta", "2027-01-01")),
      seesConfigurationAlone,
      clashWithAlpha,
    ],
    [
      "let releases take the cycles next to each other's",
      withAlpha,
      adding(release("Fictional Beta", "2027-07-01", "2027-10-01")),
      seesWork,
      undefined,
    ],
    [
      "let a release take cycles a release on another stream includes",
      withAlpha,
      adding(
        release("Fictional Beta", "2027-01-01", "2027-01-01", otherStream),
      ),
      seesWork,
      undefined,
    ],
    [
      "let features share a cycle",
      () => plan({ features: [["first", feature("2027-04-01")]] }),
      adding(feature("2027-04-01")),
      seesWork,
      undefined,
    ],
  ])("%s", (_, state, change, permissions, refusal) => {
    expect(problemOf(state(), [change], permissions)).toBe(refusal);
  });

  it("let a release take cycles a release drafted to be removed includes", () => {
    expect(
      problemOf(withAlpha(), [
        removing("release", "alpha"),
        adding(release("Fictional Beta", "2027-01-01")),
      ]),
    ).toBeUndefined();
  });
});

describe("the order of the checks", () => {
  it.each<[string, Change[], string]>([
    [
      "names a pattern's start before the schedule's end",
      [patternFrom("2027-08-01"), endingOn("2026-12-31")],
      patternStart,
    ],
    [
      "names the schedule's end before a release past it",
      [endingOn("2026-12-31")],
      endsBeforeFirstCycle,
    ],
    [
      "names a release past the end, not off the cycles, when the stream and a pattern are touched",
      [endingOn("2027-03-31"), twoMonthCycles],
      alphaAfterPlan,
    ],
    [
      "names a release's cycles before a clash",
      [adding(release("Fictional Beta", "2027-01-01", "2027-05-01"))],
      releaseNotOfStream,
    ],
    [
      "names releases before features, whatever the order touched",
      [
        adding(feature("2027-02-01")),
        ["release", "alpha", release("Fictional Alpha", "2027-02-01")],
      ],
      releaseNotOfStream,
    ],
    [
      "names the first stream touched before the next",
      [
        adding(feature("2027-02-01", otherStream)),
        adding(release("Fictional Off", "2027-02-01")),
      ],
      featureNotOfStream,
    ],
  ])("%s", (_, changes, refusal) => {
    expect(problemOf(withAlpha(), changes)).toBe(refusal);
  });

  it("names a pattern's start even when only a release is touched", () => {
    // Given a stream whose drafted pattern starts within a cycle
    const { after } = changed(plan(), [patternFrom("2027-08-01")]);

    // When a fitting release is added
    const problem = problemOf(after, [
      adding(release("Fictional Fits", "2027-01-01")),
    ]);

    // Then the pattern's start is refused
    expect(problem).toBe(patternStart);
  });
});

describe("a retired stream's cycles", () => {
  const retired = (features: [string, Recorded][] = []) =>
    recordsState({
      "release-stream": kindState([
        [stream, schedule({ name: "Fictional Retired", retired: true })],
        [otherStream, schedule({ name: "Fictional Other Stream" })],
      ]),
      feature: kindState(features),
    });

  const refusal =
    "Fictional Retired is retired, so its cycles take no new features";

  const problemIn = (state: RecordsState, changes: readonly Change[]) => {
    const { after, touched } = changed(state, changes);
    return retiredTargetProblem(after, touched);
  };

  it.each<[string, [string, Recorded][], string | undefined]>([
    ["refuse a feature added onto one", [], refusal],
    [
      "refuse a feature moved onto one from another stream",
      [["moved", feature("2027-01-01", otherStream)]],
      refusal,
    ],
    [
      "refuse a feature moved onto one from Later",
      [["moved", feature(null, null)]],
      refusal,
    ],
    [
      "keep a feature whose live record targets the stream",
      [["moved", feature("2027-01-01")]],
      undefined,
    ],
    [
      "let such a feature move between the stream's cycles",
      [["moved", feature("2027-04-01")]],
      undefined,
    ],
  ])("%s", (_, features, expected) => {
    expect(
      problemIn(retired(features), [
        ["feature", "moved", feature("2027-01-01")],
      ]),
    ).toBe(expected);
  });

  it("are judged as the stream's draft makes it", () => {
    // Given a live stream drafted to be retired
    const { after } = changed(plan(), [
      [
        "release-stream",
        stream,
        schedule({ name: "Fictional Retired", retired: true }),
      ],
    ]);

    // When a feature is added onto its cycles
    const problem = problemIn(after, [adding(feature("2027-01-01"))]);

    // Then it is refused
    expect(problem).toBe(refusal);
  });

  it.each([
    [
      "a feature onto a stream that isn't retired",
      feature("2027-01-01", otherStream),
    ],
    ["a feature moved to Later", feature(null, null)],
    [
      "a feature onto a stream with no record, which the links refuse",
      feature("2027-01-01", "stream-3"),
    ],
    ["a release onto one", release("Fictional Release", "2027-01-01")],
  ])("leave alone %s", (_, record) => {
    expect(problemIn(retired(), [adding(record)])).toBeUndefined();
  });
});
