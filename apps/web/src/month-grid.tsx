// SPDX-License-Identifier: Apache-2.0

// The monthly grid of people by month, as Capacity's Feature teams and Allocations show it, once
// what it reads has loaded, under the strip of quarters every view with time across it shares,
// following the grid as it scrolls.

import { type MonthRange, monthOf, monthsBetween } from "@fathom/shared";
import { Center, Loader } from "@mantine/core";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  memo,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import type { CellChange } from "./cell-kinds.tsx";
import { LoadProblem } from "./load-problem.tsx";
import { monthCount, peopleAndHires } from "./people-rows.ts";
import { type TableScroll, useTableScroll } from "./grid-layout.ts";
import { RecordGrid } from "./record-grid.tsx";
import type { RecordActions, RecordTable } from "./record-table.ts";
import type { SavedViews, ViewChoice } from "./table-controls.tsx";
import { formatMonth } from "./day-formats.ts";
import type { View } from "./table-view.ts";
import { TableTips } from "./table-tips.tsx";
import { type ValueStore, valueStore } from "./value-store.ts";
import {
  columnsOnScreen,
  countedColumn,
  scrollTargetFor,
  type MonthQuarter,
  monthQuarters,
  quarterPeriod,
  quarterSteps,
} from "./month-strip.ts";
import type { MonthRow } from "./team-months.tsx";
import { quarterWords, stillChosen, TimelineStrip } from "./timeline-strip.tsx";

// What a page gives the grid it shows.
export interface MonthGridProps {
  // Whether the reader may group rows by manager, which shows later months' managers.
  byManager: boolean;
  // Whether the reader may group Allocations by what each is allocated to, whose hours tell the
  // planning settings, and so only with them.
  groupsByWork?: boolean;
  now: string;
  view: View;
  onView: (view: View, replace?: boolean) => void;
  // The saved view the view started from, as the address names it.
  applied: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
  canShareViews: boolean;
}

export function MonthGrid<Rec extends MonthRow>({
  what,
  reads,
  table,
  records,
  actions,
  canEdit,
  now,
  range,
  view,
  onView,
  views,
  viewChoices,
}: {
  // What could not be loaded, such as "the allocations".
  what: string;
  reads: readonly Pick<UseQueryResult, "isError" | "refetch">[];
  table: RecordTable<Rec, CellChange, CellChange> | undefined;
  records: Rec[];
  actions: RecordActions<Rec, CellChange, CellChange>;
  canEdit: boolean;
  now: string;
  // The months the grid holds.
  range: MonthRange;
  view: View;
  onView: (view: View, replace?: boolean) => void;
  // The grid's saved views, and the dialogs that name and delete them.
  views: { saved: SavedViews; dialogs: ReactNode };
  // Choices of which rows the grid shows, first in the Views menu.
  viewChoices?: readonly ViewChoice[];
}) {
  // The month the count is for, which only the count listens for, so scrolling never redraws the
  // table; the current month, where the grid opens, until the strip says otherwise.
  const [countedMonth] = useState(() =>
    valueStore<string>((kept, next) => kept === next, monthOf(now)),
  );
  const countedTable = useMemo(
    () => (table === undefined ? undefined : countedAsPeople(table)),
    [table],
  );
  const count = useCallback(
    (rows: readonly Rec[], shown?: readonly Rec[]) => (
      <CountInView rows={rows} shown={shown} month={countedMonth} />
    ),
    [countedMonth],
  );
  if (reads.some(({ isError }) => isError)) {
    return (
      <LoadProblem
        what={what}
        onRetry={() => {
          for (const read of reads) {
            if (read.isError) void read.refetch();
          }
        }}
      />
    );
  }
  if (table === undefined || countedTable === undefined) {
    return (
      <Center p="xl">
        <Loader aria-label="Loading" />
      </Center>
    );
  }
  return (
    <TableTips>
      <RecordGrid
        records={records}
        table={countedTable}
        count={count}
        countNarrowed={count}
        fields={[]}
        order={[]}
        lists={[]}
        canEdit={canEdit}
        canAdd={false}
        rowActions={false}
        canEditColumns={false}
        actions={actions}
        view={view}
        onView={onView}
        saved={views.saved}
        viewChoices={viewChoices}
        opensAtColumn={scrollTargetFor(monthOf(now), range.from)}
        withDrafts
        columnBorders
        above={() => (
          <MonthStrip
            range={range}
            now={now}
            onCountedMonth={countedMonth.set}
          />
        )}
      />
      {views.dialogs}
    </TableTips>
  );
}

