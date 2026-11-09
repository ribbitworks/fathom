// SPDX-License-Identifier: Apache-2.0

// The months a monthly grid shows, as a reader asks for them and as they are listed.

import { z } from "zod";
import { addToMonth } from "./cycles.ts";
import { monthNumber, monthSchema } from "./days.ts";

// Five years, far more than a grid shows, so a request can't ask for unbounded work.
export const mostGridMonths = 60;

// Date arithmetic reads years before 100 as the 1900s and can't write years past 9999.
export const earliestGridMonth = "1900-01";
export const latestGridMonth = "2999-12";

export const monthsBetween = (from: string, to: string): string[] =>
  Array.from({ length: monthNumber(to) - monthNumber(from) + 1 }, (_, index) =>
    addToMonth(from, index),
  );

export const monthRangeQuerySchema = z
  .object({ from: monthSchema, to: monthSchema })
  .refine(({ from, to }) => from <= to, "The first month comes before the last")
  .refine(
    ({ from, to }) => from >= earliestGridMonth && to <= latestGridMonth,
    `A grid shows months from ${earliestGridMonth} to ${latestGridMonth}`,
  )
  .refine(
    ({ from, to }) => monthNumber(to) - monthNumber(from) < mostGridMonths,
    `A grid shows at most ${String(mostGridMonths)} months`,
  );

export type MonthRange = z.infer<typeof monthRangeQuerySchema>;
