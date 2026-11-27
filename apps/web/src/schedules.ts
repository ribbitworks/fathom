// SPDX-License-Identifier: Apache-2.0

// What the Schedules and Cycles tabs say about a schedule: its pattern, its cycles' lengths, where
// today falls among them, and the drafts that change them.

import {
  addDays,
  addMonths,
  type Cycle,
  type CyclePattern,
  type CycleUnit,
  hasEnded,
  monthOf,
  monthsInQuarter,
  addToMonth,
  quarterStart,
  type RecordDraft,
  type RecordRef,
  type ReleaseStream,
  daysBetween,
  daysInWeek,
} from "@fathom/shared";
import { isCurrent } from "./feature-board.ts";
import {
  hasShipped,
  keptReleases,
  nameCounts,
  releaseDate,
} from "./releases.ts";

// The pattern in force on a day, or the first, when none has started yet.
export function patternOn(
  stream: ReleaseStream,
  day: string,
): CyclePattern | undefined {
  const kept = stream.patterns.filter(
    ({ draft }) => draft?.action !== "deleted",
  );
  return kept.filter(({ startsOn }) => startsOn <= day).at(-1) ?? kept[0];
}

// A schedule's cycle holding the day, if any, retired or not, so retiring it changes nothing shown.
export const currentCycle = (
  stream: ReleaseStream,
  day: string,
): Cycle | undefined => stream.cycles.find((cycle) => isCurrent(cycle, day));

// The release that ships next, on or after a day, of those not removed, with the day it ships.
export function nextRelease(stream: ReleaseStream, day: string) {
  return keptReleases(stream)
    .flatMap((release) => {
      const ships = releaseDate(stream, release);
      return ships === undefined || hasShipped(stream, release, day)
        ? []
        : [{ release, ships }];
    })
    .sort((one, other) => one.ships.localeCompare(other.ships))
    .at(0);
}

const unitNames: Record<CycleUnit | "days", string> = {
  days: "day",
  weeks: "week",
  months: "month",
};

// A cycle's unit in words, one or several as its length is, such as week or months.
export const cycleUnitWords = (length: number, unit: CycleUnit | "days") =>
  // The unit is always one of the fixed units.
  // eslint-disable-next-line security/detect-object-injection
  `${unitNames[unit]}${length === 1 ? "" : "s"}`;

const lengthWords = (length: number, unit: CycleUnit | "days") =>
  `${String(length)} ${cycleUnitWords(length, unit)}`;

// How long a cycle lasts, such as 3 months, in the unit of the pattern that makes it where it fills
// a whole number of them, or else in days, as a cycle cut short by the next pattern or by the
// schedule's last day does.
export function durationWords(cycle: Cycle, unit: CycleUnit): string {
  const after = addDays(cycle.endsOn, 1);
  const days = daysBetween(cycle.startsOn, after);
  if (unit === "weeks") {
    return days % daysInWeek === 0
      ? lengthWords(days / daysInWeek, "weeks")
      : lengthWords(days, "days");
  }
  for (let months = 1; addMonths(cycle.startsOn, months) <= after; months++) {
    if (addMonths(cycle.startsOn, months) === after) {
      return lengthWords(months, "months");
    }
  }
  return lengthWords(days, "days");
}

// The unit of the pattern that makes a cycle: the last to start on or before it.
export const unitOf = (stream: ReleaseStream, cycle: Cycle): CycleUnit =>
  patternOn(stream, cycle.startsOn)?.unit ?? "months";

// How long a schedule's cycles last now, such as 3 months, by the pattern in force on the day; none
// before it has any, or once it has ended.
export function lengthNow(stream: ReleaseStream, day: string): string {
  const pattern = patternOn(stream, day);
  if (pattern === undefined || hasEnded(stream, day)) return "";
  return lengthWords(pattern.length, pattern.unit);
}

