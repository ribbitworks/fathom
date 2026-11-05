// SPDX-License-Identifier: Apache-2.0

// Where release streams' cycles and releases fall on the Releases page's timeline, by days from
// its first day, and how its axis is cut and named at each scale.

import { addDays, addMonths, type ReleaseStream } from "@fathom/shared";
import {
  daysBetween,
  lastCycleEnd,
  releaseCycles,
  releaseDate,
} from "./releases.ts";

interface Span {
  // Days from the timeline's first day to the span's first, and how many days it covers.
  at: number;
  days: number;
}

export interface TimelineLayout {
  // The timeline's first day, the first of a month, and how many days it covers.
  from: string;
  days: number;
  rows: {
    stream: ReleaseStream;
    cycles: (Span & ReleaseStream["cycles"][number])[];
    releases: (Span & {
      release: ReleaseStream["releases"][number];
      cycleWords: string;
      shipsOn: string;
      // Days from the timeline's first day to the end of the day the release ships.
      shipsAt: number;
    })[];
  }[];
  // Days from the timeline's first day to the start of today, when today is on the timeline.
  today: number | undefined;
}

const monthStart = (day: string) => `${day.slice(0, 7)}-01`;

// Where everything falls on a timeline of whole months, from the month the first cycle starts in
// to the month the last ends in, or undefined when no stream has cycles. Retired streams, and
// releases drafted to be removed, are left out.
export function timelineLayout(
  streams: readonly ReleaseStream[],
  today: string,
): TimelineLayout | undefined {
  const shown = streams.filter(
    ({ retired, cycles }) => !retired && cycles.length > 0,
  );
  if (shown.length === 0) return undefined;
  const cycles = shown.flatMap((stream) => stream.cycles);
  const from = monthStart(
    cycles.map(({ startsOn }) => startsOn).reduce((a, b) => (a < b ? a : b)),
  );
  const to = addMonths(
    monthStart(
      cycles.map(({ endsOn }) => endsOn).reduce((a, b) => (a > b ? a : b)),
    ),
    1,
  );
  const at = (day: string) => daysBetween(from, day);
  const days = at(to);
  const rows = shown.map((stream) => ({
    stream,
    cycles: stream.cycles.map((cycle) => ({
      ...cycle,
      at: at(cycle.startsOn),
      days: daysBetween(cycle.startsOn, addDays(cycle.endsOn, 1)),
    })),
    releases: stream.releases.flatMap((release) => {
      const end = lastCycleEnd(stream, release.lastCycle);
      const shipsOn = releaseDate(stream, release);
      if (
        release.draft?.action === "deleted" ||
        end === undefined ||
        shipsOn === undefined
      ) {
        return [];
      }
      return [
        {
          release,
          cycleWords: releaseCycles(stream, release),
          shipsOn,
          at: at(release.firstCycle),
          days: daysBetween(release.firstCycle, addDays(end, 1)),
          shipsAt: at(addDays(shipsOn, 1)),
        },
      ];
    }),
  }));
  const todayAt = at(today);
  return {
    from,
    days,
    rows,
    today: todayAt >= 0 && todayAt < days ? todayAt : undefined,
  };
}

// How finely the axis is cut, named by its ticks, each under the next larger period: half years
// under years, quarters under half years, months under quarters, then weeks and days under months.
export type AxisScale = "halves" | "quarters" | "months" | "weeks" | "days";

// About how wide a label is at the extra-small size: a width for each character, and the padding
// beside it, less on the axis than in a cycle or a release.
const characterWidth = 7;
export const labelPadding = { axis: 8, block: 12 } as const;

export const labelWidth = (label: string, padding: number): number =>
  label.length * characterWidth + padding;

// Each scale finer than half years, with its widest tick name and its shortest tick in days.
const scaleNeeds: readonly [AxisScale, string, number][] = [
  ["days", "Wed 30", 1],
  ["weeks", "30", 7],
  ["months", "Sep", 28],
  ["quarters", "Q1 27", 90],
];

// The finest scale whose ticks' names all fit the pixels a day takes.
export const axisScale = (dayWidth: number): AxisScale =>
  scaleNeeds.find(
    ([, label, days]) =>
      dayWidth * days >= labelWidth(label, labelPadding.axis),
  )?.[0] ?? "halves";

interface Tick extends Span {
  day: string;
  label: string;
  // A shorter label, for when the label does not fit.
  short?: string;
}

