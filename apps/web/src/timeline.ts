// SPDX-License-Identifier: Apache-2.0

// Where things fall on a timeline, by days from its first day: the whole months it covers, today,
// release streams' cycles and releases, how its axis is cut and named at each scale, and its
// quarters.

import {
  addDays,
  addMonths,
  monthOf,
  type ReleaseStream,
} from "@fathom/shared";
import type { ReactNode } from "react";
import { retiredLive } from "./lists.ts";
import {
  daysBetween,
  lastCycleEnd,
  placingFields,
  releaseCycles,
  releaseDate,
} from "./releases.ts";

interface Span {
  // Days from the timeline's first day to the span's first, and how many days it covers.
  at: number;
  days: number;
}

// The first and last days a timeline must show.
export interface DayRange {
  first: string;
  last: string;
}

// The range from the first day to the last, or undefined without both.
export const dayRange = (
  first: string | undefined,
  last: string | undefined,
): DayRange | undefined =>
  first === undefined || last === undefined ? undefined : { first, last };

export interface TimelineFrame {
  // The timeline's first day, the first of a month, and how many days it covers.
  from: string;
  days: number;
  // Days from the timeline's first day to the start of today, when today is on the timeline.
  today: number | undefined;
}

const monthStart = (day: string) => `${monthOf(day)}-01`;

const earliest = (days: readonly string[]) =>
  days.reduce((a, b) => (a < b ? a : b));
const latest = (days: readonly string[]) =>
  days.reduce((a, b) => (a > b ? a : b));

// The whole months that hold every range given, from the month the first starts in to the month the
// last ends in, or undefined when none is given.
export function timelineFrame(
  ranges: readonly DayRange[],
  today: string,
): TimelineFrame | undefined {
  if (ranges.length === 0) return undefined;
  const from = monthStart(earliest(ranges.map(({ first }) => first)));
  const to = addMonths(monthStart(latest(ranges.map(({ last }) => last))), 1);
  const days = daysBetween(from, to);
  const todayAt = daysBetween(from, today);
  return {
    from,
    days,
    today: todayAt >= 0 && todayAt < days ? todayAt : undefined,
  };
}

export type ReleaseSpan = Span & {
  release: ReleaseStream["releases"][number];
  cycleWords: string;
  shipsOn: string;
  // Days from the timeline's first day to the end of the day the release ships.
  shipsAt: number;
};

export interface ReleaseLayerRow {
  stream: ReleaseStream;
  cycles: (Span & ReleaseStream["cycles"][number])[];
  releases: ReleaseSpan[];
  // Beside live, each release a draft moves as it is live, in its old place.
  live: ReleaseSpan[];
}

// The streams a timeline's release layer shows: those with cycles that are not retired as they are
// live, since a stream drafted to be retired or restored stays where it is until approved.
const layerStreams = (streams: readonly ReleaseStream[]) =>
  streams.filter((stream) => !retiredLive(stream) && stream.cycles.length > 0);

// From the first day of the release layer's first cycle to the last of its last, or undefined
// when it shows no stream.
export function releaseLayerRange(
  streams: readonly ReleaseStream[],
): DayRange | undefined {
  const cycles = layerStreams(streams).flatMap((stream) => stream.cycles);
  if (cycles.length === 0) return undefined;
  return {
    first: earliest(cycles.map(({ startsOn }) => startsOn)),
    last: latest(cycles.map(({ endsOn }) => endsOn)),
  };
}

// Where a release falls on a timeline starting on the day given, or undefined when its cycles are
// not among the stream's.
function releaseSpan(
  stream: ReleaseStream,
  release: ReleaseStream["releases"][number],
  from: string,
): ReleaseSpan | undefined {
  const end = lastCycleEnd(stream, release.lastCycle);
  const shipsOn = releaseDate(stream, release);
  if (end === undefined || shipsOn === undefined) return undefined;
  return {
    release,
    cycleWords: releaseCycles(stream, release),
    shipsOn,
    at: daysBetween(from, release.firstCycle),
    days: daysBetween(release.firstCycle, addDays(end, 1)),
    shipsAt: daysBetween(from, addDays(shipsOn, 1)),
  };
}

