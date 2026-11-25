// SPDX-License-Identifier: Apache-2.0

// Unit tests for the kinds on a release stream's cycles: which drafts a pattern's, release's or
// feature's draft is decided and discarded with, where a stream added goes, and each kind's name.

import type { RecordRef } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { Draft, Recorded } from "./draft-records.ts";
import { type KindState, type RecordsState, usesOf } from "./record-state.ts";
import {
  featureKind,
  patternKind,
  releaseKind,
  streamKind,
} from "./release-kinds.ts";
import {
  draft,
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

const twoMonthCycles = draft("changed", { length: 2 });
const laterPatternId = "pattern-3";
const laterCycles = draft("created", pattern({ startsOn: "2028-01-01" }));
const laterRef: RecordRef = { type: "cycle-pattern", id: laterPatternId };
const cycleDrafts: RecordRef[] = [
  { type: "cycle-pattern", id: patternId },
  laterRef,
];

// Two live streams, the first's cycles drafted, by default, to be two months long and to change
// again in 2028, with the releases and features given.
function plan({
  patternDrafts = [
    [patternId, twoMonthCycles],
    [laterPatternId, laterCycles],
  ],
  ...parts
}: Partial<RecordsState> & {
  patternDrafts?: [string, Draft][];
} = {}): RecordsState {
  return recordsState({ ...twoStreams({ patternDrafts }), ...parts });
}

// One record of a kind, live as given, with its draft, if any.
const one = (
  live: Recorded | undefined,
  drafted?: Draft,
  id = "record",
): KindState =>
  kindState(
    live === undefined ? [] : [[id, live]],
    drafted === undefined ? [] : [[id, drafted]],
  );

const alpha = release("Fictional Alpha", "2027-01-01", "2027-04-01");

describe("the drafts a release's draft uses", () => {
  it.each<[string, KindState, RecordRef[]]>([
    [
      "are none when it stays on the same cycles",
      one(alpha, draft("changed", { name: "Fictional Renamed" })),
      [],
    ],
    [
      "are its stream's cycle drafts when it moves to another first cycle",
      one(alpha, draft("changed", { firstCycle: "2027-03-01" })),
      cycleDrafts,
    ],
    [
      "are its stream's cycle drafts when it moves to another last cycle",
      one(alpha, draft("changed", { lastCycle: "2027-05-01" })),
      cycleDrafts,
    ],
    [
      "are its stream's cycle drafts when added on a cycle only they make",
      one(undefined, draft("created", release("Fictional Beta", "2027-03-01"))),
      cycleDrafts,
    ],
    [
      "are none when added on a live cycle",
      one(undefined, draft("created", release("Fictional Beta", "2027-01-01"))),
      [],
    ],
    [
      "are none when it is drafted to be removed",
      one(alpha, draft("deleted")),
      [],
    ],
    [
      "are none when it moves on a stream whose cycles have no drafts",
      one(
        release("Fictional Other", "2027-01-01", "2027-01-01", otherStream),
        draft("changed", { lastCycle: "2027-04-01" }),
      ),
      [],
    ],
  ])("%s", (_, releases, uses) => {
    expect(usesOf(releaseKind, plan({ release: releases }), "record")).toEqual(
      uses,
    );
  });

  it("are the new stream's cycle drafts when it moves to another stream", () => {
    // Given both streams' cycles drafted to change
    const state = plan({
      patternDrafts: [
        [patternId, twoMonthCycles],
        [otherPatternId, twoMonthCycles],
      ],
      release: one(alpha, draft("changed", { streamId: otherStream })),
    });

    // When the drafts the release's draft uses are asked for
    const uses = usesOf(releaseKind, state, "record");

    // Then they are the other stream's alone
    expect(uses).toEqual([{ type: "cycle-pattern", id: otherPatternId }]);
  });

  it("are the stream only drafted to be added, and its cycle drafts", () => {
    // Given a stream and its cycles only drafted to be added
    const state = recordsState({
      "release-stream": one(undefined, draft("created", schedule()), "new"),
      "cycle-pattern": one(
        undefined,
        draft("created", pattern({ streamId: "new" })),
        "new-pattern",
      ),
      release: one(
        undefined,
        draft(
          "created",
          release("Fictional Release", "2027-01-01", "2027-01-01", "new"),
        ),
      ),
    });

    // When the drafts a release added on its first cycle uses are asked for
    const uses = usesOf(releaseKind, state, "record");

    // Then they are the stream's and its cycles'
    expect(uses).toEqual([
      { type: "release-stream", id: "new" },
      { type: "cycle-pattern", id: "new-pattern" },
    ]);
  });
});

describe("the drafts a feature's draft uses", () => {
  it.each<[string, KindState, RecordRef[]]>([
    [
      "are none when it stays on the same cycle",
      one(
        feature("2027-01-01"),
        draft("changed", { name: "Fictional Renamed" }),
      ),
      [],
    ],
    [
      "are its stream's cycle drafts when it moves onto another cycle",
      one(
        feature("2027-01-01"),
        draft("changed", { targetCycle: "2027-03-01" }),
      ),
      cycleDrafts,
    ],
    [
      "are its stream's cycle drafts when it moves onto a live cycle the drafts also make",
      one(
        feature("2027-01-01"),
        draft("changed", { targetCycle: "2027-07-01" }),
      ),
      cycleDrafts,
    ],
    [
      "are none when it moves on a stream whose cycles have no drafts",
      one(
        feature("2027-01-01", otherStream),
        draft("changed", { targetCycle: "2027-04-01" }),
      ),
      [],
    ],
    [
      "are its new stream's cycle drafts when it moves onto the same day of that stream",
      one(
        feature("2027-01-01", otherStream),
        draft("changed", { targetStreamId: stream }),
      ),
      cycleDrafts,
    ],
    [
      "are its stream's cycle drafts when added on a cycle only they make",
      one(undefined, draft("created", feature("2027-03-01"))),
      cycleDrafts,
    ],
    [
      "are none when added on a live cycle",
      one(undefined, draft("created", feature("2027-01-01"))),
      [],
    ],
    [
      "are none when it moves to Later",
      one(
        feature("2027-01-01"),
        draft("changed", { targetStreamId: null, targetCycle: null }),
      ),
      [],
    ],
    [
      "are none when added for Later",
      one(undefined, draft("created", feature(null, null))),
      [],
    ],
    [
      "are none when it is drafted to be removed",
      one(feature("2027-01-01"), draft("deleted")),
      [],
    ],
  ])("%s", (_, features, uses) => {
    expect(usesOf(featureKind, plan({ feature: features }), "record")).toEqual(
      uses,
    );
  });
});

describe("the drafts a pattern's draft uses", () => {
  it("are its stream's other pattern drafts, not another stream's", () => {
    // Given the stream's cycles drafted to change and to change again later, and the other's too
    const state = plan({
      patternDrafts: [
        [patternId, twoMonthCycles],
        [laterPatternId, laterCycles],
        [otherPatternId, twoMonthCycles],
      ],
    });

    // When the drafts the first pattern's draft uses are asked for
    const uses = usesOf(patternKind, state, patternId);

    // Then they are the stream's other pattern draft alone
    expect(uses).toEqual([laterRef]);
  });

  const releaseRef: RecordRef[] = [{ type: "release", id: "record" }];
  const featureRef: RecordRef[] = [{ type: "feature", id: "record" }];

  // Each row's pattern draft also uses its stream's later pattern draft, so rows name only the
  // records bound.
  it.each<[string, Partial<RecordsState>, RecordRef[]]>([
    [
      "include a live release drafted onto other cycles",
      { release: one(alpha, draft("changed", { lastCycle: "2027-05-01" })) },
      releaseRef,
    ],
    [
      "leave out a live release changed on the same cycles",
      {
        release: one(
          release("Fictional Kept", "2027-01-01", "2027-07-01"),
          draft("changed", { name: "Fictional Renamed" }),
        ),
      },
      [],
    ],
    [
      "include a live release drafted to be removed whose cycles the drafts no longer make",
      { release: one(alpha, draft("deleted")) },
      releaseRef,
    ],
    [
      "leave out a release drafted to be removed whose cycles the drafts still make",
      {
        release: one(
          release("Fictional Kept", "2027-01-01", "2027-07-01"),
          draft("deleted"),
        ),
      },
      [],
    ],
    [
      "leave out a release only drafted to be added",
      {
        release: one(
          undefined,
          draft("created", release("Fictional Beta", "2027-03-01")),
        ),
      },
      [],
    ],
    [
      "leave out a release on another stream drafted onto other cycles",
      {
        release: one(
          release("Fictional Other", "2027-01-01", "2027-01-01", otherStream),
          draft("changed", { lastCycle: "2027-04-01" }),
        ),
      },
      [],
    ],
    [
      "include a live feature moved to Later from a cycle the drafts drop",
      {
        feature: one(
          feature("2027-04-01"),
          draft("changed", { targetStreamId: null, targetCycle: null }),
        ),
      },
      featureRef,
    ],
    [
      "leave out a live feature moved to Later from a cycle the drafts keep",
      {
        feature: one(
          feature("2027-07-01"),
          draft("changed", { targetStreamId: null, targetCycle: null }),
        ),
      },
      [],
    ],
    [
      "include a live feature moved onto the stream from another",
      {
        feature: one(
          feature("2027-01-01", otherStream),
          draft("changed", { targetStreamId: stream }),
        ),
      },
      featureRef,
    ],
    [
      "leave out a live feature moved to another stream from a cycle the drafts keep",
      {
        feature: one(
          feature("2027-07-01"),
          draft("changed", { targetStreamId: otherStream }),
        ),
      },
      [],
    ],
  ])("%s", (_, parts, uses) => {
    expect(usesOf(patternKind, plan(parts), patternId)).toEqual([
      laterRef,
      ...uses,
    ]);
  });
});

describe("a stream added", () => {
  it.each<[string, [string, Recorded][], number]>([
    ["goes first when there are none", [], 1],
    [
      "goes at the end of the order",
      [
        ["first", { position: 1 }],
        ["third", { position: 3 }],
      ],
      4,
    ],
  ])("%s", (_, rows, position) => {
    expect(streamKind.added?.(new Map(rows))).toEqual({ position });
  });
});

describe("the name a record is given", () => {
  const state = plan({
    release: one(alpha),
    feature: one(feature("2027-01-01")),
  });

  it.each([
    ["names a stream", streamKind, stream, "the schedule Fictional Stream"],
    [
      "names a pattern by its stream and first day",
      patternKind,
      patternId,
      "the cycles of Fictional Stream from 2027-01-01",
    ],
    [
      "names a release with its stream",
      releaseKind,
      "record",
      "the release Fictional Alpha in Fictional Stream",
    ],
    ["names a feature", featureKind, "record", "the feature Fictional Feature"],
  ])("%s", (_, kind, id, subject) => {
    expect(kind.subject(state, id, ["features:view"])).toBe(subject);
  });
});
