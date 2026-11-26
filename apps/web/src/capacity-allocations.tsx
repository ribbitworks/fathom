// SPDX-License-Identifier: Apache-2.0

// Capacity's Allocations: people and planned hires as rows and months as columns, each cell holding,
// read only, the features someone is allocated to that month, as approved, and as drafted for those
// who see drafts, with each group's capacity and the whole organization's.

import { type LoadMark, monthOf } from "@fathom/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  allocatedWork,
  allocationMonthRecords,
  allocationMonthsTable,
  allocationsQuery,
  type AllocationRow,
  namedIn,
  marksFrom,
} from "./allocation-months.tsx";
import { allocatedToGrouping } from "./allocation-groups.ts";
import { MonthGrid, type MonthGridProps } from "./month-grid.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { orgChartQuery } from "./org-chart.ts";
import { monthManagers } from "./planned-hire-months.ts";
import { activeGrouping, emptyView } from "./table-view.ts";
import { keptByChoices, namedChoice } from "./view-choices.ts";
import {
  gridMonthsAround,
  readOnlyMonthActions,
  teamMonthsQuery,
} from "./team-months.tsx";

const overChoice = namedChoice("over");
const underChoice = namedChoice("under");

// Over and Under, each keeping the rows whose cells show it from the current month on.
const loadChoices = (
  marks: ReadonlyMap<AllocationRow, ReadonlySet<LoadMark>>,
) =>
  (
    [
      [overChoice, "Over", "over"],
      [underChoice, "Under", "under"],
    ] as const
  ).map(([choice, label, mark]) => ({
    choice,
    label,
    matches: (row: AllocationRow) => marks.get(row)?.has(mark) === true,
  }));

export function CapacityAllocations({
  byManager,
  groupsByWork = false,
  now,
  view,
  onView,
  applied,
  onApply,
  canShareViews,
}: MonthGridProps) {
  const [range] = useState(() => gridMonthsAround(now));
  const monthsRead = useQuery(teamMonthsQuery(range));
  const allocationsRead = useQuery(allocationsQuery);
  const views = useSavedViews({
    table: "capacity",
    within: allocationsQuery.queryKey,
    view,
    applied,
    onApply,
    canShare: canShareViews,
  });
  const chartRead = useQuery(orgChartQuery);
  const teamMonths = monthsRead.data;
  const allocations = allocationsRead.data;
  const chart = chartRead.data;
  const currentMonth = monthOf(now);
  // Grouped by what each is allocated to, which only a reader offered it can be.
  const byWork = groupsByWork && view.grouping === allocatedToGrouping;
  const show = view.show;
  // The work named as the Draft view shows it, for the rows and the filter alike.
  const sources = useMemo(
    () =>
      teamMonths === undefined ||
      allocations === undefined ||
      chart === undefined
        ? undefined
        : {
            teamMonths,
            allocations: namedIn(allocations, show),
            chart,
          },
    [teamMonths, allocations, chart, show],
  );
  const table = useMemo(
    () =>
      sources === undefined
        ? undefined
        : allocationMonthsTable({
            teamMonths: sources.teamMonths,
            works: allocatedWork(sources.allocations),
            allocations: sources.allocations.allocations,
            managers: byManager
              ? monthManagers(sources.teamMonths, sources.chart)
              : undefined,
            currentMonth,
            show: view.show,
            byWork,
            offersWork: groupsByWork,
          }),
    [sources, byManager, currentMonth, view.show, byWork, groupsByWork],
  );
  const grouping = activeGrouping(view, table?.groupings)?.key;
  const records = useMemo(
    () =>
      sources === undefined
        ? []
        : allocationMonthRecords({ ...sources, grouping, show: view.show }),
    [sources, grouping, view.show],
  );
  // Each row's marks, worked out once for both choices and kept while the view changes otherwise.
  // A row for one feature holds part of someone's month, so it takes the marks of their whole row.
  const marks = useMemo(() => {
    if (sources === undefined) return new Map<AllocationRow, Set<LoadMark>>();
    const marksOf = (row: AllocationRow) =>
      marksFrom(row, sources.teamMonths.months, currentMonth, view.show);
    const wholeRows = byWork
      ? new Map(
          allocationMonthRecords({
            ...sources,
            grouping: undefined,
            show: view.show,
          }).map((row) => [row.personId, marksOf(row)]),
        )
      : undefined;
    return new Map(
      records.map((row) => [
        row,
        wholeRows === undefined
          ? marksOf(row)
          : // Everyone with a row has a whole row too.
            (wholeRows.get(row.personId) as ReadonlySet<LoadMark>),
      ]),
    );
  }, [sources, records, currentMonth, view.show, byWork]);
  const overOn = overChoice.on(view);
  const underOn = underChoice.on(view);
  const kept = useMemo(
    () =>
      keptByChoices({
        rows: records,
        choices: loadChoices(marks),
        // The view as far as the choices read it, so the rows stay the same while the rest changes.
        view: overChoice.turned(underChoice.turned(emptyView, underOn), overOn),
      }),
    [records, marks, overOn, underOn],
  );
  return (
    <MonthGrid
      what="the allocations"
      reads={[monthsRead, allocationsRead, chartRead]}
      table={table}
      records={kept.rows}
      viewChoices={kept.choices}
      actions={readOnlyMonthActions}
      canEdit={false}
      now={now}
      range={range}
      view={view}
      onView={onView}
      views={views}
    />
  );
}
