// SPDX-License-Identifier: Apache-2.0

// Unit tests for a record's note as it is kept: none when empty, as written otherwise, and refused
// when it holds what a note may not.

import { describe, expect, it } from "vitest";
import { BadRequestError } from "../errors.ts";
import { keptNote } from "./records.ts";

describe("a note as it is kept", () => {
  it.each([
    ["no note", null],
    ["an empty note", ""],
    ["a blank note", "  \n "],
  ])("is none for %s", (_, note) => {
    expect(keptNote(note)).toBeNull();
  });

  it("is exactly as written, spaces and formatting included", () => {
    const note =
      "  Scope **frozen**, see [the plan](https://example.com/plan). ";

    expect(keptNote(note)).toBe(note);
  });

  it.each([
    ["HTML", "<div>Block</div>", "A note can't hold HTML."],
    [
      "more than a note may",
      "a".repeat(10_001),
      "A note can be at most 10,000 characters.",
    ],
  ])("is refused when it holds %s", (_, note, refusal) => {
    expect(() => keptNote(note)).toThrow(new BadRequestError(refusal));
  });
});
