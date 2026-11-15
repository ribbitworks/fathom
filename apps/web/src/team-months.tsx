// SPDX-License-Identifier: Apache-2.0

// Who is on which feature team, month by month, through the server's API, as a table of records: a
// row for each person and a column for each month, with the months team drafts change shown as a
// draft of the person's row. Grouped by feature team, someone who was on two teams has a row under
// each. Those who may propose team changes change a month's teams, drafted on each team from that
// month on. The table, its groupings and its read-only actions are shared with the grid's other
// mode, allocations.

import {
  addToMonth,
  byName,
  dayReadingMonth,
  mayDateChange,
  type MemberTeamsChange,
  type MonthRange,
  monthOf,
  type Show,
  type TeamMonths,
  teamMonthsSchema,
} from "@fathom/shared";
import { VisuallyHidden } from "@mantine/core";
import { queryOptions } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getJson } from "./api.ts";
import type { CellChange } from "./cell-kinds.tsx";
import { noDrafts } from "./drafts.ts";
import {
  cellColumn,
  type CellRecord,
  type Column,
  noRecordActions,
  readOnlyTableParts,
  type RecordActions,
  type RecordTable,
  type RowGrouping,
} from "./record-grid.tsx";
import { changeMemberTeams, featureTeamsQuery } from "./feature-teams.ts";
import { useSaving } from "./saving.ts";
import { formatMonth, groupedRowId } from "./table-view.ts";
import type { DraftLike } from "./status-mark.tsx";
import { type DraftedLabel, TeamLabels } from "./team-labels.tsx";

type MonthTeam = TeamMonths["teams"][number];
type TeamDraft = NonNullable<TeamMonths["drafts"]>[number];

export type MonthLabel = MonthTeam & {
  drafted?: DraftedLabel;
  draftedBy?: DraftLike;
  live?: boolean;
};

// A row of the monthly grid, in either mode.
export interface MonthRow extends CellRecord {
  personId: string;
  name: string;
  manager: TeamMonths["people"][number]["manager"];
  // The feature team this row is grouped under, when grouped by feature team.
  group?: MonthTeam | undefined;
  outside: ReadonlySet<string>;
}

