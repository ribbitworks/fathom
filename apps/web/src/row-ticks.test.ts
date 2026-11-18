// SPDX-License-Identifier: Apache-2.0

// Tests for choosing rows by ticks: ticking and unticking several at once, and which of the rows
// shown are ticked and may be, each record once.

import { describe, expect, it } from "vitest";
import { tickedOf, withTicks } from "./row-ticks.tsx";

describe("ticking rows", () => {
  it("ticks and unticks several at once, leaving the rest as they were", () => {
    const ticked = withTicks(new Set(["a"]), ["b", "c"], true);
    expect([...ticked]).toEqual(["a", "b", "c"]);
    expect([...withTicks(ticked, ["a", "c", "gone"], false)]).toEqual(["b"]);
  });

  it("gives back the same ticks when nothing changes", () => {
    const ticked = new Set(["a"]);
    expect(withTicks(ticked, ["a"], true)).toBe(ticked);
    expect(withTicks(ticked, ["gone"], false)).toBe(ticked);
    expect(withTicks(ticked, [], true)).toBe(ticked);
  });
});

describe("the rows ticked among those shown", () => {
  const ticks = {
    ticked: new Set(["a", "b", "hidden"]),
    tickable: ({ id }: { id: string }) => id !== "b",
  };

  it("leave out a ticked row the view no longer shows, and one that may not be ticked", () => {
    const shown = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(tickedOf(ticks, shown)).toEqual({
      ticked: [{ id: "a" }],
      tickable: [{ id: "a" }, { id: "c" }],
    });
  });

  it("count a record shown under several headings once", () => {
    expect(tickedOf(ticks, [{ id: "a" }, { id: "a" }])).toEqual({
      ticked: [{ id: "a" }],
      tickable: [{ id: "a" }],
    });
  });
});
