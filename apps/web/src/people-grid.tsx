// SPDX-License-Identifier: Apache-2.0

// The People table: the table of records record-grid.tsx sets out, with what is particular to
// people and planned hires, its two kinds of row. Its columns are each row's name, ID, position,
// and state, Hired for every person, their manager, whether they are marked as a manager, whom
// others can report to, their team, which follows from their manager, the feature teams they are
// on, for those who see feature teams, and their own team's name, the added columns, the month a
// planned hire is expected, and, for those who may see them, start and end dates and the date their
// manager is theirs from. A planned hire's name is optional, and while it has none its position and
// ID stand in for it; it has no end date, mark as a manager, date its manager is its own from, or
// team name, and its start date is its target date. No two rows have the same ID, a person's end
// date cannot be before their start date, and an ID typed in cannot look like a temporary one.

import { dayNeeded } from "./day-input.tsx";
import { FillHireButton } from "./row-controls.tsx";
import type {
  Choice,
  DataClasses,
  Field,
  List,
  Person,
  Show,
} from "@fathom/shared";
import {
  classifiedFieldNames,
  builtInColumnNames,
  builtInColumnTiers,
  defaultClasses,
  personLengths,
  temporaryIdPrefix,
} from "@fathom/shared";
import { addedColumn, cellRequest } from "./added-columns.ts";
import { notShown, personDraftFields } from "./draft-details.tsx";
import { leftWarning } from "./status-mark.tsx";
import { canFill } from "./hire-fill.ts";
import { noDrafts } from "./drafts.ts";
import { choice, offered, sameName } from "./lists.ts";
import {
  cellColumn,
  type Column as RecordColumn,
  columnsOn,
  inOrder,
  isPending,
  liveRecordsOf,
  type RecordActions,
  RecordGrid,
  type RecordGridProps,
  type RecordTable,
  type RowGrouping,
  type RowProblem,
  recordsAsShown,
  shownSchema,
} from "./record-grid.tsx";
import { byChoice, holdsChoices } from "./choice-grouping.ts";
import { flagChoice } from "./cell-kinds.tsx";
import {
  isHire,
  personKeyOf,
  peopleAndHires,
  type RowChange,
  rowName,
  type RowRequest,
  stateMeaning,
} from "./people-rows.ts";
import { type CellValue, formatMonth } from "./table-view.ts";
import { today } from "./today.ts";
import { type ChangesFrom, managerChangesFrom } from "./person-change.ts";

export type PeopleActions = RecordActions<Person, RowChange, RowRequest>;

export type Column = RecordColumn<Person, RowChange>;

export const personKind = "person";
export const hireKind = "planned-hire";

// What a planned hire has but a person does not, and the other way round.
const hiresOnly = (kind: string) => kind === hireKind;
const peopleOnly = (kind: string) => kind !== hireKind;

// The keys of a person's built-in details held as text.
export type DetailKey =
  | "preferredName"
  | "employeeId"
  | "positionId"
  | "stateId"
  | "startDate"
  | "endDate"
  | "managerFrom"
  | "teamName"
  | "isManager";

const detailKeys: readonly DetailKey[] = [
  "preferredName",
  "employeeId",
  "positionId",
  "stateId",
  "startDate",
  "endDate",
  "managerFrom",
  "teamName",
  "isManager",
];

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

// Whether someone is marked as a manager live, whatever their draft makes them.
const markedLive = (person: Person) =>
  person.draft?.changed.includes("isManager") === true
    ? person.draft.live.isManager === true
    : person.isManager === true;

// Whether someone, or a planned hire, may be given as a manager: live and marked as a manager live,
// so neither drafted to be added or removed nor still being added, and not gone by today, as far
// as the reader sees their end date. Fathom checks the rest, such as loops.
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

export const byLabel = (choices: Choice[]) =>
  choices.sort((a, b) => collator.compare(a.label, b.label));

