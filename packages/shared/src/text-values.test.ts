// SPDX-License-Identifier: Apache-2.0

// Tests for the values text columns hold.

import { describe, expect, it } from "vitest";
import { textLimit, textProblem, textValueSchema } from "./text-values.ts";

// Built from its code point, so the test's own source holds no mark that changes direction.
const rightToLeftOverride = String.fromCodePoint(0x202e);

describe("a text column's value", () => {
  it("holds up to 200 characters", () => {
    expect(textLimit).toBe(200);
    expect(textProblem("x".repeat(200))).toBeUndefined();
    expect(textProblem("x".repeat(201))).toBe("use 200 characters or fewer");
  });

  it("is refused on several lines", () => {
    expect(textProblem("North\nwing")).toBe("use one line");
  });

  it("refuses characters that aren't plain text", () => {
    expect(textProblem("North\twing")).toBe("use plain text");
    expect(textProblem(`North${rightToLeftOverride}wing`)).toBe(
      "use plain text",
    );
  });

  it("is asked for trimmed, with its line breaks made alike, and empty as none", () => {
    expect(textValueSchema.parse("  North\r\nwing\r ")).toBe("North\nwing");
    expect(textValueSchema.parse("   ")).toBeNull();
    expect(textValueSchema.parse(null)).toBeNull();
  });
});