// Both grids count people and planned hires alike.
function countedAsPeople<Rec extends MonthRow>(
  table: RecordTable<Rec, CellChange, CellChange>,
): RecordTable<Rec, CellChange, CellChange> {
  return {
    ...table,
    countKinds: peopleAndHires((row: Rec) => row.plannedHire === true),
  };
}

type Counted = Pick<MonthRow, "outside" | "plannedHire">;

// What both grids count in a month: the people employed then and the planned hires expected by
// then, of all the rows and, while something narrows them, of those shown, as the rows stay put
// while the month changes.
export function monthGridCount(
  month: string,
  rows: readonly Counted[],
  shown?: readonly Counted[],
): string {
  const inMonth = (some: readonly Counted[]) =>
    some.filter((row) => !row.outside.has(month));
  return monthCount(
    formatMonth(month),
    (row: Counted) => row.plannedHire === true,
    inMonth(rows),
    shown === undefined ? undefined : inMonth(shown),
  );
}

function CountInView({
  rows,
  shown,
  month,
}: {
  rows: readonly MonthRow[];
  shown?: readonly MonthRow[] | undefined;
  month: ValueStore<string, string>;
}) {
  const counted = useSyncExternalStore(month.subscribe, month.get);
  return monthGridCount(counted, rows, shown);
}

// Where each month's column is in the table, from its heading.
function monthPlaces(box: HTMLElement, months: readonly string[]) {
  const headings = new Map(
    [...box.querySelectorAll<HTMLElement>("th[data-column]")].map((heading) => [
      heading.dataset.column,
      heading,
    ]),
  );
  return months.flatMap((month) => {
    const heading = headings.get(month);
    return heading === undefined
      ? []
      : [{ key: month, left: heading.offsetLeft, width: heading.offsetWidth }];
  });
}

interface OnScreen {
  months: string[];
  scrolled: number;
  furthest: number;
  // How far the grid was scrolled when first laid out, where it opens.
  opened: number | undefined;
  // The month the count is for, as the grid scrolls by hand.
  counted: string | undefined;
}

// The grid's months whose columns are on screen, and how far it is scrolled, read from the table
// at most once a frame as it scrolls, resizes or its columns change.
function useOnScreen(months: readonly string[], scroll: TableScroll) {
  const [onScreen, setOnScreen] = useState<OnScreen>({
    months: [],
    scrolled: 0,
    furthest: 0,
    opened: undefined,
    counted: undefined,
  });
  const { box, frozenWidth } = scroll;
  useLayoutEffect(() => {
    let stop: (() => void) | undefined;
    let watched = true;
    // Once the table has its scrolling box, which it gets after the strip's effects run, and has
    // scrolled to where it opens, in its own layout effect, but before the browser paints, so what
    // is in view shows in the first drawing.
    queueMicrotask(() => {
      const scroller = box();
      if (!watched || scroller === null) return;
      const measure = () => {
        const places = monthPlaces(scroller, months);
        const next = {
          months: columnsOnScreen(places, {
            scrolled: scroller.scrollLeft,
            room: scroller.clientWidth,
            frozenWidth,
          }),
          counted: countedColumn(places, {
            scrolled: scroller.scrollLeft,
            frozenWidth,
          }),
          scrolled: scroller.scrollLeft,
          furthest: scroller.scrollWidth - scroller.clientWidth,
        };
        setOnScreen((before) =>
          before.opened !== undefined &&
          before.scrolled === next.scrolled &&
          before.furthest === next.furthest &&
          before.months.join() === next.months.join() &&
          before.counted === next.counted
            ? before
            : { ...next, opened: before.opened ?? next.scrolled },
        );
      };
      // Then at most once a frame, once the browser has laid the table out to draw it, so moving
      // from cell to cell never makes it lay the whole table out again.
      let frame = 0;
      const soon = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
      };
      flushSync(measure);
      scroller.addEventListener("scroll", soon);
      const watching = new ResizeObserver(soon);
      watching.observe(scroller);
      watching.observe(scroller.querySelector("table") as HTMLTableElement);
      stop = () => {
        cancelAnimationFrame(frame);
        scroller.removeEventListener("scroll", soon);
        watching.disconnect();
      };
    });
    return () => {
      watched = false;
      stop?.();
    };
  }, [box, months, frozenWidth]);
  return onScreen;
}

