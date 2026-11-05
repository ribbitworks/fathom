// SPDX-License-Identifier: Apache-2.0

// A release stream's cycles, worked out from its cycle patterns, as the Decisions Log sets out:
// each pattern makes cycles of its length from the day it starts until the stream's next pattern
// starts, named by its naming pattern, and made at least two years ahead. A cycle is known by its
// stream and the day it starts. Each cycle knows its share of the months it spans, for counting
// allocations, capacity, and demand. Days are ISO dates, such as 2027-01-01, worked out in UTC.

import { z } from "zod";

export const cycleUnitSchema = z.enum(["weeks", "months"]);

export type CycleUnit = z.infer<typeof cycleUnitSchema>;

export interface CyclePatternLike {
  startsOn: string;
  length: number;
  unit: CycleUnit;
  naming: string;
}

// The part of a month a cycle covers: its days in the month over the month's days.
export interface MonthShare {
  // The month, such as 2027-01.
  month: string;
  share: number;
}

export interface Cycle {
  startsOn: string;
  endsOn: string;
  name: string;
  months: MonthShare[];
}

// The last two digits of the year the cycle ends in, and its number within that year.
export const defaultNaming = "{YY}.{N}";

// What a naming pattern can hold besides its own text.
export const namingTokens = [
  { token: "{YYYY}", means: "the year the cycle ends in" },
  { token: "{YY}", means: "the last two digits of that year" },
  { token: "{N}", means: "the cycle's number within that year" },
  { token: "{#}", means: "the cycle's number in the stream, from its first" },
] as const;

// How far ahead a new stream's cycles are made, so features expected far ahead can target one.
export const yearsAhead = 2;

// The most cycles one stream makes, so a pattern of one week from long ago cannot make too many.
const mostCycles = 5000;

const parseDay = (day: string): Date => new Date(`${day}T00:00:00Z`);

const formatDay = (date: Date): string => date.toISOString().slice(0, 10);

export function addDays(day: string, days: number): string {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDay(date);
}

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

// The same day of the month some months later, or the month's last day when it is shorter, so a
// cycle that starts on the 31st starts on the last day of shorter months.
export function addMonths(day: string, months: number): string {
  const date = parseDay(day);
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const dayOfMonth = Math.min(date.getUTCDate(), daysInMonth(year, month));
  return formatDay(new Date(Date.UTC(year, month, dayOfMonth)));
}

// The day a pattern's cycle, counted from its first, starts on. Counting from the pattern's start,
// rather than from the cycle before, keeps cycles on the same day of the month.
const cycleStart = (pattern: CyclePatternLike, index: number): string =>
  pattern.unit === "weeks"
    ? addDays(pattern.startsOn, 7 * pattern.length * index)
    : addMonths(pattern.startsOn, pattern.length * index);

// The day a new stream's cycles are made until, from the day it is drafted: two years on.
export const horizonFrom = (today: string): string =>
  addMonths(today, 12 * yearsAhead);

// A cycle's name from its naming pattern, given its number within the year it ends in and its
// number in the stream, counting from the stream's first cycle.
export function cycleName(
  naming: string,
  endsOn: string,
  number: number,
  count: number,
): string {
  const year = endsOn.slice(0, 4);
  return naming
    .replaceAll("{YYYY}", year)
    .replaceAll("{YY}", year.slice(2))
    .replaceAll("{N}", String(number))
    .replaceAll("{#}", String(count));
}

// The months a cycle spans, each with the share of its days the cycle covers.
export function monthShares(startsOn: string, endsOn: string): MonthShare[] {
  const shares: MonthShare[] = [];
  let first = startsOn;
  while (first <= endsOn) {
    const date = parseDay(first);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const days = daysInMonth(year, month);
    const monthEnd = formatDay(new Date(Date.UTC(year, month, days)));
    const last = monthEnd < endsOn ? monthEnd : endsOn;
    const covered = parseDay(last).getUTCDate() - date.getUTCDate() + 1;
    shares.push({ month: first.slice(0, 7), share: covered / days });
    first = addDays(last, 1);
  }
  return shares;
}

// A stream's cycles, in order, from its first pattern's start to the first cycle that starts after
// the day given. A cycle that the next pattern's start would cut short ends the day before it.
export function cyclesOf(
  patterns: readonly CyclePatternLike[],
  until: string,
): Cycle[] {
  const sorted = [...patterns].sort((a, b) =>
    a.startsOn.localeCompare(b.startsOn),
  );
  const spans: { startsOn: string; endsOn: string; naming: string }[] = [];
  for (const [at, pattern] of sorted.entries()) {
    const next = sorted[at + 1]?.startsOn;
    for (let index = 0; spans.length < mostCycles; index += 1) {
      const startsOn = cycleStart(pattern, index);
      if ((next !== undefined && startsOn >= next) || startsOn > until) break;
      const following = cycleStart(pattern, index + 1);
      const end = next !== undefined && next < following ? next : following;
      spans.push({
        startsOn,
        endsOn: addDays(end, -1),
        naming: pattern.naming,
      });
    }
  }
  const numbers = new Map<string, number>();
  return spans.map(({ startsOn, endsOn, naming }, at) => {
    const year = endsOn.slice(0, 4);
    const number = (numbers.get(year) ?? 0) + 1;
    numbers.set(year, number);
    return {
      startsOn,
      endsOn,
      name: cycleName(naming, endsOn, number, at + 1),
      months: monthShares(startsOn, endsOn),
    };
  });
}

// Whether a pattern may start on a day, among a stream's other patterns: any day when there are
// none, and otherwise only on the start of one of the cycles they make, so the cycles before it
// keep their names and dates and none is cut short.
export function patternStartFits(
  others: readonly CyclePatternLike[],
  startsOn: string,
): boolean {
  if (others.length === 0) return true;
  return cyclesOf(others, startsOn).some(
    (cycle) => cycle.startsOn === startsOn,
  );
}
