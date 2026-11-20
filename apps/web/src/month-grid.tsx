// SPDX-License-Identifier: Apache-2.0

// The monthly grid of people by month, as Feature assignments' teams and Capacity's allocations show
// it, once what it reads has loaded, or what it shows until then, under the strip of quarters every
// view with time across it shares, following the grid as it scrolls.

import { type MonthRange, monthOf, monthsBetween } from "@fathom/shared";
import { Center, Loader } from "@mantine/core";
import type { UseQueryResult } from "@tanstack/react-query";
import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import type { CellChange } from "./cell-kinds.tsx";
import { LoadProblem } from "./load-problem.tsx";
import { type TableScroll, useTableScroll } from "./grid-layout.ts";
import { RecordGrid } from "./record-grid.tsx";
import type { RecordActions, RecordTable } from "./record-table.ts";
import type { SavedViews } from "./table-controls.tsx";
import type { View } from "./table-view.ts";
import { TableTips } from "./table-tips.tsx";
import {
  columnsOnScreen,
  type MonthQuarter,
  monthQuarters,
  quarterSteps,
} from "./month-strip.ts";
import type { MonthRow } from "./team-months.tsx";
import {
  edgeTolerance,
  quarterWords,
  stillChosen,
  TimelineStrip,
} from "./timeline-strip.tsx";

// What a page gives the grid it shows.
export interface MonthGridProps {
  // Whether the reader may group rows by manager, which shows later months' managers.
  byManager: boolean;
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
}) {
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
  if (table === undefined) {
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
        table={table}
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
        opensAtColumn={monthOf(now)}
        withDrafts
        columnBorders
        above={() => <MonthStrip range={range} now={now} />}
      />
      {views.dialogs}
    </TableTips>
  );
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
}

// The grid's months whose columns are on screen, and how far it is scrolled, read from the table
// at most once a frame as it scrolls, resizes or its columns change.
function useOnScreen(months: readonly string[], scroll: TableScroll) {
  const [onScreen, setOnScreen] = useState<OnScreen>({
    months: [],
    scrolled: 0,
    furthest: 0,
  });
  const { box, frozenWidth } = scroll;
  useEffect(() => {
    // Drawn by the time its effects run, as the strip is drawn inside the table.
    const scroller = box() as HTMLDivElement;
    const measure = () => {
      const next = {
        months: columnsOnScreen(monthPlaces(scroller, months), {
          scrolled: scroller.scrollLeft,
          room: scroller.clientWidth,
          frozenWidth,
        }),
        scrolled: scroller.scrollLeft,
        furthest: scroller.scrollWidth - scroller.clientWidth,
      };
      setOnScreen((before) =>
        before.scrolled === next.scrolled &&
        before.furthest === next.furthest &&
        before.months.join() === next.months.join()
          ? before
          : next,
      );
    };
    // Once the browser has laid the table out to draw it, at most once a frame, so moving from cell
    // to cell never makes it lay the whole table out again.
    let frame = 0;
    const soon = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    soon();
    scroller.addEventListener("scroll", soon);
    const watching = new ResizeObserver(soon);
    watching.observe(scroller);
    watching.observe(scroller.querySelector("table") as HTMLTableElement);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", soon);
      watching.disconnect();
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
}: {
  range: MonthRange;
  now: string;
}) {
  const scroll = useTableScroll();
  const months = useMemo(
    () => monthsBetween(range.from, range.to),
    [range.from, range.to],
  );
  const quarters = useMemo(() => monthQuarters(months), [months]);
  const onScreen = useOnScreen(months, scroll);
  // The quarter last chosen, and where the grid then was.
  const [chosen, setChosen] = useState<{ key: string; left: number }>();
  const goTo = (month: string, quarter: string | undefined) => {
    scroll.scrollTo(month);
    const left = (scroll.box() as HTMLDivElement).scrollLeft;
    setChosen(quarter === undefined ? undefined : { key: quarter, left });
  };
  const firstOnScreen = onScreen.months.at(0) ?? monthOf(now);
  const { previous, next } = quarterSteps(quarters, firstOnScreen);
  const stepTo = (quarter: MonthQuarter) => {
    goTo(quarter.months[0], quarter.start);
  };
  return (
    <TimelineStrip
      words={quarterWords}
      periods={quarters.map((quarter) => ({
        key: quarter.start,
        onChoose: () => {
          stepTo(quarter);
        },
        label: quarter.label,
        short: quarter.short,
        weight: quarter.months.length,
        inView: quarter.months.some((month) => onScreen.months.includes(month)),
        selected: stillChosen(chosen, quarter.start, onScreen.scrolled),
        current: quarter.months.includes(monthOf(now)),
      }))}
      onPrevious={
        previous === undefined || onScreen.scrolled <= edgeTolerance
          ? undefined
          : () => {
              stepTo(previous);
            }
      }
      onNext={
        next === undefined ||
        onScreen.scrolled >= onScreen.furthest - edgeTolerance
          ? undefined
          : () => {
              stepTo(next);
            }
      }
      onToday={() => {
        goTo(monthOf(now), undefined);
      }}
    />
  );
});
