// SPDX-License-Identifier: Apache-2.0

// Tests for a person's initials, including names with one part, extra spaces, or none at all, and
// names in other scripts, whose first characters are never split.

import { describe, expect, it } from "vitest";
import { initials } from "./names.ts";

describe("initials", () => {
  it.each([
    ["Fictional Person", "FP"],
    ["fictional middle person", "FM"],
    ["Fictional", "F"],
    ["  Fictional   Person  ", "FP"],
    ["", ""],
    ["Вероника Елисеева", "ВЕ"],
    ["越智 太陽", "越太"],
    ["𠮷田 太郎", "𠮷太"],
    ["E\u0301lodie Dubois", "E\u0301D"],
  ])("of %j are %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
