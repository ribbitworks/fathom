// SPDX-License-Identifier: Apache-2.0

// What the Schedules tab says about a schedule: the pattern in force and the release that ships
// next, how long a cycle lasts, in its pattern's unit where it fills whole ones and in days where it
// is cut short, how long its cycles last now, and where today falls among them, so its details can
// start at the current cycle.

import {
  addDays,
  addMonths,
  type Cycle,
  type CyclePattern,
  type CycleUnit,
  hasEnded,
  type ReleaseStream,
} from "@fathom/shared";
import { isCurrent } from "./feature-board.ts";
import { daysBetween, keptReleases, releaseDate } from "./releases.ts";

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
      return ships !== undefined && ships >= day ? [{ release, ships }] : [];
    })
    .sort((one, other) => one.ships.localeCompare(other.ships))
    .at(0);
}

const daysPerWeek = 7;

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
    return days % daysPerWeek === 0
      ? lengthWords(days / daysPerWeek, "weeks")
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
