// SPDX-License-Identifier: Apache-2.0

// Where the shared table's columns sit: how wide each is, which are frozen, and the table's
// sideways scrolling.

import {
  type CSSProperties,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useColumnWidths } from "./column-widths.ts";
import {
  type ScrollEdges,
  cellKey,
  frozenLayout,
  frozenLeft,
  sameEdges,
  scrollBesideFrozen,
  useMeasured,
} from "./frozen-columns.ts";
import { kindOf, shown } from "./grid-columns.tsx";
import { cellDraft, liveName } from "./grid-drafts.ts";
import type { SelectionGrid } from "./grid-selection.ts";
import classes from "./pages.module.css";
import type { AnyColumn, Column, GridRecord } from "./record-table.ts";
import { classMarkChars, draftMarkChars } from "./status-mark.tsx";
import { frozenAtFirst, valueOrStandIn } from "./table-view.ts";
import { valueStore } from "./value-store.ts";

const widestChars = 30;
// A table's name column starts no wider than most full names with the row's slot, so the columns
// after it get the room; a longer name is cut short, and the column can be made wider.
const widestNameChars = 24;

// How many characters a row's slot takes before its first value: the record's marks, then the first
// value's dot, which hangs back into it.
const slotChars = 2 + draftMarkChars;

// How many characters a column fits in its cells and in its header, which CSS turns into its width.
export function columnWidth(
  column: AnyColumn,
  longestText: ReadonlyMap<string, number>,
  // The table's name column, which starts narrower than the rest.
  nameColumn?: string,
): { cells: number; header: number } {
  return {
    cells: Math.min(
      column.cellChars ??
        kindOf(column).width(column, longestText.get(column.key) ?? 0),
      column.key === nameColumn ? widestNameChars : widestChars,
    ),
    header: Math.min(
      Math.max(
        column.label.length +
          (column.field?.draft ? draftMarkChars : 0) +
          classMarkChars(column.dataClass),
        (liveName(column, "both")?.length ?? 0) + draftMarkChars,
      ),
      widestChars,
    ),
  };
}

// A column's width as CSS sets it: to fit its cells' characters and its header's, or, when set, in
// pixels.
export function widthStyle(
  {
    cells,
    header,
  }: {
    cells: number;
    header: number;
  },
  set: number | undefined,
): CSSProperties {
  return {
    "--cell-chars": cells,
    "--header-chars": header,
    ...(set === undefined ? {} : { "--set-width": `${String(set)}px` }),
  } as CSSProperties;
}

function longestTexts<Rec extends GridRecord>(
  columns: readonly Column<Rec>[],
  records: readonly Rec[],
  // The column drawn first, as a list of one, which holds the slot for a draft's mark.
  first: readonly string[],
): Map<string, number> {
  return new Map(
    columns
      .filter((column) => kindOf(column).measured)
      .map((column) => [
        column.key,
        (first.includes(column.key) ? slotChars : 0) +
          records.reduce(
            (longest, record) =>
              Math.max(
                longest,
                shown(column, valueOrStandIn(column, record)).length +
                  (!first.includes(column.key) &&
                  cellDraft(record.draft, column)
                    ? draftMarkChars
                    : 0),
              ),
            0,
          ),
      ]),
  );
}

// The table's sideways scrolling, for what a page shows above it that follows it, such as a strip:
// the box that scrolls, once drawn, how far its frozen columns reach, and scrolling a column to just
// after them.
export interface TableScroll {
  box: () => HTMLDivElement | null;
  frozenWidth: number;
  scrollTo: (column: string) => void;
}

export const TableScrolling = createContext<TableScroll | undefined>(undefined);

// The scrolling of the table drawing what is above it, which only a table draws.
export function useTableScroll(): TableScroll {
  const scroll = useContext(TableScrolling);
  if (scroll === undefined) {
    throw new Error(
      "Only what a table draws above itself follows its scrolling.",
    );
  }
  return scroll;
}

