// SPDX-License-Identifier: Apache-2.0

// The People table: the table of records record-grid.tsx sets out, with what is particular to
// people and planned hires, its two kinds of row. Its columns are each row's name, ID, position,
// and state, Hired for every person, their manager, whether they are marked as a manager, whom
// others can report to, their team, which follows from their manager, and their own team's name,
// the added columns, the month a planned hire is expected, and, for those who may see them, start
// and end dates and the date their manager is theirs from. A planned hire's name is optional, and
// while it has none its position and ID stand in for it; it has no end date, mark as a manager,
// date its manager is its own from, or team name, and its start date is its target date. No two
// rows have the same ID, a person's end date cannot be before their start date, and an ID typed in
// cannot look like a temporary one.

import type { Choice, Field, List, Person, Show } from "@fathom/shared";
import {
  builtInColumnNames,
  personLengths,
  temporaryIdPrefix,
} from "@fathom/shared";
import { ActionIcon, Menu, VisuallyHidden } from "@mantine/core";
import { notShown, personDraftFields } from "./draft-details.tsx";
import { noDrafts } from "./drafts.ts";
import { offered, sameName } from "./lists.ts";
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
import {
  isHire,
  type RowChange,
  rowName,
  type RowRequest,
} from "./people-rows.ts";
import type { CellValue } from "./table-view.ts";
import { count } from "./numbers.ts";
import { today } from "./today.ts";
import { Icon } from "./icons.tsx";
import classes from "./people-grid.module.css";

export type PeopleActions = RecordActions<Person, RowChange, RowRequest>;

export type PeopleGridHandle = RecordGridHandle;

export type Column = RecordColumn<Person, RowChange>;

const personKind = "person";
const hireKind = "planned-hire";

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

// Whether someone may be given as a manager: live and marked as a manager live, so neither drafted
// to be added or removed nor still being added, and not gone by today, as far as the reader sees
// their end date. Fathom checks the rest, such as loops.
const mayManage = (person: Person, today: string) =>
  !isHire(person) &&
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
      const manages = mayManage(person, today);
      return !isHire(person) && (manages || named.has(person.id))
        ? [choice(person.id, person.preferredName, !manages)]
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

