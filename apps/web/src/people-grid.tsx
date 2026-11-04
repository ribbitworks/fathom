// SPDX-License-Identifier: Apache-2.0

// The People table: the table of records record-grid.tsx sets out, with what is particular to
// people. Its columns are each person's name and Employee ID, the added columns, and, for those who
// may see them, start and end dates. A person's Employee ID must be one no one else has, and their
// end date cannot be before their start date.

import type {
  Field,
  List,
  Person,
  PersonChange,
  PersonRequest,
} from "@fathom/shared";
import { builtInColumnNames, personLengths } from "@fathom/shared";
import { personDraftFields } from "./draft-details.tsx";
import { noDrafts } from "./drafts.ts";
import { sameName } from "./lists.ts";
import {
  cellColumn,
  type Column as RecordColumn,
  inOrder,
  liveRecordsOf,
  type RecordActions,
  RecordGrid,
  type RecordGridHandle,
  type RecordGridProps,
  type RecordTable,
  type RowProblem,
} from "./record-grid.tsx";
import type { CellValue } from "./table-view.ts";

export type PeopleActions = RecordActions<Person, PersonChange, PersonRequest>;

export type PeopleGridHandle = RecordGridHandle;

export type Column = RecordColumn<Person, PersonChange>;

// The keys of a person's built-in details.
export type DetailKey =
  "preferredName" | "employeeId" | "startDate" | "endDate";

const detailKeys: readonly DetailKey[] = [
  "preferredName",
  "employeeId",
  "startDate",
  "endDate",
];

// The People table's columns, in the order given by their keys: each person's name and Employee ID,
// the added columns, and, for those who may see them, start and end dates. A column the order does
// not name yet comes at the end.
export function columnsFor(
  fields: readonly Field[],
  lists: readonly List[],
  order: readonly string[],
  showDates: boolean,
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
  return inOrder(
    [
      builtIn("preferredName", "text", true, personLengths.preferredName),
      builtIn("employeeId", "text", true, personLengths.employeeId),
      ...(showDates
        ? [builtIn("startDate", "date"), builtIn("endDate", "date")]
        : []),
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
// detail and column a draft changes has its live value back.
export const livePeople = (people: readonly Person[]): Person[] =>
  liveRecordsOf(people, detailKeys);

// What is wrong with a person's details taken together, if anything, and in which column: an
// Employee ID someone else has, or an end date before the start date, marked in the date changed,
// or in the end date. The Employee ID is checked when it is what changed, or when a person is added.
function recordProblem(
  values: Record<string, CellValue>,
  others: () => Record<string, CellValue>[],
  changed?: string,
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
  return undefined;
}

// The request that adds a person, from each column's value as its kind would save it, with every
// choice column named and no link left empty.
function requestFor(parts: readonly PersonChange[]): PersonRequest {
  // Every table has its name and Employee ID columns, and its dates together or not at all.
  const { preferredName, employeeId, startDate, endDate } = Object.assign(
    {},
    ...parts,
  ) as PersonRequest;
  return {
    preferredName,
    employeeId,
    ...(startDate === undefined ? {} : { startDate, endDate }),
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
): RecordTable<Person, PersonChange, PersonRequest> {
  return {
    label: "People",
    one: "person",
    noun: "people",
    newRowLabel: "New person",
    removeLabel: "Remove person",
    nameOf: (person) => person.preferredName,
    columnsFor: (fields, lists, order) =>
      columnsFor(fields, lists, order, showDates),
    liveRecords: livePeople,
    draftFields: personDraftFields,
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
    <RecordGrid records={people} table={peopleTable(showDates)} {...props} />
  );
}
