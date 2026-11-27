// SPDX-License-Identifier: Apache-2.0

// A person's details: their fields and the tiers that cover them, their values, and the checks on
// the values asked for and the changes recorded. Part of the data access layer.

import { type Database, fieldOfValue, people, type Reader } from "@fathom/db";
import {
  askedColumnIds,
  type ColumnValueMap,
  type ColumnValues,
  columnValueMaps,
  eachColumnValueMap,
  isLink,
  type FieldType,
  type Flags,
  type Link,
  type Links,
  type Notes,
  type Numbers,
  type SomeRequestedColumnValues,
  type Texts,
  textProblem,
  type Tier,
} from "@fathom/shared";
import { inArray } from "drizzle-orm";
import { type Actor, seesSensitivity } from "../access.ts";
import { BadRequestError } from "../errors.ts";
import { type Change, changesBetween, type Transaction } from "./changes.ts";
import { fitsColumns, type Recorded, tidy } from "./draft-records.ts";
import { choicesWithAdded, refuseHeldColumns } from "./added-columns.ts";
import { checkBuiltInChoice } from "./built-in-lists.ts";
import { isFlag, isNote, isNumber, isText, typeOf } from "./column-types.ts";
import { recordEvents } from "./history.ts";
import { keptNote } from "./records.ts";
import { reportingFields } from "./reporting.ts";
import {
  type ColumnInfo,
  type TableColumns,
  type FieldValue,
  inListOrder,
  readColumns,
  readValues,
  recordedValues,
  valueField,
  valueFieldsIn,
} from "./values.ts";

export type PersonRow = typeof people.$inferSelect;

export const noPerson = "There is no such person";
export const detailFields = [
  "preferredName",
  "employeeId",
  "positionId",
  "startDate",
  "endDate",
  "isManager",
  "stateId",
] as const;
export const personFields = [...detailFields, ...reportingFields];

// The fields of a person kept in classes of their own: their dates, and changes to their manager.
export const personalDetailFields = [
  "startDate",
  "endDate",
  "managerId",
  "managerFrom",
] as const;

// The tier of each field of a person: dates are in their own classes, and changes to their manager
// in past managers', since they name them; the position, state, and each column's values are as
// sensitive as their list, and the rest is General. Every value field recorded is for one of the
// columns given.
export function personTier(columns: TableColumns) {
  const { startDate, endDate, managerHistory } = columns.dataClasses;
  const tiers = new Map<string, Tier>([
    ["positionId", columns.positionTier],
    ["stateId", columns.stateTier],
    ["startDate", startDate],
    ["endDate", endDate],
    ["managerId", managerHistory],
    ["managerFrom", managerHistory],
    ...columns.map((column): [string, Tier] => [
      valueField(column.id),
      column.tier,
    ]),
  ]);
  return (field: string): Tier => tiers.get(field) ?? "general";
}

// Whether an actor sees a field of a person's draft: a detail, or a value in one of the columns
// given, of a class the actor sees. Deciding a draft needs every field it holds seen.
export function seesPersonField(actor: Actor, columns: TableColumns) {
  const tierOf = personTier(columns);
  const shown = new Set(columns.map(({ id }) => valueField(id)));
  return (field: string): boolean =>
    (fieldOfValue(field) === null || shown.has(field)) &&
    seesSensitivity(actor, tierOf(field));
}

export function recorded(
  row: PersonRow,
  values: ReadonlyMap<string, FieldValue>,
): Recorded {
  return {
    preferredName: row.preferredName,
    employeeId: row.employeeId,
    positionId: row.positionId,
    startDate: row.startDate,
    endDate: row.endDate,
    // Recorded only when marked, so adding or removing someone who is not records nothing for it.
    ...(row.isManager ? { isManager: true } : {}),
    // Recorded only when chosen; with none, a person has the first state of their meaning.
    ...(row.stateId === null ? {} : { stateId: row.stateId }),
    ...recordedValues(values),
  };
}

// The meaning of a person's state: Left once their end date has passed, and Hired until then.
export const meaningOn = (person: Recorded, today: string): "hired" | "left" =>
  typeof person.endDate === "string" && person.endDate < today
    ? "left"
    : "hired";

