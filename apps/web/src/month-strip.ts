// SPDX-License-Identifier: Apache-2.0

// The strip of quarters above a month grid: the quarters its months fall in, the quarters the
// arrows step to from the first month on screen, and which months' columns are on screen.

import { addToMonth, quarterStart } from "@fathom/shared";
import { quarterName, quarterOf } from "./timeline.ts";

export interface MonthQuarter {
  // The quarter's first month, which keys it.
  start: string;
  label: string;
  short: string;
  // Its months on the grid, the first and last quarter's cut short by the grid's ends.
  months: [string, ...string[]];
}

// The quarters a grid's months fall in, such as Q1 2027, in order.
export function monthQuarters(months: readonly string[]): MonthQuarter[] {
  const quarters: MonthQuarter[] = [];
  for (const month of months) {
    const start = quarterStart(month);
    const last = quarters.at(-1);
    if (last?.start === start) last.months.push(month);
    else {
      quarters.push({
        start,
        label: quarterName(`${start}-01`),
        short: quarterOf(`${start}-01`),
        months: [month],
      });
    }
  }
  return quarters;
}

// A quarter as a strip names it: as wide as its months, in view while any of its months is, and
// current while it holds this month.
export const quarterPeriod = (
  quarter: MonthQuarter,
  inView: (month: string) => boolean,
  thisMonth: string,
) => ({
  key: quarter.start,
  label: quarter.label,
  short: quarter.short,
  weight: quarter.months.length,
  inView: quarter.months.some(inView),
  current: quarter.months.includes(thisMonth),
});

// The quarter the ‹ arrow goes to, starting before the first month on screen, which is the start
// of the quarter on screen when partway into it; and the quarter › goes to, starting after it.
export function quarterSteps(
  quarters: readonly MonthQuarter[],
  firstOnScreen: string,
): { previous: MonthQuarter | undefined; next: MonthQuarter | undefined } {
  return {
    previous: quarters.findLast(({ months }) => months[0] < firstOnScreen),
    next: quarters.find(({ months }) => months[0] > firstOnScreen),
  };
}

// A column as the grid lays it out, in pixels from the table's left edge.
export interface ColumnPlace {
  key: string;
  left: number;
  width: number;
}

// A column counts as on screen with at least half of it in view.
const enoughInView = 1 / 2;

// The columns on screen, in order: those frozen at the left, and those at least half in view
// between the frozen columns and the view's right edge.
export function columnsOnScreen(
  columns: readonly ColumnPlace[],
  {
    scrolled,
    room,
    frozenWidth,
  }: {
    scrolled: number;
    room: number;
    frozenWidth: number;
  },
): string[] {
  const from = scrolled + frozenWidth;
  const to = scrolled + room;
  return columns
    .filter(
      ({ left, width }) =>
        left < frozenWidth ||
        Math.min(left + width, to) - Math.max(left, from) >=
          width * enoughInView,
    )
    .map(({ key }) => key);
}

// Where a grid scrolls to show a month: the month before it, just after the frozen columns, so the
// month shown has the one before it beside it, unless it is the grid's first.
export const scrollTargetFor = (month: string, firstMonth: string): string =>
  month === firstMonth ? month : addToMonth(month, -1);

// The column a grid's count is for, as the grid scrolls by hand: the first wholly in view after the
// frozen columns, or the one after it where it starts at their edge, as the month before the one a
// grid was moved to does. A pixel is allowed for rounding.
export function countedColumn(
  columns: readonly ColumnPlace[],
  { scrolled, frozenWidth }: { scrolled: number; frozenWidth: number },
): string | undefined {
  const edge = scrolled + frozenWidth;
  const index = columns.findIndex(({ left }) => left >= edge - 1);
  if (index === -1) return undefined;
  const [whole, after] = columns.slice(index, index + 2);
  const beforeTheMonthShown =
    index > 0 && whole !== undefined && whole.left <= edge + 1;
  return (beforeTheMonthShown ? (after ?? whole) : whole)?.key;
}
