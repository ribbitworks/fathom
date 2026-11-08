// SPDX-License-Identifier: Apache-2.0

// Tests for how many columns stay frozen as a column moves, and where frozen columns sit, measured
// from the header's cells. The frozen columns themselves are tested in record-grid.test.tsx.

import { describe, expect, it } from "vitest";
import { frozenAfterMove, frozenLayout } from "./frozen-columns.ts";

describe("frozen columns after a move", () => {
  it.each([
    [2, 0, 3, 1],
    [2, 1, 2, 1],
    [2, 3, 1, 3],
    [2, 3, 2, 2],
    [2, 0, 1, 2],
    [2, 3, 4, 2],
    [0, 1, 0, 0],
  ])(
    "with %i frozen, a column moved from %i to %i leaves %i frozen",
    (frozen, from, to, after) => {
      expect(frozenAfterMove(frozen, from, to)).toBe(after);
    },
  );
});

describe("where frozen columns sit", () => {
  const measured = { widths: [80, 120, 100, 100, 60], room: 1000, height: 0 };

  it("starts each header cell where the ones before it end, a live copy's after its column's", () => {
    const layout = frozenLayout(measured, [1, 2, 1, 1], 3);
    expect([...layout.lefts]).toEqual([
      ["0-0", 0],
      ["1-0", 80],
      ["1-1", 200],
      ["2-0", 300],
      ["3-0", 400],
    ]);
    expect(layout.frozen).toBe(3);
    expect(layout.width).toBe(400);
  });

  it("freezes only as many columns as fit in half the room, and none when the first does not", () => {
    expect(frozenLayout({ ...measured, room: 500 }, [1, 2, 1, 1], 4)).toEqual(
      expect.objectContaining({
        frozen: 1,
        width: 80,
        fits: [true, false, false, false],
      }),
    );
    expect(frozenLayout({ ...measured, room: 100 }, [1, 1], 1).frozen).toBe(0);
  });

  it("freezes those asked for before the table is measured, no more than it has", () => {
    const layout = frozenLayout({ widths: [], room: 0, height: 0 }, [1, 1], 5);
    expect(layout.frozen).toBe(2);
    expect(layout.width).toBe(0);
  });
});