// Refuses a state that is not a hiring state with the meaning the person's end date gives them.
// A state they already have stays valid when retired.
export async function checkState(
  reader: Reader,
  person: Recorded,
  today: string,
  had: unknown,
): Promise<void> {
  if (typeof person.stateId !== "string") return;
  const meaning = await checkBuiltInChoice(
    reader,
    "hiring-states",
    person.stateId,
    had,
  );
  if (meaning === "proposed" || meaning === "open") {
    throw new BadRequestError("That state is for planned hires");
  }
  if (meaning !== meaningOn(person, today)) {
    throw new BadRequestError(
      meaning === "left"
        ? "A Left state is for someone whose end date has passed"
        : "This person has left, so choose a state meaning Left",
    );
  }
}

// A person as recorded, with Manager? left out unless checked, or unchecked from a live check,
// since only a check is recorded: so unchecking what the live person does not have changes nothing.
export function withMark(
  person: Recorded,
  live: Recorded | undefined,
): Recorded {
  if (person.isManager === true || live?.isManager === true) return person;
  return Object.fromEntries(
    Object.entries(person).filter(([field]) => field !== "isManager"),
  );
}

// A record's choices, by column, as recorded.
export function valuesOf(person: Recorded): Map<string, string[]> {
  return new Map(
    Object.entries(person).flatMap(([field, value]) => {
      const fieldId = fieldOfValue(field);
      return fieldId === null || !Array.isArray(value)
        ? []
        : [[fieldId, value.map(String)]];
    }),
  );
}

type Shows = (columnId: string) => boolean;

const showsAll: Shows = () => true;

// What a column of one value holds for a person or planned hire, by column, as recorded, in only
// the columns shown. Each type's value is told apart by its shape, which no other type's shares.
const valuesHolding = <Held, Read>(
  person: Recorded,
  holds: (value: unknown) => value is Held,
  shows: Shows,
  copied: (held: Held) => Read,
): Record<string, Read> =>
  Object.fromEntries(
    Object.entries(person).flatMap(([field, value]) => {
      const fieldId = fieldOfValue(field);
      return fieldId === null || !shows(fieldId) || !holds(value)
        ? []
        : [[fieldId, copied(value)]];
    }),
  );

// A person's or planned hire's links, by column, as recorded.
const linksOf = (person: Recorded, shows: Shows): Links =>
  valuesHolding(person, isLink, shows, ({ address, text }) => ({
    address,
    text,
  }));

const notesOf = (person: Recorded, shows: Shows): Notes =>
  valuesHolding(person, isNote, shows, String);

const numbersOf = (person: Recorded, shows: Shows): Numbers =>
  valuesHolding(person, isNumber, shows, Number);

const flagsOf = (person: Recorded, shows: Shows): Flags =>
  valuesHolding(person, isFlag, shows, (): true => true);

const textsOf = (person: Recorded, shows: Shows): Texts =>
  valuesHolding(person, isText, shows, ({ text }) => text);

const columnValueReaders: {
  [Kind in ColumnValueMap]: (
    person: Recorded,
    shows: Shows,
  ) => ColumnValues[Kind];
} = {
  links: linksOf,
  notes: notesOf,
  numbers: numbersOf,
  flags: flagsOf,
  texts: textsOf,
};

// A person's or planned hire's values in each map, by column, as recorded, in only the columns
// shown.
export const columnValuesOf = (
  record: Recorded,
  shows = showsAll,
): ColumnValues =>
  eachColumnValueMap<ColumnValues>((map) =>
    // The map is one of the readers' own.
    // eslint-disable-next-line security/detect-object-injection
    columnValueReaders[map](record, shows),
  );

// A person's or planned hire's values, by column, in only the columns the reader is shown.
export const shownValuesOf = (record: Recorded, shows: Shows) => ({
  values: Object.fromEntries(
    [...valuesOf(record)].filter(([columnId]) => shows(columnId)),
  ),
  ...columnValuesOf(record, shows),
});

