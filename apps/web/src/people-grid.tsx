// SPDX-License-Identifier: Apache-2.0

// The People table: the table of records record-grid.tsx sets out, with what is particular to
// people. Its columns are each person's name, Employee ID, and position, their manager, whether they
// are marked as a manager, whom others can report to, their team, which follows from their manager,
// and their own team's name, the added columns, and, for those who may see them, start and end dates
// and the date their manager is theirs from. A person's Employee ID must be one no one else has, and
// their end date cannot be before their start date.

import type {
  Choice,
  Field,
  List,
  Person,
  PersonChange,
  PersonRequest,
} from "@fathom/shared";
import { builtInColumnNames, personLengths } from "@fathom/shared";
import { VisuallyHidden } from "@mantine/core";
import { notShown, personDraftFields } from "./draft-details.tsx";
import { noDrafts } from "./drafts.ts";
import { sameName } from "./lists.ts";
import {
  cellColumn,
  type Column as RecordColumn,
  inOrder,
  isPending,
  liveRecordsOf,
  type RecordActions,
  RecordGrid,
  type RecordGridHandle,
  type RecordGridProps,
  type RecordTable,
  type RowProblem,
} from "./record-grid.tsx";
import { StatusMark } from "./status-mark.tsx";
import { flagChoice } from "./cell-kinds.tsx";
import type { CellValue } from "./table-view.ts";

export type PeopleActions = RecordActions<Person, PersonChange, PersonRequest>;

export type PeopleGridHandle = RecordGridHandle;

export type Column = RecordColumn<Person, PersonChange>;

// The keys of a person's built-in details held as text.
export type DetailKey =
  | "preferredName"
  | "employeeId"
  | "startDate"
  | "endDate"
  | "managerFrom"
  | "teamName"
  | "isManager";

const detailKeys: readonly DetailKey[] = [
  "preferredName",
  "employeeId",
  "startDate",
  "endDate",
  "managerFrom",
  "teamName",
  "isManager",
];

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

// Today as YYYY-MM-DD, by the same clock the server's checks use.
const today = () => new Date().toISOString().slice(0, 10);

// Whether someone is marked as a manager live, whatever their draft makes them.
const markedLive = (person: Person) =>
  person.draft?.changed.includes("isManager") === true
    ? person.draft.live.isManager === true
    : person.isManager === true;

// Whether someone may be given as a manager: live and marked as a manager live, so neither drafted
// to be added or removed nor still being added, and not gone by today, as far as the reader sees
// their end date. Fathom checks the rest, such as loops.
const mayManage = (person: Person, today: string) =>
  person.draft?.action !== "deleted" &&
  person.draft?.action !== "created" &&
  !isPending(person) &&
  markedLive(person) &&
  (person.endDate == null || person.endDate >= today);

// Who each person reports to, live or as drafted, whoever the people shown name as a manager.
function managersNamed(people: readonly Person[]): Map<string, string> {
  const named = new Map<string, string>();
  for (const person of people) {
    if (person.manager)
      named.set(person.manager.id, person.manager.preferredName);
    const live = person.draft?.live.managerId;
    if (typeof live === "string" && !named.has(live)) named.set(live, notShown);
  }
  return named;
}

const choice = (id: string, label: string, retired: boolean): Choice => ({
  id,
  label,
  description: "",
  retired,
});

const byLabel = (choices: Choice[]) =>
  choices.sort((a, b) => collator.compare(a.label, b.label));

// The people a person may report to, by name, and, no longer offered, those who have gone, or are
// no longer marked as managers, while someone still reports to them.
function managerChoices(people: readonly Person[], today: string): Choice[] {
  const named = managersNamed(people);
  const shown = new Set(people.map(({ id }) => id));
  return byLabel([
    ...people.flatMap((person) => {
      const offered = mayManage(person, today);
      return offered || named.has(person.id)
        ? [choice(person.id, person.preferredName, !offered)]
        : [];
    }),
    ...[...named]
      .filter(([id]) => !shown.has(id))
      .map(([id, name]) => choice(id, name, true)),
  ]);
}