export interface PersonMonths extends MonthRow {
  teamsIn: ReadonlyMap<string, MonthLabel[]>;
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
export const managerGrouping = "manager";
export const featureTeamGrouping = "feature-team";

// Grouped by manager, under each manager given, by name, and then those with none.
function groupedByManager<Rec extends Pick<MonthRow, "manager">>(
  managersGiven: readonly { id: string; name: string }[],
): RowGrouping<Rec> {
  const managers = [
    ...new Map(managersGiven.map((manager) => [manager.id, manager])).values(),
  ].sort(byName);
  const ranks = new Map(managers.map(({ id }, rank) => [id, rank]));
  return {
    key: managerGrouping,
    label: "Manager",
    of: ({ manager }) => [
      manager === null
        ? { key: "no-manager", label: "No manager", rank: lastRank }
        : {
            key: manager.id,
            label: manager.name,
            // Every manager of a row is given above.
            rank: ranks.get(manager.id) as number,
          },
    ],
  };
}

function groupedByFeatureTeam<Rec extends Pick<MonthRow, "group">>(
  data: TeamMonths,
): RowGrouping<Rec> {
  const ranks = new Map(
    [...data.teams].sort(byName).map(({ id }, rank) => [id, rank]),
  );
  return {
    key: featureTeamGrouping,
    label: "Feature team",
    of: ({ group }) => [
      group === undefined
        ? { key: "no-team", label: "No feature team", rank: lastRank }
        : {
            key: group.id,
            label: group.name,
            // Every team in the data is ranked above.
            rank: ranks.get(group.id) as number,
          },
    ],
  };
}

// With drafts applied, a team a draft takes someone off is gone, rather than struck through.
const labelsShown = (labels: readonly MonthLabel[], show: Show) =>
  show === "drafts"
    ? labels.filter(({ drafted }) => drafted !== "removed")
    : labels;

// Who may change a month's teams: those who may propose team changes, the current month and later,
// and earlier months too for those who may change Personal details.
export interface TeamMonthEdits {
  today: string;
  changesDates: boolean;
}

const editableMonth = (
  month: string,
  { today, changesDates }: TeamMonthEdits,
) => mayDateChange(changesDates, dayReadingMonth(month, today), today);

// The table of the monthly grid: a row's name, frozen on the left, then a column for each month,
// whose cells show what the content gives, shaded outside someone's employment.
export function monthGridTable<
  Rec extends MonthRow & { live?: Rec | undefined },
>({
  months,
  label,
  choices,
  content,
  readOnly,
  standIn,
  groupings,
}: {
  months: readonly string[];
  label: string;
  choices: readonly { id: string; name: string }[];
  content: (record: Rec, month: string) => ReactNode;
  readOnly: (month: string) => boolean;
  standIn?: (record: Rec) => string;
  groupings: readonly RowGrouping<Rec>[];
}): RecordTable<Rec, CellChange, CellChange> {
  const monthChoices = [...choices].sort(byName).map(({ id, name }) => ({
    id,
    label: name,
    description: "",
    retired: false,
  }));
  const monthColumns = months.map((month): Column<Rec, CellChange> => ({
    ...cellColumn<Rec, CellChange>(month, "choice", {
      label: formatMonth(month),
      required: false,
      choices: monthChoices,
      multiple: true,
    }),
    content: (record) => content(record, month),
    marksParts: true,
    shaded: (record) => record.outside.has(month),
    mark: (record) =>
      record.outside.has(month) ? (
        <VisuallyHidden>Not employed</VisuallyHidden>
      ) : undefined,
    cellChars: monthCellChars,
    headingCentred: true,
    readOnly: readOnly(month),
  }));
  const columns = [
    {
      ...cellColumn<Rec, CellChange>("name", "text", {
        label: "Person",
        required: true,
        choices: [],
        multiple: false,
      }),
      readOnly: true,
      ...(standIn === undefined ? {} : { standIn }),
    },
    ...monthColumns,
  ];
  return {
    ...readOnlyTableParts,
    label,
    one: "person",
    noun: "people",
    nameOf: (record) => record.name || (standIn?.(record) ?? ""),
    nameColumn: "name",
    countedAs: ({ personId }) => personId,
    columnsFor: () => columns,
    liveRecords: (records) => records.map((record) => record.live ?? record),
    drafts: () => noDrafts(),
    groupings,
    oneLevel: true,
  };
}

export function teamMonthsTable(
  data: TeamMonths,
  show: Show,
  edits: TeamMonthEdits,
  // The managers to group by, for roles that may group by manager.
  managers: readonly { id: string; name: string }[] | undefined,
): Table {
  return monthGridTable<PersonMonths>({
    months: data.months,
    label: "Feature teams by month",
    choices: data.teams,
    content: (person, month) => (
      <TeamLabels teams={labelsShown(person.teamsIn.get(month) ?? [], show)} />
    ),
    readOnly: (month) => !editableMonth(month, edits),
    groupings: monthGroupings(managers, data),
  });
}

export const peopleManagers = (data: TeamMonths) =>
  data.people.flatMap(({ manager }) => (manager === null ? [] : [manager]));

// The ways the grid's rows group: by manager, given the managers for roles that may, and by feature
// team.
export function monthGroupings<Rec extends MonthRow>(
  managers: readonly { id: string; name: string }[] | undefined,
  data: TeamMonths,
): RowGrouping<Rec>[] {
  return [
    ...(managers === undefined ? [] : [groupedByManager<Rec>(managers)]),
    groupedByFeatureTeam<Rec>(data),
  ];
}

// A month's teams as a cell changes them: the teams added and removed, from the day the month is
// read as of; undefined when the cell changes nothing.
export function monthChange(
  record: PersonMonths,
  change: CellChange,
  today: string,
): { month: string; request: MemberTeamsChange } | undefined {
  const [entry] = Object.entries(change.values ?? {});
  if (entry === undefined) return undefined;
  const [month, chosen] = entry;
  const was = new Map(Object.entries(record.values)).get(month) ?? [];
  const add = chosen.filter((id) => !was.includes(id));
  const remove = was.filter((id) => !chosen.includes(id));
  if (add.length === 0 && remove.length === 0) return undefined;
  const from = dayReadingMonth(month, today);
  return {
    month,
    request: { add, remove, ...(from === today ? {} : { from }) },
  };
}

// The months as a change of someone's teams from a month makes them, shown at once while it saves:
// the teams added and removed in that month and every later one, as the person's own draft.
export function withMonthChange(
  data: TeamMonths,
  personId: string,
  month: string,
  { add, remove }: MemberTeamsChange,
): TeamMonths {
  const changed = [...add, ...remove];
  const knownDrafts = new Set(data.drafts.map(({ teamId }) => teamId));
  return {
    ...data,
    people: data.people.map((person) => {
      if (person.id !== personId) return person;
      const teams = new Map(Object.entries(person.drafted?.teams ?? {}));
      const approved = new Map(Object.entries(person.teams));
      for (const later of data.months.filter((one) => one >= month)) {
        const before = teams.get(later) ?? approved.get(later) ?? [];
        teams.set(
          later,
          [...before.filter((id) => !changed.includes(id)), ...add].sort(),
        );
      }
      return {
        ...person,
        drafted: {
          teams: Object.fromEntries(teams),
          by: [...new Set([...(person.drafted?.by ?? []), ...changed])],
        },
      };
    }),
    drafts: [
      ...data.drafts,
      ...changed
        .filter((teamId) => !knownDrafts.has(teamId))
        .map((teamId) => ({
          teamId,
          action: "changed" as const,
          state: "waiting" as const,
          unpublished: true,
        })),
    ],
  };
}

// A mode of the grid that changes nothing never calls these.
export const readOnlyMonthActions = noRecordActions<
  MonthRow,
  CellChange,
  CellChange
>();

// Changing a month's teams, shown at once and saved as the team drafts, which can be undone; the
// table changes nothing else.
export function useTeamMonthActions(
  range: MonthRange,
  today: string,
  // While another of the page's dialogs is open, which Cmd+Z leaves alone.
  blocked: boolean,
): RecordActions<PersonMonths, CellChange, CellChange> {
  const { queryKey } = teamMonthsQuery(range);
  const { save, undoable } = useSaving<TeamMonths>({
    queryKey,
    refreshes: [featureTeamsQuery.queryKey],
    removed:
      "Someone else has removed this. The feature assignments have been refreshed.",
    blocked,
  });
  return {
    ...noRecordActions<PersonMonths, CellChange, CellChange>(),
    update: (record, change) => {
      const changing = monthChange(record, change, today);
      if (changing === undefined) return;
      const { month, request } = changing;
      save({
        next: (data) => withMonthChange(data, record.personId, month, request),
        save: () => changeMemberTeams(record.personId, request),
        failure: `Fathom could not change the feature teams of ${record.name}.`,
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
  };
}

// The draft a person's row shows for the drafts changing their months: rejected while any is,
// so it is seen to, otherwise the reader's own while any holds their unpublished changes.
export function personDraft(
  drafts: readonly Pick<TeamDraft, "state" | "unpublished">[],
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
        : { ...team, drafted: "added", draftedBy: draft },
    ),
    ...live
      .filter(({ id }) => !draftedIds.has(id))
      .map((team): MonthLabel => ({
        ...team,
        drafted: "removed",
        draftedBy: draft,
      })),
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
    live: withLiveMarks(live, new Map(draftedMonths), draft),
  };
}

// The person as approved, for the Live row and live only, with each team a draft takes away from a
// month marked as live with that draft.
function withLiveMarks(
  live: PersonMonths,
  draftedTeamsIn: ReadonlyMap<string, readonly string[]>,
  draft: DraftLike,
): PersonMonths {
  return {
    ...live,
    teamsIn: new Map(
      [...live.teamsIn].map(([month, labels]): [string, MonthLabel[]] => {
        const draftedIds = draftedTeamsIn.get(month);
        return [
          month,
          draftedIds === undefined
            ? labels
            : labels.map((label) =>
                draftedIds.includes(label.id)
                  ? label
                  : {
                      ...label,
                      drafted: "removed",
                      draftedBy: draft,
                      live: true,
                    },
              ),
        ];
      }),
    ),
  };
}

// The teams in any of someone's months, by name, each with the months they are on it.
export function teamsAcross(
  teamsIn: ReadonlyMap<string, readonly MonthTeam[]>,
): { team: MonthTeam; months: string[] }[] {
  const each = new Map<string, { team: MonthTeam; months: string[] }>();
  for (const [month, teams] of teamsIn) {
    for (const team of teams) {
      const { id, name, colour } = team;
      const held = each.get(id) ?? { team: { id, name, colour }, months: [] };
      held.months.push(month);
      each.set(id, held);
    }
  }
  return [...each.values()].sort((first, second) =>
    byName(first.team, second.team),
  );
}

// A row for each person by name, or, grouped by feature team, one under each team they were on in
// the months shown, as the Draft menu shows them, and one under none for those on no team.
export function teamMonthRecords(
  data: TeamMonths,
  grouping: string | undefined,
  show: Show,
): PersonMonths[] {
  const teams = new Map(data.teams.map((team) => [team.id, team]));
  const drafts = new Map(data.drafts.map((draft) => [draft.teamId, draft]));
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
    const teamsInAnyMonth = teamsAcross(
      new Map(
        [...(show === "live" ? live : record).teamsIn].map(
          ([month, labels]) => [month, labelsShown(labels, show)],
        ),
      ),
    );
    return teamsInAnyMonth.length === 0
      ? [record]
      : teamsInAnyMonth.map(({ team: group }) => {
          const id = groupedRowId(group.id, person.id);
          return {
            ...record,
            id,
            group,
            ...(record.live === undefined
              ? {}
              : { live: { ...record.live, id, group } }),
          };
        });
  });
}
