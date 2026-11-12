// SPDX-License-Identifier: Apache-2.0

// Effort as Fathom keeps it: pure effort, at full efficiency, kept in hours and shown in the unit the
// reader picks through the conversions set for the whole of Fathom. Each unit has a step that an
// estimate is kept to and rounded up to: whole hours, half person-days, and whole person-days for
// the larger units. Conversions are limited so every step is a whole number of hundredths of an
// hour, which the database keeps exactly, so an estimate always reads back as it was entered.

import { z } from "zod";
import { numberDigits, outOfRange, roundedUpTo } from "./numbers.ts";

export const effortUnits = [
  "hours",
  "person-days",
  "person-weeks",
  "person-months",
  "person-quarters",
] as const;

export type EffortUnit = (typeof effortUnits)[number];

export const effortUnitSchema = z.enum(effortUnits);

export const defaultEffortUnit: EffortUnit = "hours";

export const monthsInQuarter = 3;

// Hours in a person-day are whole or half hours.
const hourSteps = 2;

export const effortConversionLimits = {
  hoursPerDay: { least: 0.5, most: 24 },
  daysPerWeek: { least: 1, most: 7 },
  daysPerMonth: { least: 1, most: 31 },
} as const;

export const startingEffortConversions = {
  hoursPerDay: 8,
  daysPerWeek: 5,
  daysPerMonth: 20,
} as const;

const { hoursPerDay, daysPerWeek, daysPerMonth } = effortConversionLimits;

// What each conversion is called on screen, where it is set with the other planning settings.
export const effortConversionNames = {
  hoursPerDay: "Hours a day",
  daysPerWeek: "Working days a week",
  daysPerMonth: "Working days a month",
} as const satisfies Record<keyof typeof effortConversionLimits, string>;

const wholeDays = (name: string) => `${name}: use whole days`;

export const effortConversionsSchema = z.object({
  hoursPerDay: z
    .number()
    .min(hoursPerDay.least, {
      error: outOfRange(effortConversionNames.hoursPerDay, hoursPerDay),
    })
    .max(hoursPerDay.most, {
      error: outOfRange(effortConversionNames.hoursPerDay, hoursPerDay),
    })
    .refine((value) => Number.isInteger(value * hourSteps), {
      error: `${effortConversionNames.hoursPerDay}: use whole or half hours`,
    }),
  daysPerWeek: z
    .number()
    .int({ error: wholeDays(effortConversionNames.daysPerWeek) })
    .min(daysPerWeek.least, {
      error: outOfRange(effortConversionNames.daysPerWeek, daysPerWeek),
    })
    .max(daysPerWeek.most, {
      error: outOfRange(effortConversionNames.daysPerWeek, daysPerWeek),
    }),
  daysPerMonth: z
    .number()
    .int({ error: wholeDays(effortConversionNames.daysPerMonth) })
    .min(daysPerMonth.least, {
      error: outOfRange(effortConversionNames.daysPerMonth, daysPerMonth),
    })
    .max(daysPerMonth.most, {
      error: outOfRange(effortConversionNames.daysPerMonth, daysPerMonth),
    }),
});

export type EffortConversions = z.infer<typeof effortConversionsSchema>;

// Effort is worked out in hundredths of an hour, the steps the database keeps, so arithmetic on
// fractions of a day stays exact.
const hundredthsInHour = 100;
// An amount is shown to as many places as a number can be typed with, so it can be typed back.
const placesShown = numberDigits.afterPoint;
// The most steps a unit holds is a quarter of 31 whole days, under 100, so an amount shown to six
// places is within a ten-thousandth of a step of the steps it came from. Counting steps to four
// places drops that, and what floating point adds, such as 0.30000000000000004, before rounding up.
const placesCounted = 4;

const toHundredths = (hours: number): number =>
  Math.round(hours * hundredthsInHour);

const fromHundredths = (hundredths: number): number =>
  hundredths / hundredthsInHour;

const roundedUp = (steps: number): number =>
  roundedUpTo(steps, 0, placesCounted);

// How many hundredths of an hour a unit holds.
function unitHundredths(
  conversions: EffortConversions,
  unit: EffortUnit,
): number {
  const day = toHundredths(conversions.hoursPerDay);
  const sizes: Record<EffortUnit, number> = {
    hours: hundredthsInHour,
    "person-days": day,
    "person-weeks": day * conversions.daysPerWeek,
    "person-months": day * conversions.daysPerMonth,
    "person-quarters": day * conversions.daysPerMonth * monthsInQuarter,
  };
  // The unit is one of the typed units, each a key of the table.
  // eslint-disable-next-line security/detect-object-injection
  return sizes[unit];
}

// The step an amount in a unit is kept to, in hundredths of an hour: whole hours, half
// person-days, and whole person-days for the larger units.
function stepHundredths(
  conversions: EffortConversions,
  unit: EffortUnit,
): number {
  const day = toHundredths(conversions.hoursPerDay);
  const steps: Record<EffortUnit, number> = {
    hours: hundredthsInHour,
    "person-days": day / hourSteps,
    "person-weeks": day,
    "person-months": day,
    "person-quarters": day,
  };
  // The unit is one of the typed units, each a key of the table.
  // eslint-disable-next-line security/detect-object-injection
  return steps[unit];
}

// The hours an amount entered in a unit is kept as, rounded up to the unit's step.
export function enteredHours(
  amount: number,
  unit: EffortUnit,
  conversions: EffortConversions,
): number {
  const step = stepHundredths(conversions, unit);
  const steps = roundedUp((amount * unitHundredths(conversions, unit)) / step);
  return fromHundredths(steps * step);
}

// An estimate's hours as an amount in a unit, exactly, before any rounding.
export const exactEffort = (
  hours: number,
  unit: EffortUnit,
  conversions: EffortConversions,
): number => (hours * hundredthsInHour) / unitHundredths(conversions, unit);

// The largest amount of a unit kept as no more than a number of hours, such as the largest estimate.
export function largestIn(
  hours: number,
  unit: EffortUnit,
  conversions: EffortConversions,
): number {
  const step = stepHundredths(conversions, unit);
  const steps = Math.floor(toHundredths(hours) / step);
  return Number(
    ((steps * step) / unitHundredths(conversions, unit)).toFixed(placesShown),
  );
}

// An estimate's hours as an amount in a unit, rounded up to the unit's step, to as many places as
// a number is typed with.
export function shownEffort(
  hours: number,
  unit: EffortUnit,
  conversions: EffortConversions,
): number {
  const step = stepHundredths(conversions, unit);
  const steps = roundedUp(toHundredths(hours) / step);
  return Number(
    ((steps * step) / unitHundredths(conversions, unit)).toFixed(placesShown),
  );
}
