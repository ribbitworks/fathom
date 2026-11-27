// SPDX-License-Identifier: Apache-2.0

// Days, moments and months as people read them, in their own language, each with its year.

import { parseDay } from "@fathom/shared";

const day = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// A date as people read it, with its year.
export function formatDay(value: string): string {
  return day.format(parseDay(value));
}

const dayInYear = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

// Two days as people read them, such as Jan 1 to Mar 31, 2027, naming the year once when both
// share it. Intl's own range uses a dash, which Fathom's words don't.
export function formatDayRange(first: string, last: string): string {
  if (first.slice(0, 4) !== last.slice(0, 4)) {
    return `${formatDay(first)} to ${formatDay(last)}`;
  }
  return `${dayInYear.format(parseDay(first))} to ${formatDay(last)}`;
}

const momentDay = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

// The day of a moment, such as when something was saved, as people read it where they are, with its
// year.
export function formatMomentDay(moment: string): string {
  return momentDay.format(new Date(moment));
}

const month = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// A month, such as 2027-03, as people read it, such as Mar 2027.
export function formatMonth(value: string): string {
  return month.format(parseDay(`${value}-01`));
}

interface Expected {
  expected: string;
  undated?: true | undefined;
}

// When a planned hire is expected: its month, or no target date when that month comes from none,
// since it would move with the day shown.
export const expectedWords = ({ expected, undated }: Expected): string =>
  undated === true ? "no target date" : `expected ${formatMonth(expected)}`;

// What marks a planned hire, with when it is expected.
export const plannedWords = (planned: Expected): string =>
  `Planned, ${expectedWords(planned)}`;
