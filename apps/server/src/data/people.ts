// SPDX-License-Identifier: Apache-2.0

// People and their details: reading everyone a user may see, adding one person or several pasted at
// once, changing a person's details, and deleting a person entered by mistake. Part of the data
// access layer, the only server code that queries the database. Every change is recorded in the
// change history, field by field, with each field's tier: a person's name and Employee ID are
// General, their start and end dates Restricted, and each column's values as sensitive as its list.
// Users see and change only the tiers their roles allow, and changes to Restricted or Confidential
// details are also recorded in the access history.

import { type Database, fieldValues, inChunks, people } from "@fathom/db";
import type { Person, PersonChange, PersonRequest, Tier } from "@fathom/shared";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  type Actor,
  requirePermission,
  requireTierEdit,
  seesTier,
} from "../access.ts";
import { BadRequestError, NotFoundError } from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  refusingDuplicates,
  type Transaction,
} from "./changes.ts";
import { recordEvents } from "./history.ts";
import {
  type ColumnInfo,
  fieldOfValue,
  inListOrder,
  readColumns,
  readValues,
  valueField,
  writeValues,
} from "./values.ts";

type PersonRow = typeof people.$inferSelect;

// A person as the change history records them: their details, and each column's choices, left out
// when none are chosen.
type Recorded = Record<string, unknown>;

const noPerson = "There is no such person";
const duplicateEmployeeId = "Someone already has that Employee ID";
const detailFields = [
  "preferredName",
  "employeeId",
  "startDate",
  "endDate",
] as const;

// The tier of each field of a person: dates are Restricted, each column's values are as sensitive
// as its list, and the rest is General. Every value field recorded is for one of the columns given.
export function personTier(columns: readonly ColumnInfo[]) {
  const tiers = new Map<string, Tier>([
    ["startDate", "restricted"],
    ["endDate", "restricted"],
    ...columns.map((column): [string, Tier] => [
      valueField(column.id),
      column.tier,
    ]),
  ]);
  return (field: string): Tier => tiers.get(field) ?? "general";
}

function recorded(
  row: PersonRow,
  values: ReadonlyMap<string, readonly string[]>,
): Recorded {
  const record: Recorded = {
    preferredName: row.preferredName,
    employeeId: row.employeeId,
    startDate: row.startDate,
    endDate: row.endDate,
  };
  for (const [fieldId, choiceIds] of values) {
    if (choiceIds.length > 0) record[valueField(fieldId)] = [...choiceIds];
  }
  return record;
}

// The changes between two versions of a person, with each field's tier.
export function personChanges(
  columns: readonly ColumnInfo[],
  id: string,
  action: Change["action"],
  before: Recorded | undefined,
  after: Recorded | undefined,
): Change[] {
  const fieldNames = [
    ...detailFields,
    ...new Set(
      [...Object.keys(before ?? {}), ...Object.keys(after ?? {})].filter(
        (field) => fieldOfValue(field) !== null,
      ),
    ),
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

// Refuses changes to tiers the actor may not change.
function requireEdits(actor: Actor, made: readonly Change[]): void {
  for (const tier of new Set(made.map((change) => change.tier))) {
    requireTierEdit(actor, tier);
  }
}

// Records, in the access history, each person whose Restricted or Confidential details changed.
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
      action: "restricted-changed" as const,
      subjectId,
    })),
  );
}

type ChoiceRow = Awaited<ReturnType<typeof inListOrder>>[number];

// Every choice asked for in the requests, in list order, read at once.
async function choicesAskedFor(
  transaction: Transaction,
  requests: readonly {
    values?: Readonly<Record<string, readonly string[]>> | undefined;
  }[],
): Promise<ChoiceRow[]> {
  return inListOrder(
    transaction,
    requests.flatMap((request) => Object.values(request.values ?? {}).flat()),
  );
}

