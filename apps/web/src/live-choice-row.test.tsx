// SPDX-License-Identifier: Apache-2.0

// Tests for where a moved choice's live copy goes among a list's choices.

import { describe, expect, it } from "vitest";
import { movedLiveAfter } from "./live-choice-row.tsx";
import { fictionalChoice } from "./test-support.tsx";

describe("a moved choice's live place", () => {
  const first = fictionalChoice("a");
  const second = fictionalChoice("b");
  const offered = [second, first, fictionalChoice("c")];
  const moved = new Map([["b", 2]]);
  const liveOrder = ["a", "retired", "b", "c"];

  it("is just after the offered choice it followed live", () => {
    const after = movedLiveAfter(offered, liveOrder, moved);
    expect(after.get("a")).toEqual([second]);
    expect(after.has(null)).toBe(false);
  });

  it("follows each moved choice's own live neighbour", () => {
    const third = fictionalChoice("c");
    const after = movedLiveAfter(
      [third, first, second],
      ["a", "b", "c"],
      new Map([
        ["b", 2],
        ["c", 3],
      ]),
    );
    expect(after.get("a")).toEqual([second]);
    expect(after.get("b")).toEqual([third]);
    expect(after.size).toBe(2);
  });

  it("keeps the order shown among choices at the same place", () => {
    const third = fictionalChoice("c");
    const after = movedLiveAfter(
      [third, second],
      ["a"],
      new Map([
        ["b", 0],
        ["c", 1],
      ]),
    );
    expect(after.get(null)).toEqual([third, second]);
  });

  it("is at the top when it was first live", () => {
    expect(movedLiveAfter(offered, ["b", "a", "c"], moved).get(null)).toEqual([
      second,
    ]);
  });
});