// Each team someone is on, known by its manager, named as the server names it for the people on
// it: by its name, or by its manager's name while it has none. A team only a draft's live line
// names, with nobody on it now, is named by its manager as shown.
function teamChoices(people: readonly Person[]): Choice[] {
  const named = managersNamed(people);
  const teamOf = new Map<string, string | null>();
  for (const { manager, team } of people) {
    if (manager && team !== undefined) teamOf.set(manager.id, team);
  }
  const byId = new Map(people.map((person) => [person.id, person]));
  return byLabel(
    [...named].map(([id, name]) => {
      const manager = byId.get(id);
      const label = teamOf.has(id)
        ? (teamOf.get(id) ?? name)
        : (manager?.teamName ?? manager?.preferredName ?? name);
      return choice(id, label, false);
    }),
  );
}

const asIds = (value: CellValue) => value as string[];

const markedChoice = choice(flagChoice, "Yes", false);

// A single choice as a cell's value: the one chosen, or none.
const chosen = (id: string | null | undefined): string[] =>
  typeof id === "string" ? [id] : [];

// Gone by today while someone still reports to them, for readers who may see when people leave.
function LeftMark({ person }: { person: Person }) {
  return person.managerLeft === true ? (
    <StatusMark tone="warning" spaced>
      Left<VisuallyHidden>: their end date has passed</VisuallyHidden>
    </StatusMark>
  ) : null;
}

// The columns made for each set of people, which stays the same while the page shows it, so the
// choices are not made again each time the table is drawn.
const madeFor = new WeakMap<
  readonly Person[],
  { day: string; columns: [Column, Column] }
>();

// The Manager column, picking from the people given, and the Team column, which follows from it.
function reportingColumns(
  people: readonly Person[],
  today: string,
): [Column, Column] {
  const made = madeFor.get(people);
  if (made?.day === today) return made.columns;
  const columns = makeReportingColumns(people, today);
  madeFor.set(people, { day: today, columns });
  return columns;
}

function makeReportingColumns(
  people: readonly Person[],
  today: string,
): [Column, Column] {
  const manager: Column = {
    key: "managerId",
    kind: "choice",
    // Every built-in column is named.
    label: builtInColumnNames.get("managerId") as string,
    required: false,
    multiple: false,
    choices: managerChoices(people, today),
    emptyLabel: "No manager",
    retiredLabel: "No longer offered",
    value: (person) => chosen(person.manager?.id),
    live: (draft) => chosen(draft.live.managerId),
    change: (value) => ({ managerId: asIds(value)[0] ?? null }),
  };
  return [
    {
      ...manager,
      mark: (person) => <LeftMark person={person} />,
    },
    {
      ...manager,
      key: "team",
      label: builtInColumnNames.get("team") as string,
      choices: teamChoices(people),
      emptyLabel: "No team",
      readOnly: true,
      changesWith: "managerId",
      change: () => ({}),
    },
  ];
}

