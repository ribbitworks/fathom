// SPDX-License-Identifier: Apache-2.0

// The Feature assignments page: people as rows and months as columns, each cell holding, in Teams
// mode, the feature teams someone is on that month, changed by those who may propose team changes,
// or, in Allocations mode, read only, the features they are allocated to; each as approved, and as
// drafted for those who see drafts. A switch picks the mode, and changing it keeps the view, apart
// from the months' filters, which pick teams in one mode and features in the other.

import { monthOf, monthSchema } from "@fathom/shared";
import {
  Center,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Tooltip,
  VisuallyHidden,
} from "@mantine/core";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  allocationManagers,
  allocationMonthRecords,
  allocationMonthsTable,
  allocationsQuery,
} from "./allocation-months.tsx";
import type { CellChange } from "./cell-kinds.tsx";
import { LoadProblem } from "./load-problem.tsx";
import { orgChartQuery } from "./org-chart.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import {
  type RecordActions,
  RecordGrid,
  type RecordTable,
} from "./record-grid.tsx";
import { activeGrouping, type View, withoutFilters } from "./table-view.ts";
import { TableTips } from "./table-tips.tsx";
import {
  gridMonthsAround,
  type MonthRow,
  readOnlyMonthActions,
  teamMonthRecords,
  teamMonthsQuery,
  teamMonthsTable,
  useTeamMonthActions,
} from "./team-months.tsx";
import { today } from "./today.ts";

export const gridModeSchema = z.enum(["teams", "allocations"]);

export type GridMode = z.infer<typeof gridModeSchema>;

const modeLabels: Record<GridMode, string> = {
  teams: "Teams",
  allocations: "Allocations",
};

const unseenAllocations = "This role doesn't see allocations";

const withoutMonthFilters = (view: View): View =>
  withoutFilters(view, (key) => !monthSchema.safeParse(key).success);

export function FeatureAssignmentsPage({
  seesPeople,
  seesAllocations,
  proposesTeams,
  changesDates,
  mode: asked,
  onMode,
  view,
  onView,
}: {
  seesPeople: boolean;
  seesAllocations: boolean;
  proposesTeams: boolean;
  // Whether the reader may change Personal details, and so months before the current one.
  changesDates: boolean;
  mode: GridMode;
  onMode: (mode: GridMode, view: View) => void;
  view: View;
  onView: (view: View, replace?: boolean) => void;
}) {
  const [now] = useState(today);
  const mode = seesAllocations ? asked : "teams";
  const grid = { seesPeople, now, view, onView };
  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader title="Feature assignments" />
      <Group>
        <SegmentedControl
          aria-label="What the table shows"
          size="xs"
          value={mode}
          onChange={(next) => {
            onMode(gridModeSchema.parse(next), withoutMonthFilters(view));
          }}
          data={[
            { value: "teams", label: modeLabels.teams },
            seesAllocations
              ? { value: "allocations", label: modeLabels.allocations }
              : {
                  value: "allocations",
                  label: (
                    <Tooltip label={unseenAllocations}>
                      <span>
                        {modeLabels.allocations}
                        <VisuallyHidden>. {unseenAllocations}</VisuallyHidden>
                      </span>
                    </Tooltip>
                  ),
                  disabled: true,
                },
          ]}
        />
      </Group>
      {mode === "teams" ? (
        <TeamsGrid
          {...grid}
          proposesTeams={proposesTeams}
          changesDates={changesDates}
        />
      ) : (
        <AllocationsGrid {...grid} />
      )}
    </Stack>
  );
}

interface GridProps {
  seesPeople: boolean;
  now: string;
  view: View;
  onView: (view: View, replace?: boolean) => void;
}

function TeamsGrid({
  seesPeople,
  proposesTeams,
  changesDates,
  now,
  view,
  onView,
}: GridProps & { proposesTeams: boolean; changesDates: boolean }) {
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
    <MonthGrid
      reads={[query]}
      table={table}
      records={records}
      actions={actions}
      canEdit={proposesTeams}
      now={now}
      view={view}
      onView={onView}
      withDrafts={seesPeople}
    />
  );
}

function AllocationsGrid({ seesPeople, now, view, onView }: GridProps) {
  const [range] = useState(() => gridMonthsAround(now));
  const monthsRead = useQuery(teamMonthsQuery(range));
  const allocationsRead = useQuery(allocationsQuery);
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
            managers: allocationManagers(sources.teamMonths, sources.chart),
            seesPeople,
            currentMonth,
            show: view.show,
          }),
    [sources, seesPeople, currentMonth, view.show],
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
      reads={[monthsRead, allocationsRead, chartRead]}
      table={table}
      records={records}
      actions={readOnlyMonthActions}
      canEdit={false}
      now={now}
      view={view}
      onView={onView}
      withDrafts
    />
  );
}

// The grid of either mode once what it reads has loaded, or what it shows until then.
function MonthGrid<Rec extends MonthRow>({
  reads,
  table,
  records,
  actions,
  canEdit,
  now,
  view,
  onView,
  withDrafts,
}: {
  reads: readonly Pick<UseQueryResult, "isError" | "refetch">[];
  table: RecordTable<Rec, CellChange, CellChange> | undefined;
  records: Rec[];
  actions: RecordActions<Rec, CellChange, CellChange>;
  canEdit: boolean;
  now: string;
  view: View;
  onView: (view: View, replace?: boolean) => void;
  withDrafts: boolean;
}) {
  if (reads.some(({ isError }) => isError)) {
    return (
      <LoadProblem
        what="the feature assignments"
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
        opensAtColumn={monthOf(now)}
        withDrafts={withDrafts}
      />
    </TableTips>
  );
}
