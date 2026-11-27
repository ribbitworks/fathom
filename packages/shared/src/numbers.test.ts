// SPDX-License-Identifier: Apache-2.0

// Tests for numbers as Fathom keeps them.

import { describe, expect, it } from "vitest";
import {
  isNumberValue,
  numberProblem,
  numberProblemFor,
  numberProblemWords,
  numberValueSchema,
  roundedUpTo,
  typedNumber,
} from "./numbers.ts";

const longRun = 200_000;
const quickAnswerMilliseconds = 1000;

describe("roundedUpTo", () => {
  it("rounds up to the places given", () => {
    expect(roundedUpTo(2 / 3, 2)).toBe(0.67);
    expect(roundedUpTo(1.01, 0)).toBe(2);
    expect(roundedUpTo(-1.5, 0)).toBe(-1);
  });

  it("rounds up nothing that floating point adds past the places kept", () => {
    expect(roundedUpTo(0.1 + 0.2, 1)).toBe(0.3);
    expect(roundedUpTo(1.975 * 100, 0)).toBe(198);
    expect(roundedUpTo(6.000000000000001, 0, 4)).toBe(6);
  });
});

describe("typedNumber", () => {
  it.each([
    ["0", 0],
    ["42", 42],
    ["-3", -3],
    ["1234.5", 1234.5],
    [" 7 ", 7],
    [".5", 0.5],
    ["-.5", -0.5],
    ["5.", 5],
    ["0.000001", 0.000001],
    ["000123.4500", 123.45],
    ["999999999.999999", 999999999.999999],
    ["999999999999999", 999999999999999],
  ])("reads %j", (text, number) => {
    expect(typedNumber(text)).toBe(number);
  });

  it.each([
    ["nothing", ""],
    ["a word", "ten"],
    ["a sign alone", "-"],
    ["a point alone", "."],
    ["a sign and a point", "-."],
    ["a comma between thousands", "1,234"],
    ["a decimal comma", "1,5"],
    ["a space between thousands", "1 234"],
    ["an exponent", "1e3"],
    ["a plus sign", "+1"],
    ["two points", "1.2.3"],
    ["infinity", "Infinity"],
    ["sixteen digits", "1234567890123456"],
    ["seven decimal places", "0.1234567"],
    ["a point before the sign", ".-5"],
    ["a sign after the digits", "5-"],
    ["a second point after a trailing one", "5.."],
  ])("refuses %s", (_, text) => {
    expect(typedNumber(text)).toBeUndefined();
  });

  it(
    "refuses a long run of digits ending in a letter at once",
    { timeout: quickAnswerMilliseconds },
    () => {
      expect(typedNumber(`${"1".repeat(longRun)}x`)).toBeUndefined();
    },
  );

  it(
    "refuses a long fraction of zeros ending in a digit at once",
    { timeout: quickAnswerMilliseconds },
    () => {
      expect(typedNumber(`0.${"0".repeat(longRun)}1`)).toBeUndefined();
    },
  );
});

describe("numberProblem", () => {
  it.each([
    ["nothing", "", undefined],
    ["a number", "12.5", undefined],
    ["a word", "ten", "form"],
    ["too many digits", "1234567890123456", "digits"],
    ["too many decimal places", "0.1234567", "digits"],
  ])("for %s", (_, text, problem) => {
    expect(numberProblem(text)).toBe(problem);
  });
});

describe("a number's problem in words", () => {
  it("names no field under its own field", () => {
    expect([numberProblemWords("form"), numberProblemWords("digits")]).toEqual([
      "Number needed, such as 1234.5",
      "At most 15 digits, 6 after the point",
    ]);
  });

  it("names what it is for elsewhere", () => {
    expect([
      numberProblemFor("form", "Score"),
      numberProblemFor("digits", "Score"),
    ]).toEqual([
      "Type a number for Score, such as 1234.5",
      "Use at most 15 digits for Score, 6 after the point",
    ]);
  });
});

describe("isNumberValue", () => {
  it.each([0, -1.5, 1234.5])("accepts %d", (value) => {
    expect(isNumberValue(value)).toBe(true);
  });

  it.each([
    ["text", "1"],
    ["nothing", null],
    ["not a number", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["a sum that lost its exactness", 0.1 + 0.2],
    ["a value written with an exponent", 1e21],
  ])("refuses %s", (_, value) => {
    expect(isNumberValue(value)).toBe(false);
  });
});

describe("numberValueSchema", () => {
  it("says what form a number takes when it refuses one", () => {
    const result = numberValueSchema.safeParse(1e21);
    expect(result.error?.issues.at(0)?.message).toMatch(/1234\.5.*15 digits/);
  });
});