// Where a schedule's details start its cycles: at the one holding the day, or else the first to
// start after it; at the last when every cycle has ended, so the list is never empty.
export function startingCycle(cycles: readonly Cycle[], day: string): number {
  const found = cycles.findIndex(({ endsOn }) => endsOn >= day);
  return found === -1 ? Math.max(cycles.length - 1, 0) : found;
}

// A draft that changes a schedule's cycles, with the record it is the draft of, as decisions name
// it, and, for a pattern's, the day the pattern starts.
export interface CycleChange {
  ref: RecordRef;
  record: { id: string; draft: RecordDraft; heldBy?: string | undefined };
  startsOn: string | undefined;
}

// The drafts that change a schedule's cycles: its own, where it changes when the schedule ends, then
// its patterns', in their order, leaving out rejected ones where asked.
export function cycleChanges(
  stream: ReleaseStream,
  leaveOutRejected: boolean,
): CycleChange[] {
  const kept = (draft: RecordDraft | undefined): draft is RecordDraft =>
    draft !== undefined && !(leaveOutRejected && draft.state === "rejected");
  const { draft } = stream;
  const ownEnd: CycleChange[] =
    kept(draft) &&
    draft.action === "changed" &&
    draft.changed.includes("endsOn")
      ? [
          {
            ref: { type: "release-stream", id: stream.id },
            record: { id: stream.id, draft, heldBy: stream.heldBy },
            startsOn: undefined,
          },
        ]
      : [];
  return [
    ...ownEnd,
    ...stream.patterns.flatMap(
      ({ id, draft: patternDraft, heldBy, startsOn }) =>
        kept(patternDraft)
          ? [
              {
                ref: { type: "cycle-pattern" as const, id },
                record: { id, draft: patternDraft, heldBy },
                startsOn,
              },
            ]
          : [],
    ),
  ];
}

// The change behind a cycle a draft changes: that of the last pattern starting on or before it, or
// else the first, such as a change of when the schedule ends.
export const changeBehind = (
  changes: readonly CycleChange[],
  cycle: Pick<Cycle, "startsOn">,
): CycleChange | undefined =>
  changes
    .filter(
      ({ startsOn }) => startsOn !== undefined && startsOn <= cycle.startsOn,
    )
    .at(-1) ?? changes[0];

// Each cycle of a schedule as shown beside the same cycle as it is live, if it is, and each live
// cycle no longer among those shown on its own: matched by name where the name is the only one of
// its kind on both sides, as a cycle moved by a new length keeps its name, and else by its first day.
export type CycleTwin =
  { cycle: Cycle; twin: Cycle | undefined } | { cycle: undefined; twin: Cycle };

export function cycleTwins(
  shown: readonly Cycle[],
  live: readonly Cycle[],
): CycleTwin[] {
  const once = (cycles: readonly Cycle[]) => {
    const counts = nameCounts(cycles.map(({ name }) => name));
    return (name: string) => counts(name) === 1;
  };
  const shownOnce = once(shown);
  const liveOnce = once(live);
  const byName = (cycle: Cycle) =>
    shownOnce(cycle.name) && liveOnce(cycle.name);
  const unmatched = new Set(live.filter((cycle) => !byName(cycle)));
  const pairs = shown.map((cycle): CycleTwin => {
    const twin = byName(cycle)
      ? live.find(({ name }) => name === cycle.name)
      : [...unmatched].find(({ startsOn }) => startsOn === cycle.startsOn);
    if (twin !== undefined) unmatched.delete(twin);
    return { cycle, twin };
  });
  const matched = new Set(pairs.map(({ twin }) => twin));
  return [
    ...pairs,
    ...live
      .filter((cycle) => !matched.has(cycle))
      .map((twin) => ({ cycle: undefined, twin })),
  ];
}

// The first day of the quarter after next, from the day given: a cycle starting on or after it is
// a later one, which the Cycles tab shows only when asked for.
export function laterCyclesFrom(day: string): string {
  return `${addToMonth(quarterStart(monthOf(day)), 2 * monthsInQuarter)}-01`;
}
