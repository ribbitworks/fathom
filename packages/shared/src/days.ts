// SPDX-License-Identifier: Apache-2.0

// Days, such as 2026-10-31, as Fathom keeps and shows them everywhere: whether text is one that
// exists, and a day typed as digits alone, such as 20261031, put in that form.

import { z } from "zod";

export const daySchema = z.iso.date();

// Whether text is a whole day, such as 2026-10-31, that exists.
export const isDay = (text: string): boolean =>
  daySchema.safeParse(text).success;

// Text typed as a day, with digits alone, or digits and dashes, laid out as the digits fill a day:
// 2026, 2026-10 and 2026-10-31 as they are typed. Anything else is left as typed.
export function typedDay(text: string): string {
  const trimmed = text.trim();
  if (!/^[\d-]*$/.test(trimmed)) return trimmed;
  const digits = trimmed.replaceAll("-", "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6)]
    .filter((part) => part !== "")
    .join("-");
}
