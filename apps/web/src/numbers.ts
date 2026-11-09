// SPDX-License-Identifier: Apache-2.0

// Counts and other numbers as each person's language settings write them, such as 1,500 or 1 500.

import { numberDigits } from "@fathom/shared";

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