// The People table's columns, in the order given by their keys: each person's name, Employee ID,
// and position, from the built-in Positions list, for those who may see them, start and end dates,
// their manager, for those who may see it, the date their manager is theirs from, their team and
// team name, and the added columns. A column the order does not name yet comes at the end. Managers
// are picked from the people given.
export function columnsFor(
  fields: readonly Field[],
  lists: readonly List[],
  order: readonly string[],
  showDates: boolean,
  people: readonly Person[] = [],
): Column[] {
  const builtIn = (
    key: DetailKey,
    kind: Column["kind"],
    required = false,
    maxLength?: number,
  ) =>
    cellColumn<Person, PersonChange>(key, kind, {
      // Every built-in column is named.
      label: builtInColumnNames.get(key) as string,
      required,
      choices: [],
      multiple: false,
      maxLength,
    });
  const [manager, team] = reportingColumns(people, today());
  const position: Column = {
    key: "positionId",
    kind: "choice",
    // Every built-in column is named.
    label: builtInColumnNames.get("positionId") as string,
    required: true,
    multiple: false,
    // Only live positions, since a position must be a choice the list already has.
    choices: (
      lists.find(({ builtIn }) => builtIn === "positions")?.choices ?? []
    ).filter(({ draft }) => draft?.action !== "created"),
    value: (person) => [person.positionId],
    live: (draft) => chosen(draft.live.positionId),
    // A required column is never saved empty, so a change always holds a position.
    change: (value) => ({ positionId: asIds(value)[0] }),
  };
  return inOrder(
    [
      builtIn("preferredName", "text", true, personLengths.preferredName),
      builtIn("employeeId", "text", true, personLengths.employeeId),
      position,
      ...(showDates
        ? [builtIn("startDate", "date"), builtIn("endDate", "date")]
        : []),
      manager,
      {
        ...builtIn("isManager", "flag"),
        choices: [markedChoice],
        emptyLabel: "No",
      },
      ...(showDates
        ? [
            // Fathom takes today, or a new person's start date, when no date is given.
            {
              ...builtIn("managerFrom", "date"),
              change: (value: CellValue) =>
                value === "" ? {} : { managerFrom: value as string },
            },
          ]
        : []),
      team,
      {
        ...builtIn("teamName", "text", false, personLengths.teamName),
        breaksDown: false,
      },
      // A column's type is the kind of its cells.
      ...fields.map((field) =>
        cellColumn<Person, PersonChange>(field.id, field.type, {
          label: field.name,
          required: field.required,
          field,
          choices: lists.find(({ id }) => id === field.listId)?.choices ?? [],
          multiple: field.multiple,
        }),
      ),
    ],
    order,
  );
}

// Everyone as they are live, without drafts: those only drafted to be added are left out, and each
// detail and column a draft changes has its live value back, with each person's manager, and their
// team, named as the manager's live team name has it.
const liveMade = new WeakMap<readonly Person[], Person[]>();

export function livePeople(people: readonly Person[]): Person[] {
  const made = liveMade.get(people);
  if (made !== undefined) return made;
  const live = makeLivePeople(people);
  liveMade.set(people, live);
  return live;
}

function makeLivePeople(people: readonly Person[]): Person[] {
  const drafted = new Map(people.map((person) => [person.id, person.draft]));
  const named = managersNamed(people);
  const nameOf = new Map(
    people.map(({ id, preferredName }) => [id, preferredName]),
  );
  const live = liveRecordsOf(people, detailKeys).map((person): Person => {
    const draft = drafted.get(person.id);
    if (draft?.action !== "changed" || !draft.changed.includes("managerId")) {
      return person;
    }
    const id = draft.live.managerId;
    return {
      ...person,
      manager:
        typeof id === "string"
          ? // Every live manager is named, if only as not shown.
            { id, preferredName: nameOf.get(id) ?? (named.get(id) as string) }
          : null,
    };
  });
  const byId = new Map(live.map((person) => [person.id, person]));
  const now = today();
  return live.map((person) => {
    const manager =
      person.manager === undefined || person.manager === null
        ? undefined
        : byId.get(person.manager.id);
    if (manager === undefined) return person;
    // Only readers who see Restricted details see when a line starts, and whether its manager left.
    const withTeam = { ...person, team: manager.teamName ?? null };
    if (person.managerFrom === undefined) return withTeam;
    delete withTeam.managerLeft;
    return typeof manager.endDate === "string" && manager.endDate < now
      ? { ...withTeam, managerLeft: true }
      : withTeam;
  });
}