// The changes between two versions of a person, with each field's tier.
export function personChanges(
  columns: TableColumns,
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change[] {
  const fieldNames = [
    ...personFields,
    ...new Set(valueFieldsIn(before, after)),
  ];
  return changesBetween(
    "person",
    id,
    action,
    before,
    after,
    fieldNames,
    personTier(columns),
  );
}

// Records, in the access history, each person whose Personal or Confidential details changed,
// live or in a draft.
export async function recordSensitiveChanges(
  transaction: Pick<Database, "insert">,
  actorId: string | null,
  made: readonly Change[],
): Promise<void> {
  const changed = new Set(
    made
      .filter(
        (change) => change.recordType === "person" && change.tier !== "general",
      )
      .map((change) => change.recordId),
  );
  await recordEvents(
    transaction,
    [...changed].map((subjectId) => ({
      actorId,
      action: "personal-changed" as const,
      subjectId,
    })),
  );
}

type ChoiceRow = Awaited<ReturnType<typeof inListOrder>>[number];

// Every choice asked for in the requests, live or drafted to be added as the editor sees it, in
// list order, read at once. The drafts lock keeps them from being deleted, or their drafts
// discarded, until the drafts holding them are saved.
export async function choicesAskedFor(
  transaction: Transaction,
  editor: string,
  requests: readonly (Parameters<typeof askedColumnIds>[0] & {
    values?: Readonly<Record<string, readonly string[]>> | undefined;
  })[],
): Promise<ChoiceRow[]> {
  await refuseHeldColumns(
    transaction,
    editor,
    requests.flatMap(askedColumnIds),
  );
  return choicesWithAdded(
    transaction,
    editor,
    requests.flatMap((request) => Object.values(request.values ?? {}).flat()),
  );
}

// Checks the choices asked for each column, and returns them in list order. Choices a person
// already has stay valid when retired; new ones must be offered.
export function checkedValues(
  columns: readonly ColumnInfo[],
  known: readonly ChoiceRow[],
  requested: Readonly<Record<string, readonly string[]>>,
  current: ReadonlyMap<string, readonly string[]> | undefined,
): Map<string, string[]> {
  const checked = new Map<string, string[]>();
  for (const [fieldId, choiceIds] of Object.entries(requested)) {
    const column = columns.find(({ id }) => id === fieldId);
    if (column?.type !== "choice") {
      throw new BadRequestError("There is no such column");
    }
    const choices = known.filter(({ id }) => choiceIds.includes(id));
    if (
      choices.length !== choiceIds.length ||
      choices.some(({ listId }) => listId !== column.listId)
    ) {
      throw new BadRequestError(`Choose ${column.name} from the column's list`);
    }
    const had = current?.get(fieldId) ?? [];
    if (
      choices.some(
        ({ id, retired }) =>
          !had.includes(id) && (retired || column.listRetired),
      )
    ) {
      throw new BadRequestError(`Choose a ${column.name} that is offered`);
    }
    if (!column.multiple && choices.length > 1) {
      throw new BadRequestError(`${column.name} takes one choice`);
    }
    checked.set(
      fieldId,
      choices.map(({ id }) => id),
    );
  }
  return checked;
}

// What is asked for columns of one type, as recorded, refusing any column not of that type.
function checkedOfType<Asked>(
  columns: readonly ColumnInfo[],
  requested: Readonly<Record<string, Asked>> | undefined,
  type: FieldType,
  recorded: (asked: Asked, column: ColumnInfo) => unknown,
): Recorded {
  return Object.fromEntries(
    Object.entries(requested ?? {}).map(
      ([fieldId, asked]): [string, unknown] => {
        const column = columns.find(({ id }) => id === fieldId);
        if (column?.type !== type) {
          throw new BadRequestError("There is no such column");
        }
        return [valueField(fieldId), recorded(asked, column)];
      },
    ),
  );
}

// The links asked for each column, as recorded: a link, or no choices for a link removed. The
// shared schema has already checked and normalized each link.
const checkedLinks = (
  columns: readonly ColumnInfo[],
  requested: Readonly<Record<string, Link | null>> | undefined,
): Recorded =>
  checkedOfType(columns, requested, "link", (link) =>
    link === null ? [] : { ...link },
  );

// The notes asked for each column, as recorded: a note kept exactly as sent, or no choices for a
// note removed, as an empty note also is. A note holding anything notes do not allow is refused
// rather than cleaned, so what is kept is what the editor showed.
const checkedNotes = (
  columns: readonly ColumnInfo[],
  requested: Readonly<Record<string, string | null>> | undefined,
): Recorded =>
  checkedOfType(columns, requested, "note", (note) => keptNote(note) ?? []);

// The numbers asked for each column, as recorded, or no choices for a number removed. The shared
// schema has already checked each number.
const checkedNumbers = (
  columns: readonly ColumnInfo[],
  requested: Readonly<Record<string, number | null>> | undefined,
): Recorded =>
  checkedOfType(columns, requested, "number", (number) => number ?? []);

// A record's values in the columns given: those a request names replace those it has, each checked
// against its column, given the choices asked for, and every required column must then hold one.
export function askedColumnValues(
  columns: readonly ColumnInfo[],
  known: readonly ChoiceRow[],
  request: Parameters<typeof checkedColumnValues>[1] & {
    values?: Readonly<Record<string, readonly string[]>> | undefined;
  },
  current: Recorded | undefined,
): Recorded {
  const had = current === undefined ? undefined : valuesOf(current);
  const chosen = checkedValues(columns, known, request.values ?? {}, had);
  const kept = Object.fromEntries(
    Object.entries(current ?? {}).filter(
      ([field]) => fieldOfValue(field) !== null,
    ),
  );
  const values: Recorded = {
    ...kept,
    ...Object.fromEntries(
      [...chosen].map(([fieldId, ids]) => [valueField(fieldId), ids]),
    ),
    ...checkedColumnValues(columns, request),
  };
  for (const column of columns) {
    if (
      column.required &&
      typeOf(column).count(values[valueField(column.id)]) === 0
    ) {
      throw new BadRequestError(`${column.name} must be filled in`);
    }
  }
  return tidy(values);
}

// The boxes asked for each column, as recorded: a ticked box, or no choices for one unticked.
const checkedFlags = (
  columns: readonly ColumnInfo[],
  requested: Readonly<Record<string, true | null>> | undefined,
): Recorded => checkedOfType(columns, requested, "flag", (box) => box ?? []);

// The texts asked for each column, as recorded, or none, for a text removed. Each must fit its
// column: on one line unless it holds several, and within its limit.
const checkedTexts = (
  columns: readonly ColumnInfo[],
  requested: Readonly<Record<string, string | null>> | undefined,
): Recorded =>
  checkedOfType(columns, requested, "text", (text, column) => {
    if (text === null) return [];
    const problem = textProblem(text, column.multiline);
    if (problem !== undefined) {
      throw new BadRequestError(`${column.name}: ${problem}`);
    }
    return { text };
  });

const columnValueCheckers: {
  [Kind in ColumnValueMap]: (
    columns: readonly ColumnInfo[],
    requested: SomeRequestedColumnValues[Kind],
  ) => Recorded;
} = {
  links: checkedLinks,
  notes: checkedNotes,
  numbers: checkedNumbers,
  flags: checkedFlags,
  texts: checkedTexts,
};

// The values asked for in each map, as recorded, checked in turn.
export function checkedColumnValues(
  columns: readonly ColumnInfo[],
  requested: SomeRequestedColumnValues,
): Recorded {
  // Only a type parameter lets the compiler match each map's checker to the values asked for in it.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  const checkedIn = <Kind extends ColumnValueMap>(map: Kind) =>
    // The map is one of the checkers' own.
    // eslint-disable-next-line security/detect-object-injection
    columnValueCheckers[map](columns, requested[map]);
  return Object.fromEntries(
    columnValueMaps.flatMap((map) => Object.entries(checkedIn(map))),
  );
}

// Whether the live people given, as they are now, fit their columns, as fitsColumns sets out. Used
// after an undo or an approval puts people's values in place, since the columns may have changed
// since.
export async function peopleFitColumns(
  transaction: Transaction,
  personIds: readonly string[],
): Promise<boolean> {
  const present = await transaction
    .select({ id: people.id })
    .from(people)
    .where(inArray(people.id, [...personIds]));
  if (present.length === 0) return true;
  const columns = await readColumns(transaction);
  const values = await readValues(
    transaction,
    present.map(({ id }) => id),
    columns.map(({ id }) => id),
    "person",
  );
  const choices = await inListOrder(
    transaction,
    [...values.values()].flatMap((byColumn) =>
      [...byColumn.values()].flatMap((value) =>
        Array.isArray(value) ? value : [],
      ),
    ),
  );
  const listOf = new Map(choices.map(({ id, listId }) => [id, listId]));
  return present.every(({ id }) =>
    fitsColumns(
      columns,
      listOf,
      Object.fromEntries(
        [...(values.get(id) ?? [])].map(([fieldId, value]) => [
          valueField(fieldId),
          value,
        ]),
      ),
    ),
  );
}

// Refuses a person missing a required column's value, or with dates out of order.
export function checkComplete(
  columns: readonly ColumnInfo[],
  person: Recorded,
): void {
  for (const column of columns) {
    if (column.required && person[valueField(column.id)] === undefined) {
      throw new BadRequestError(`${column.name} must be filled in`);
    }
  }
  const { startDate, endDate } = person;
  if (
    typeof startDate === "string" &&
    typeof endDate === "string" &&
    endDate < startDate
  ) {
    throw new BadRequestError("The end date cannot be before the start date");
  }
}
