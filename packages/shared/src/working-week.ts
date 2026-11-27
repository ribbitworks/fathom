// SPDX-License-Identifier: Apache-2.0

// The working week the planning settings name, its days' names, and the rules that count working
// days and cut time into weeks.

import { z } from "zod";
import { addDays, daysBetween, daysInWeek, parseDay } from "./cycles.ts";

// Days of the week as the settings keep them, Monday first, whatever day a week starts on.
export const weekdays = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
} as const;

export type Weekday = (typeof weekdays)[keyof typeof weekdays];

const everyWeekday = Object.values(weekdays);

export const weekdayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const satisfies Record<Weekday, string>;

export const weekdayShortNames = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const satisfies Record<Weekday, string>;

export const workingWeekNames = {
  workingDays: "Working days",
  weekStartsOn: "Week starts on",
} as const;

export const workingDayNeeded = "Working day needed";

const weekdayIn = (name: string) =>
  z.literal(everyWeekday, { error: `Choose a day of the week for ${name}` });

export const weekdaySchema = z.literal(everyWeekday);

export const weekStartsOnSchema = weekdayIn(workingWeekNames.weekStartsOn);

export const workingDaysSchema = z
  .array(weekdayIn(workingWeekNames.workingDays))
  .min(1, { error: workingDayNeeded })
  .refine((days) => new Set(days).size === days.length, {
    error: `${workingWeekNames.workingDays}: name each day once`,
  });

export const startingWorkingWeek = {
  workingDays: [
    weekdays.monday,
    weekdays.tuesday,
    weekdays.wednesday,
    weekdays.thursday,
    weekdays.friday,
  ],
  weekStartsOn: weekdays.monday,
} as const satisfies { workingDays: Weekday[]; weekStartsOn: Weekday };

// The days of a week starting on the day given, in order.
export const weekOrder = (startsOn: Weekday): Weekday[] =>
  Array.from(
    { length: daysInWeek },
    (_none, index) => ((startsOn + index) % daysInWeek) as Weekday,
  );

// A run of this many working days in a row is named by its first and last.
const shortestNamedRun = 3;

// The working days in words, in the week's order, such as Mon to Fri, or Mon to Wed, Fri.
export function workingDaysWords(
  workingDays: readonly Weekday[],
  startsOn: Weekday,
): string {
  const runs: Weekday[][] = [];
  let run: Weekday[] = [];
  for (const day of weekOrder(startsOn)) {
    if (workingDays.includes(day)) {
      run.push(day);
    } else {
      runs.push(run);
      run = [];
    }
  }
  runs.push(run);
  return runs
    .filter((days) => days.length > 0)
    .map((days) => {
      // Each day is one of the week's seven.
      // eslint-disable-next-line security/detect-object-injection
      const names = days.map((day) => weekdayShortNames[day]);
      return names.length < shortestNamedRun
        ? names.join(", ")
        : [names.at(0), names.at(-1)].join(" to ");
    })
    .join(", ");
}

// JavaScript counts the days of the week from Sunday.
// The settings' day for each of the calendar's, Sunday first.
const byCalendarDay = [
  weekdays.sunday,
  weekdays.monday,
  weekdays.tuesday,
  weekdays.wednesday,
  weekdays.thursday,
  weekdays.friday,
  weekdays.saturday,
] as const;

// The calendar's day is always one of its seven.
export const weekdayOf = (day: string): Weekday =>
  byCalendarDay[parseDay(day).getUTCDay()] as Weekday;

export const isWorkingDay = (
  day: string,
  workingDays: readonly Weekday[],
): boolean => workingDays.includes(weekdayOf(day));

// The working days from the first day to the last, both counted. Whole weeks each hold every
// working day once, so only the days left over are looked at one by one.
export function workingDaysBetween(
  first: string,
  last: string,
  workingDays: readonly Weekday[],
): number {
  const days = daysBetween(first, last) + 1;
  if (days <= 0) return 0;
  const weeks = Math.floor(days / daysInWeek);
  const leftOver = Array.from({ length: days % daysInWeek }, (_none, index) =>
    addDays(first, weeks * daysInWeek + index),
  );
  return (
    weeks * workingDays.length +
    leftOver.filter((day) => isWorkingDay(day, workingDays)).length
  );
}

export const weekStartOf = (day: string, startsOn: Weekday): string =>
  addDays(day, -((weekdayOf(day) - startsOn + daysInWeek) % daysInWeek));

// A part of a week within a span of days: the day it starts on, the day its week starts on, earlier
// for a week cut short by the span's start, and how many of its days the span holds.
export interface WeekPiece {
  from: string;
  weekStart: string;
  days: number;
}

// The days from one day up to another, not counting the other, cut wherever a week starts, such as
// the weeks of a month on a timeline.
export function weeksWithin(
  from: string,
  until: string,
  startsOn: Weekday,
): WeekPiece[] {
  const pieces: WeekPiece[] = [];
  for (let day = from; day < until;) {
    const weekStart = weekStartOf(day, startsOn);
    const nextWeek = addDays(weekStart, daysInWeek);
    const end = nextWeek < until ? nextWeek : until;
    pieces.push({ from: day, weekStart, days: daysBetween(day, end) });
    day = end;
  }
  return pieces;
}