// What is wrong with a person's details taken together, if anything, and in which column: an
// Employee ID someone else has, an end date before the start date, marked in the date changed, or
// in the end date, or a manager without the date they are the person's manager from, or that date
// given to someone with no manager and no line to move, such as someone added. The Employee ID is
// checked when it is what changed, or when a person is added.
function recordProblem(
  values: Record<string, CellValue>,
  others: () => Record<string, CellValue>[],
  changed?: string,
  before?: Record<string, CellValue>,
): RowProblem | undefined {
  const employeeId = values.employeeId;
  if (
    (changed === undefined || changed === "employeeId") &&
    typeof employeeId === "string" &&
    others().some(
      (other) =>
        typeof other.employeeId === "string" &&
        sameName(other.employeeId, employeeId),
    )
  ) {
    return {
      message: "Someone already has that Employee ID",
      column: "employeeId",
    };
  }
  const { startDate, endDate } = values;
  if (
    typeof startDate === "string" &&
    typeof endDate === "string" &&
    startDate !== "" &&
    endDate !== "" &&
    endDate < startDate
  ) {
    return {
      message: "The end date cannot be before the start date",
      column: changed === "startDate" ? "startDate" : "endDate",
    };
  }
  const manager = values.managerId;
  const from = values.managerFrom;
  const managed = Array.isArray(manager) && manager.length > 0;
  if (changed === "managerFrom" && managed && from === "") {
    return { message: "Manager since needed", column: "managerFrom" };
  }
  // A line with no manager may move, but someone with no line has none to move.
  const noLine = changed === undefined || before?.managerFrom === "";
  if (noLine && !managed && typeof from === "string" && from !== "") {
    return {
      message: "Choose a manager, or leave Manager since empty",
      column: "managerFrom",
    };
  }
  return undefined;
}

// The request that adds a person, from each column's value as its kind would save it, with every
// choice column named and no link left empty.
function requestFor(parts: readonly PersonChange[]): PersonRequest {
  // Every table has its name, Employee ID, Position and Manager columns, and its dates together or
  // not at all.
  const {
    preferredName,
    employeeId,
    positionId,
    startDate,
    endDate,
    managerId,
    managerFrom,
    teamName,
    isManager,
  } = Object.assign({}, ...parts) as PersonRequest;
  return {
    preferredName,
    employeeId,
    positionId,
    ...(startDate === undefined ? {} : { startDate, endDate }),
    ...(managerId == null
      ? {}
      : { managerId, ...(managerFrom === undefined ? {} : { managerFrom }) }),
    ...(teamName == null || teamName === "" ? {} : { teamName }),
    ...(isManager === true ? { isManager } : {}),
    values: Object.assign({}, ...parts.map((part) => part.values)) as Record<
      string,
      string[]
    >,
    links: Object.fromEntries(
      parts.flatMap((part) =>
        Object.entries(part.links ?? {}).flatMap(([key, held]) =>
          held === null ? [] : [[key, held]],
        ),
      ),
    ),
  };
}

function peopleTable(
  showDates: boolean,
  people: readonly Person[],
): RecordTable<Person, PersonChange, PersonRequest> {
  return {
    label: "People",
    one: "person",
    noun: "people",
    newRowLabel: "New person",
    removeLabel: "Remove person",
    nameOf: (person) => person.preferredName,
    columnsFor: (fields, lists, order, records) =>
      columnsFor(fields, lists, order, showDates, records),
    liveRecords: livePeople,
    draftFields: (person, draft, fields, lists) =>
      personDraftFields(person, draft, fields, lists, people),
    recordProblem,
    request: requestFor,
    drafts: (ids) => ({ ...noDrafts(), people: ids }),
  };
}

type PeopleGridProps = Omit<
  RecordGridProps<Person, PersonChange, PersonRequest>,
  "records" | "table"
> & {
  // Everyone the user may see; the view decides who is shown, and in what order.
  people: Person[];
  showDates: boolean;
};

export function PeopleGrid({ people, showDates, ...props }: PeopleGridProps) {
  return (
    <RecordGrid
      records={people}
      table={peopleTable(showDates, people)}
      {...props}
    />
  );
}
