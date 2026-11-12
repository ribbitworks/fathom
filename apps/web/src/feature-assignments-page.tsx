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
  peopleManagers,
  readOnlyMonthActions,
  teamMonthRecords,
  teamMonthsQuery,
  teamMonthsTable,
  useTeamMonthActions,
} from "./team-months.tsx";
import { today } from "./today.ts";
import { WhyMissing } from "./why-missing.tsx";

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
  whyMissing,
  whyNoManagerGrouping,
  seesAllocations,
  editsTeams,
  changesDates,
  mode: asked,
  onMode,
  view,
  onView,
}: {
  // Why the role does not get the page, when it does not see every class of data the page needs.
  whyMissing?: string | undefined;
  // Why the role may not group rows by manager, when it may not.
  whyNoManagerGrouping?: string | undefined;
  seesAllocations: boolean;
  editsTeams: boolean;
  // Whether the reader may change Personal details, and so months before the current one.
  changesDates: boolean;
  mode: GridMode;
  onMode: (mode: GridMode, view: View) => void;
  view: View;
  onView: (view: View, replace?: boolean) => void;
}) {
  const [now] = useState(today);
  const mode = seesAllocations ? asked : "teams";
  const grid = {
    byManager: whyNoManagerGrouping === undefined,
    now,
    view,
    onView,
  };
  if (whyMissing !== undefined) {
    return (
      <Stack gap="md">
        <PageHeader title="Feature assignments" />
        <WhyMissing why={whyMissing} />
      </Stack>
    );
  }
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
      {whyNoManagerGrouping !== undefined && (
        <WhyMissing why={whyNoManagerGrouping} />
      )}
      {mode === "teams" ? (
        <TeamsGrid
          {...grid}
          editsTeams={editsTeams}
          changesDates={changesDates}
        />
      ) : (
        <AllocationsGrid {...grid} />
      )}
    </Stack>
  );
}

interface GridProps {
  byManager: boolean;
  now: string;
  view: View;
  onView: (view: View, replace?: boolean) => void;
}

function TeamsGrid({
  byManager,
  editsTeams,
  changesDates,
  now,
  view,
  onView,
}: GridProps & { editsTeams: boolean; changesDates: boolean }) {
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
      reads={[query]}
      table={table}
      records={records}
      actions={actions}
      canEdit={editsTeams}
      now={now}
      view={view}
      onView={onView}
      withDrafts
    />
  );
}

function AllocationsGrid({ byManager, now, view, onView }: GridProps) {
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
