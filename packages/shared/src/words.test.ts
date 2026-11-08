// SPDX-License-Identifier: Apache-2.0

// Tests for several names in one phrase.

import { describe, expect, it } from "vitest";
import { allOf, eitherOf } from "./words.ts";

describe("allOf", () => {
  it.each([
    [[], ""],
    [["Ana"], "Ana"],
    [["Ana", "Ben"], "Ana and Ben"],
    [["Ana", "Ben", "Cy"], "Ana, Ben, and Cy"],
  ])("joins %j", (names, phrase) => {
    expect(allOf(names)).toBe(phrase);
  });
});

describe("eitherOf", () => {
  it.each([
    [["Ana"], "Ana"],
    [["Ana", "Ben"], "Ana or Ben"],
    [["Ana", "Ben", "Cy"], "Ana, Ben, or Cy"],
  ])("joins %j", (names, phrase) => {
    expect(eitherOf(names)).toBe(phrase);
  });
});
