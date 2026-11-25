// SPDX-License-Identifier: Apache-2.0

// Capacity's Coverage: each work's effort against the hours allocated to it, by month.

import { monthOf, monthsBetween } from "@fathom/shared";
import { Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import {
  allocationMonthRecords,
  allocationsQuery,
} from "./allocation-months.tsx";
import styles from "./allocation-lines.module.css";
import type { CellChange } from "./cell-kinds.tsx";
import { byChoice } from "./choice-grouping.ts";
import {
  type CoverageRow,
  coverageRows,
  deliveredByWork,
} from "./coverage-rows.ts";
import { cellColumn } from "./grid-columns.tsx";
import { MonthGrid, type MonthGridProps } from "./month-grid.tsx";
import { count } from "./numbers.ts";
import { orgChartQuery } from "./org-chart.ts";
import { twoKindsOfRow } from "./people-rows.ts";
import { liveRecordsBy, withLiveFields } from "./live-records.ts";
import {
  liveSettings,
  planningSettingsQuery,
  shownSettings as shownSettingsAs,
} from "./planning-settings.ts";
import {
  type PlanTab,
  planChoicesQuery,
  projectPlanQuery,
} from "./projects.ts";
import { noDrafts } from "./drafts.ts";
import {
  type Column,
  noRecordActions,
  readOnlyTableParts,
  type RecordTable,
} from "./record-table.ts";
import { releaseStreamsQuery } from "./releases.ts";
import { useSavedViews } from "./saved-views.tsx";
import {
  gridMonthsAround,
  monthColumnLook,
  teamMonthsQuery,
} from "./team-months.tsx";

const hours = (amount: number) => `${count(Math.round(amount))} h`;

// A number cell holds its number as text, and nothing as empty text.
const numberValue = (amount: number | undefined) =>
  amount === undefined ? "" : String(amount);

const coverageActions = noRecordActions<CoverageRow, CellChange, CellChange>();

const dimmed = (words: string) => (
  <Text component="span" inherit c="dimmed">
    {words}
  </Text>
);

// A work with no effort has no figure to show.
const orNone = (
  amount: number | undefined,
  shown: (amount: number) => ReactNode,
) => (amount === undefined ? dimmed("None") : shown(amount));

// What is left of a work's effort, or, in red, how far its allocations go past it, rounded first
// so a part of an hour over reads 0 h.
function Remaining({ remaining }: { remaining: number }) {
  const left = Math.round(remaining) || 0;
  return left < 0 ? (
    <Text component="span" inherit fw={600} className={styles.marked}>
      {`\u2212${hours(-left)}`}
    </Text>
  ) : (
    hours(left)
  );
}

// A month's hours: from the current month on, allocated of needed for a work with an effort, even
// once earlier months have covered it; a past month, which needs nothing more, or a work with no
// effort, the hours allocated alone, a past month's in grey, and none where none are.
function monthCell(
  row: CoverageRow,
  month: string,
  currentMonth: string,
): ReactNode {
  const covered = row.coverage.months.find((one) => one.month === month);
  if (covered === undefined) return null;
  if (covered.needed !== undefined) {
    return `${count(Math.round(covered.allocated))} of ${hours(covered.needed)}`;
  }
  if (Math.round(covered.allocated) === 0) return null;
  return month < currentMonth
    ? dimmed(hours(covered.allocated))
    : hours(covered.allocated);
}

const numberColumn = (
  key: string,
  label: string,
  chars: number,
  value: (row: CoverageRow) => number | undefined,
  content: (row: CoverageRow) => ReactNode,
): Column<CoverageRow, CellChange> => ({
  ...cellColumn<CoverageRow, CellChange>(key, "number", {
    label,
    required: false,
    choices: [],
    multiple: false,
  }),
  value: (row) => numberValue(value(row)),
  content,
  cellChars: chars,
  readOnly: true,
});

const frozen = (
  column: Column<CoverageRow, CellChange>,
): Column<CoverageRow, CellChange> => ({ ...column, frozenAtFirst: true });

export const coverageTeamKey = "featureTeam";

export type CoverageDetails = (
  tab: Extract<PlanTab, "features" | "projects">,
  id: string,
) => void;

// Wide enough for most works' names in full, the months still in view, and each figure for its
// heading and up to 99,999 h.
const workChars = 22;
const effortChars = 8;
const allocatedChars = 9;
const remainingChars = 10;

// The table: each work, frozen on the left with its effort and what is left, then its allocated
// hours, which the frozen columns have no room for beside a name in full, then a column for each
// month the grid holds.
export function coverageTable({
  months,
  currentMonth,
  teams,
  onDetails,
}: {
  months: readonly string[];
  currentMonth: string;
  teams: readonly { id: string; name: string; colour: string | null }[];
  onDetails: CoverageDetails;
}): RecordTable<CoverageRow, CellChange, CellChange> {
  const team: Column<CoverageRow, CellChange> = {
    ...cellColumn<CoverageRow, CellChange>(coverageTeamKey, "choice", {
      label: "Feature team",
      required: false,
      choices: teams.map(({ id, name }) => ({
        id,
        label: name,
        description: "",
        retired: false,
      })),
      multiple: false,
    }),
    value: (row) => {
      const teamId = row.feature?.featureTeamId;
      return teamId === undefined || teamId === null ? [] : [teamId];
    },
    readOnly: true,
    hiddenAtFirst: true,
  };
  const columns: Column<CoverageRow, CellChange>[] = [
    {
      ...cellColumn<CoverageRow, CellChange>("name", "text", {
        label: "Work",
        required: true,
        choices: [],
        multiple: false,
      }),
      value: (row) => row.name,
      cellChars: workChars,
      colour: (row) =>
        teams.find(({ id }) => id === row.feature?.featureTeamId)?.colour ??
        null,
      readOnly: true,
      frozenAtFirst: true,
    },
    frozen(
      numberColumn(
        "effort",
        "Effort",
        8,
        (row) => row.effort,
        (row) => orNone(row.effort, hours),
      ),
    ),
    frozen(
      numberColumn(
        "remaining",
        "Remaining",
        10,
        (row) => row.remaining,
        (row) =>
          orNone(row.remaining, (remaining) => (
            <Remaining remaining={remaining} />
          )),
      ),
    ),
    numberColumn(
      "allocated",
      "Allocated",
      allocatedChars,
      (row) => row.allocated,
      (row) => hours(row.allocated),
    ),
    team,
    ...months.map((month): Column<CoverageRow, CellChange> => ({
      ...cellColumn<CoverageRow, CellChange>(month, "number", {
        label: "",
        required: false,
        choices: [],
        multiple: false,
      }),
      ...monthColumnLook(month, currentMonth),
      centred: true,
      value: (row) =>
        numberValue(
          row.coverage.months.find((one) => one.month === month)?.allocated,
        ),
      content: (row) => monthCell(row, month, currentMonth),
      readOnly: true,
    })),
  ];
  return {
    ...readOnlyTableParts,
    label: "Coverage",
    one: "work",
    noun: "work",
    counted: twoKindsOfRow(
      { one: "feature", many: "features" },
      { one: "project", many: "projects" },
      (row: CoverageRow) => row.feature === undefined,
    ),
    nameOf: (row) => row.name,
    nameColumn: "name",
    columnsFor: () => columns,
    liveRecords: (rows) => [...rows],
    drafts: () => noDrafts(),
    groupings: [byChoice(team, { holds: "names" })],
    hasDetails: (row) =>
      row.feature !== undefined || row.projectId !== undefined,
    showDetails: (row) => {
      if (row.projectId === undefined) onDetails("features", row.id);
      else onDetails("projects", row.projectId);
    },
  };
}

export function CapacityCoverage({
  now,
  view,
  onView,
  applied,
  onApply,
  canShareViews,
  onDetails,
}: Omit<MonthGridProps, "byManager"> & { onDetails: CoverageDetails }) {
  const [range] = useState(() => gridMonthsAround(now));
  const monthsRead = useQuery(teamMonthsQuery(range));
  const allocationsRead = useQuery(allocationsQuery);
  const chartRead = useQuery(orgChartQuery);
  const planRead = useQuery(projectPlanQuery);
  const streamsRead = useQuery(releaseStreamsQuery);
  const settingsRead = useQuery(planningSettingsQuery);
  const choicesRead = useQuery(planChoicesQuery);
  const views = useSavedViews({
    table: "capacity-coverage",
    within: allocationsQuery.queryKey,
    view,
    applied,
    onApply,
    canShare: canShareViews,
  });
  const currentMonth = monthOf(now);
  const months = useMemo(() => monthsBetween(range.from, range.to), [range]);
  const teamMonths = monthsRead.data;
  const table = useMemo(
    () =>
      teamMonths === undefined
        ? undefined
        : coverageTable({
            months,
            currentMonth,
            teams: teamMonths.teams,
            onDetails,
          }),
    [teamMonths, months, currentMonth, onDetails],
  );
  const records = useMemo(() => {
    const allocations = allocationsRead.data;
    const chart = chartRead.data;
    const plan = planRead.data;
    const streams = streamsRead.data;
    const shownSettings = settingsRead.data;
    const choices = choicesRead.data;
    if (
      teamMonths === undefined ||
      allocations === undefined ||
      chart === undefined ||
      plan === undefined ||
      streams === undefined ||
      shownSettings === undefined ||
      choices === undefined
    ) {
      return [];
    }
    // The figures follow the Draft menu as Allocations' totals do: drafts only with drafts applied.
    const drafted = view.show === "drafts";
    const settings = drafted
      ? shownSettingsAs(shownSettings, "drafts")
      : liveSettings(shownSettings);
    const rows = allocationMonthRecords({
      teamMonths,
      allocations,
      chart,
      grouping: undefined,
      show: view.show,
    });
    return coverageRows({
      features: drafted
        ? plan.features
        : liveRecordsBy(plan.features, withLiveFields),
      projects: plan.projects,
      meanings: new Map(
        choices.featureStatuses.map(({ id, meaning }) => [id, meaning]),
      ),
      allocatedWork: allocations.features,
      streams: streams.streams,
      settings,
      delivered: deliveredByWork({
        rows,
        months: teamMonths.months,
        settings,
        show: view.show,
      }),
      currentMonth,
    });
  }, [
    teamMonths,
    allocationsRead.data,
    chartRead.data,
    planRead.data,
    streamsRead.data,
    settingsRead.data,
    choicesRead.data,
    view.show,
    currentMonth,
  ]);
  return (
    <MonthGrid
      what="the coverage"
      reads={[
        monthsRead,
        allocationsRead,
        chartRead,
        planRead,
        streamsRead,
        settingsRead,
        choicesRead,
      ]}
      table={table}
      records={records}
      actions={coverageActions}
      canEdit={false}
      now={now}
      range={range}
      view={view}
      onView={onView}
      views={views}
    />
  );
}
