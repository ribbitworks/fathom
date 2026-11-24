// SPDX-License-Identifier: Apache-2.0

// Days, such as 2026-10-31, and months, such as 2026-10, as Fathom keeps and shows them everywhere:
// whether text is a day that exists, and a day typed as digits alone, such as 20261031, put in that
// form without moving or dropping a digit typed.

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

// What a day or month box holds, with the cursor where the last key left it: null, as a browser
// gives for a box without one, is taken as the end.
export type Typing = { text: string; cursor: number | null };

const notDigitOrDash = /[^\d-]/g;

const digitCount = (text: string): number => text.replace(/\D/g, "").length;

// Whether laying text out as a form lays it would drop a digit typed, as it drops those past the
// form's last part, so that the text would be saved as a day or month other than the one shown.
export const layOutDropsDigits = (
  layOut: (text: string) => string,
  text: string,
): boolean => digitCount(layOut(text)) !== digitCount(text);

// The last digit before the cursor, with any dashes after it.
const lastDigit = /\d-*$/;

// What a day or month box shows after a key: only digits and dashes, laid out as the given form lays
// them while typing goes on at the end. A key in the middle, such as deleting a digit to correct it,
// leaves the rest where it was, with the cursor in the gap, so laying them out again doesn't move
// them along. There, digits past what the form holds are taken back out, just before the cursor, as
// those just typed, so the box never holds more than one day or month.
export const typedInPlace =
  (layOut: (text: string) => string) =>
  ({ text, cursor }: Typing): Typing => {
    const kept = text.replace(notDigitOrDash, "");
    const keptCursor = text
      .slice(0, cursor ?? text.length)
      .replace(notDigitOrDash, "").length;
    if (keptCursor < kept.length) {
      let before = kept.slice(0, keptCursor);
      const extra = digitCount(kept) - digitCount(layOut(kept));
      for (let taken = 0; taken < extra; taken += 1)
        before = before.replace(lastDigit, "");
      return { text: before + kept.slice(keptCursor), cursor: before.length };
    }
    const typed = layOut(kept);
    return { text: typed, cursor: typed.length };
  };

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