const monthName = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});

const weekdayName = new Intl.DateTimeFormat("en", {
  weekday: "short",
  timeZone: "UTC",
});

const dateOf = (day: string) => new Date(`${day}T00:00:00Z`);
const monthWords = (day: string) => monthName.format(dateOf(day));
const dayNumber = (day: string) => String(Number(day.slice(8)));
const monthNumber = (day: string) => Number(day.slice(5, 7));

const nextDay = (day: string) => addDays(day, 1);

const nextMonday = (day: string) =>
  addDays(day, (8 - dateOf(day).getUTCDay()) % 7 || 7);

// The first month of the period of some months, counted from January, that a day falls in.
const periodStart = (months: number, day: string) =>
  `${day.slice(0, 4)}-${String(
    Math.floor((monthNumber(day) - 1) / months) * months + 1,
  ).padStart(2, "0")}-01`;

const nextPeriod = (months: number) => (day: string) =>
  addMonths(periodStart(months, day), months);

// A period of some months in words, such as "Jan to Jun 2027", or "Jan to Jun 27" under its year.
const periodWords =
  (months: number, shortYear = false) =>
  (day: string) => {
    const start = periodStart(months, day);
    const year = shortYear ? day.slice(2, 4) : day.slice(0, 4);
    return `${monthWords(start)} to ${monthWords(addMonths(start, months - 1))} ${year}`;
  };

// The timeline cut into periods, each ending where the next begins, labelled by the day it starts.
function ticks(
  { from, days }: TimelineLayout,
  next: (day: string) => string,
  label: (day: string) => string,
): Tick[] {
  const to = addDays(from, days);
  const cut: Tick[] = [];
  for (let day = from; day < to; day = next(day)) {
    const end = next(day) < to ? next(day) : to;
    cut.push({
      day,
      label: label(day),
      at: daysBetween(from, day),
      days: daysBetween(day, end),
    });
  }
  return cut;
}

// The timeline's axis at a scale: the periods the view is cut into, under the larger periods they
// fall in, such as the quarters Q1 27 and Q2 27 under "Jan to Jun 2027". A period cut short by
// the timeline's start is still named, except a week, named by its Monday.
export function timelineAxis(
  layout: TimelineLayout,
  scale: AxisScale,
): { above: Tick[]; ticks: Tick[] } {
  const cut = (next: (day: string) => string, label: (day: string) => string) =>
    ticks(layout, next, label);
  const months = (withYear: boolean) =>
    cut(
      (day) => addMonths(day, 1),
      (day) =>
        withYear ? `${monthWords(day)} ${day.slice(0, 4)}` : monthWords(day),
    );
  const quarterOf = (day: string) =>
    `Q${String(Math.ceil(monthNumber(day) / 3))}`;
  const quarters = (shortYear: boolean) =>
    cut(nextPeriod(3), (day) => {
      const year = shortYear ? day.slice(2, 4) : day.slice(0, 4);
      return `${quarterOf(day)} ${year}`;
    }).map((tick) => ({ ...tick, short: quarterOf(tick.day) }));
  if (scale === "halves") {
    // Half years named with the year's last two digits, or by their first months when that is
    // too long.
    return {
      above: cut(nextPeriod(12), (day) => day.slice(0, 4)),
      ticks: cut(nextPeriod(6), periodWords(6, true)).map((tick) => ({
        ...tick,
        short: monthWords(periodStart(6, tick.day)),
      })),
    };
  }
  if (scale === "quarters") {
    // Half years in full, or by their first months and years, such as Jan 2027, when too long.
    const halves = cut(nextPeriod(6), periodWords(6)).map((tick) => ({
      ...tick,
      short: `${monthWords(periodStart(6, tick.day))} ${tick.day.slice(0, 4)}`,
    }));
    return { above: halves, ticks: quarters(true) };
  }
  if (scale === "months")
    return { above: quarters(false), ticks: months(false) };
  if (scale === "weeks") {
    return {
      above: months(true),
      ticks: cut(nextMonday, (day) =>
        dateOf(day).getUTCDay() === 1
          ? `${monthWords(day)} ${dayNumber(day)}`
          : "",
      ).map((tick) => ({ ...tick, short: dayNumber(tick.day) })),
    };
  }
  return {
    above: months(true),
    ticks: cut(
      nextDay,
      (day) => `${weekdayName.format(dateOf(day))} ${dayNumber(day)}`,
    ),
  };
}
