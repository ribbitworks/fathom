// SPDX-License-Identifier: Apache-2.0

// Numbers as Fathom keeps them, for any column holding one: typed in one form everywhere, such as
// 1234.5, whatever the reader's language, as a date is, since a comma or a point between digits
// means different things in different places and a wrong guess would keep a value a thousand times
// off. The limits keep every value exact in the browser and written without an exponent.

import { z } from "zod";

export const numberDigits = { total: 15, afterPoint: 6 };

const numberForm = "use a number such as 1234.5";
const numberLimit = `use at most ${String(numberDigits.total)} digits, ${String(numberDigits.afterPoint)} of them after the point`;

const typedForm = /^-?(\d+\.?\d*|\.\d+)$/;

function withinDigits(text: string): boolean {
  const [whole = "", fraction = ""] = text.replace("-", "").split(".");
  const placed = fraction.replace(/0+$/, "").length;
  return (
    placed <= numberDigits.afterPoint &&
    whole.replace(/^0+/, "").length + placed <= numberDigits.total
  );
}

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
