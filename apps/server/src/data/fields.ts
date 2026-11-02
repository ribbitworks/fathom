// SPDX-License-Identifier: Apache-2.0

// The columns people add to the People table, each drawing on a list: checking that a column's
// settings fit the people's values, and deleting a live column with its values. Changes to columns
// are drafts, as column-drafts.ts sets out, and their order is kept with the built-in columns', in
// column-order.ts. Part of the data access layer. A column's settings are General data, recorded in
// the change history field by field. Deleting a column deletes its values, which are recorded as
// changes to each person who had one.

import { fields, fieldValues, lists, people } from "@fathom/db";
import type { FieldRequest } from "@fathom/shared";
import { asc, count, countDistinct, eq, gt } from "drizzle-orm";
import { BadRequestError, ConflictError } from "../errors.ts";
import { type Change, changesBetween, type Transaction } from "./changes.ts";
import { draftedValues } from "./drafts.ts";
import { personChanges } from "./people.ts";
import {
  type FieldRow,
  readColumns,
  readValues,
  valueField,
} from "./values.ts";

export const fieldFields = [
  "tableName",
  "name",
  "listId",
  "multiple",
  "required",
] as const;

export const fieldChanges = (
  id: string,
  action: Change["action"],
  before: FieldRow | undefined,
  after: FieldRow | undefined,
) => changesBetween("field", id, action, before, after, fieldFields);

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

// Refuses settings that the people already in Fathom, live or in drafts, do not meet: a required
// column that someone has no value for, or one choice where someone has several. A draft that
// changes someone without changing the column keeps their live value.
export async function checkValuesFit(
  transaction: Transaction,
  field: FieldRow,
  request: FieldRequest,
): Promise<void> {
  const inDrafts = await draftedValues(transaction, field.id);
  if (
    request.required &&
    inDrafts.some(({ adds, chosen }) =>
      // A draft adding someone holds only the columns with choices.
      adds ? chosen === undefined : chosen?.length === 0,
    )
  ) {
    throw new ConflictError(
      `Drafts leave ${field.name} empty, so it cannot be required yet`,
    );
  }
  if (
    !request.multiple &&
    inDrafts.some(({ chosen }) => (chosen?.length ?? 0) > 1)
  ) {
    throw new ConflictError(
      `Drafts have several choices for ${field.name}, so it cannot take only one yet`,
    );
  }
  if (
    request.listId !== field.listId &&
    inDrafts.some(({ chosen }) => (chosen?.length ?? 0) > 0)
  ) {
    throw new ConflictError(
      `Drafts have values from the list of ${field.name}, so its list cannot change`,
    );
  }
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

// Deletes a live column and its values, as approving its removal does, and returns the changes to
// record: the column's, and each person's values in it, with their tiers, which the caller checks
// the actor may see.
export async function deleteLiveField(
  transaction: Transaction,
  id: string,
): Promise<Change[]> {
  // Approved only for a live column.
  const before = (await lockFields(transaction)).find(
    (row) => row.id === id,
  ) as FieldRow;
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
  await transaction.delete(fields).where(eq(fields.id, id));
  // The column's key stays in the order, so it would come back in its place.
  return [...fieldChanges(id, "deleted", before, undefined), ...valueChanges];
}
