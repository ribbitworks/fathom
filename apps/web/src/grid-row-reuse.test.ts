// SPDX-License-Identifier: Apache-2.0

// Tests for reusing the shared table's drawn rows while an edit only starts: which rows are drawn
// again, and that any other change draws them all.

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useRowReuse } from "./grid-row-reuse.ts";

const rows = ["a", "b", "c"];

// Draws each row as a new element, counting how many were drawn.
function drawing() {
  const drawn: string[] = [];
  const draw = (row: string): ReactNode[] => {
    drawn.push(row);
    return [{ row }] as unknown as ReactNode[];
  };
  return { drawn, draw };
}

function rowsDrawn(state: object = { problem: undefined }) {
  const { result, rerender } = renderHook(
    ({ given }: { given: object }) => useRowReuse(given).rowReuse,
    { initialProps: { given: state } },
  );
  return { result, rerender };
}

describe("reusing the drawn rows", () => {
  it("draws again only the rows the edit starting and the one before it are in", () => {
    // Given rows drawn once
    const { result } = rowsDrawn();
    const props = { records: rows };
    const first = drawing();
    const before = result.current.draw(
      props,
      rows,
      String,
      undefined,
      first.draw,
    );
    // When an edit starts in the second row, with nothing else changed
    result.current.editStarting.current = true;
    const second = drawing();
    const after = result.current.draw(props, rows, String, 1, second.draw);
    // Then only that row is drawn again, and the others are the rows drawn before
    expect(second.drawn).toEqual(["b"]);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    // And when an edit starts in the third, the second is drawn again too
    result.current.editStarting.current = true;
    const third = drawing();
    result.current.draw(props, rows, String, 2, third.draw);
    expect(third.drawn).toEqual(["b", "c"]);
  });

  it.each([
    ["no edit starts", true, true],
    ["the props change", false, true],
    ["the table's state changes", true, false],
  ])("draws every row again when %s", (change, sameProps, sameState) => {
    // Given rows drawn once
    const state = { problem: undefined };
    const { result, rerender } = rowsDrawn(state);
    const props = { records: rows };
    result.current.draw(props, rows, String, undefined, drawing().draw);
    // When the rows are drawn again with that change
    if (!sameState) rerender({ given: { problem: "Name needed" } });
    result.current.editStarting.current = change !== "no edit starts";
    const again = drawing();
    result.current.draw(
      sameProps ? props : { records: [...rows] },
      rows,
      String,
      undefined,
      again.draw,
    );
    // Then every row is drawn
    expect(again.drawn).toEqual(rows);
  });
});
