// SPDX-License-Identifier: Apache-2.0

// Reusing the shared table's drawn rows when an edit only starts, so opening a cell's editor redraws
// that row alone, not every row of a long table.

import { type ReactNode, useLayoutEffect, useRef } from "react";
import type { useGridState } from "./grid-selection.ts";

type GridState = ReturnType<typeof useGridState>;

// What starting an edit changes in the table's state, which every row but the one edited ignores.
const editStartKeys: ReadonlySet<string> = new Set<keyof GridState>([
  "editingAt",
  "openedWith",
]);

interface DrawnRow {
  rowIndex: number;
  drawn: ReactNode[];
}

interface Drawn {
  inputs: Map<string, unknown>;
  editingRow: number | undefined;
  rows: Map<string, DrawnRow>;
}

// What the rows are drawn from that isn't a function, by name: what the table was given and keeps,
// each unchanged while the table redraws for an edit's start alone, and its state, less the edit's.
function inputsOf(sources: object, state: object): Map<string, unknown> {
  const entries: [string, unknown][] = [
    ...Object.entries(sources).map(([key, value]): [string, unknown] => [
      `sources.${key}`,
      value,
    ]),
    ...Object.entries(state).filter(([key]) => !editStartKeys.has(key)),
  ];
  return new Map(entries.filter(([, value]) => typeof value !== "function"));
}

const sameInputs = (
  before: Map<string, unknown>,
  now: Map<string, unknown>,
): boolean =>
  before.size === now.size &&
  [...now].every(([key, value]) => Object.is(before.get(key), value));

// A reused row keeps the event handlers it was drawn with, which knew no edit had started. Each acts
// only on its row's focused cell, and starting an edit elsewhere takes focus away first; a new row's
// paste, which also asks whether an edit is open, is why new rows are always drawn again.
export function useRowReuse(state: object) {
  // Set when an edit starts, for the drawing that follows it, and cleared once that is on screen.
  const editStarting = useRef(false);
  const drawn = useRef<Drawn>(undefined);
  useLayoutEffect(() => {
    editStarting.current = false;
  });
  return {
    rowReuse: {
      editStarting,
      draw: <Row>(
        sources: object,
        rows: readonly Row[],
        keyOf: (row: Row) => string,
        reusable: (row: Row) => boolean,
        editingRow: number | undefined,
        drawRow: (row: Row, rowIndex: number) => ReactNode[],
      ): ReactNode[][] => {
        const inputs = inputsOf(sources, state);
        const last = drawn.current;
        const reusing =
          editStarting.current &&
          last !== undefined &&
          sameInputs(last.inputs, inputs);
        const rowsNow = new Map<string, DrawnRow>();
        const drawnRows = rows.map((row, rowIndex) => {
          const key = keyOf(row);
          const before = reusing ? last.rows.get(key) : undefined;
          const reused =
            before !== undefined &&
            reusable(row) &&
            before.rowIndex === rowIndex &&
            rowIndex !== editingRow &&
            rowIndex !== last?.editingRow;
          const shown = reused ? before.drawn : drawRow(row, rowIndex);
          rowsNow.set(key, { rowIndex, drawn: shown });
          return shown;
        });
        drawn.current = { inputs, editingRow, rows: rowsNow };
        return drawnRows;
      },
    },
  };
}

export type RowReuse = ReturnType<typeof useRowReuse>["rowReuse"];
