// SPDX-License-Identifier: Apache-2.0

// Days, moments and months as people read them, in their own language, each with its year.

const day = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// A date as people read it, with its year.
export function formatDay(value: string): string {
  return day.format(new Date(`${value}T00:00:00Z`));
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
  return month.format(new Date(`${value}-01T00:00:00Z`));
}

// What marks a planned hire: the month it is expected, or no date when that month comes from none,
// since it would move with the day shown.
export const plannedWords = ({
  expected,
  undated,
}: {
  expected: string;
  undated?: true | undefined;
}): string =>
  undated === true
    ? "Planned, no date"
    : `Planned, expected ${formatMonth(expected)}`;
