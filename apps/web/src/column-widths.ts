// SPDX-License-Identifier: Apache-2.0

// The widths a table's columns are set to, which the view keeps: a step wider or narrower from the
// keyboard or a column's menu, put back to fit what the column holds, or dragged by the edge of its
// header. While an edge is dragged, the column, its live copy, and the frozen columns after it are
// moved in place, without drawing the table again or measuring it, and the view takes the width
// once the drag ends.

import { type RefObject, useRef } from "react";
import {
  type FrozenLayout,
  frozenVariables,
  frozenWidened,
  type Measured,
  widestFrozen,
} from "./frozen-columns.ts";
import type { DragPoint } from "./resize-edge.tsx";
import { type View, widthStep, widthWithin, withWidth } from "./table-view.ts";

interface Drag {
  // Where the edge was pressed across the page, the column's width then, the table measured then,
  // and the width it is dragged to, if any.
  from: number;
  start: number;
  measured: Measured;
  width?: number;
}

export interface ColumnWidths {
  // The width set for a column, or none while it fits what it holds.
  setWidthOf: (key: string) => number | undefined;
  canWiden: (key: string, index: number) => boolean;
  canNarrow: (key: string, index: number) => boolean;
  // Makes a column a step wider, 1, or narrower, -1.
  step: (key: string, index: number, step: number) => void;
  reset: (key: string) => void;
  // Whether a column's edge is being dragged, during which its header must not be dragged too.
  resizing: () => boolean;
  // What a column's edge does as it is dragged or double-clicked.
  edge: (
    key: string,
    index: number,
  ) => {
    onStart: (edge: HTMLElement, at: DragPoint) => void;
    onDrag: (at: DragPoint) => void;
    onEnd: () => void;
    onReset: () => void;
  };
}

export function useColumnWidths({
  panelRef,
  view,
  onView,
  measured,
  measuredNow,
  headerCells,
  frozen,
  holdMeasuring,
}: {
  // The table's panel, holding its columns and where its frozen columns sit, as CSS variables.
  panelRef: RefObject<HTMLDivElement | null>;
  view: View;
  onView: (view: View) => void;
  measured: Measured;
  // The table measured as it is now, since the measure kept for drawing may lag its width.
  measuredNow: () => Measured;
  // Each column's header cells: its own, and any live copy beside it.
  headerCells: readonly number[];
  frozen: FrozenLayout;
  // Stops measuring the table while a drag moves it, and measures it again once it ends.
  holdMeasuring: (held: boolean) => void;
}): ColumnWidths {
  const drag = useRef<Drag>(undefined);
  const setWidthOf = (key: string) =>
    Object.entries(view.widths ?? {}).find(([column]) => column === key)?.[1];
  // A width the column may take: a frozen column only as wide as keeps the frozen columns within
  // their share of the table, as last drawn, or as it is now while it is being changed.
  const widthFor = (index: number, wanted: number, measure = measured) =>
    widthWithin(wanted, widestFrozen(measure, headerCells, frozen, index));
  const shownWidth = (index: number) =>
    measured.widths.at(
      headerCells.slice(0, index).reduce((total, cells) => total + cells, 0),
    ) ?? 0;
  const widthOf = (key: string, index: number) =>
    setWidthOf(key) ?? shownWidth(index);
  const setWidth = (key: string, width: number | undefined) => {
    onView(withWidth(view, key, width));
  };
  const showDragged = (key: string, index: number, width: number) => {
    const panel = panelRef.current as HTMLDivElement;
    for (const columnElement of panel.querySelectorAll("col")) {
      if (columnElement.dataset.column === key) {
        columnElement.style.setProperty("--set-width", `${String(width)}px`);
      }
    }
    const variables = frozenVariables(
      frozenWidened(frozen, headerCells, index, width - shownWidth(index)),
    );
    for (const [name, value] of Object.entries(variables)) {
      panel.style.setProperty(name, value);
    }
  };
  return {
    setWidthOf,
    canWiden: (key, index) => widthOf(key, index) < widthFor(index, Infinity),
    canNarrow: (key, index) => widthOf(key, index) > widthWithin(0),
    step: (key, index, step) => {
      setWidth(
        key,
        widthFor(index, widthOf(key, index) + step * widthStep, measuredNow()),
      );
    },
    reset: (key) => {
      setWidth(key, undefined);
    },
    resizing: () => drag.current !== undefined,
    edge: (key, index) => ({
      onStart: (edge, { x }) => {
        holdMeasuring(true);
        // The edge sits in the column's header cell.
        const cell = edge.parentElement as HTMLElement;
        drag.current = {
          from: x,
          start: cell.getBoundingClientRect().width,
          measured: measuredNow(),
        };
      },
      onDrag: ({ x }) => {
        // A drag moves only once it has started.
        const current = drag.current as Drag;
        current.width = widthFor(
          index,
          current.start + x - current.from,
          current.measured,
        );
        showDragged(key, index, current.width);
      },
      onEnd: () => {
        const ended = drag.current as Drag;
        drag.current = undefined;
        if (ended.width !== undefined) setWidth(key, ended.width);
        holdMeasuring(false);
      },
      onReset: () => {
        setWidth(key, undefined);
      },
    }),
  };
}