const spansOf = (
  stream: ReleaseStream,
  releases: readonly ReleaseStream["releases"][number][],
  from: string,
) => releases.flatMap((release) => releaseSpan(stream, release, from) ?? []);

// Where each stream's cycles and releases fall on a timeline starting on the day given, as the
// Draft view shows them, with, beside live, the streams as they are live, whose releases a draft
// moves are drawn in their old places too. Streams retired as they are live are left out.
export function releaseLayer(
  streams: readonly ReleaseStream[],
  from: string,
  live?: readonly ReleaseStream[],
): ReleaseLayerRow[] {
  return layerStreams(streams).map((stream) => {
    const liveStream = live?.find(({ id }) => id === stream.id);
    const moved = stream.releases.filter(
      ({ draft }) =>
        draft?.action === "changed" &&
        draft.changed.some((field) => placingFields.includes(field)),
    );
    return {
      stream,
      cycles: stream.cycles.map((cycle) => ({
        ...cycle,
        at: daysBetween(from, cycle.startsOn),
        days: daysBetween(cycle.startsOn, addDays(cycle.endsOn, 1)),
      })),
      releases: spansOf(stream, stream.releases, from),
      live:
        liveStream === undefined
          ? []
          : spansOf(
              liveStream,
              liveStream.releases.filter(({ id }) =>
                moved.some((release) => release.id === id),
              ),
              from,
            ),
    };
  });
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

// About how wide some characters are, such as the room a mark takes before a name.
export const charactersWidth = (characters: number): number =>
  characters * characterWidth;

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

export interface Tick extends Span {
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
  { from, days }: TimelineFrame,
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

const quarterOf = (day: string) =>
  `Q${String(Math.ceil(monthNumber(day) / 3))}`;

// The timeline cut into quarters, such as Q1 2027, or Q1 27 with the year short, each with the
// quarter alone as its shorter label.
function quarterTicks(
  frame: TimelineFrame,
  shortYear: boolean,
): (Tick & { short: string })[] {
  return ticks(frame, nextPeriod(3), (day) => {
    const year = shortYear ? day.slice(2, 4) : day.slice(0, 4);
    return `${quarterOf(day)} ${year}`;
  }).map((tick) => ({ ...tick, short: quarterOf(tick.day) }));
}

// The quarters across the whole timeline, such as Q1 2027, the first and last cut short by its
// ends.
export const timelineQuarters = (
  frame: TimelineFrame,
): (Tick & { short: string })[] => quarterTicks(frame, false);

// The timeline's axis at a scale: the periods the view is cut into, under the larger periods they
// fall in, such as the quarters Q1 27 and Q2 27 under "Jan to Jun 2027". A period cut short by
// the timeline's start is still named, except a week, named by its Monday.
export function timelineAxis(
  frame: TimelineFrame,
  scale: AxisScale,
): { above: Tick[]; ticks: Tick[] } {
  const cut = (next: (day: string) => string, label: (day: string) => string) =>
    ticks(frame, next, label);
  const months = (withYear: boolean) =>
    cut(
      (day) => addMonths(day, 1),
      (day) =>
        withYear ? `${monthWords(day)} ${day.slice(0, 4)}` : monthWords(day),
    );
  const quarters = (shortYear: boolean) => quarterTicks(frame, shortYear);
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

// A name too long for its cycle, release or period is left out rather than cut short, as hovering
// shows it.
export const fits = (
  label: string,
  width: number,
  padding: number = labelPadding.block,
): boolean => width >= labelWidth(label, padding);

export interface Px {
  (days: number): string;
  of: (days: number) => number;
  // The pixels a day takes, unrounded.
  day: number;
}

// Rounded, since days at a fraction of a pixel each leave errors such as 62.99999999999999px.
export function pxAt(dayWidth: number): Px {
  const of = (days: number) => Math.round(days * dayWidth * 100) / 100;
  return Object.assign((days: number) => `${String(of(days))}px`, {
    of,
    day: dayWidth,
  });
}

// A row a view puts on a timeline: its label, kept in view while the tracks scroll, and its lanes,
// drawn at the pixels a day takes.
export interface TimelineRow {
  id: string;
  label: ReactNode;
  lanes: (px: Px) => ReactNode;
}
