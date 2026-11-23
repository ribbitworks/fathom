// SPDX-License-Identifier: Apache-2.0

// The rules for ending a schedule and for changing one cycle's length, which the server enforces
// and the browser shows before saving.

import type { Permission } from "./access.ts";
import {
  type Cycle,
  type CyclePatternLike,
  cyclesOf,
  endsBeforeFirstCycle,
  endsTooEarly,
  type LengthChange,
  movedCycles,
  pastAnyMove,
  patternsForLength,
} from "./cycles.ts";
import {
  movedReleases,
  namesPlannedWork,
  type ReleaseCycles,
  type ReleaseMove,
} from "./releases.ts";

// A release or feature on a schedule's cycles, by the start of the last cycle it includes.
export type PlannedWork = Pick<ReleaseCycles, "name" | "lastCycle"> & {
  type: "release" | "feature";
};

const afterEnd: Readonly<
  Record<PlannedWork["type"], (name: string) => string>
> = {
  release: (name) =>
    `The release ${name} includes cycles after that day; change it first`,
  feature: (name) =>
    `The feature ${name} targets a cycle after that day; change it first`,
};

const unnamedAfterEnd = "Work is planned on cycles after that day";

const typeRank: Readonly<Record<PlannedWork["type"], number>> = {
  release: 0,
  feature: 1,
};

// Compared by code point rather than locale, so the server and every browser agree.
const byCodePoint = (first: string, second: string): number =>
  first === second ? 0 : first < second ? -1 : 1;

// Releases before features, then the latest last cycle, then by name, so the server and the
// browser name the same one whatever order they list them in.
const firstNamed = (first: PlannedWork, second: PlannedWork): number =>
  typeRank[first.type] - typeRank[second.type] ||
  byCodePoint(second.lastCycle, first.lastCycle) ||
  byCodePoint(first.name, second.name);

// Why a schedule can't end on a day, or undefined when it can: it would end before its first cycle
// starts, or a release or feature would be left on a cycle after it, named only to a role that sees
// them.
export function scheduleEndProblem(
  patterns: readonly CyclePatternLike[],
  endsOn: string | null,
  planned: readonly PlannedWork[],
  permissions: readonly Permission[],
): string | undefined {
  if (endsTooEarly(patterns, endsOn)) return endsBeforeFirstCycle;
  if (endsOn === null) return undefined;
  const after = planned
    .filter(({ lastCycle }) => lastCycle > endsOn)
    .sort(firstNamed)
    .at(0);
  if (after === undefined) return undefined;
  return namesPlannedWork(permissions)
    ? afterEnd[after.type](after.name)
    : unnamedAfterEnd;
}

// A schedule as a change of one cycle's length works from: its patterns, its cycles laid out until
// a day, and its last day, if any.
export interface LengthChanging {
  name: string;
  patterns: readonly CyclePatternLike[];
  cycles: readonly Cycle[];
  until: string;
  endsOn: string | null;
}

// What one cycle's new length makes of a schedule: the patterns that give it, its cycles laid out
// past any move, where each cycle now starts, and the releases and features that move with their
// cycles; or why it can't be made, with the cycles it would make once the patterns can be.
export function cycleLengthMoves<Moved extends ReleaseCycles>(
  schedule: LengthChanging,
  change: LengthChange,
  planned: readonly Moved[],
  permissions: readonly Permission[],
):
  | {
      patterns: CyclePatternLike[];
      cycles: Cycle[];
      moved: Map<string, string | undefined>;
      moves: ReleaseMove<Moved>[];
    }
  | { problem: string; cycles?: Cycle[] } {
  const made = patternsForLength(schedule.patterns, change);
  if ("problem" in made) return made;
  const until = pastAnyMove(schedule.until);
  const cycles = cyclesOf(made.patterns, until, schedule.endsOn);
  const moved = movedCycles(schedule.cycles, cycles);
  const moving = movedReleases(
    planned,
    moved,
    schedule.endsOn ?? until,
    schedule.name,
    permissions,
  );
  if ("problem" in moving) return { problem: moving.problem, cycles };
  return { patterns: made.patterns, cycles, moved, moves: moving.moves };
}
