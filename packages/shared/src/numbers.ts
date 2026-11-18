// SPDX-License-Identifier: Apache-2.0

// Numbers as Fathom keeps them in any column holding one: the form they're typed in, their digit
// limits and rounding.

import { z } from "zod";

// Keeps every value exact in the browser and written without an exponent.
export const numberDigits = { total: 15, afterPoint: 6 };

const numberForm = "use a number such as 1234.5";
const numberLimit = `use at most ${String(numberDigits.total)} digits, ${String(numberDigits.afterPoint)} of them after the point`;

// One form in every language, since a comma or point between digits means different things.
// Each branch reads a run of digits only one way, so refused text is checked in linear time.
const typedForm = /^-?(\d+\.?|\d*\.\d+)$/;

function placesUsed(fraction: string): number {
  let places = fraction.length;
  while (places > 0 && fraction[places - 1] === "0") places -= 1;
  return places;
}

function withinDigits(text: string): boolean {
  const [whole = "", fraction = ""] = text.replace("-", "").split(".");
  const placed = placesUsed(fraction);
  return (
    placed <= numberDigits.afterPoint &&
    whole.replace(/^0+/, "").length + placed <= numberDigits.total
  );
}

// What a value refused for being out of its range says, such as Hours a day: use 0.5 to 24.
export const outOfRange = (
  name: string,
  { least, most }: { least: number; most: number },
  unit = "",
) => `${name}: use ${String(least)}${unit} to ${String(most)}${unit}`;

// What is wrong with text typed as a number, in words to follow a label, or undefined when it is
// empty or a number Fathom keeps.
export function numberProblem(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  if (!typedForm.test(trimmed)) return numberForm;
  return withinDigits(trimmed) ? undefined : numberLimit;
}

// The number typed, or undefined when the text is not one Fathom keeps.
export function typedNumber(text: string): number | undefined {
  return text.trim() === "" || numberProblem(text) !== undefined
    ? undefined
    : Number(text.trim());
}

// A number rounded up to a number of decimal places, such as 0.67 for two thirds to two places,
// first dropping what lies past a number of places, such as what floating point adds to
// 0.30000000000000004, so it rounds nothing up: by default, past those a number is typed with. The
// places kept are always more than the places rounded to, as every caller's are.
export function roundedUpTo(
  value: number,
  places: number,
  keptPlaces: number = numberDigits.afterPoint,
): number {
  const scale = 10 ** places;
  return (
    Math.ceil(Number((value * scale).toFixed(keptPlaces - places))) / scale
  );
}

export const isNumberValue = (value: unknown): value is number =>
  typeof value === "number" && typedNumber(String(value)) === value;

export const numberValueSchema = z.custom<number>(isNumberValue, {
  error: `Numbers ${numberForm}, and ${numberLimit}`,
});
