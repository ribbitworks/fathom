// SPDX-License-Identifier: Apache-2.0

// A Duration column's cells: each holds a length as typed, such as 2 wk, shown as typed or in the
// one unit the column's Show in chooses, and compared and added up by the lengths' sizes.

import {
  type Duration,
  durationIn,
  type DurationUnit,
  parseDuration,
  unitDays,
} from "@fathom/shared";
import { decimalTo } from "./numbers.ts";
import { asText, type CellValue, type TableColumn } from "./table-view.ts";

type LengthColumn = Pick<TableColumn<never>, "lengths">;

// An amount of a unit, with a true minus sign for one counting back, such as −1.4 wk.
const amountText = (amount: number, unit: DurationUnit, places: number) =>
  `${amount < 0 ? "−" : ""}${decimalTo(Math.abs(amount), places)} ${unit}`;

// Each unit's name, as a Duration column's Unit and Show in offer them, in their order, and its
// words for an amount of many and of one, such as 3 weeks or 1 week.
export const durationUnitsShown: readonly {
  unit: DurationUnit;
  label: string;
  name: string;
  one: string;
}[] = [
  {
    unit: "d",
    label: "Calendar days",
    name: "calendar days",
    one: "calendar day",
  },
  {
    unit: "wd",
    label: "Working days",
    name: "working days",
    one: "working day",
  },
  { unit: "wk", label: "Weeks", name: "weeks", one: "week" },
  { unit: "mo", label: "Months", name: "months", one: "month" },
];

// A unit's name in words, for amounts of it, such as weeks.
export function unitName(unit: DurationUnit): string {
  switch (unit) {
    case "d":
      return "calendar days";
    case "wd":
      return "working days";
    case "wk":
      return "weeks";
    case "mo":
      return "months";
  }
}

export const unitsOffered = durationUnitsShown.map(({ unit, label }) => ({
  value: unit,
  label,
}));

// The length a cell holds, which is always typed with its unit, or none for an empty cell.
export const lengthOf = (value: CellValue): Duration | undefined => {
  const read = parseDuration(asText(value), "d");
  return "duration" in read ? read.duration : undefined;
};

// A length's size in calendar days, by which lengths in different units sort.
export const lengthDays = (value: CellValue): number => {
  const length = lengthOf(value);
  return length === undefined ? 0 : length.amount * unitDays(length.unit);
};

// The unit a column's lengths are compared and added up in: the one shown, or else its own.
export const lengthUnit = (column: LengthColumn): DurationUnit =>
  column.lengths?.shown ?? column.lengths?.own ?? "d";

// A cell's length as an amount of the column's unit.
export const lengthIn = (column: LengthColumn, value: CellValue): number => {
  const length = lengthOf(value);
  return length === undefined ? 0 : durationIn(length, lengthUnit(column));
};

// A cell's length as the column shows it: as typed, or in the unit chosen to the places chosen.
export const shownLength = (
  column: LengthColumn,
  value: CellValue,
  places: number,
): string => {
  const shown = column.lengths?.shown;
  const length = lengthOf(value);
  if (shown === undefined || length === undefined) return asText(value);
  return amountText(durationIn(length, shown), shown, places);
};

// What floating point leaves of a whole amount, far below any part of a unit typed.
const wholeWithin = 1e-9;

// The units a bound is named in when not a whole amount of the unit shown, largest first.
const boundUnits: readonly DurationUnit[] = ["mo", "wk", "wd", "d"];

// A filter's bound, kept in calendar days, as it was typed: in the unit shown, where it is a whole
// amount of it, as a bare number always is, or else in the unit it is a whole amount of, such as
// 3 mo for 91.3125 days, so the bound is never hidden by rounding; a whole amount of none, as only
// an address might hold, is shown in the unit shown to the column's decimal places.
export const shownBound = (
  column: LengthColumn & Pick<TableColumn<never>, "places">,
  days: number,
): string => {
  const unit = lengthUnit(column);
  const amountIn = (one: DurationUnit) => days / unitDays(one);
  const whole = [unit, ...boundUnits].find(
    (one) => Math.abs(amountIn(one) - Math.round(amountIn(one))) < wholeWithin,
  );
  return whole === undefined
    ? amountText(amountIn(unit), unit, column.places ?? 0)
    : amountText(Math.round(amountIn(whole)), whole, 0);
};
