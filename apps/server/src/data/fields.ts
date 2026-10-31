// SPDX-License-Identifier: Apache-2.0

// The columns people add to the People table, each drawing on a list: adding, changing, and deleting
// them. Their order is kept with the built-in columns', in column-order.ts. Part of the data access
// layer, the only server code that queries the database; the caller checks the actor may change
// planning configuration. A column's settings are General data, and are recorded in the change
// history field by field. Deleting a column deletes its values, which are recorded as changes to
// each person who had one.

import { type Database, fields, fieldValues, lists, people } from "@fathom/db";
import type { Field, FieldRequest } from "@fathom/shared";
import { asc, count, countDistinct, eq, gt, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type Actor, requirePermission, requireTierEdit } from "../access.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import {
  type Change,
  changesBetween,
  recordChanges,
  refusingDuplicates,
  type Saved,
  type Transaction,
} from "./changes.ts";
import { appendColumn } from "./column-order.ts";
import { personChanges, recordSensitiveChanges } from "./people.ts";
import {
  type FieldRow,
  readColumns,
  readValues,
  valueField,
} from "./values.ts";

const noField = "There is no such column";
const duplicateField = "There is already a column with that name";

export const fieldFields = [
  "tableName",
  "name",
  "listId",
  "multiple",
  "required",
] as const;

const fieldChanges = (
  id: string,
  action: Change["action"],
  before: FieldRow | undefined,
  after: FieldRow | undefined,
) => changesBetween("field", id, action, before, after, fieldFields);

export function toField(row: FieldRow): Field {
  return {
    id: row.id,
    name: row.name,
    listId: row.listId,
    multiple: row.multiple,
    required: row.required,
  };
}

// Every column on people, locked.
export async function lockFields(
  transaction: Transaction,
): Promise<FieldRow[]> {
  return transaction
    .select()
    .from(fields)
    .where(eq(fields.tableName, "people"))
    .orderBy(asc(fields.id))
    .for("update");
}

async function lockField(
  transaction: Transaction,
  id: string,
): Promise<FieldRow> {
  const row = (await lockFields(transaction)).find((field) => field.id === id);
  if (row === undefined) throw new NotFoundError(noField);
  return row;
}

// Locks lists against change while a column is changed, in a fixed order.
async function shareLists(
  transaction: Transaction,
  listIds: readonly string[],
): Promise<void> {
  await transaction
    .select({ id: lists.id })
    .from(lists)
    .where(inArray(lists.id, [...new Set(listIds)]))
    .orderBy(asc(lists.id))
    .for("share");
}

// Refuses a list that does not exist or is retired, since a retired list is no longer offered.
async function checkList(transaction: Transaction, listId: string) {
  const [list] = await transaction
    .select({ retired: lists.retired })
    .from(lists)
    .where(eq(lists.id, listId))
    .for("share");
  if (list === undefined) throw new BadRequestError("There is no such list");
  if (list.retired) {
    throw new BadRequestError("Choose a list that is not retired");
  }
}

// The total a count query found.
async function totalOf(query: Promise<{ total: number }[]>): Promise<number> {
  return (await query).reduce((sum, { total }) => sum + total, 0);
}

// A number of people in words, with the verb that follows.
export const peopleHave = (total: number) =>
  total === 1 ? "1 person has" : `${String(total)} people have`;

// Refuses settings that the people already in Fathom do not meet: a required column that someone has
// no value for, or one choice where someone has several.
export async function checkValuesFit(
  transaction: Transaction,
  field: FieldRow,
  request: FieldRequest,
): Promise<void> {
  if (request.required && !field.required) {
    const everyone = await totalOf(
      transaction.select({ total: count() }).from(people),
    );
    const filled = await totalOf(
      transaction
        .select({ total: countDistinct(fieldValues.personId) })
        .from(fieldValues)
        .where(eq(fieldValues.fieldId, field.id)),
    );
    const missing = everyone - filled;
    if (missing > 0) {
      throw new ConflictError(
        `${peopleHave(missing)} no ${field.name}, so it cannot be required yet`,
      );
    }
  }
  if (!request.multiple && field.multiple) {
    const several = await transaction
      .select({ personId: fieldValues.personId })
      .from(fieldValues)
      .where(eq(fieldValues.fieldId, field.id))
      .groupBy(fieldValues.personId)
      .having(gt(count(), 1));
    if (several.length > 0) {
      throw new ConflictError(
        `${peopleHave(several.length)} several choices for ${field.name}, so it cannot take only one yet`,
      );
    }
  }
  if (request.listId !== field.listId) {
    const used = await totalOf(
      transaction
        .select({ total: count() })
        .from(fieldValues)
        .where(eq(fieldValues.fieldId, field.id)),
    );
    if (used > 0) {
      throw new ConflictError(
        `${field.name} has values from its list, so its list cannot change`,
      );
    }
    await checkList(transaction, request.listId);
  }
}

