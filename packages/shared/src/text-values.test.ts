// SPDX-License-Identifier: Apache-2.0

// Tests for the values text columns hold.

import { describe, expect, it } from "vitest";
import { textLimit, textProblem, textValueSchema } from "./text-values.ts";

// Built from its code point, so the test's own source holds no mark that changes direction.
const rightToLeftOverride = String.fromCodePoint(0x202e);

describe("a text column's value", () => {
  it("holds up to 200 characters on one line, or 2,000 on several", () => {
    expect(textLimit(false)).toBe(200);
    expect(textLimit(true)).toBe(2000);
    expect(textProblem("x".repeat(200), false)).toBeUndefined();
    expect(textProblem("x".repeat(201), false)).toBe(
      "use 200 characters or fewer",
    );
    expect(textProblem("x".repeat(2000), true)).toBeUndefined();
    expect(textProblem("x".repeat(2001), true)).toBe(
      "use 2,000 characters or fewer",
    );
  });

  it("keeps its lines only in a column of several lines", () => {
    expect(textProblem("North\nwing", true)).toBeUndefined();
    expect(textProblem("North\nwing", false)).toBe("use one line");
  });

  it("refuses characters that aren't plain text, on any line", () => {
    expect(textProblem("North\twing", true)).toBe("use plain text");
    expect(textProblem(`North${rightToLeftOverride}wing`, false)).toBe(
      "use plain text",
    );
  });

  it("is asked for trimmed, with its line breaks made alike, and empty as none", () => {
    expect(textValueSchema.parse("  North\r\nwing\r ")).toBe("North\nwing");
    expect(textValueSchema.parse("   ")).toBeNull();
    expect(textValueSchema.parse(null)).toBeNull();
  });

  it("is refused past the most any column holds before its column is known", () => {
    expect(textValueSchema.safeParse("x".repeat(2001)).success).toBe(false);
  });
});
