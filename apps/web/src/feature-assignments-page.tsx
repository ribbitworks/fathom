// SPDX-License-Identifier: Apache-2.0

// The Feature assignments page: people as rows and months as columns, each cell holding the feature
// teams someone is on that month, as approved, and as drafted for those who see drafts, changed by
// those who may propose team changes. Allocations join as a second mode.

import { monthOf } from "@fathom/shared";
import { Center, Group, Loader, SegmentedControl, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LoadProblem } from "./load-problem.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { RecordGrid } from "./record-grid.tsx";
import { activeGrouping, type View } from "./table-view.ts";
import { TableTips } from "./table-tips.tsx";
import {
  gridMonthsAround,
  teamMonthRecords,
  teamMonthsQuery,
  teamMonthsTable,
  useTeamMonthActions,
} from "./team-months.tsx";
import { today } from "./today.ts";

export function FeatureAssignmentsPage({
  seesPeople,
  proposesTeams,
  changesDates,
  view,
  onView,
}: {
  seesPeople: boolean;
  proposesTeams: boolean;
  // Whether the reader may change Restricted details, and so months before the current one.
  changesDates: boolean;
  view: View;
  onView: (view: View, replace?: boolean) => void;
}) {
  const [now] = useState(today);
  const [range] = useState(() => gridMonthsAround(now));
  const query = useQuery(teamMonthsQuery(range));
  const actions = useTeamMonthActions(range, now);
  const { data } = query;
  const table = useMemo(
    () =>
      data === undefined
        ? undefined
        : teamMonthsTable(data, seesPeople, view.show, {
            today: now,
            changesDates,
          }),
    [data, seesPeople, view.show, now, changesDates],
  );
  const grouping = activeGrouping(view, table?.groupings)?.key;
  const records = useMemo(
    () =>
      data === undefined ? [] : teamMonthRecords(data, grouping, view.show),
    [data, grouping, view.show],
  );
  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader title="Feature assignments" />
      <Group>
        <SegmentedControl
          aria-label="What the table shows"
          size="xs"
          value="teams"
          data={[
            { value: "teams", label: "Teams" },
            {
              value: "allocations",
              label: "Allocations, later",
              disabled: true,
            },
          ]}
        />
      </Group>
      {query.isError ? (
        <LoadProblem
          what="the feature assignments"
          onRetry={() => void query.refetch()}
        />
      ) : table === undefined ? (
        <Center p="xl">
          <Loader aria-label="Loading" />
        </Center>
      ) : (
        <TableTips>
          <RecordGrid
            records={records}
            table={table}
            fields={[]}
            order={[]}
            lists={[]}
            canEdit={proposesTeams}
            canAdd={false}
            rowActions={false}
            canEditColumns={false}
            actions={actions}
            view={view}
            onView={onView}
            opensAtColumn={monthOf(now)}
            withDrafts={seesPeople}
          />
        </TableTips>
      )}
    </Stack>
  );
}
