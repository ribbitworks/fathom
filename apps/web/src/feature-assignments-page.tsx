// SPDX-License-Identifier: Apache-2.0

// The Feature assignments page: people as rows and months as columns, each cell holding the feature
// teams someone is on that month, as approved, and as drafted for those who see drafts, changed by
// those who may propose team changes.

import { Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MonthGrid, type MonthGridProps } from "./month-grid.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { activeGrouping, type View } from "./table-view.ts";
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
  byManager,
  editsTeams,
  changesDates,
  view,
  onView,
}: {
  // Whether the reader may group rows by manager, which shows later months' managers.
  byManager: boolean;
  editsTeams: boolean;
  // Whether the reader may change Personal details, and so months before the current one.
  changesDates: boolean;
  view: View;
  onView: (view: View, replace?: boolean) => void;
}) {
  const [now] = useState(today);
  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader title="Feature assignments" />
      <TeamsGrid
        byManager={byManager}
        editsTeams={editsTeams}
        changesDates={changesDates}
        now={now}
        view={view}
        onView={onView}
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
}: MonthGridProps & { editsTeams: boolean; changesDates: boolean }) {
  const [range] = useState(() => gridMonthsAround(now));
  const query = useQuery(teamMonthsQuery(range));
  const actions = useTeamMonthActions(range, now);
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
      view={view}
      onView={onView}
    />
  );
}
