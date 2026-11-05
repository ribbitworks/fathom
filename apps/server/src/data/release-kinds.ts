// SPDX-License-Identifier: Apache-2.0

// Release streams, their cycle patterns, and their releases, as kinds of the plan's records, with
// the rules the Decisions Log sets for them: a stream's later patterns start on the start of one of
// its cycles, so the cycles before keep their names and dates; a release includes consecutive
// cycles of its stream, from its first to its last, which no other release in the stream includes,
// and none starting after the stream's cycles-until date. Part of the data access layer; records.ts
// checks the rules when a change is drafted or published, against the records as the editor sees
// them, and when drafts are approved, against the live records.

import { cyclePatterns, releases, releaseStreams } from "@fathom/db";
import {
  type Cycle,
  type CyclePatternLike,
  cycleUnitSchema,
  cyclesOf,
  patternStartFits,
  planSubjects,
  type RecordRef,
} from "@fathom/shared";
import type { Recorded } from "./drafts.ts";
import {
  addedOnly,
  type RecordKind,
  type RecordsState,
  type Touched,
  shownIds,
  shownVersion,
  versionOf,
} from "./record-state.ts";

const nameIn = (state: RecordsState, id: string): string =>
  // A stream is never removed, so what belongs to it always has one.
  String(shownVersion(state, "release-stream", id)?.name);

export const streamKind: RecordKind = {
  type: "release-stream",
  table: releaseStreams,
  fields: ["name", "retired", "cyclesUntil"],
  links: {},
  unique: {
    field: "name",
    message: "There is already a release stream with that name",
  },
  subject: (state, id) => planSubjects.stream(nameIn(state, id)),
  // A stream added goes at the end of the order.
  added: (rows) => ({
    position:
      Math.max(
        0,
        ...[...rows.values()].map(({ position }) => Number(position)),
      ) + 1,
  }),
};

export const patternKind: RecordKind = {
  type: "cycle-pattern",
  table: cyclePatterns,
  fields: ["streamId", "startsOn", "length", "unit", "naming"],
  links: { streamId: "release-stream" },
  unique: {
    field: "startsOn",
    within: "streamId",
    message: "This stream already has cycles that change on that day",
  },
  subject: (state, id) => {
    const pattern = shownVersion(state, "cycle-pattern", id);
    return planSubjects.pattern(
      nameIn(state, String(pattern?.streamId)),
      String(pattern?.startsOn),
    );
  },
};

export const releaseKind: RecordKind = {
  type: "release",
  table: releases,
  fields: ["streamId", "name", "firstCycle", "lastCycle", "shipsOn", "colour"],
  links: { streamId: "release-stream" },
  unique: {
    field: "name",
    within: "streamId",
    message: "This stream already has a release with that name",
  },
  subject: (state, id) => {
    const release = shownVersion(state, "release", id);
    return planSubjects.release(
      String(release?.name),
      nameIn(state, String(release?.streamId)),
    );
  },
  // A release whose cycles only patterns drafted to be added make uses those patterns' drafts.
  alsoUses: (state, id) => {
    // Only a record its draft keeps is asked what else it uses.
    const release = versionOf(state, "release", id) as Recorded;
    const streamId = String(release.streamId);
    const live = livePatterns(state, streamId);
    if (releaseFits(cyclesOf(live, String(release.lastCycle)), release)) {
      return [];
    }
    return patternIds(state, streamId)
      .filter((patternId) => addedOnly(state, "cycle-pattern", patternId))
      .map((patternId): RecordRef => ({
        type: "cycle-pattern",
        id: patternId,
      }));
  },
};

export const releaseKinds = [streamKind, patternKind, releaseKind] as const;

// A pattern as the cycles are worked out from it.
const asPattern = (record: Recorded): CyclePatternLike => ({
  startsOn: String(record.startsOn),
  length: Number(record.length),
  unit: cycleUnitSchema.catch("months").parse(record.unit),
  naming: String(record.naming),
});

const patternIds = (state: RecordsState, streamId: string) =>
  shownIds(state, "cycle-pattern").filter(
    (id) => shownVersion(state, "cycle-pattern", id)?.streamId === streamId,
  );

