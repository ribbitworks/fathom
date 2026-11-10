// SPDX-License-Identifier: Apache-2.0

// Counts and other numbers as each person's language settings write them, such as 1,500 or 1 500.

import { numberDigits, roundedUpTo } from "@fathom/shared";

const counts = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function count(value: number): string {
  return counts.format(value);
}

const decimals = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: numberDigits.afterPoint,
});

export function decimal(value: number): string {
  return decimals.format(value);
}

// A number rounded up to a number of decimal places, written as the reader's language writes it.
export function decimalUpTo(value: number, places: number): string {
  return decimalsTo(places).format(roundedUpTo(value, places));
}

// A formatter for each number of decimal places, made once, since a table formats many numbers.
const formatters = new Map<number, Intl.NumberFormat>();
function decimalsTo(places: number): Intl.NumberFormat {
  const kept = formatters.get(places);
  if (kept !== undefined) return kept;
  const made = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: places,
  });
  formatters.set(places, made);
  return made;
}
