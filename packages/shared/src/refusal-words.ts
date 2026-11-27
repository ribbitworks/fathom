// SPDX-License-Identifier: Apache-2.0

// The words of a refusal of a value of the wrong kind in a record's column, wherever the column is
// edited: under a table's row, in a details panel or in a New form, as UI Conventions sets out.

export const daySample = "2026-10-31";
export const monthSample = "2027-03";
export const numberSample = "1234.5";

// Such as Type a date for Start, such as 2026-10-31.
export const typeFor = (noun: string, label: string, sample: string) =>
  `Type a ${noun} for ${label}, such as ${sample}`;