export function useGridLayout<Rec extends GridRecord, Change, Request>(
  grid: Pick<
    SelectionGrid<Rec, Change, Request>,
    | "onView"
    | "opensAtColumn"
    | "linkedColumn"
    | "allColumns"
    | "columns"
    | "view"
    | "records"
    | "liveBeside"
  >,
) {
  const {
    onView,
    opensAtColumn,
    linkedColumn,
    allColumns,
    columns,
    view,
    records,
    liveBeside,
  } = grid;
  // No width follows what is typed, so editing never moves the table. Hidden columns are measured
  // too, so one shown again fits what it holds.
  const [longestText] = useState(() =>
    longestTexts(
      allColumns,
      records,
      columns.slice(0, 1).map(({ key }) => key),
    ),
  );
  // Whether the table has columns out of view to either side: those to its left once scrolled
  // sideways, which the frozen columns' edge shows with a shadow, or else a fade, and those to its
  // right, which a fade shows.
  // Kept apart from the table's state, so reaching an end redraws only the marks, not every row.
  const [edges] = useState(() =>
    valueStore<ScrollEdges>(sameEdges, { before: false, after: false }),
  );
  // Each column's header cells: its own, and any live copy beside it.
  const headerCells = columns.map((column) => (liveBeside(column) ? 2 : 1));
  const {
    scrollRef,
    measured,
    hold: holdMeasuring,
    now: measuredNow,
  } = useMeasured(
    columns
      .map((column) => `${column.key}${liveBeside(column) ? "+" : ""}`)
      .join(" "),
    edges.set,
  );
  const atFirst = frozenAtFirst(columns);
  const frozenAsked = Math.min(view.frozen ?? atFirst, columns.length);
  const frozen = frozenLayout(measured, headerCells, frozenAsked);
  // Held from the table's first drawing, so the page can let the link go at once.
  const [linkedAtFirst] = useState(linkedColumn?.key);
  const onLinkedOpened = linkedColumn?.onOpened;
  useEffect(() => {
    onLinkedOpened?.();
  }, [onLinkedOpened]);
  const scrolledTo = opensAtColumn ?? linkedAtFirst;
  const openedAtColumn = useRef(false);
  useLayoutEffect(() => {
    if (scrolledTo === undefined || openedAtColumn.current) return;
    const scroll = scrollBesideFrozen(
      frozen,
      columns.findIndex(({ key }) => key === scrolledTo),
    );
    if (scroll === undefined || measured.widths.length === 0) return;
    openedAtColumn.current = true;
    (scrollRef.current as HTMLDivElement).scrollLeft = scroll;
  });
  // The columns and where the frozen ones sit as last drawn, so scrolling to a column from above the
  // table needs nothing new from each drawing.
  const placing = useRef({ frozen, columns });
  useLayoutEffect(() => {
    placing.current = { frozen, columns };
  });
  const [scrolling] = useState(() => ({
    box: () => scrollRef.current,
    scrollTo: (key: string) => {
      const { frozen: frozenNow, columns: columnsNow } = placing.current;
      const scroll = scrollBesideFrozen(
        frozenNow,
        columnsNow.findIndex((column) => column.key === key),
      );
      // A column not shown, such as one hidden, leaves the table where it is.
      if (scroll !== undefined) {
        (scrollRef.current as HTMLDivElement).scrollLeft = scroll;
      }
    },
  }));
  const frozenWidth = frozen.width;
  const tableScroll = useMemo<TableScroll>(
    () => ({ ...scrolling, frozenWidth }),
    [scrolling, frozenWidth],
  );
  // Where a frozen column's cell, or its live copy's, sits, or nothing for a column not frozen.
  const frozenCell = (index: number, copy = 0) =>
    index < frozen.frozen
      ? {
          className: classes.frozen,
          style: { left: `var(${frozenLeft(cellKey(index, copy))})` },
        }
      : { className: "", style: undefined };
  const frozenView = (count: number) => (count === atFirst ? undefined : count);
  const freeze = (count: number) => {
    onView({ ...view, frozen: frozenView(count) });
  };
  // The table's panel, holding its columns and where its frozen columns sit.
  const panelRef = useRef<HTMLDivElement>(null);
  const widths = useColumnWidths({
    panelRef,
    view,
    onView,
    measured,
    measuredNow,
    headerCells,
    frozen,
    holdMeasuring,
  });
  return {
    longestText,
    edges,
    scrollRef,
    measured,
    frozenAsked,
    frozen,
    linkedAtFirst,
    tableScroll,
    frozenCell,
    frozenView,
    freeze,
    panelRef,
    widths,
  };
}

export type LayoutGrid<Rec extends GridRecord, Change, Request> = SelectionGrid<
  Rec,
  Change,
  Request
> &
  ReturnType<typeof useGridLayout<Rec, Change, Request>>;