const month = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// The months planned hires are expected, earliest first, as choices named as people read them, such
// as Mar 2027, so the column sorts and filters by month.
function monthChoices(people: readonly Person[]): Choice[] {
  return [...new Set(people.flatMap(({ expected }) => expected ?? []))]
    .sort()
    .map((expected) =>
      choice(
        expected,
        month.format(new Date(`${expected}-01T00:00:00Z`)),
        false,
      ),
    );
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
// the date their manager is theirs from, their team and team name, the added columns, which planned
// hires have only where offered on them, and the month a planned hire is expected. A column the
// order does not name yet comes at the end. Managers are picked from the people given.
export function columnsFor(
  fields: readonly Field[],
  lists: readonly List[],
  order: readonly string[],
  showDates: boolean,
  people: readonly Person[] = [],
  showPosition = true,
  showHireDates = showDates,
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
  const personal = (column: Column): Column => ({
    ...column,
    offeredOn: peopleOnly,
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
    // A planned hire is Proposed or Open, and hired by filling it. A person is Hired, or Left once
    // their end date has passed, which the state they show already says, so they are offered only
    // states of its meaning. A new person may be either, as the end date given decides, which the
    // server checks.
    pickableOn: (option, row, rowKind) => {
      if (hiresOnly(rowKind)) {
        return option.meaning === "proposed" || option.meaning === "open";
      }
      if (row === undefined) {
        return option.meaning === "hired" || option.meaning === "left";
      }
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
    value: (row) => chosen(row.expected),
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
        ? [builtIn("startDate", "date"), personal(builtIn("endDate", "date"))]
        : []),
      // A planned hire's target date is part of the hiring plan, not a personal detail, so readers
      // who see the plan but not people's dates see it for hires alone.
      ...(!showDates && showHireDates
        ? [{ ...builtIn("startDate", "date"), offeredOn: hiresOnly }]
        : []),
      manager,
      personal({
        ...builtIn("isManager", "flag"),
        choices: [markedChoice],
        emptyLabel: "No",
      }),
      ...(showDates
        ? [
            // Fathom takes today, or a new person's start date, when no date is given.
            personal({
              ...builtIn("managerFrom", "date"),
              change: (value: CellValue) =>
                value === "" ? {} : { managerFrom: value as string },
            }),
          ]
        : []),
      team,
      personal({
        ...builtIn("teamName", "text", false, personLengths.teamName),
        breaksDown: false,
      }),
      // A column's type is the kind of its cells. Planned hires have the columns offered on them,
      // where nothing is required.
      ...fields.map((field): Column => ({
        ...cellColumn<Person, RowChange>(field.id, field.type, {
          label: field.name,
          required: field.required,
          field,
          choices: lists.find(({ id }) => id === field.listId)?.choices ?? [],
          multiple: field.multiple,
        }),
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

export function livePeople(people: readonly Person[]): Person[] {
  const made = liveMade.get(people);
  if (made !== undefined) return made;
  const live = makeLivePeople(people);
  liveMade.set(people, live);
  return live;
}

// Everyone as the Draft menu's choice shows them: as drafted, with the drafts applied, where a
// rejected draft is taken back and someone drafted to be removed is gone, or as they are live.
export function peopleAsShown(people: readonly Person[], show: Show): Person[] {
  if (show !== "drafts")
    return show === "live" ? livePeople(people) : [...people];
  const live = new Map(livePeople(people).map((person) => [person.id, person]));
  return people.flatMap((person) => {
    if (person.draft?.state === "rejected") {
      const before = live.get(person.id);
      return before === undefined ? [] : [before];
    }
    return person.draft?.action === "deleted" ? [] : [person];
  });
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
    ...withNotes(parts.flatMap((part) => Object.entries(part.notes ?? {}))),
  };
}

// A new person's notes, left out when they have none, as for those added before notes were.
const withNotes = (notes: [string, string | null][]) =>
  notes.length === 0 ? {} : { notes: Object.fromEntries(notes) };

// The button at the end of a person's Name cell that shows their details beside the table, shown
// while the row is pointed at or one of its cells has focus, so they show without the row's menu.
// From the keyboard, the row's menu offers the same.
function ShowDetailsButton({
  row,
  onOpen,
}: {
  row: Person;
  onOpen: (person: Person) => void;
}) {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="sm"
      tabIndex={-1}
      className={classes.showDetails}
      aria-label={`Show details of ${row.preferredName}`}
      // The cell would otherwise take the click as choosing or editing it.
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(row);
      }}
    >
      <Icon name="open" />
    </ActionIcon>
  );
}

function peopleTable(
  showDates: boolean,
  showHireDates: boolean,
  showPosition: boolean,
  people: readonly Person[],
  lists: readonly List[],
  canEditHires: boolean,
  onOpen: ((person: Person) => void) | undefined,
): RecordTable<Person, RowChange, RowRequest> {
  const kindOf = (row: Person) => row.kind ?? personKind;
  const hireIds = new Set(people.filter(isHire).map(({ id }) => id));
  return {
    label: "People",
    one: "person",
    noun: "people",
    counted: {
      noun: "people and planned hires",
      counted: (rows) => {
        const hires = rows.filter(isHire).length;
        const people = rows.length - hires;
        return [
          ...(people > 0 || hires === 0
            ? [`${count(people)} ${people === 1 ? "person" : "people"}`]
            : []),
          ...(hires > 0
            ? [
                `${count(hires)} ${hires === 1 ? "planned hire" : "planned hires"}`,
              ]
            : []),
        ].join(" and ");
      },
    },
    kinds: [personKind, hireKind],
    kindOf,
    newRowLabel: (kind) =>
      kind === hireKind ? "New planned hire" : "New person",
    removeLabel: (row) =>
      isHire(row) ? "Remove planned hire" : "Remove person",
    nameOf: (row) => rowName(row, lists),
    readOnlyRecord: (row) => isHire(row) && !canEditHires,
    columnsFor: (fields, lists, order, records) =>
      columnsFor(
        fields,
        lists,
        order,
        showDates,
        records,
        showPosition,
        showHireDates,
      ).map((column) =>
        column.key === "preferredName" && onOpen !== undefined
          ? {
              ...column,
              mark: (row: Person) =>
                !isHire(row) &&
                !isPending(row) && (
                  <ShowDetailsButton row={row} onOpen={onOpen} />
                ),
            }
          : column,
      ),
    liveRecords: livePeople,
    draftFields: (person, draft, fields, lists) =>
      personDraftFields(person, draft, fields, lists, people),
    recordProblem,
    request: (changes, kind) => ({
      ...requestFor(changes),
      ...(kind === hireKind ? { kind } : {}),
    }),
    drafts: (ids) => ({
      ...noDrafts(),
      people: ids.filter((id) => !hireIds.has(id)),
      plannedHires: ids.filter((id) => hireIds.has(id)),
    }),
    // Planned hires have no details of their own to show, nor has a row not saved yet.
    ...(onOpen === undefined
      ? {}
      : {
          menuItems: (row: Person) =>
            !isHire(row) &&
            !isPending(row) && (
              <Menu.Item
                onClick={() => {
                  onOpen(row);
                }}
              >
                Show details
              </Menu.Item>
            ),
        }),
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
  // Shows a person's details beside the table.
  onOpen?: ((person: Person) => void) | undefined;
};

export function PeopleGrid({
  people,
  showDates,
  showHireDates = showDates,
  showPosition = true,
  canEditHires = false,
  onOpen,
  ...props
}: PeopleGridProps) {
  return (
    <RecordGrid
      records={people}
      table={peopleTable(
        showDates,
        showHireDates,
        showPosition,
        people,
        props.lists,
        canEditHires,
        onOpen,
      )}
      canAdd={showPosition}
      {...props}
    />
  );
}
