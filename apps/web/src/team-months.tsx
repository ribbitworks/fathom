// SPDX-License-Identifier: Apache-2.0

// Who is on which feature team, month by month, through the server's API, as a read-only table of
// records: a row for each person and a column for each month. Grouped by feature team, someone who
// was on two teams has a row under each.

import {
  addToMonth,
  byName,
  type MonthRange,
  monthOf,
  type TeamMonths,
  teamMonthsSchema,
} from "@fathom/shared";
import { VisuallyHidden } from "@mantine/core";
import { queryOptions } from "@tanstack/react-query";
import { getJson } from "./api.ts";
import type { CellChange } from "./cell-kinds.tsx";
import { noDrafts } from "./drafts.ts";
import {
  cellColumn,
  type CellRecord,
  type Column,
  type RecordActions,
  type RecordTable,
  type RowGrouping,
} from "./record-grid.tsx";
import { formatMonth } from "./table-view.ts";
import { TeamLabels } from "./team-labels.tsx";

type MonthTeam = TeamMonths["teams"][number];

export interface PersonMonths extends CellRecord {
  personId: string;
  name: string;
  manager: TeamMonths["people"][number]["manager"];
  // The feature team this row is grouped under, when grouped by feature team.
  group?: MonthTeam | undefined;
  teamsIn: ReadonlyMap<string, MonthTeam[]>;
  outside: ReadonlySet<string>;
}

type Table = RecordTable<PersonMonths, CellChange, CellChange>;

// Labels are in a smaller font than the table, so this fits about 20 of their letters.
const monthCellChars = 15;
const monthsBack = 12;
const monthsShown = 24;

export function gridMonthsAround(today: string): MonthRange {
  const month = monthOf(today);
  return {
    from: addToMonth(month, -monthsBack),
    to: addToMonth(month, monthsShown - monthsBack - 1),
  };
}

export const teamMonthsQuery = ({ from, to }: MonthRange) =>
  queryOptions({
    queryKey: ["team-months", from, to],
    queryFn: () =>
      getJson(
        `/api/feature-teams/months?from=${from}&to=${to}`,
        teamMonthsSchema,
      ),
  });

const lastRank = Number.MAX_SAFE_INTEGER;
const managerGrouping = "manager";
export const featureTeamGrouping = "feature-team";

const groupedByManager = (data: TeamMonths): RowGrouping<PersonMonths> => {
  const managers = [
    ...new Map(
      data.people.flatMap(({ manager }) =>
        manager === null ? [] : [[manager.id, manager] as const],
      ),
    ).values(),
  ].sort(byName);
  const ranks = new Map(managers.map(({ id }, rank) => [id, rank]));
  return {
    key: managerGrouping,
    label: "Manager",
    of: ({ manager }) =>
      manager === null
        ? { key: "no-manager", label: "No manager", rank: lastRank }
        : {
            key: manager.id,
            label: manager.name,
            // Every manager in the data is ranked above.
            rank: ranks.get(manager.id) as number,
          },
  };
};

const groupedByFeatureTeam = (data: TeamMonths): RowGrouping<PersonMonths> => {
  const ranks = new Map(
    [...data.teams].sort(byName).map(({ id }, rank) => [id, rank]),
  );
  return {
    key: featureTeamGrouping,
    label: "Feature team",
    of: ({ group }) =>
      group === undefined
        ? { key: "no-team", label: "No feature team", rank: lastRank }
        : {
            key: group.id,
            label: group.name,
            // Every team in the data is ranked above.
            rank: ranks.get(group.id) as number,
          },
  };
};

export function teamMonthsTable(data: TeamMonths, seesPeople: boolean): Table {
  const choices = [...data.teams].sort(byName).map(({ id, name }) => ({
    id,
    label: name,
    description: "",
    retired: false,
  }));
  const monthColumns = data.months.map(
    (month): Column<PersonMonths, CellChange> => ({
      ...cellColumn<PersonMonths, CellChange>(month, "choice", {
        label: formatMonth(month),
        required: false,
        choices,
        multiple: true,
      }),
      content: (person) => (
        <TeamLabels teams={person.teamsIn.get(month) ?? []} />
      ),
      shaded: (person) => person.outside.has(month),
      mark: (person) =>
        person.outside.has(month) ? (
          <VisuallyHidden>Not employed</VisuallyHidden>
        ) : undefined,
      cellChars: monthCellChars,
      headingCentred: true,
    }),
  );
  const columns = [
    cellColumn<PersonMonths, CellChange>("name", "text", {
      label: "Person",
      required: true,
      choices: [],
      multiple: false,
    }),
    ...monthColumns,
  ];
  return {
    label: "Feature teams by month",
    one: "person",
    noun: "people",
    newRowLabel: () => "",
    removeLabel: () => "",
    nameOf: ({ name }) => name,
    countedAs: ({ personId }) => personId,
    columnsFor: () => columns,
    liveRecords: (records) => [...records],
    draftFields: () => [],
    recordProblem: () => undefined,
    request: () => ({}),
    drafts: () => noDrafts(),
    groupings: [
      ...(seesPeople ? [groupedByManager(data)] : []),
      groupedByFeatureTeam(data),
    ],
  };
}

const nothing = () => undefined;

// The table never changes anything, so its actions are never called.
export const noTeamMonthActions: RecordActions<
  PersonMonths,
  CellChange,
  CellChange
> = {
  add: nothing,
  update: nothing,
  remove: nothing,
  discard: nothing,
  resubmit: nothing,
  decide: nothing,
  editColumn: nothing,
  discardColumn: nothing,
  resubmitColumn: nothing,
};

// A row for each person by name, or, grouped by feature team, one under each team they were on in
// the months shown and one under none for those on no team.
export function teamMonthRecords(
  data: TeamMonths,
  grouping: string | undefined,
): PersonMonths[] {
  const teams = new Map(data.teams.map((team) => [team.id, team]));
  const people = [...data.people].sort((first, second) =>
    byName({ name: first.preferredName }, { name: second.preferredName }),
  );
  return people.flatMap((person) => {
    const teamsIn = new Map(
      Object.entries(person.teams).map(([month, teamIds]) => [
        month,
        // The server lists every team a person's months name.
        teamIds.map((teamId) => teams.get(teamId) as MonthTeam).sort(byName),
      ]),
    );
    const teamsInAnyMonth = [
      ...new Map(
        [...teamsIn.values()].flat().map((team) => [team.id, team]),
      ).values(),
    ].sort(byName);
    const record: PersonMonths = {
      id: person.id,
      personId: person.id,
      name: person.preferredName,
      manager: person.manager,
      values: person.teams,
      links: {},
      teamsIn,
      outside: new Set(person.outside),
    };
    if (grouping !== featureTeamGrouping) return [record];
    return teamsInAnyMonth.length === 0
      ? [record]
      : teamsInAnyMonth.map((group) => ({
          ...record,
          id: `${group.id} ${person.id}`,
          group,
        }));
  });
}
