// SPDX-License-Identifier: Apache-2.0

// Capacity's Feature teams: people as rows and months as columns, each cell holding the feature
// teams someone is on that month, as approved, and as drafted for those who see drafts, changed by
// those who may propose team changes.

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MonthGrid, type MonthGridProps } from "./month-grid.tsx";
import { orgChartQuery } from "./org-chart.ts";
import { hireRows, monthManagers } from "./planned-hire-months.ts";
import { useSavedViews } from "./saved-views.tsx";
import { activeGrouping } from "./table-view.ts";
import {
  gridMonthsAround,
  teamMonthRecords,
  teamMonthsQuery,
  teamMonthsTable,
  useTeamMonthActions,
} from "./team-months.tsx";

export function CapacityFeatureTeams({
  byManager,
  seesHires,
  editsTeams,
  changesDates,
  now,
  view,
  onView,
  applied,
  onApply,
  canShareViews,
}: MonthGridProps & {
  // Whether the reader sees planned hires, each a row of its own.
  seesHires: boolean;
  editsTeams: boolean;
  // Whether the reader may change Personal details, and so months before the current one.
  changesDates: boolean;
}) {
  const [range] = useState(() => gridMonthsAround(now));
  const read = teamMonthsQuery(range);
  const query = useQuery(read);
  const views = useSavedViews({
    table: "feature-assignments",
    within: read.queryKey,
    view,
    applied,
    onApply,
    canShare: canShareViews,
  });
  const actions = useTeamMonthActions(range, now, views.opened);
  const chartRead = useQuery({ ...orgChartQuery, enabled: seesHires });
  const { data } = query;
  const chart = chartRead.data;
  const loaded = data !== undefined && (!seesHires || chart !== undefined);
  const table = useMemo(
    () =>
      !loaded
        ? undefined
        : teamMonthsTable(
            data,
            view.show,
            { today: now, changesDates },
            byManager ? monthManagers(data, chart) : undefined,
          ),
    [loaded, data, chart, view.show, now, changesDates, byManager],
  );
  const grouping = activeGrouping(view, table?.groupings)?.key;
  const records = useMemo(
    () =>
      !loaded
        ? []
        : teamMonthRecords(
            data,
            grouping,
            view.show,
            chart === undefined ? [] : hireRows(chart, data.months),
          ),
    [loaded, data, chart, grouping, view.show],
  );
  return (
    <MonthGrid
      what="the feature teams"
      reads={[query, chartRead]}
      table={table}
      records={records}
      actions={actions}
      canEdit={editsTeams}
      now={now}
      range={range}
      view={view}
      onView={onView}
      views={views}
    />
  );
}
