// SPDX-License-Identifier: Apache-2.0

// Tests for a person's initials, including names with one part, extra spaces, or none at all.

import { describe, expect, it } from "vitest";
import { initials } from "./names.ts";

describe("initials", () => {
  it.each([
    ["Fictional Person", "FP"],
    ["fictional middle person", "FM"],
    ["Fictional", "F"],
    ["  Fictional   Person  ", "FP"],
    ["", ""],
  ])("of %j are %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
