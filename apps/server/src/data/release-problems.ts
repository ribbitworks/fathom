// SPDX-License-Identifier: Apache-2.0

// The rules across a release stream's records that each change drafted, published and approved must
// keep: patterns, the stream's last day, releases' and features' cycles, and retired streams.

import {
  cyclesOf,
  endsBeforeFirstCycle,
  endsTooEarly,
  namesPlannedWork,
  patternStartFits,
  type Permission,
} from "@fathom/shared";
import type { Recorded } from "./drafts.ts";
import {
  type RecordsState,
  type Touched,
  stateOf,
  versionOf,
} from "./record-state.ts";
import {
  endsOnOf,
  onCycles,
  type OnCyclesType,
  onStream,
  reachOf,
  releaseFits,
  streamPatterns,
  streamReleases,
} from "./stream-cycles.ts";

interface CycleRefusals {
  afterPlan: (name: string) => string;
  offCycles: (name: string) => string;
  notOfStream: string;
}

// How each kind of record on a stream's cycles is refused: when it is past the stream's plan, when
// a change of the stream's cycles leaves it off them, and when the cycles asked for are not the
// stream's.
const cycleRefusals: Readonly<Record<OnCyclesType, CycleRefusals>> = {
  release: {
    afterPlan: (name) =>
      `The release ${name} includes cycles after that day; change it first`,
    offCycles: (name) =>
      `The release ${name} would no longer start and end with cycles of its schedule; change it first`,
    notOfStream: "Choose a first and last cycle of the release's schedule",
  },
  feature: {
    afterPlan: (name) =>
      `The feature ${name} targets a cycle after that day; change it first`,
    offCycles: (name) =>
      `The feature ${name} would no longer target a cycle of its schedule; change it first`,
    notOfStream: "Choose a cycle of the feature's schedule",
  },
};

// The refusals of a change of cycles, to a role that can't see releases and features, naming none
// of them.
const unnamedRefusals = {
  afterPlan: "Work is planned on cycles after that day",
  offCycles:
    "Work planned on these cycles would no longer fit the schedule's cycles",
} as const;

const overlaps = (first: Recorded, second: Recorded) =>
  String(first.firstCycle) <= String(second.lastCycle) &&
  String(second.firstCycle) <= String(first.lastCycle);

// The stream a touched record belongs to, or is.
const streamOf = ({ type, id, record }: Touched): string =>
  type === "release-stream"
    ? id
    : String(record.streamId ?? record.targetStreamId);

// The first way the records break the rules for streams' cycles and releases, in the streams the
// touched records belong to, or undefined when they keep them, in words the role acting can see. A
// release breaks them only if it is touched, or a pattern in its stream is, so a change is not
// refused for a problem it did not make.
export function releaseProblem(
  state: RecordsState,
  touched: readonly Touched[],
  permissions: readonly Permission[],
): string | undefined {
  const worded = (named: string, unnamed: string) =>
    namesPlannedWork(permissions) ? named : unnamed;
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
        return "Cycles can change only from the start of one of the schedule's cycles";
      }
    }
    const found = streamReleases(state, streamId);
    const endsOn = endsOnOf(state, streamId);
    const made = patterns.map(({ pattern }) => pattern);
    if ((streamTouched || patternTouched) && endsTooEarly(made, endsOn)) {
      return endsBeforeFirstCycle;
    }
    const cycles = cyclesOf(made, reachOf(state, streamId), endsOn);
    for (const { type, cycles: asCycles } of onCycles) {
      // The type is always one of the fixed kinds on a stream's cycles.
      // eslint-disable-next-line security/detect-object-injection
      const refusals = cycleRefusals[type];
      for (const { id, record } of onStream(state, type, streamId, asCycles)) {
        const recordTouched = touched.some(
          (ref) => ref.type === type && ref.id === id,
        );
        if (!patternTouched && !streamTouched && !recordTouched) continue;
        const name = String(record.name);
        const own = asCycles(record);
        if (
          streamTouched &&
          endsOn !== null &&
          String(own.lastCycle) > endsOn
        ) {
          return worded(refusals.afterPlan(name), unnamedRefusals.afterPlan);
        }
        if (!releaseFits(cycles, own)) {
          return patternTouched
            ? worded(refusals.offCycles(name), unnamedRefusals.offCycles)
            : refusals.notOfStream;
        }
        if (type !== "release") continue;
        const clash = found.find(
          (other) => other.id !== id && overlaps(record, other.release),
        );
        // Only one who sees releases changes a release onto another's cycles: a change of cycles
        // moves a stream's releases together, so they never come to share one.
        if (clash !== undefined) {
          return `The release ${String(clash.release.name)} already includes some of those cycles`;
        }
      }
    }
  }
  return undefined;
}

// The first feature drafted onto a cycle of a retired stream that its live record doesn't already
// target a cycle of, refused, since a retired stream's cycles take no new features. A feature
// already there keeps its place, and may move between the stream's cycles, as a change of the
// stream's cycles moves it with its cycle; each draft is checked on its own, so the rule can't tell
// that move from another.
export function retiredTargetProblem(
  state: RecordsState,
  touched: readonly Touched[],
): string | undefined {
  for (const { type, id, record } of touched) {
    if (type !== "feature" || typeof record.targetStreamId !== "string") {
      continue;
    }
    const streamId = record.targetStreamId;
    const stream = versionOf(state, "release-stream", streamId);
    if (stream?.retired !== true) continue;
    const live = stateOf(state, "feature").live.get(id);
    if (live?.targetStreamId !== streamId) {
      return `${String(stream.name)} is retired, so its cycles take no new features`;
    }
  }
  return undefined;
}
