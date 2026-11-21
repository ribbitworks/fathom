// SPDX-License-Identifier: Apache-2.0

// Unit tests for keeping a record's note and for which roles may change a kind of record.

import { describe, expect, it } from "vitest";
import { BadRequestError } from "../errors.ts";
import { changesKind, keptNote } from "./records.ts";

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

describe("who may change a kind of record", () => {
  it("is a role holding one of its permissions that also sees the kind", () => {
    expect(changesKind(["plan:edit", "features:view"], "cycle-pattern")).toBe(
      true,
    );
  });

  it("is not a role holding one of its permissions that doesn't see the kind", () => {
    expect(changesKind(["plan:edit", "plan:view"], "cycle-pattern")).toBe(
      false,
    );
  });

  it("is not a role that sees the kind without a permission to change it", () => {
    expect(
      changesKind(["features:edit", "features:view"], "cycle-pattern"),
    ).toBe(false);
  });
});