// Checks the choices asked for each column, and returns them in list order. Choices a person already
// has stay valid when retired; new ones must be offered.
function checkedValues(
  columns: readonly ColumnInfo[],
  known: readonly ChoiceRow[],
  requested: Readonly<Record<string, readonly string[]>>,
  current: ReadonlyMap<string, readonly string[]> | undefined,
): Map<string, string[]> {
  const checked = new Map<string, string[]>();
  for (const [fieldId, choiceIds] of Object.entries(requested)) {
    const column = columns.find(({ id }) => id === fieldId);
    if (column === undefined) {
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

// Whether the people given, as they are now, fit their columns: each value from the column's list,
// one choice unless the column takes several, and a value in every required column. Used after an
// undo puts people's values back, since the columns may have changed since.
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
  );
  const choices = await inListOrder(
    transaction,
    [...values.values()].flatMap((byColumn) => [...byColumn.values()].flat()),
  );
  return present.every(({ id }) =>
    columns.every((column) => {
      const chosen = values.get(id)?.get(column.id) ?? [];
      return (
        (!column.required || chosen.length > 0) &&
        (column.multiple || chosen.length <= 1) &&
        chosen.every(
          (choiceId) =>
            choices.find((choice) => choice.id === choiceId)?.listId ===
            column.listId,
        )
      );
    }),
  );
}

// Refuses a person missing a required column's value, or with dates out of order.
function checkComplete(columns: readonly ColumnInfo[], person: Recorded): void {
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

export interface PeopleRead {
  people: Person[];
  columns: ColumnInfo[];
  // Whether what was read included anyone's Restricted details, which the access history records.
  includedRestricted: boolean;
}

// Everyone the actor may see, by preferred name, with the columns whose values they may see. Users
// who cannot see Restricted details see only current staff, so the list does not reveal anyone's
// start or end date before it arrives, and receive no dates.
export async function readPeople(
  database: Database,
  actor: Actor,
): Promise<PeopleRead> {
  const restricted = seesTier(actor, "restricted");
  const columns = (await readColumns(database)).filter((column) =>
    seesTier(actor, column.tier),
  );
  const rows = await database
    .select()
    .from(people)
    .where(
      restricted
        ? undefined
        : sql`(${people.startDate} IS NULL OR ${people.startDate} <= current_date) AND (${people.endDate} IS NULL OR ${people.endDate} >= current_date)`,
    )
    .orderBy(asc(sql`lower(${people.preferredName})`), asc(people.id));
  const values = await readValues(
    database,
    rows.map(({ id }) => id),
    columns.map(({ id }) => id),
  );
  return {
    people: rows.map((row) => ({
      id: row.id,
      preferredName: row.preferredName,
      employeeId: row.employeeId,
      ...(restricted ? { startDate: row.startDate, endDate: row.endDate } : {}),
      values: Object.fromEntries(values.get(row.id) ?? []),
    })),
    columns,
    includedRestricted:
      rows.length > 0 &&
      (restricted || columns.some(({ tier }) => tier !== "general")),
  };
}

// Adds people, all saved together, and returns them with the change set they were saved in.
export async function createPeople(
  database: Database,
  actor: Actor,
  requests: readonly PersonRequest[],
): Promise<{ ids: string[]; changeSetId: string | null }> {
  requirePermission(actor, "people:edit");
  return refusingDuplicates(duplicateEmployeeId, () =>
    database.transaction(async (transaction) => {
      const columns = await readColumns(transaction, true);
      const known = await choicesAskedFor(transaction, requests);
      const made: Change[] = [];
      const rows: PersonRow[] = [];
      const chosen: { personId: string; fieldId: string; choiceId: string }[] =
        [];
      for (const request of requests) {
        const id = randomUUID();
        const values = checkedValues(columns, known, request.values, undefined);
        const row: PersonRow = {
          id,
          preferredName: request.preferredName,
          employeeId: request.employeeId,
          startDate: request.startDate ?? null,
          endDate: request.endDate ?? null,
        };
        const after = recorded(row, values);
        checkComplete(columns, after);
        made.push(...personChanges(columns, id, "created", undefined, after));
        rows.push(row);
        for (const [fieldId, choiceIds] of values) {
          chosen.push(
            ...choiceIds.map((choiceId) => ({
              personId: id,
              fieldId,
              choiceId,
            })),
          );
        }
      }
      requireEdits(actor, made);
      // Everyone in one statement, and their values in as few as PostgreSQL allows.
      await transaction.insert(people).values(rows);
      for (const chunk of inChunks(chosen)) {
        await transaction.insert(fieldValues).values(chunk);
      }
      const ids = rows.map(({ id }) => id);
      await recordSensitiveChanges(transaction, actor.user.id, made);
      return {
        ids,
        changeSetId: await recordChanges(transaction, actor.user.id, made),
      };
    }),
  );
}

async function lockPerson(
  transaction: Transaction,
  id: string,
): Promise<PersonRow> {
  const [row] = await transaction
    .select()
    .from(people)
    .where(eq(people.id, id))
    .for("update");
  if (row === undefined) throw new NotFoundError(noPerson);
  return row;
}

// A person's details and values as recorded, locked for a change.
async function lockRecorded(
  transaction: Transaction,
  columns: readonly ColumnInfo[],
  id: string,
): Promise<{
  row: PersonRow;
  values: Map<string, string[]>;
  before: Recorded;
}> {
  const row = await lockPerson(transaction, id);
  const values =
    (
      await readValues(
        transaction,
        [id],
        columns.map((column) => column.id),
      )
    ).get(id) ?? new Map<string, string[]>();
  return { row, values, before: recorded(row, values) };
}

// Changes some of a person's details; each column named has its choices replaced.
export async function updatePerson(
  database: Database,
  actor: Actor,
  id: string,
  change: PersonChange,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  return refusingDuplicates(duplicateEmployeeId, () =>
    database.transaction(async (transaction) => {
      const columns = await readColumns(transaction, true);
      const { row, values, before } = await lockRecorded(
        transaction,
        columns,
        id,
      );
      const changedValues = checkedValues(
        columns,
        await choicesAskedFor(transaction, [change]),
        change.values ?? {},
        values,
      );
      const next: PersonRow = {
        ...row,
        ...(change.preferredName === undefined
          ? {}
          : { preferredName: change.preferredName }),
        ...(change.employeeId === undefined
          ? {}
          : { employeeId: change.employeeId }),
        ...(change.startDate === undefined
          ? {}
          : { startDate: change.startDate }),
        ...(change.endDate === undefined ? {} : { endDate: change.endDate }),
      };
      const after = recorded(next, new Map([...values, ...changedValues]));
      checkComplete(columns, after);
      const made = personChanges(columns, id, "changed", before, after);
      requireEdits(actor, made);
      if (made.length === 0) return null;
      await transaction
        .update(people)
        .set({
          preferredName: next.preferredName,
          employeeId: next.employeeId,
          startDate: next.startDate,
          endDate: next.endDate,
        })
        .where(eq(people.id, id));
      for (const [fieldId, choiceIds] of changedValues) {
        await writeValues(transaction, id, fieldId, choiceIds);
      }
      await recordSensitiveChanges(transaction, actor.user.id, made);
      return recordChanges(transaction, actor.user.id, made);
    }),
  );
}

// Deletes a person entered by mistake, with their values, recording everything they held. People
// who leave are given an end date instead. Nothing uses people yet; later slices refuse to delete a
// person who is, for example, on a team.
export async function deletePerson(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  return database.transaction(async (transaction) => {
    const columns = await readColumns(transaction, true);
    const { before } = await lockRecorded(transaction, columns, id);
    const made = personChanges(columns, id, "deleted", before, undefined);
    requireEdits(actor, made);
    await transaction.delete(people).where(eq(people.id, id));
    await recordSensitiveChanges(transaction, actor.user.id, made);
    return recordChanges(transaction, actor.user.id, made);
  });
}