// The people and planned hires a row may report to, by name, and, no longer offered, those who have
// gone, or are no longer marked as managers, while someone still reports to them.
function managerChoices(
  people: readonly Person[],
  lists: readonly List[],
  today: string,
): Choice[] {
  const named = managersNamed(people);
  const shown = new Set(people.map(({ id }) => id));
  return byLabel([
    ...people.flatMap((person) => {
      const manages = mayManage(person, today);
      return manages || named.has(person.id)
        ? [choice(person.id, rowName(person, lists), !manages)]
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

// The Feature teams column, naming the teams each person is on, which are changed on the teams
// themselves, or none for readers who are not sent feature teams.
function featureTeamsColumn(people: readonly Person[]): Column | undefined {
  if (!people.some(({ featureTeams }) => featureTeams !== undefined)) {
    return undefined;
  }
  const teams = new Map(
    people.flatMap(({ featureTeams = [] }) =>
      featureTeams.map(({ id, name }) => [id, name] as const),
    ),
  );
  return {
    key: "featureTeams",
    kind: "choice",
    label: builtInColumnNames.get("featureTeams") as string,
    required: false,
    multiple: true,
    choices: byLabel([...teams].map(([id, name]) => choice(id, name, false))),
    emptyLabel: "No feature team",
    readOnly: true,
    value: (person) => (person.featureTeams ?? []).map(({ id }) => id),
    live: () => [],
    change: () => ({}),
  };
}

const asIds = (value: CellValue) => value as string[];

const markedChoice = choice(flagChoice, "Yes", false);

// A single choice as a cell's value: the one chosen, or none.
export const chosen = (id: string | null | undefined): string[] =>
  typeof id === "string" ? [id] : [];

// The columns made for each set of people, which stays the same while the page shows it, so the
// choices are not made again each time the table is drawn.
const madeFor = new WeakMap<
  readonly Person[],
  { day: string; lists: readonly List[]; columns: [Column, Column] }
>();

// The Manager column, picking from the people and planned managers given, and the Team column, which
// follows from it.
function reportingColumns(
  people: readonly Person[],
  lists: readonly List[],
  today: string,
): [Column, Column] {
  const made = madeFor.get(people);
  if (made?.day === today && made.lists === lists) return made.columns;
  const columns = makeReportingColumns(people, lists, today);
  madeFor.set(people, { day: today, lists, columns });
  return columns;
}

function makeReportingColumns(
  people: readonly Person[],
  lists: readonly List[],
  today: string,
): [Column, Column] {
  // People report only to people; a planned hire reports to a person or another planned hire.
  const hires = new Set(people.filter(isHire).map(({ id }) => id));
  const manager: Column = {
    key: "managerId",
    kind: "choice",
    // Every built-in column is named.
    label: builtInColumnNames.get("managerId") as string,
    required: false,
    multiple: false,
    choices: managerChoices(people, lists, today),
    pickableOn: (offeredChoice, row, kind) =>
      !hires.has(offeredChoice.id) ||
      (hiresOnly(kind) && offeredChoice.id !== row?.id),
    emptyLabel: "No manager",
    retiredLabel: "No longer offered",
    value: (person) => chosen(person.manager?.id),
    live: (draft) => chosen(draft.live.managerId),
    change: (value) => ({ managerId: asIds(value)[0] ?? null }),
  };
  return [
    {
      ...manager,
      // Gone by today while someone still reports to them, for readers who may see when people leave.
      status: (person) =>
        person.managerLeft === true ? leftWarning : undefined,
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

// The months planned hires are expected, earliest first, as choices named as people read them, such
// as Mar 2027, so the column sorts and filters by month.
function monthChoices(people: readonly Person[]): Choice[] {
  return [
    ...new Set(
      people.flatMap(({ expected, undated }) =>
        expected === undefined || undated === true ? [] : expected,
      ),
    ),
  ]
    .sort()
    .map((expected) => choice(expected, formatMonth(expected), false));
}

// Whether a column is offered on planned hires as the server takes it: as live, since a hire's
// value cannot wait on a draft switching the column on, or, for a column only drafted to be added,
// as drafted, since the column's draft is approved with the hire's.
const offeredOnHires = (field: Field) =>
  field.draft?.action === "created"
    ? field.onPlannedHires
    : (field.draft?.live.onPlannedHires ?? field.onPlannedHires);

// The People table's columns, in the order given by their keys: each row's name, optional for a
// planned hire, its ID, and position, from the built-in Positions list, for those who may see them,
// its state, Hired for every person, start and end dates, their manager, for those who may see it,
// the date their manager is theirs from, their team, feature teams and team name, the added columns,
// which planned hires have only where offered on them, and the month a planned hire is expected. A
// column the order does not name yet comes at the end. Managers are picked from the people given.
export function columnsFor(
  fields: readonly Field[],
  lists: readonly List[],
  order: readonly string[],
  showDates: boolean,
  people: readonly Person[] = [],
  showPosition = true,
  showHireDates = showDates,
  canAddHires = false,
): Column[] {
  const builtIn = (
    key: DetailKey,
    kind: Column["kind"],
    required = false,
    maxLength?: number,
  ) =>
    cellColumn<Person, RowChange>(key, kind, {
      // Every built-in column is named.
      label: builtInColumnNames.get(key) as string,
      required,
      choices: [],
      multiple: false,
      maxLength,
    });
  // Built-in columns only people have.
  const onPeopleOnly = (column: Column): Column => ({
    ...column,
    offeredOn: peopleOnly,
  });
  const [manager, team] = reportingColumns(people, lists, today());
  const featureTeams = featureTeamsColumn(people);
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
    value: (person) =>
      person.positionId === undefined ? [] : [person.positionId],
    live: (draft) => chosen(draft.live.positionId),
    // A required column is never saved empty, so a change always holds a position.
    change: (value) => ({ positionId: asIds(value)[0] }),
  };
  // Readers who cannot see the hiring states list are sent none, and see no State column.
  const statesList = lists.find(({ builtIn }) => builtIn === "hiring-states");
  const states = (statesList?.choices ?? []).filter(
    ({ draft }) => draft?.action !== "created",
  );
  const firstProposed = states.find(
    (option) => option.meaning === "proposed" && offered(option),
  );
  const firstHired = states.find(
    (option) => option.meaning === "hired" && offered(option),
  );
  const state: Column = {
    key: "stateId",
    kind: "choice",
    label: builtInColumnNames.get("stateId") as string,
    required: true,
    multiple: false,
    choices: states,
    // A record being added may be given the state of any kind the user may add, which decides its
    // kind: Hired or Left, as the end date given decides, which the server checks, or, for those who
    // may add planned hires, Proposed or Open. A planned hire is Proposed or Open, and hired by
    // filling it. A person is Hired, or Left once their end date has passed, which the state they
    // show already says, so they are offered only states of its meaning.
    pickableOn: (option, row, rowKind) => {
      const makes = kindOfMeaning(option.meaning);
      if (row === undefined) {
        return makes === personKind || (canAddHires && makes === hireKind);
      }
      if (hiresOnly(rowKind)) return makes === hireKind;
      const meaning = states.find(({ id }) => id === row.stateId)?.meaning;
      return option.meaning === meaning;
    },
    value: (row) => chosen(row.stateId),
    live: (draft) => chosen(draft.live.stateId),
    // Every row has a state, so a change always holds one.
    change: (value) => ({ stateId: asIds(value)[0] }),
    // A new planned hire starts in the first state meaning Proposed, and a new person in the first
    // meaning Hired.
    newRowValue: (rowKind) => {
      const first = hiresOnly(rowKind) ? firstProposed : firstHired;
      return first === undefined ? [] : [first.id];
    },
  };
  const expected: Column = {
    key: "expected",
    kind: "choice",
    label: builtInColumnNames.get("expected") as string,
    required: false,
    multiple: false,
    choices: monthChoices(people),
    readOnly: true,
    // A month from no date moves with the day shown, so it is left empty.
    value: (row) => chosen(row.undated === true ? undefined : row.expected),
    live: () => [],
    change: () => ({}),
    offeredOn: hiresOnly,
  };
  return inOrder(
    [
      {
        ...builtIn("preferredName", "text", true, personLengths.preferredName),
        requiredOn: peopleOnly,
        // A planned hire with no name of its own goes by its position and ID.
        standIn: (row: Person) => rowName(row, lists),
      },
      {
        ...builtIn("employeeId", "text", true, personLengths.employeeId),
        // Cleared, a planned hire's ID is a temporary one.
        requiredOn: peopleOnly,
      },
      ...(showPosition ? [position] : []),
      ...(statesList === undefined ? [] : [state]),
      ...(showDates
        ? [
            builtIn("startDate", "date"),
            onPeopleOnly(builtIn("endDate", "date")),
          ]
        : []),
      // A planned hire's target date is part of the hiring plan, not a personal detail, so readers
      // who see the plan but not people's dates see it for hires alone.
      ...(!showDates && showHireDates
        ? [{ ...builtIn("startDate", "date"), offeredOn: hiresOnly }]
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
            onPeopleOnly({
              ...builtIn("managerFrom", "date"),
              change: (value: CellValue) =>
                value === "" ? {} : { managerFrom: value as string },
            }),
          ]
        : []),
      team,
      ...(featureTeams === undefined ? [] : [featureTeams]),
      onPeopleOnly({
        ...builtIn("teamName", "text", false, personLengths.teamName),
        breaksDown: false,
      }),
      // A column's type is the kind of its cells. Planned hires have the columns offered on them,
      // where nothing is required.
      ...fields.map((field): Column => ({
        ...addedColumn<Person, RowChange>(field, lists),
        ...(offeredOnHires(field)
          ? { requiredOn: (kind: string) => field.required && peopleOnly(kind) }
          : { offeredOn: peopleOnly }),
      })),
      expected,
    ],
    order,
  );
}

// Everyone as they are live, without drafts: those only drafted to be added are left out, and each
// detail and column a draft changes has its live value back, with each person's manager, and their
// team, named as the manager's live team name has it.
const liveMade = new WeakMap<readonly Person[], Person[]>();

// Changes made from a day, judged by today's people as they are live, before today's are read too.
export const changesFromDay = (
  day: string | undefined,
  today: readonly Person[] | undefined,
): ChangesFrom | undefined =>
  day === undefined
    ? undefined
    : {
        day,
        today: new Map(livePeople(today ?? []).map((one) => [one.id, one])),
      };

export function livePeople(people: readonly Person[]): Person[] {
  const made = liveMade.get(people);
  if (made !== undefined) return made;
  const live = makeLivePeople(people);
  liveMade.set(people, live);
  return live;
}

// Everyone as the Draft menu's choice shows them: as drafted, with the drafts applied, where a
// rejected draft is taken back and someone drafted to be removed is gone, or as they are live.
export const peopleAsShown = (
  people: readonly Person[],
  show: Show,
): Person[] => recordsAsShown(show, people, livePeople);

function makeLivePeople(people: readonly Person[]): Person[] {
  const drafted = new Map(people.map((person) => [person.id, person.draft]));
  const named = managersNamed(people);
  const nameOf = new Map(
    people.map(({ id, preferredName }) => [id, preferredName]),
  );
  const endOf = new Map(people.map(({ id, endDate }) => [id, endDate]));
  const now = today();
  const live = liveRecordsOf(people, detailKeys).map((person): Person => {
    const draft = drafted.get(person.id);
    if (draft?.action !== "changed" || !draft.changed.includes("managerId")) {
      return person;
    }
    const id = draft.live.managerId;
    // Whether the manager has left is sent of the drafted manager, so the live one's is worked out
    // here, from their end date, which only those who see Personal details are sent.
    const end = typeof id === "string" ? endOf.get(id) : undefined;
    const livePerson: Person = {
      ...person,
      manager:
        typeof id === "string"
          ? // Every live manager is named, if only as not shown.
            { id, preferredName: nameOf.get(id) ?? (named.get(id) as string) }
          : null,
    };
    if (typeof end === "string" && end < now) livePerson.managerLeft = true;
    else delete livePerson.managerLeft;
    return livePerson;
  });
  const byId = new Map(live.map((person) => [person.id, person]));
  return live.map((person) => {
    const manager =
      person.manager === undefined || person.manager === null
        ? undefined
        : byId.get(person.manager.id);
    if (manager === undefined) return person;
    // Only readers who see Personal details see when a line starts, and whether its manager left.
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
export function recordProblem(
  values: Record<string, CellValue>,
  others: () => Record<string, CellValue>[],
  changed?: string,
  before?: Record<string, CellValue>,
): RowProblem | undefined {
  const employeeId = values.employeeId;
  const checksId = changed === undefined || changed === "employeeId";
  if (
    checksId &&
    typeof employeeId === "string" &&
    employeeId.trim().toLowerCase().startsWith(temporaryIdPrefix.toLowerCase())
  ) {
    return {
      message: `An ID cannot start with ${temporaryIdPrefix}, which temporary IDs use`,
      column: "employeeId",
    };
  }
  if (
    checksId &&
    typeof employeeId === "string" &&
    employeeId.trim() !== "" &&
    others().some(
      (other) =>
        typeof other.employeeId === "string" &&
        sameName(other.employeeId, employeeId),
    )
  ) {
    return {
      message: "Someone already has that ID",
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
    return { message: dayNeeded, column: "managerFrom" };
  }
  // A line with no manager may move, but someone with no line has none to move.
  const noLine = changed === undefined || before?.managerFrom === "";
  if (noLine && !managed && typeof from === "string" && from !== "") {
    return {
      message: "Choose a manager, or leave Manager assigned empty",
      column: "managerFrom",
    };
  }
  return undefined;
}

// The kind of record a state makes a new row: a planned hire for a state meaning Proposed or Open,
// and a person for one meaning Hired or Left.
export function kindOfState(
  lists: readonly List[],
  stateId: string | undefined,
): string | undefined {
  return kindOfMeaning(stateMeaning(lists, stateId));
}

// The kind of record a state's meaning is for: a planned hire is Proposed or Open, and a person
// Hired or Left.
function kindOfMeaning(meaning: string | null | undefined): string | undefined {
  if (meaning === "proposed" || meaning === "open") return hireKind;
  if (meaning === "hired" || meaning === "left") return personKind;
  return undefined;
}

// The request that adds a record of a kind, from its value in each column the kind has.
export function newRecordRequest(
  columns: readonly Column[],
  kind: string,
  values: Readonly<Record<string, CellValue>>,
): RowRequest {
  return requestFromChanges(
    columnsOn(columns, kind).map((column) =>
      column.change(values[column.key] as CellValue),
    ),
    kind,
  );
}

// The request that adds a record of a kind, from each column's change.
export const requestFromChanges = (
  changes: readonly RowChange[],
  kind: string,
): RowRequest => ({
  ...requestFor(changes),
  ...(kind === hireKind ? { kind } : {}),
});

// The request that adds a person or planned hire, from each column's value as its kind would save
// it, with every choice column named and no link left empty.
function requestFor(parts: readonly RowChange[]): RowRequest {
  // Every table that adds people has its name, Employee ID, Position and Manager columns, since
  // those who cannot see positions add none, and its dates together or not at all.
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
    stateId,
  } = Object.assign({}, ...parts) as RowRequest;
  return {
    preferredName,
    employeeId,
    positionId,
    ...(stateId === undefined ? {} : { stateId }),
    ...(startDate === undefined ? {} : { startDate, endDate }),
    ...(managerId == null
      ? {}
      : { managerId, ...(managerFrom === undefined ? {} : { managerFrom }) }),
    ...(teamName == null || teamName === "" ? {} : { teamName }),
    ...(isManager === true ? { isManager } : {}),
    ...cellRequest(parts),
  };
}

// The only value changed from another day, since the rest take no date.
export const datedKey = "managerId";

const builtInGroupings = ["managerId", "featureTeams", "positionId", "stateId"];

// Team follows from Manager, so isn't offered apart.
function peopleGroupings(columns: readonly Column[]): RowGrouping<Person>[] {
  const teamOf = new Map(
    columns
      .find(({ key }) => key === "team")
      ?.choices.map(({ id, label }) => [id, label]),
  );
  const managerHeading = ({ id, label }: Choice) => {
    const team = teamOf.get(id);
    return team === undefined || team === label ? label : `${label}, ${team}`;
  };
  return [
    ...builtInGroupings.flatMap((key) =>
      columns.filter((column) => column.key === key),
    ),
    ...columns.filter(
      (column) => column.field !== undefined && holdsChoices(column),
    ),
  ].map((column) =>
    column.key === "managerId"
      ? byChoice(column, managerHeading)
      : byChoice(column),
  );
}

function peopleTable(
  // The columns and lists as the Draft menu's choice shows them, which the rows can be grouped by.
  schema: { fields: readonly Field[]; lists: readonly List[] },
  showDates: boolean,
  showHireDates: boolean,
  showPosition: boolean,
  people: readonly Person[],
  lists: readonly List[],
  canEditHires: boolean,
  onOpen: ((person: Person) => void) | undefined,
  onFill: ((hire: Person) => void) | undefined,
  dataClasses: DataClasses,
  changesFrom: ChangesFrom | undefined,
): RecordTable<Person, RowChange, RowRequest> {
  const kindOf = (row: Person) => row.kind ?? personKind;
  // Each built-in column's class, as the server decides who is sent it. A Start column showing
  // planned hires' target dates alone is part of the hiring plan, not people's start dates.
  const classed = (shown: readonly List[]) => {
    const listClass = (key: string) =>
      shown.find(({ builtIn }) => builtIn === key)?.visibility ?? "general";
    const builtInClasses = builtInColumnTiers({
      positionTier: listClass("positions"),
      stateTier: listClass("hiring-states"),
      dataClasses,
    });
    return (column: Column): Column =>
      column.dataClass !== undefined ||
      (column.key === "startDate" && !showDates)
        ? column
        : { ...column, dataClass: builtInClasses.get(column.key) };
  };
  const hireIds = new Set(people.filter(isHire).map(({ id }) => id));
  const columnsShown = (
    shownFields: readonly Field[],
    shownLists: readonly List[],
    order: readonly string[],
    records: readonly Person[],
  ) =>
    columnsFor(
      shownFields,
      shownLists,
      order,
      showDates,
      records,
      showPosition,
      showHireDates,
      canEditHires,
    );
  return {
    label: "People",
    groupings: peopleGroupings(
      columnsShown(schema.fields, schema.lists, [], people),
    ),
    ungrouped: true,
    exported: {
      recordedAs: "people",
      // Planned hires' rows are the hiring plan, whatever columns are exported.
      held: (rows, show) => [
        ...(rows.some(isHire)
          ? [
              {
                field: "hiringPlan" as const,
                name: classifiedFieldNames.hiringPlan,
                dataClass: dataClasses.hiringPlan,
              },
            ]
          : []),
        // A drafted manager is a past manager to come, so is as past managers are, though live
        // managers are General.
        ...(show !== "live" &&
        rows.some((row) => row.draft?.changed.includes("managerId") === true)
          ? [
              {
                field: "managerHistory" as const,
                name: classifiedFieldNames.managerHistory,
                dataClass: dataClasses.managerHistory,
              },
            ]
          : []),
      ],
    },
    one: "person",
    noun: "people",
    counted: peopleAndHires(isHire),
    kinds: [personKind, hireKind],
    kindOf,
    newRowLabel: (kind) =>
      kind === hireKind ? "New planned hire" : "New person",
    removeLabel: (row) =>
      isHire(row) ? "Remove planned hire" : "Remove person",
    nameOf: (row) => rowName(row, lists),
    nameColumn: "preferredName",
    // On another day only people's managers change, from that day, while their line can.
    readOnlyRecord: (row) =>
      changesFrom === undefined
        ? isHire(row) && !canEditHires
        : isHire(row) || !managerChangesFrom(row.id, changesFrom),
    columnsFor: (shownFields, shownLists, order, records) =>
      columnsShown(shownFields, shownLists, order, records)
        .map(classed(shownLists))
        .map((column) =>
          changesFrom === undefined || column.key === datedKey
            ? column
            : { ...column, readOnly: true },
        )
        .map((column) =>
          column.key === "preferredName" &&
          onOpen !== undefined &&
          onFill !== undefined
            ? {
                ...column,
                mark: (row: Person) =>
                  !isPending(row) &&
                  canFill(row, lists) && (
                    <FillHireButton
                      name={rowName(row, lists)}
                      onFill={() => {
                        onFill(row);
                      }}
                    />
                  ),
              }
            : column,
        ),
    liveRecords: livePeople,
    draftFields: (person, draft, fields, lists) =>
      personDraftFields(person, draft, fields, lists, people),
    recordProblem,
    request: requestFromChanges,
    kindOfNewRow: (values) =>
      kindOfState(lists, asIds(values.stateId ?? [])[0]),
    drafts: (ids) => ({
      ...noDrafts(),
      people: ids.filter((id) => !hireIds.has(id)),
      plannedHires: ids.filter((id) => hireIds.has(id)),
    }),
    ...(onOpen === undefined ? {} : { showDetails: onOpen }),
    keyOf: (row) =>
      personKeyOf({ keyNumber: row.keyNumber, hire: isHire(row) }),
  };
}

type PeopleGridProps = Omit<
  RecordGridProps<Person, RowChange, RowRequest>,
  "records" | "table"
> & {
  // Everyone and every planned hire the user may see; the view decides which are shown, and in
  // what order.
  people: Person[];
  showDates: boolean;
  // Whether the user sees planned hires' target dates, which come with the hiring plan.
  showHireDates?: boolean;
  // Whether the user sees the Positions list's tier; without it they see no Position column and
  // cannot add people, who each need a position.
  showPosition?: boolean;
  // Whether the user may change planned hires, as well as people.
  canEditHires?: boolean;
  // The classes the organization keeps people's details in, which mark the columns holding them.
  dataClasses?: DataClasses;
  // Shows a person's details beside the table.
  onOpen?: ((person: Person) => void) | undefined;
  // Starts filling a planned hire in its details, for those who may.
  onFill?: ((hire: Person) => void) | undefined;
  // The day People shows, when a change of manager is made from it rather than today.
  changesFrom?: ChangesFrom | undefined;
};

export function PeopleGrid({
  people,
  showDates,
  showHireDates = showDates,
  showPosition = true,
  canEditHires = false,
  dataClasses = defaultClasses,
  onOpen,
  onFill,
  changesFrom,
  ...props
}: PeopleGridProps) {
  return (
    <RecordGrid
      records={people}
      table={peopleTable(
        shownSchema(
          props.withDrafts === false ? "live" : props.view.show,
          props.fields,
          props.lists,
        ),
        showDates,
        showHireDates,
        showPosition,
        people,
        props.lists,
        canEditHires,
        onOpen,
        onFill,
        dataClasses,
        changesFrom,
      )}
      canAdd={showPosition && changesFrom === undefined}
      rowActions={changesFrom === undefined}
      {...props}
    />
  );
}
