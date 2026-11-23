// SPDX-License-Identifier: Apache-2.0

// What is on a release stream's cycles as drafts make them: its patterns, releases and features, its
// last day, how far its cycles are laid out, and which drafts of its cycles a record's draft uses.

import {
  type Cycle,
  type CyclePatternLike,
  cycleUnitSchema,
  cyclesOf,
  horizonFrom,
  type RecordRef,
} from "@fathom/shared";
import type { Recorded } from "./draft-records.ts";
import {
  type RecordsState,
  shownIds,
  shownVersion,
  stateOf,
  versionOf,
} from "./record-state.ts";

// A feature's target as a release on that one cycle, so a release's rules for cycles hold for it.
export const targetAsCycles = (feature: Recorded): Recorded => ({
  streamId: feature.targetStreamId,
  firstCycle: feature.targetCycle,
  lastCycle: feature.targetCycle,
});

// The kinds of record on a stream's cycles, each as a release's cycles.
export const onCycles = [
  { type: "release", cycles: (release: Recorded) => release },
  { type: "feature", cycles: targetAsCycles },
] as const;

export type OnCyclesType = (typeof onCycles)[number]["type"];

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

export const patternDrafts = (
  state: RecordsState,
  streamId: string,
): RecordRef[] =>
  patternIds(state, streamId)
    .filter((id) => stateOf(state, "cycle-pattern").drafts.has(id))
    .map((id) => ({ type: "cycle-pattern", id }));

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

export function livePatterns(
  state: RecordsState,
  streamId: string,
): CyclePatternLike[] {
  return [...state["cycle-pattern"].live.values()]
    .filter((pattern) => pattern.streamId === streamId)
    .map(asPattern);
}

// The records of a kind on a stream's cycles as their drafts make them, those drafted to be removed
// left out.
export const onStream = (
  state: RecordsState,
  type: OnCyclesType,
  streamId: string,
  cycles: (record: Recorded) => Recorded,
): { id: string; record: Recorded }[] =>
  shownIds(state, type).flatMap((id) => {
    const record = versionOf(state, type, id);
    return record !== undefined && cycles(record).streamId === streamId
      ? [{ id, record }]
      : [];
  });

// The features that target a stream's cycles, as their drafts make them.
export const streamFeatures = (state: RecordsState, streamId: string) =>
  onStream(state, "feature", streamId, targetAsCycles);

// A stream's releases as their drafts make them, in the order of their cycles, those drafted to be
// removed left out.
export function streamReleases(
  state: RecordsState,
  streamId: string,
): { id: string; release: Recorded }[] {
  return onStream(state, "release", streamId, (release) => release)
    .map(({ id, record }) => ({ id, release: record }))
    .sort((a, b) =>
      String(a.release.firstCycle).localeCompare(String(b.release.firstCycle)),
    );
}

// The releases and features on a stream's cycles, as their drafts make them, a feature as a release
// on its one cycle.
export const planned = (state: RecordsState, streamId: string) => [
  ...streamReleases(state, streamId).map(({ id, release }) => ({
    type: "release" as const,
    id,
    record: release,
    name: String(release.name),
    firstCycle: String(release.firstCycle),
    lastCycle: String(release.lastCycle),
    shipsOn: typeof release.shipsOn === "string" ? release.shipsOn : null,
  })),
  ...streamFeatures(state, streamId).map(({ id, record }) => ({
    type: "feature" as const,
    id,
    record,
    name: String(record.name),
    firstCycle: String(record.targetCycle),
    lastCycle: String(record.targetCycle),
    shipsOn: null,
  })),
];

export type Planned = ReturnType<typeof planned>[number];

// A schedule's last day, from its record, or null while it keeps going.
export const endsOnIn = (stream: Recorded): string | null =>
  typeof stream.endsOn === "string" ? stream.endsOn : null;

// A schedule's last day, as its draft, if any, makes it.
export const endsOnOf = (
  state: RecordsState,
  streamId: string,
): string | null =>
  // A schedule is never removed, so what belongs to it always has one.
  endsOnIn(versionOf(state, "release-stream", streamId) ?? {});

// The day the last cycle anything on a schedule's cycles includes starts, as drafts make them, or
// none when nothing is on them: how far its cycles must be worked out to judge them, since Fathom
// lays them out ahead from today.
export const reachOf = (state: RecordsState, streamId: string): string =>
  onCycles
    .flatMap(({ type, cycles: asCycles }) =>
      onStream(state, type, streamId, asCycles).map(({ record }) =>
        String(asCycles(record).lastCycle),
      ),
    )
    .sort()
    .at(-1) ?? "";

// How far a schedule's cycles are laid out: two years from today, or further, to the cycle the
// furthest record on them includes, such as one a change of cycles moved past that day.
export function laidOutUntil(
  state: RecordsState,
  streamId: string,
  today: string,
): string {
  const horizon = horizonFrom(today);
  const reach = reachOf(state, streamId);
  return reach > horizon ? reach : horizon;
}

// Whether a release's first and last cycles are cycles of its stream, in order.
export function releaseFits(
  cycles: readonly Cycle[],
  release: Recorded,
): boolean {
  const starts = new Set(cycles.map(({ startsOn }) => startsOn));
  return (
    starts.has(String(release.firstCycle)) &&
    starts.has(String(release.lastCycle)) &&
    String(release.firstCycle) <= String(release.lastCycle)
  );
}

export const cyclesChanged = (version: Recorded, live: Recorded) =>
  version.streamId !== live.streamId ||
  version.firstCycle !== live.firstCycle ||
  version.lastCycle !== live.lastCycle;

// The drafts of a stream's cycles that a record's draft uses: those of its stream when it moves to
// other cycles, or, when added, is on a cycle only those drafts make.
export function draftsOfCycles(
  state: RecordsState,
  version: Recorded,
  live: Recorded | undefined,
): RecordRef[] {
  const streamId = String(version.streamId);
  const bound =
    live === undefined
      ? !releaseFits(
          cyclesOf(livePatterns(state, streamId), String(version.lastCycle)),
          version,
        )
      : cyclesChanged(version, live);
  return bound ? patternDrafts(state, streamId) : [];
}
