// SPDX-License-Identifier: Apache-2.0

// A table's first columns frozen on the left while the rest scroll sideways under them: how many
// fit, where each frozen cell sits, measured from the header's cells, how wide a frozen column may
// be made, and how many stay frozen once a column moves, a column moved into the frozen ones
// joining them and one moved out leaving; and whether the table has columns out of view to either
// side.

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

// Whether a scrolling box has more of its content out of view to its left, and to its right, a
// pixel's rounding aside.
export interface ScrollEdges {
  before: boolean;
  after: boolean;
}

export const scrollEdges = ({
  scrollLeft,
  clientWidth,
  scrollWidth,
}: Pick<HTMLElement, "scrollLeft" | "clientWidth" | "scrollWidth">) => ({
  before: scrollLeft > 0,
  after: scrollLeft + clientWidth < scrollWidth - 1,
});

// The edges seen before, where nothing about them has changed, so a table isn't drawn again for
// every step of scrolling.
export const keptEdges = (
  before: ScrollEdges,
  next: ScrollEdges,
): ScrollEdges =>
  before.before === next.before && before.after === next.after ? before : next;

// Where each header cell's right edge is against the frozen columns' share of the table's width:
// before it, at it or past it, which is all the width decides about how the table is drawn, the
// Wider item of a frozen column's menu included.
const againstShare = ({ widths, room }: Measured): number[] => {
  let edge = 0;
  return widths.map((width) => {
    edge += width;
    return room === 0 ? -1 : Math.sign(edge - room * frozenShare);
  });
};

// Whether two measures draw the table alike: the same widths and height, and each column's edge on
// the same side of the frozen columns' share, however much the width between them differs, so
// resizing the page or a side panel draws the table again only when something it shows changes.
export function drawsAlike(first: Measured, second: Measured): boolean {
  const secondSides = againstShare(second);
  return (
    first.height === second.height &&
    first.widths.length === second.widths.length &&
    first.widths.every((width, index) => width === second.widths.at(index)) &&
    againstShare(first).every((side, index) => side === secondSides.at(index))
  );
}

// The table in its scrolling box, measured whenever its header's cells change, named by `cells`,
// and whenever it or its box is resized, such as when rows are added or the window narrows, except
// while held, as while a column's edge is dragged, and once more as it is let go. Each measure gives
// the box's edges to `onEdges`, but a measure that draws the table alike is not kept, and `now`
// measures it as it is, for what needs the exact width. `onEdges` must stay the same function. The
// table, and so its box, is shown unless its rows are drawn another way, such as on a board, which
// the table is mounted afresh to leave.
export function useMeasured(
  cells: string,
  onEdges: (edges: ScrollEdges) => void,
): {
  scrollRef: RefObject<HTMLDivElement | null>;
  measured: Measured;
  hold: (held: boolean) => void;
  now: () => Measured;
} {
  const scroll = useRef<HTMLDivElement>(null);
  const held = useRef(false);
  const [measured, setMeasured] = useState<Measured>({
    widths: [],
    room: 0,
    height: 0,
  });
  const kept = useRef<Measured>(undefined);
  const update = useCallback(() => {
    const box = scroll.current;
    if (held.current || box === null) return;
    onEdges(scrollEdges(box));
    const next = measure(box);
    if (kept.current !== undefined && drawsAlike(kept.current, next)) return;
    kept.current = next;
    setMeasured(next);
  }, [onEdges]);
  const hold = useCallback(
    (holding: boolean) => {
      held.current = holding;
      update();
    },
    [update],
  );
  const now = useCallback(() => measure(scroll.current as HTMLDivElement), []);
  useLayoutEffect(update, [update, cells]);
  useEffect(() => {
    const box = scroll.current;
    if (box === null) return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(box);
    observer.observe(box.querySelector("table") as HTMLElement);
    return () => {
      observer.disconnect();
    };
  }, [update]);
  return { scrollRef: scroll, measured, hold, now };
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
