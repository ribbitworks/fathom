// SPDX-License-Identifier: Apache-2.0

// Capacity's Coverage: each work as a row, its effort needed, the hours allocated to it and what is
// left, then each month's hours allocated of those needed, read only.

import { monthOf, monthsBetween } from "@fathom/shared";
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
import { planChoicesQuery, projectPlanQuery } from "./projects.ts";
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

// What is left of a work's effort, or Over, in red, and how far its allocations go past it.
function Remaining({ remaining }: { remaining: number }) {
  return remaining < 0 ? (
    <span className={styles.marked}>Over +{hours(-remaining)}</span>
  ) : (
    hours(remaining)
  );
}

// A month's hours: allocated of needed, or allocated alone where nothing more is needed, as in a
// past month, for work with no effort, or once earlier months have covered its effort.
function monthCell(row: CoverageRow, month: string): ReactNode {
  const covered = row.coverage.months.find((one) => one.month === month);
  if (covered === undefined) return null;
  return covered.needed === undefined || Math.round(covered.needed) === 0
    ? hours(covered.allocated)
    : `${count(Math.round(covered.allocated))} of ${hours(covered.needed)}`;
}

const numberColumn = (
  key: string,
  label: string,
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
  readOnly: true,
  frozenAtFirst: true,
});

export const coverageTeamKey = "featureTeam";

// The table: each work, frozen on the left with its effort, allocated hours and what is left, then a
// column for each month the grid holds.
export function coverageTable({
  months,
  currentMonth,
  teams,
  onFeature,
}: {
  months: readonly string[];
  currentMonth: string;
  teams: readonly { id: string; name: string }[];
  onFeature: (id: string) => void;
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
      readOnly: true,
      frozenAtFirst: true,
    },
    numberColumn(
      "effort",
      "Effort",
      (row) => row.effort,
      (row) => (row.effort === undefined ? null : hours(row.effort)),
    ),
    numberColumn(
      "allocated",
      "Allocated",
      (row) => row.allocated,
      (row) => hours(row.allocated),
    ),
    numberColumn(
      "remaining",
      "Remaining",
      (row) => row.remaining,
      (row) =>
        row.remaining === undefined ? null : (
          <Remaining remaining={row.remaining} />
        ),
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
      value: (row) =>
        numberValue(
          row.coverage.months.find((one) => one.month === month)?.allocated,
        ),
      content: (row) => monthCell(row, month),
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
    hasDetails: (row) => row.feature !== undefined,
    showDetails: (row) => {
      onFeature(row.id);
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
  onFeature,
}: Omit<MonthGridProps, "byManager"> & { onFeature: (id: string) => void }) {
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
            onFeature,
          }),
    [teamMonths, months, currentMonth, onFeature],
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
