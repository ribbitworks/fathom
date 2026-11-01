// SPDX-License-Identifier: Apache-2.0

// Counts as each person's language settings write them, such as 1,500 or 1 500.

const counts = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function count(value: number): string {
  return counts.format(value);
}
