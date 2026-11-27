// SPDX-License-Identifier: Apache-2.0

// Reusing the shared table's drawn rows when an edit only starts, so opening a cell's editor redraws
// that row alone, not every row of a long table.

import { type ReactNode, useLayoutEffect, useRef } from "react";

// What starting an edit changes, which every row but the one edited ignores.
const editStartKeys = new Set(["editingAt", "openedWith"]);

interface DrawnRow {
  rowIndex: number;
  drawn: ReactNode[];
}

interface Drawn {
  inputs: Map<string, unknown>;
  editingRow: number | undefined;
  rows: Map<string, DrawnRow>;
}

// What the rows are drawn from that isn't a function, by name: the table's props, unchanged while the
// table redraws for its own state alone, and that state, less the edit's own.
function inputsOf(props: object, state: object): Map<string, unknown> {
  const entries: [string, unknown][] = [
    ...Object.entries(props).map(([key, value]): [string, unknown] => [
      `props.${key}`,
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
      // Draws the rows, reusing a row drawn last time where an edit only started, so each row is drawn
      // from the same props and state, and the row, in the same place, holds neither the cell edited
      // now nor the one edited before. React leaves a row it is given again
      // unchanged as it was.
      draw: <Row>(
        props: object,
        rows: readonly Row[],
        keyOf: (row: Row) => string,
        editingRow: number | undefined,
        drawRow: (row: Row, rowIndex: number) => ReactNode[],
      ): ReactNode[][] => {
        const inputs = inputsOf(props, state);
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