// Adds a column at the end of the People table. It can be required only while there is no one yet.
export async function createField(
  database: Database,
  madeBy: string,
  request: FieldRequest,
): Promise<Saved<Field>> {
  return refusingDuplicates(duplicateField, () =>
    database.transaction(async (transaction) => {
      // Lists are locked before columns, as every change that locks both does.
      await checkList(transaction, request.listId);
      await lockFields(transaction);
      const row: FieldRow = {
        id: randomUUID(),
        tableName: "people",
        name: request.name,
        listId: request.listId,
        multiple: request.multiple,
        required: false,
      };
      // A new column has no values, so it can be required only while there is no one yet.
      await checkValuesFit(transaction, row, request);
      const created = { ...row, required: request.required };
      await transaction.insert(fields).values(created);
      await appendColumn(transaction, row.id);
      const changeSetId = await recordChanges(
        transaction,
        madeBy,
        fieldChanges(row.id, "created", undefined, created),
      );
      return { result: toField(created), changeSetId };
    }),
  );
}

export async function updateField(
  database: Database,
  madeBy: string,
  id: string,
  request: FieldRequest,
): Promise<Saved<Field>> {
  return refusingDuplicates(duplicateField, () =>
    database.transaction(async (transaction) => {
      // The column's list and the list asked for are locked before the columns, as every change that
      // locks both does.
      const [current] = await transaction
        .select({ listId: fields.listId })
        .from(fields)
        .where(eq(fields.id, id));
      // A column that does not exist, or was deleted meanwhile, is refused once the columns are locked.
      await shareLists(transaction, [
        request.listId,
        ...(current ? [current.listId] : []),
      ]);
      const before = await lockField(transaction, id);
      await checkValuesFit(transaction, before, request);
      const after = { ...before, ...request };
      const changeSetId = await recordChanges(
        transaction,
        madeBy,
        fieldChanges(id, "changed", before, after),
      );
      if (changeSetId !== null) {
        await transaction.update(fields).set(request).where(eq(fields.id, id));
      }
      return { result: toField(after), changeSetId };
    }),
  );
}

// Deletes a column and its values. Its values are people's data, so the actor must also be able to
// change people, and the tier of the column's values.
export async function deleteField(
  database: Database,
  actor: Actor,
  id: string,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  return database.transaction(async (transaction) => {
    const rows = await lockFields(transaction);
    const before = rows.find((row) => row.id === id);
    if (before === undefined) throw new NotFoundError(noField);
    const columns = await readColumns(transaction);
    const holders = await transaction
      .selectDistinct({ personId: fieldValues.personId })
      .from(fieldValues)
      .where(eq(fieldValues.fieldId, id));
    // Values found by their column always belong to a person, for now the only owner.
    const personIds = holders.map(({ personId }) => String(personId));
    const values = await readValues(transaction, personIds, [id]);
    const valueChanges = personIds.flatMap((personId) =>
      personChanges(
        columns,
        personId,
        "changed",
        { [valueField(id)]: values.get(personId)?.get(id) },
        {},
      ),
    );
    for (const tier of new Set(valueChanges.map((change) => change.tier))) {
      requireTierEdit(actor, tier);
    }
    // The column's key stays in the order, so undoing the deletion puts it back in its place.
    const made = [
      ...fieldChanges(id, "deleted", before, undefined),
      ...valueChanges,
    ];
    await transaction.delete(fields).where(eq(fields.id, id));
    await recordSensitiveChanges(transaction, actor.user.id, made);
    return recordChanges(transaction, actor.user.id, made);
  });
}
