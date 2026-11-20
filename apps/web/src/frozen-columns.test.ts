// SPDX-License-Identifier: Apache-2.0

// Tests for how many columns stay frozen as a column moves, and where frozen columns sit, measured
// from the header's cells, and how wide a frozen column may be made. The frozen columns themselves
// are tested in grid-layout.test.tsx.

import { describe, expect, it } from "vitest";
import {
  frozenAfterMove,
  frozenLayout,
  frozenVariables,
  frozenWidened,
  scrollBesideFrozen,
  widestFrozen,
  keptEdges,
} from "./frozen-columns.ts";

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

  it("scrolls a column to just after the frozen ones, and nowhere for a column not there", () => {
    const layout = frozenLayout(measured, [1, 2, 1, 1], 1);

    expect(scrollBesideFrozen(layout, 2)).toBe(220);
    expect(scrollBesideFrozen(layout, -1)).toBeUndefined();
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

describe("how wide a frozen column may be made", () => {
  const measured = { widths: [80, 120, 100, 100, 60], room: 1000, height: 0 };
  const headerCells = [1, 2, 1, 1];
  const layout = frozenLayout(measured, headerCells, 3);

  it("leaves the frozen columns half the room, sharing it with a live copy", () => {
    expect(widestFrozen(measured, headerCells, layout, 0)).toBe(180);
    expect(widestFrozen(measured, headerCells, layout, 1)).toBe(160);
    expect(widestFrozen(measured, headerCells, layout, 2)).toBe(200);
  });

  it("does not limit a column not frozen, or any before the table is measured", () => {
    expect(widestFrozen(measured, headerCells, layout, 3)).toBe(Infinity);
    const unmeasured = { widths: [], room: 0, height: 0 };
    expect(
      widestFrozen(
        unmeasured,
        headerCells,
        frozenLayout(unmeasured, headerCells, 3),
        0,
      ),
    ).toBe(Infinity);
  });
});

describe("frozen columns while one is made wider", () => {
  const measured = { widths: [80, 120, 100, 100, 60], room: 1000, height: 0 };
  const headerCells = [1, 2, 1, 1];
  const layout = frozenLayout(measured, headerCells, 3);
  const leftsOf = (widened: ReturnType<typeof frozenWidened>) => [
    ...widened.lefts.values(),
  ];

  it("moves the cells after it, a live copy beside it by its own change, and where they end", () => {
    const widened = frozenWidened(layout, headerCells, 1, 10);
    expect(leftsOf(widened)).toEqual([0, 80, 210, 320, 420]);
    expect(widened.width).toBe(420);
    expect(leftsOf(frozenWidened(layout, headerCells, 0, -20))).toEqual([
      0, 60, 180, 280, 380,
    ]);
  });

  it("moves nothing for a column not frozen", () => {
    expect(frozenWidened(layout, headerCells, 3, 50)).toBe(layout);
  });

  it("names each place and where the frozen columns end as CSS variables", () => {
    expect(
      frozenVariables({
        lefts: new Map([
          ["0-0", 0],
          ["1-1", 80],
        ]),
        width: 160,
      }),
    ).toEqual({
      "--frozen-width": "160px",
      "--frozen-left-0-0": "0px",
      "--frozen-left-1-1": "80px",
    });
  });
});

describe("keptEdges", () => {
  const before = { before: true, after: false };

  it("keeps the edges seen before when nothing has changed", () => {
    expect(keptEdges(before, { before: true, after: false })).toBe(before);
  });

  it.each([
    { before: false, after: false },
    { before: true, after: true },
  ])("takes the new edges when they change: %o", (next) => {
    expect(keptEdges(before, next)).toBe(next);
  });
});
