// SPDX-License-Identifier: Apache-2.0

// The Feature assignments page: people as rows and months as columns, each cell holding the feature
// teams someone is on that month, as approved, and as drafted for those who see drafts, changed by
// those who may propose team changes.

import { Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MonthGrid, type MonthGridProps } from "./month-grid.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { activeGrouping } from "./table-view.ts";
import {
  gridMonthsAround,
  peopleManagers,
  teamMonthRecords,
  teamMonthsQuery,
  teamMonthsTable,
  useTeamMonthActions,
} from "./team-months.tsx";
import { today } from "./today.ts";

export function FeatureAssignmentsPage({
  editsTeams,
  changesDates,
  ...grid
}: Omit<MonthGridProps, "now"> & {
  editsTeams: boolean;
  // Whether the reader may change Personal details, and so months before the current one.
  changesDates: boolean;
}) {
  const [now] = useState(today);
  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader title="Feature assignments" />
      <TeamsGrid
        editsTeams={editsTeams}
        changesDates={changesDates}
        now={now}
        {...grid}
      />
    </Stack>
  );
}

function TeamsGrid({
  byManager,
  editsTeams,
  changesDates,
  now,
  view,
  onView,
  applied,
  onApply,
  canShareViews,
}: MonthGridProps & { editsTeams: boolean; changesDates: boolean }) {
  const [range] = useState(() => gridMonthsAround(now));
  const read = teamMonthsQuery(range);
  const query = useQuery(read);
  const views = useSavedViews({
    table: "feature-assignments",
    within: read.queryKey,
    applied,
    onApply,
    canShare: canShareViews,
  });
  const actions = useTeamMonthActions(range, now, views.opened);
  const { data } = query;
  const table = useMemo(
    () =>
      data === undefined
        ? undefined
        : teamMonthsTable(
            data,
            view.show,
            { today: now, changesDates },
            byManager ? peopleManagers(data) : undefined,
          ),
    [data, view.show, now, changesDates, byManager],
  );
  const grouping = activeGrouping(view, table?.groupings)?.key;
  const records = useMemo(
    () =>
      data === undefined ? [] : teamMonthRecords(data, grouping, view.show),
    [data, grouping, view.show],
  );
  return (
    <MonthGrid
      what="the feature assignments"
      reads={[query]}
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
