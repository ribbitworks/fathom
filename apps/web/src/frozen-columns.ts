// SPDX-License-Identifier: Apache-2.0

// A table's first columns frozen on the left while the rest scroll sideways under them: how many
// fit, where each frozen cell sits, measured from the header's cells, how wide a frozen column may
// be made, and how many stay frozen once a column moves, a column moved into the frozen ones
// joining them and one moved out leaving.

import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// How many columns stay frozen until the view says otherwise: the first.
export const frozenByDefault = 1;

// The most of the table's visible width the frozen columns may take, so the rest can still scroll.
const frozenShare = 0.5;

export function frozenAfterMove(
  frozen: number,
  from: number,
  to: number,
): number {
  if (from < frozen && to >= frozen) return frozen - 1;
  if (from >= frozen && to < frozen) return frozen + 1;
  return frozen;
}

// The widths of the header's cells, in order, the width the table has to show them in, and how
// tall the rows shown are.
export interface Measured {
  widths: number[];
  room: number;
  height: number;
}

function measure(scroll: HTMLElement): Measured {
  const header = scroll.querySelector("thead tr") as Element;
  const table = scroll.querySelector("table") as HTMLElement;
  return {
    widths: [...header.children].map(
      (cell) => cell.getBoundingClientRect().width,
    ),
    room: scroll.clientWidth,
    height: Math.min(table.offsetHeight, scroll.clientHeight),
  };
}

const sameMeasure = (first: Measured, second: Measured) =>
  first.room === second.room &&
  first.height === second.height &&
  first.widths.length === second.widths.length &&
  first.widths.every((width, index) => width === second.widths.at(index));

// The table in its scrolling box, measured whenever its header's cells change, named by `cells`,
// and whenever it or its box is resized, such as when rows are added or the window narrows, except
// while held, as while a column's edge is dragged, and once more as it is let go. The table, and so
// its box, is always shown.
export function useMeasured(
  cells: string,
): [RefObject<HTMLDivElement | null>, Measured, (held: boolean) => void] {
  const scroll = useRef<HTMLDivElement>(null);
  const held = useRef(false);
  const [measured, setMeasured] = useState<Measured>({
    widths: [],
    room: 0,
    height: 0,
  });
  const update = useCallback(() => {
    if (held.current) return;
    const next = measure(scroll.current as HTMLDivElement);
    setMeasured((current) => (sameMeasure(current, next) ? current : next));
  }, []);
  const hold = useCallback(
    (holding: boolean) => {
      held.current = holding;
      update();
    },
    [update],
  );
  useLayoutEffect(update, [update, cells]);
  useEffect(() => {
    const box = scroll.current as HTMLDivElement;
    const observer = new ResizeObserver(update);
    observer.observe(box);
    observer.observe(box.querySelector("table") as HTMLElement);
    return () => {
      observer.disconnect();
    };
  }, [update]);
  return [scroll, measured, hold];
}

export interface FrozenLayout {
  // How many columns are frozen: as many of those asked for as leave the rest room to scroll.
  frozen: number;
  // Where the frozen columns end, from the table's left edge.
  width: number;
  // Whether freezing up to each column leaves the rest room to scroll.
  fits: boolean[];
  // Where each header cell of each column starts, its own and then any live copy's, by
  // `${column}-${cell}`.
  lefts: Map<string, number>;
}

// How a header cell is named among those of the table: by its column, and 0 for the column's own
// cell or 1 for a live copy beside it.
export const cellKey = (column: number, copy: number) =>
  `${String(column)}-${String(copy)}`;

// How far to scroll sideways so a column starts just after the frozen ones, or undefined for a
// column the layout does not have.
export function scrollBesideFrozen(
  { lefts, width }: FrozenLayout,
  column: number,
): number | undefined {
  const left = lefts.get(cellKey(column, 0));
  return left === undefined ? undefined : left - width;
}

// Where frozen columns sit, given how many header cells each column has, one or, with a live copy
// beside it, two. Before the table is measured, any number may be frozen.
export function frozenLayout(
  measured: Measured,
  headerCells: readonly number[],
  asked: number,
): FrozenLayout {
  const lefts = new Map<string, number>();
  const rights: number[] = [];
  let edge = 0;
  let cell = 0;
  for (const [column, cells] of headerCells.entries()) {
    for (let copy = 0; copy < cells; copy += 1) {
      lefts.set(cellKey(column, copy), edge);
      edge += measured.widths.at(cell) ?? 0;
      cell += 1;
    }
    rights.push(edge);
  }
  const fits = rights.map(
    (right) => measured.room === 0 || right <= measured.room * frozenShare,
  );
  let frozen = Math.min(asked, headerCells.length);
  while (frozen > 0 && fits.at(frozen - 1) !== true) frozen -= 1;
  return {
    frozen,
    width: rights.slice(0, frozen).at(-1) ?? 0,
    fits,
    lefts,
  };
}

// Where frozen cells sit and the frozen columns end, as CSS variables for the cells and the frozen
// columns' edge to take, so a drag can move them without drawing the table again.
export function frozenVariables(
  layout: Pick<FrozenLayout, "lefts" | "width">,
): Record<string, string> {
  const variables: [string, string][] = [
    ["--frozen-width", `${String(layout.width)}px`],
    ...[...layout.lefts].map(([cell, left]): [string, string] => [
      frozenLeft(cell),
      `${String(left)}px`,
    ]),
  ];
  return Object.fromEntries(variables);
}

// The CSS variable for where a header cell's column, by `${column}-${cell}`, sits when frozen.
export const frozenLeft = (cell: string) => `--frozen-left-${cell}`;

// Where frozen cells sit and the frozen columns end once a frozen column, with any live copy beside
// it, is made `change` pixels wider, or narrower when less than none.
export function frozenWidened(
  layout: FrozenLayout,
  headerCells: readonly number[],
  column: number,
  change: number,
): Pick<FrozenLayout, "lefts" | "width"> {
  if (column >= layout.frozen) return layout;
  const cells = headerCells.at(column) as number;
  const lefts = new Map(layout.lefts);
  for (const [at, count] of headerCells.entries()) {
    for (let copy = 0; copy < count; copy += 1) {
      const moved = at === column ? copy : at > column ? cells : 0;
      const key = cellKey(at, copy);
      lefts.set(key, (layout.lefts.get(key) as number) + change * moved);
    }
  }
  return { lefts, width: layout.width + change * cells };
}

// The widest a frozen column, with any live copy beside it as wide, may be made so the frozen
// columns stay within their share of the table's width: unlimited for a column not frozen, or
// before the table is measured.
export function widestFrozen(
  measured: Measured,
  headerCells: readonly number[],
  layout: FrozenLayout,
  column: number,
): number {
  if (column >= layout.frozen || measured.room === 0) return Infinity;
  const sum = (values: readonly number[]) =>
    values.reduce((total, value) => total + value, 0);
  const first = sum(headerCells.slice(0, column));
  const cells = headerCells.at(column) as number;
  const own = sum(measured.widths.slice(first, first + cells));
  return (measured.room * frozenShare - (layout.width - own)) / cells;
}