// The strip of the grid's quarters: a quarter chosen, or reached by an arrow, is scrolled to just
// after the frozen columns and selected until the grid moves elsewhere; Today goes back to the
// current month. Drawn again only when its months, today or the table's scrolling change, not each
// time the grid is, such as when focus moves from cell to cell.
const MonthStrip = memo(function MonthStrip({
  range,
  now,
  onCountedMonth,
}: {
  range: MonthRange;
  now: string;
  onCountedMonth: (month: string) => void;
}) {
  const scroll = useTableScroll();
  const months = useMemo(
    () => monthsBetween(range.from, range.to),
    [range.from, range.to],
  );
  const quarters = useMemo(() => monthQuarters(months), [months]);
  const onScreen = useOnScreen(months, scroll);
  const current = quarters.find(({ months: held }) =>
    held.includes(monthOf(now)),
  )?.start;
  // The quarter last chosen, the month the grid was moved to, and where the grid then was. The grid
  // opens at the current month, as Today goes back to it, so the current quarter is chosen from the
  // first, until the grid moves from where it opened.
  const [chosen, setChosen] = useState<
    { key: string; month: string; left: number | undefined } | undefined
  >(() =>
    current === undefined
      ? undefined
      : { key: current, month: monthOf(now), left: undefined },
  );
  // Where the grid was when the quarter was chosen, or, for the one chosen as it opens, where it
  // opened, once known.
  const chosenLeft = chosen?.left ?? onScreen.opened;
  const stillThere =
    chosen !== undefined &&
    (chosenLeft === undefined ||
      stillChosen(
        { key: chosen.key, left: chosenLeft },
        chosen.key,
        onScreen.scrolled,
      ));
  // The month the count is for: the one the grid was moved to while it stays there, even where its
  // end keeps that month from showing second, or else the one in view as it scrolls by hand.
  const counted = stillThere ? chosen.month : onScreen.counted;
  useLayoutEffect(() => {
    if (counted !== undefined) onCountedMonth(counted);
  }, [onCountedMonth, counted]);
  // Its heading is filled as the strip's chosen quarter is; marked on the heading itself, so
  // scrolling never redraws the table.
  useLayoutEffect(() => {
    const heading =
      counted === undefined
        ? null
        : scroll
            .box()
            ?.querySelector<HTMLElement>(`th[data-column="${counted}"]`);
    heading?.setAttribute("data-counted", "");
    return () => {
      heading?.removeAttribute("data-counted");
    };
  }, [counted, scroll, onScreen]);
  const goTo = (month: string, quarter: string) => {
    scroll.scrollTo(scrollTargetFor(month, range.from));
    const left = (scroll.box() as HTMLDivElement).scrollLeft;
    setChosen({ key: quarter, month, left });
  };
  // The arrows step from the month the count is for.
  const { previous, next } = quarterSteps(quarters, counted ?? monthOf(now));
  const stepTo = (quarter: MonthQuarter) => {
    goTo(quarter.months[0], quarter.start);
  };
  return (
    <TimelineStrip
      words={quarterWords}
      periods={quarters.map((quarter) => ({
        ...quarterPeriod(
          quarter,
          (month) => onScreen.months.includes(month),
          monthOf(now),
        ),
        onChoose: () => {
          stepTo(quarter);
        },
        selected: stillThere && chosen.key === quarter.start,
      }))}
      onPrevious={
        previous &&
        (() => {
          stepTo(previous);
        })
      }
      onNext={
        next &&
        (() => {
          stepTo(next);
        })
      }
      onToday={() => {
        goTo(monthOf(now), current ?? monthOf(now));
      }}
    />
  );
});
