// SPDX-License-Identifier: Apache-2.0

// The values of columns on people: one row for each person, column, and chosen choice, as ADR 0005
// sets out. Part of the data access layer. In the change history, a person's values for a column are
// one field of the person, named after the column, holding the chosen choices in the list's order,
// as sensitive as the column's list.

import {
  type Database,
  fields,
  fieldValues,
  listItems,
  lists,
} from "@fathom/db";
import { type Tier, tierSchema } from "@fathom/shared";
import { and, asc, eq, inArray } from "drizzle-orm";

type Reader = Pick<Database, "select">;
export type FieldRow = typeof fields.$inferSelect;

export { fieldOfValue, valueField } from "@fathom/db";

// A column with the tier of its values, which is its list's visibility, and whether its list is
// retired.
export interface ColumnInfo extends FieldRow {
  tier: Tier;
  listRetired: boolean;
}

// Every column on people, with the tier of its values. A change to people's values locks the columns
// against change until it is saved, so a column cannot become required, or take one choice, while
// values that would not fit are being saved.
export async function readColumns(
  reader: Reader,
  lock = false,
): Promise<ColumnInfo[]> {
  if (lock) {
    await reader
      .select({ id: fields.id })
      .from(fields)
      .where(eq(fields.tableName, "people"))
      .for("share");
  }
  const rows = await reader
    .select({
      field: fields,
      visibility: lists.visibility,
      retired: lists.retired,
    })
    .from(fields)
    .innerJoin(lists, eq(lists.id, fields.listId))
    .where(eq(fields.tableName, "people"))
    .orderBy(asc(fields.id));
  return rows.map(({ field, visibility, retired }) => ({
    ...field,
    // A tier the server no longer knows is treated as the most sensitive rather than trusted.
    tier: tierSchema.catch("confidential").parse(visibility),
    listRetired: retired,
  }));
}

// Each person's chosen choices, by person and column, in their list's order, for the people and
// columns given.
export async function readValues(
  reader: Reader,
  personIds: readonly string[],
  fieldIds: readonly string[],
): Promise<Map<string, Map<string, string[]>>> {
  const values = new Map<string, Map<string, string[]>>();
  if (personIds.length === 0 || fieldIds.length === 0) return values;
  const rows = await reader
    .select({
      personId: fieldValues.personId,
      fieldId: fieldValues.fieldId,
      choiceId: fieldValues.choiceId,
    })
    .from(fieldValues)
    .innerJoin(listItems, eq(listItems.id, fieldValues.choiceId))
    .where(
      and(
        inArray(fieldValues.personId, [...personIds]),
        inArray(fieldValues.fieldId, [...fieldIds]),
      ),
    )
    .orderBy(asc(listItems.position), asc(listItems.id));
  for (const { fieldId, choiceId, ...row } of rows) {
    // Values found by person always have one.
    const personId = String(row.personId);
    const byField = values.get(personId) ?? new Map<string, string[]>();
    byField.set(fieldId, [...(byField.get(fieldId) ?? []), choiceId]);
    values.set(personId, byField);
  }
  return values;
}

// Replaces a person's choices for a column.
export async function writeValues(
  transaction: Pick<Database, "delete" | "insert">,
  personId: string,
  fieldId: string,
  choiceIds: readonly string[],
): Promise<void> {
  await transaction
    .delete(fieldValues)
    .where(
      and(eq(fieldValues.personId, personId), eq(fieldValues.fieldId, fieldId)),
    );
  if (choiceIds.length > 0) {
    await transaction
      .insert(fieldValues)
      .values(choiceIds.map((choiceId) => ({ fieldId, personId, choiceId })));
  }
}

// Choices in list order, so values compare and are recorded the same way however they were sent.
export async function inListOrder(
  reader: Reader,
  choiceIds: readonly string[],
): Promise<{ id: string; listId: string; retired: boolean }[]> {
  if (choiceIds.length === 0) return [];
  return reader
    .select({
      id: listItems.id,
      listId: listItems.listId,
      retired: listItems.retired,
    })
    .from(listItems)
    .where(inArray(listItems.id, [...new Set(choiceIds)]))
    .orderBy(asc(listItems.position), asc(listItems.id));
}
