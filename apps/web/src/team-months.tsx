// SPDX-License-Identifier: Apache-2.0

// Who is on which feature team, month by month, through the server's API, as a read-only table of
// records: a row for each person and a column for each month, with the months team drafts change
// shown as a draft of the person's row. Grouped by feature team, someone who was on two teams has a
// row under each.

import {
  addToMonth,
  byName,
  type MonthRange,
  monthOf,
  type Show,
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
import type { DraftLike } from "./status-mark.tsx";
import { type DraftedLabel, TeamLabels } from "./team-labels.tsx";

type MonthTeam = TeamMonths["teams"][number];
type TeamDraft = NonNullable<TeamMonths["drafts"]>[number];

export type MonthLabel = MonthTeam & {
  drafted?: DraftedLabel;
  addedBy?: DraftLike;
};

export interface PersonMonths extends CellRecord {
  personId: string;
  name: string;
  manager: TeamMonths["people"][number]["manager"];
  // The feature team this row is grouped under, when grouped by feature team.
  group?: MonthTeam | undefined;
  teamsIn: ReadonlyMap<string, MonthLabel[]>;
  outside: ReadonlySet<string>;
  // The person as approved, when a draft changes their months.
  live?: PersonMonths | undefined;
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

// With drafts applied, a team a draft takes someone off is gone, rather than struck through.
const labelsShown = (labels: readonly MonthLabel[], show: Show) =>
  show === "drafts"
    ? labels.filter(({ drafted }) => drafted !== "removed")
    : labels;

export function teamMonthsTable(
  data: TeamMonths,
  seesPeople: boolean,
  show: Show,
): Table {
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
        <TeamLabels
          teams={labelsShown(person.teamsIn.get(month) ?? [], show)}
        />
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
    liveRecords: (records) => records.map((record) => record.live ?? record),
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

// The draft a person's row shows for the team drafts changing their months: rejected while any is,
// so it is seen to, otherwise the reader's own while any holds their unpublished changes.
export function personDraft(
  drafts: readonly TeamDraft[],
): Pick<TeamDraft, "state" | "unpublished"> {
  return {
    state: drafts.some(({ state }) => state === "rejected")
      ? "rejected"
      : "waiting",
    ...(drafts.some(({ unpublished }) => unpublished === true)
      ? { unpublished: true }
      : {}),
  };
}

// A month's teams as a draft makes them, with those it adds and those it takes away marked.
function draftedLabels(
  live: readonly MonthTeam[],
  drafted: readonly MonthTeam[],
  draft: DraftLike,
): MonthLabel[] {
  const liveIds = new Set(live.map(({ id }) => id));
  const draftedIds = new Set(drafted.map(({ id }) => id));
  return [
    ...drafted.map((team): MonthLabel =>
      liveIds.has(team.id)
        ? team
        : { ...team, drafted: "added", addedBy: draft },
    ),
    ...live
      .filter(({ id }) => !draftedIds.has(id))
      .map((team): MonthLabel => ({ ...team, drafted: "removed" })),
  ].sort(byName);
}

// A person's row as drafts change their months, with the teams added and taken away marked, and
// the person as approved kept for the Live row.
function draftOf(
  live: PersonMonths,
  drafted: NonNullable<TeamMonths["people"][number]["drafted"]>,
  teamsOf: (teamIds: readonly string[]) => MonthTeam[],
  drafts: ReadonlyMap<string, TeamDraft>,
): PersonMonths {
  const draftedMonths = Object.entries(drafted.teams);
  // The server lists each team draft a person's drafted months name.
  const draft = personDraft(
    drafted.by.map((teamId) => drafts.get(teamId) as TeamDraft),
  );
  return {
    ...live,
    values: { ...live.values, ...drafted.teams },
    teamsIn: new Map([
      ...live.teamsIn,
      ...draftedMonths.map(([month, teamIds]): [string, MonthLabel[]] => [
        month,
        draftedLabels(live.teamsIn.get(month) ?? [], teamsOf(teamIds), draft),
      ]),
    ]),
    draft: {
      action: "changed",
      changed: draftedMonths.map(([month]) => month),
      live: { values: live.values, links: {} },
      ...draft,
      madeBy: null,
    },
    live,
  };
}

// A row for each person by name, or, grouped by feature team, one under each team they were on in
// the months shown, as the Draft menu shows them, and one under none for those on no team.
export function teamMonthRecords(
  data: TeamMonths,
  grouping: string | undefined,
  show: Show,
): PersonMonths[] {
  const teams = new Map(data.teams.map((team) => [team.id, team]));
  const drafts = new Map(
    (data.drafts ?? []).map((draft) => [draft.teamId, draft]),
  );
  // The server lists every team a person's months name.
  const teamsOf = (teamIds: readonly string[]) =>
    teamIds.map((teamId) => teams.get(teamId) as MonthTeam).sort(byName);
  const people = [...data.people].sort((first, second) =>
    byName({ name: first.preferredName }, { name: second.preferredName }),
  );
  return people.flatMap((person) => {
    const liveTeamsIn = new Map(
      Object.entries(person.teams).map(([month, teamIds]) => [
        month,
        teamsOf(teamIds),
      ]),
    );
    const live: PersonMonths = {
      id: person.id,
      personId: person.id,
      name: person.preferredName,
      manager: person.manager,
      values: person.teams,
      links: {},
      teamsIn: liveTeamsIn,
      outside: new Set(person.outside),
    };
    const { drafted } = person;
    const record: PersonMonths =
      drafted === undefined ? live : draftOf(live, drafted, teamsOf, drafts);
    if (grouping !== featureTeamGrouping) return [record];
    const teamsInAnyMonth = [
      ...new Map(
        [...(show === "live" ? live : record).teamsIn.values()]
          .flatMap((labels) => labelsShown(labels, show))
          .map((team) => [team.id, team]),
      ).values(),
    ].sort(byName);
    return teamsInAnyMonth.length === 0
      ? [record]
      : teamsInAnyMonth.map(({ id, name, colour }) => {
          const group = { id, name, colour };
          return {
            ...record,
            id: `${id} ${person.id}`,
            group,
            ...(record.live === undefined
              ? {}
              : {
                  live: {
                    ...record.live,
                    id: `${id} ${person.id}`,
                    group,
                  },
                }),
          };
        });
  });
}
