// SPDX-License-Identifier: Apache-2.0

// One cycle's new length as drafts: those of the patterns that give it, and of the releases and
// features on cycles that move, moved with them; or why the change can't be made, in words.

import {
  cycleLengthMoves,
  cyclesOf,
  longestCycleIn,
  type CycleLengthRequest,
  type CyclePatternLike,
  type Permission,
  type ReleaseMove,
} from "@fathom/shared";
import { type RecordsState, shownVersion } from "./record-state.ts";
import { changeableRecord, type Wanted } from "./record-drafting.ts";
import {
  endsOnOf,
  laidOutUntil,
  type Planned,
  planned,
  streamPatterns,
} from "./stream-cycles.ts";

type Kept = ReturnType<typeof streamPatterns>;

const samePattern = (first: CyclePatternLike, second: CyclePatternLike) =>
  first.startsOn === second.startsOn &&
  first.length === second.length &&
  first.unit === second.unit &&
  first.naming === second.naming;

// The drafts that take a stream's patterns to those wanted: each record keeps its start day, so no
// record takes a day another still holds; the rest are removed, and new days added.
function patternDrafts(
  state: RecordsState,
  streamId: string,
  kept: Kept,
  wanted: readonly CyclePatternLike[],
  newId: () => string,
): Wanted[] {
  const drafts: Wanted[] = [];
  for (const { id, pattern } of kept) {
    const same = wanted.find(({ startsOn }) => startsOn === pattern.startsOn);
    if (same !== undefined && samePattern(same, pattern)) continue;
    const record = changeableRecord(state, "cycle-pattern", id);
    drafts.push({
      type: "cycle-pattern",
      id,
      record: same === undefined ? undefined : { ...record, ...same },
    });
  }
  for (const pattern of wanted) {
    if (kept.some((old) => old.pattern.startsOn === pattern.startsOn)) continue;
    drafts.push({
      type: "cycle-pattern",
      id: newId(),
      record: { streamId, ...pattern },
    });
  }
  return drafts;
}

// The drafts that move releases and features with their cycles, a feature by its one cycle.
const movingDrafts = (
  state: RecordsState,
  moves: readonly ReleaseMove<Planned>[],
): Wanted[] =>
  moves.map(({ release: { type, id, record }, ...to }) => {
    changeableRecord(state, type, id);
    return {
      type,
      id,
      record:
        type === "release"
          ? { ...record, ...to }
          : { ...record, targetCycle: to.firstCycle },
    };
  });

const nameOf = (state: RecordsState, streamId: string): string =>
  String(shownVersion(state, "release-stream", streamId)?.name);

// A pattern, release or feature someone else holds, or one its draft removes, throws, as
// changeableRecord does.
export function cycleLengthChange(
  state: RecordsState,
  streamId: string,
  startsOn: string,
  request: CycleLengthRequest,
  {
    today,
    permissions,
    newId,
  }: {
    today: string;
    permissions: readonly Permission[];
    newId: () => string;
  },
): { drafts: Wanted[] } | { missing: string } | { refusal: string } {
  const kept = streamPatterns(state, streamId);
  const patterns = kept.map(({ pattern }) => pattern);
  const endsOn = endsOnOf(state, streamId);
  const until = laidOutUntil(state, streamId, today);
  const cycles = cyclesOf(patterns, until, endsOn);
  if (!cycles.some((cycle) => cycle.startsOn === startsOn)) {
    return { missing: "There is no such cycle in this schedule" };
  }
  const { unit } = patterns
    .filter((pattern) => pattern.startsOn <= startsOn)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
    // A cycle starts on that day, so a pattern makes it.
    .at(-1) as CyclePatternLike;
  if (request.length > longestCycleIn(unit)) {
    return { refusal: "A cycle can be at most two years long." };
  }
  const change = cycleLengthMoves(
    { name: nameOf(state, streamId), patterns, cycles, until, endsOn },
    { startsOn, ...request },
    planned(state, streamId),
    permissions,
  );
  if ("problem" in change) return { refusal: change.problem };
  return {
    drafts: [
      ...patternDrafts(state, streamId, kept, change.patterns, newId),
      ...movingDrafts(state, change.moves),
    ],
  };
}
