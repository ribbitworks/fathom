// SPDX-License-Identifier: Apache-2.0

// Days, such as 2026-10-31, and months, such as 2026-10, as Fathom keeps and shows them everywhere:
// whether text is a day that exists, and a day typed as digits alone, such as 20261031, put in that
// form.

import { z } from "zod";

export const daySchema = z.iso.date();

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

// Whether text is a whole month, such as 2026-10, that exists.
export const isMonth = (text: string): boolean =>
  monthSchema.safeParse(text).success;

// Whether text is a whole day, such as 2026-10-31, that exists.
export const isDay = (text: string): boolean =>
  daySchema.safeParse(text).success;

export const isFirstOfMonth = (day: string): boolean => day.endsWith("-01");

// Asks for something as of a day; without one, as it is today.
export const dayQuerySchema = z.object({ on: daySchema.optional() });

const monthLength = "YYYY-MM".length;

// The month a day is in, such as 2026-10 for 2026-10-31.
export const monthOf = (day: string): string => day.slice(0, monthLength);

const monthsInYear = 12;

// A month, or the month of a day, as a count of months, so two can be compared or subtracted.
export const monthNumber = (monthOrDay: string): number =>
  Number(monthOrDay.slice(0, "YYYY".length)) * monthsInYear +
  Number(monthOrDay.slice("YYYY-".length, monthLength));

// The day a month is read as of: its first, or today during the current month.
export const dayReadingMonth = (month: string, today: string): string =>
  month === monthOf(today) ? today : `${month}-01`;

// Text with digits alone, or digits and dashes, laid out in parts of the lengths given as the digits
// fill them. Anything else is left as typed.
function laidOut(text: string, lengths: readonly number[]): string {
  const trimmed = text.trim();
  if (!/^[\d-]*$/.test(trimmed)) return trimmed;
  let digits = trimmed.replaceAll("-", "");
  return lengths
    .map((length) => {
      const part = digits.slice(0, length);
      digits = digits.slice(length);
      return part;
    })
    .filter((part) => part !== "")
    .join("-");
}

// A day as it is typed: 2026, 2026-10 and 2026-10-31.
export const typedDay = (text: string): string => laidOut(text, [4, 2, 2]);

// A month as it is typed: 2026 and 2026-10.
export const typedMonth = (text: string): string => laidOut(text, [4, 2]);

// The day a new reporting line starts unless another is given: today, or the person's start date if
// that is later.
export const defaultLineFrom = (
  startDate: string | null | undefined,
  today: string,
): string =>
  typeof startDate === "string" && startDate > today ? startDate : today;

// Whether a change, such as to a feature team, may take effect from a day: a day before today needs
// the right to change Personal details.
export const mayDateChange = (
  changesDates: boolean,
  day: string,
  today: string,
): boolean => changesDates || day >= today;

// Whether reporting lines may be changed from a day other than today: only an earlier one, as any
// change may be, since later days wait for planned reporting changes.
export const mayDateLineChange = (
  changesDates: boolean,
  day: string,
  today: string,
): boolean => day < today && mayDateChange(changesDates, day, today);

// Whether someone's reporting line can change from a day: a change takes the place of their current
// line, never one before it, so the day is on or after the current line's and their own start.
export const lineChangesFrom = (
  person: {
    startDate?: string | null | undefined;
    managerFrom?: string | null | undefined;
  },
  day: string,
): boolean =>
  (person.managerFrom ?? day) <= day && (person.startDate ?? day) <= day;
