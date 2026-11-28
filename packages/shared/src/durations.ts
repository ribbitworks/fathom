// SPDX-License-Identifier: Apache-2.0

// A Duration column's lengths, such as 2 wk: a whole amount in one unit, what one reads as typed,
// a day moved by one, and the length between two days. The start day counts as the first, so a
// length from a day to the day it was moved to gives back the amount moved by.

import { z } from "zod";
import { addDays, daysBetween, daysInWeek } from "./cycles.ts";
import {
  isWorkingDay,
  type Weekday,
  workingDaysBetween,
} from "./working-week.ts";

export const durationUnits = ["d", "wd", "wk", "mo"] as const;

export const durationUnitSchema = z.enum(durationUnits);

export type DurationUnit = z.infer<typeof durationUnitSchema>;

// The longest length typed, in any unit, well past any plan, and within what the database keeps.
export const durationLimit = 9999;

export const durationSchema = z.object({
  amount: z.number().int().min(-durationLimit).max(durationLimit),
  unit: durationUnitSchema,
});

export type Duration = z.infer<typeof durationSchema>;

const daysInYear = 365.25;
const monthsInYear = 12;

// Each unit's size in calendar days, for showing one unit in another, comparing and adding up; a
// working day's is the week's days shared among its working days, so 7/5 for Mon to Fri.
export function unitDays(
  unit: DurationUnit,
  workingDays: readonly Weekday[],
): number {
  switch (unit) {
    case "d":
      return 1;
    case "wd":
      return daysInWeek / workingDays.length;
    case "wk":
      return daysInWeek;
    case "mo":
      return daysInYear / monthsInYear;
  }
}

export const durationIn = (
  { amount, unit }: Duration,
  shown: DurationUnit,
  workingDays: readonly Weekday[],
): number =>
  unit === shown
    ? amount
    : (amount * unitDays(unit, workingDays)) / unitDays(shown, workingDays);

// A length as typed, by its unit's code, with a minus sign where it counts back, such as −1 wk.
export const durationText = ({ amount, unit }: Duration): string =>
  `${amount < 0 ? "−" : ""}${String(Math.abs(amount))} ${unit}`;

const lastDayOfMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const dayFrom = (year: number, monthIndex: number, day: number): string =>
  new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);

// The day months away whose day of the month is the start's, or the month's last where that day
// doesn't exist; counting the start as the first, the span ends the day before it, or on it when cut
// short to the month's end, and back from the start, the day after it.
function plusMonths(start: string, months: number): string {
  const [year = 0, month = 1, day = 1] = start.split("-").map(Number);
  const target = month - 1 + months;
  const targetYear = year + Math.floor(target / monthsInYear);
  const targetMonth = ((target % monthsInYear) + monthsInYear) % monthsInYear;
  const last = lastDayOfMonth(targetYear, targetMonth);
  const reached = dayFrom(targetYear, targetMonth, Math.min(day, last));
  if (months < 0) return addDays(reached, 1);
  return day > last ? reached : addDays(reached, -1);
}

// The start begins on a working day, the next one, or the one before counting back; each working day
// after it counts until the amount is reached.
function plusWorkingDays(
  start: string,
  amount: number,
  workingDays: readonly Weekday[],
): string {
  const step = Math.sign(amount);
  let day = start;
  while (!isWorkingDay(day, workingDays)) day = addDays(day, step);
  for (let counted = 1; counted < Math.abs(amount);) {
    day = addDays(day, step);
    if (isWorkingDay(day, workingDays)) counted += 1;
  }
  return day;
}

// The last day of the span of the length given from the start, the start counting as its first.
export function plusDuration(
  start: string,
  { amount, unit }: Duration,
  workingDays: readonly Weekday[],
): string {
  if (amount === 0) return start;
  switch (unit) {
    case "d":
    case "wk": {
      const days = unit === "wk" ? amount * daysInWeek : amount;
      return addDays(start, days - Math.sign(amount));
    }
    case "wd":
      return plusWorkingDays(start, amount, workingDays);
    case "mo":
      return plusMonths(start, amount);
  }
}

// The length from the start to the end, both counted, in the unit given; an end before the start is
// reversed, which the cell says rather than showing a length.
export function spanBetween(
  start: string,
  end: string,
  unit: DurationUnit,
  workingDays: readonly Weekday[],
): number | "reversed" {
  if (end < start) return "reversed";
  if (unit === "wd") return workingDaysBetween(start, end, workingDays);
  return (daysBetween(start, end) + 1) / unitDays(unit, workingDays);
}

// What a typed unit is called, by its code, its short names and its whole names.
const unitWords = new Map<string, DurationUnit>([
  ["d", "d"],
  ["day", "d"],
  ["days", "d"],
  ["calendar day", "d"],
  ["calendar days", "d"],
  ["wd", "wd"],
  ["working day", "wd"],
  ["working days", "wd"],
  ["w", "wk"],
  ["wk", "wk"],
  ["week", "wk"],
  ["weeks", "wk"],
  ["m", "mo"],
  ["mo", "mo"],
  ["month", "mo"],
  ["months", "mo"],
]);

// Why a typed length is refused: a date, two units, part of a unit, or a unit not known.
export type DurationRefusal = "amount" | "oneUnit" | "whole" | "unit";

// A day typed in any form: digits joined by a dash or a slash, or a month's name and then a day.
const looksLikeDay = [/\d[-/]\d/u, /^[a-z]{3,9}\.? \d/u];

// A sign, a number, whole or not, and words naming a unit, if any.
const typedLength = /^([−-]?)\s*([\d.,]+)\s*([a-z ]*)$/u;

// What a Duration cell holds once typed, or why it's refused. A bare number takes the column's
// unit, and a minus sign counts back.
export function parseDuration(
  text: string,
  columnUnit: DurationUnit,
): { empty: true } | { duration: Duration } | { refused: DurationRefusal } {
  const typed = text.trim().toLowerCase();
  if (typed === "") return { empty: true };
  if (looksLikeDay.some((form) => form.test(typed))) {
    return { refused: "amount" };
  }
  const parts = typedLength.exec(typed);
  if (parts === null) {
    return { refused: /\d.*\D\d/u.test(typed) ? "oneUnit" : "unit" };
  }
  const [, minus = "", number = "", words = ""] = parts;
  if (/[.,]/u.test(number)) return { refused: "whole" };
  const named = words.trim();
  const unit = named === "" ? columnUnit : unitWords.get(named);
  if (unit === undefined) return { refused: "unit" };
  return {
    duration: { amount: (minus === "" ? 1 : -1) * Number(number), unit },
  };
}
