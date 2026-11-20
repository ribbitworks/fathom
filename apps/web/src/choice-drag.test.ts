// SPDX-License-Identifier: Apache-2.0

// Tests for where a dropped or moved choice ends up. Real dragging needs a browser's layout, so
// the drop is tested through the move it asks for.

import { describe, expect, it } from "vitest";
import {
  droppedMove,
  followingAfterMove,
  liftedWhileDragging,
} from "./choice-drag.ts";
import { fictionalChoice } from "./test-support.tsx";

const choices = ["a", "b", "c"].map(fictionalChoice);

describe("where a moved choice ends up", () => {
  it.each([
    [0, 2, "c"],
    [2, 0, null],
    [2, 1, "a"],
    [0, 1, "b"],
  ])("from place %i to place %i follows %s", (from, to, after) => {
    expect(followingAfterMove(choices, from, to)).toBe(after);
  });
});

describe("dropping a dragged choice", () => {
  const at = (index: number) => ({ index, droppableId: "choices" });

  it("moves a choice dropped somewhere new", () => {
    expect(droppedMove(choices, { source: at(2), destination: at(0) })).toEqual(
      { choice: choices[2], after: null },
    );
  });

  it.each([
    ["where it started", at(1)],
    ["outside the list", null],
  ])("moves nothing when dropped %s", (_case, destination) => {
    expect(droppedMove(choices, { source: at(1), destination })).toBe(
      undefined,
    );
  });

  it("moves nothing when the choice has gone", () => {
    expect(droppedMove(choices, { source: at(5), destination: at(0) })).toBe(
      undefined,
    );
  });
});

describe("a dragged row", () => {
  it("is lifted only while it is being dragged", () => {
    expect(liftedWhileDragging("row", false)).toBe("row");
    expect(liftedWhileDragging("row", true)).not.toBe("row");
  });
});