// A stream's patterns as their drafts make them, those drafted to be removed left out.
export function streamPatterns(
  state: RecordsState,
  streamId: string,
): { id: string; pattern: CyclePatternLike }[] {
  return patternIds(state, streamId).flatMap((id) => {
    const version = versionOf(state, "cycle-pattern", id);
    return version === undefined ? [] : [{ id, pattern: asPattern(version) }];
  });
}

function livePatterns(
  state: RecordsState,
  streamId: string,
): CyclePatternLike[] {
  return [...state["cycle-pattern"].live.values()]
    .filter((pattern) => pattern.streamId === streamId)
    .map(asPattern);
}

// A stream's releases as their drafts make them, in the order of their cycles, those drafted to be
// removed left out.
export function streamReleases(
  state: RecordsState,
  streamId: string,
): { id: string; release: Recorded }[] {
  return shownIds(state, "release")
    .flatMap((id) => {
      const release = versionOf(state, "release", id);
      return release?.streamId === streamId ? [{ id, release }] : [];
    })
    .sort((a, b) =>
      String(a.release.firstCycle).localeCompare(String(b.release.firstCycle)),
    );
}

// The day a stream's cycles are made until, as its draft, if any, makes it.
export const cyclesUntilOf = (state: RecordsState, streamId: string): string =>
  // A stream is never removed, so what belongs to it always has one.
  String(versionOf(state, "release-stream", streamId)?.cyclesUntil);

// Whether a release's first and last cycles are cycles of its stream, in order.
function releaseFits(cycles: readonly Cycle[], release: Recorded): boolean {
  const starts = new Set(cycles.map(({ startsOn }) => startsOn));
  return (
    starts.has(String(release.firstCycle)) &&
    starts.has(String(release.lastCycle)) &&
    String(release.firstCycle) <= String(release.lastCycle)
  );
}

const overlaps = (first: Recorded, second: Recorded) =>
  String(first.firstCycle) <= String(second.lastCycle) &&
  String(second.firstCycle) <= String(first.lastCycle);

// The stream a touched record belongs to, or is.
const streamOf = ({ type, id, record }: Touched): string =>
  type === "release-stream" ? id : String(record.streamId);

// The first way the records break the rules for streams' cycles and releases, in the streams the
// touched records belong to, or undefined when they keep them. A release breaks them only if it is
// touched, or a pattern in its stream is, so a change is not refused for a problem it did not make.
export function releaseProblem(
  state: RecordsState,
  touched: readonly Touched[],
): string | undefined {
  const streams = new Set(touched.map(streamOf));
  for (const streamId of streams) {
    const patterns = streamPatterns(state, streamId);
    const patternTouched = touched.some(
      (ref) => ref.type === "cycle-pattern" && streamOf(ref) === streamId,
    );
    const streamTouched = touched.some(
      (ref) => ref.type === "release-stream" && ref.id === streamId,
    );
    for (const [at, { pattern }] of patterns.entries()) {
      const others = patterns
        .filter((_, index) => index !== at)
        .map((other) => other.pattern);
      const earliest = others.every(
        (other) => pattern.startsOn < other.startsOn,
      );
      if (!earliest && !patternStartFits(others, pattern.startsOn)) {
        return "Cycles can change only from the start of one of the stream's cycles";
      }
    }
    const found = streamReleases(state, streamId);
    const until = cyclesUntilOf(state, streamId);
    const cycles = cyclesOf(
      patterns.map(({ pattern }) => pattern),
      until,
    );
    const checked = found.filter(
      ({ id }) =>
        patternTouched ||
        streamTouched ||
        touched.some((ref) => ref.type === "release" && ref.id === id),
    );
    for (const { id, release } of checked) {
      if (streamTouched && String(release.lastCycle) > until) {
        return `The release ${String(release.name)} includes cycles after that day; change it first`;
      }
      if (!releaseFits(cycles, release)) {
        return patternTouched
          ? `The release ${String(release.name)} would no longer start and end with cycles of its stream; change it first`
          : "Choose a first and last cycle of the release's stream";
      }
      const clash = found.find(
        (other) => other.id !== id && overlaps(release, other.release),
      );
      if (clash !== undefined) {
        return `The release ${String(clash.release.name)} already includes some of those cycles`;
      }
    }
  }
  return undefined;
}
