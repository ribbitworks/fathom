// SPDX-License-Identifier: Apache-2.0

// Capacity's People mode: people and planned hires as rows and months as columns, each cell holding,
// read only, the features someone is allocated to that month, as approved, and as drafted for those
// who see drafts, with each group's capacity and the whole organization's.

import { monthOf } from "@fathom/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  allocationManagers,
  allocationMonthRecords,
  allocationMonthsTable,
  allocationsQuery,
} from "./allocation-months.tsx";
import { MonthGrid, type MonthGridProps } from "./month-grid.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { orgChartQuery } from "./org-chart.ts";
import { activeGrouping } from "./table-view.ts";
import {
  gridMonthsAround,
  readOnlyMonthActions,
  teamMonthsQuery,
} from "./team-months.tsx";

export function CapacityPeople({
  byManager,
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
    applied,
    onApply,
    canShare: canShareViews,
  });
  const chartRead = useQuery(orgChartQuery);
  const teamMonths = monthsRead.data;
  const allocations = allocationsRead.data;
  const chart = chartRead.data;
  const currentMonth = monthOf(now);
  const sources = useMemo(
    () =>
      teamMonths === undefined ||
      allocations === undefined ||
      chart === undefined
        ? undefined
        : { teamMonths, allocations, chart },
    [teamMonths, allocations, chart],
  );
  const table = useMemo(
    () =>
      sources === undefined
        ? undefined
        : allocationMonthsTable({
            teamMonths: sources.teamMonths,
            features: sources.allocations.features,
            managers: byManager
              ? allocationManagers(sources.teamMonths, sources.chart)
              : undefined,
            currentMonth,
            show: view.show,
          }),
    [sources, byManager, currentMonth, view.show],
  );
  const grouping = activeGrouping(view, table?.groupings)?.key;
  const records = useMemo(
    () =>
      sources === undefined
        ? []
        : allocationMonthRecords({ ...sources, grouping, show: view.show }),
    [sources, grouping, view.show],
  );
  return (
    <MonthGrid
      what="the allocations"
      reads={[monthsRead, allocationsRead, chartRead]}
      table={table}
      records={records}
      actions={readOnlyMonthActions}
      canEdit={false}
      now={now}
      view={view}
      onView={onView}
      views={views}
    />
  );
}
