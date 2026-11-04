// SPDX-License-Identifier: Apache-2.0

// The values of columns on people: one row for each person, column, and chosen choice, or for each
// person and web link column, as ADR 0005 sets out. Part of the data access layer. In the change
// history, a person's values for a column are one field of the person, named after the column,
// holding the chosen choices in the list's order, or the link, as sensitive as the column's list,
// or a web link column's own visibility.

import { storedTier } from "../access.ts";
import { typeOf } from "./column-types.ts";
import {
  type Database,
  fields,
  fieldValues,
  listItems,
  lists,
} from "@fathom/db";
import { isLink, type Link, type Tier } from "@fathom/shared";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

type Reader = Pick<Database, "select">;
export type FieldRow = typeof fields.$inferSelect;

export { fieldOfValue, valueField } from "@fathom/db";

// A column with the tier of its values, which is its list's visibility, or a web link column's own,
// and whether its list is retired.
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
    .leftJoin(lists, eq(lists.id, fields.listId))
    .where(eq(fields.tableName, "people"))
    .orderBy(asc(fields.id));
  return rows.map(({ field, visibility, retired }) => ({
    ...field,
    tier: valuesTier(field, visibility),
    listRetired: retired ?? false,
  }));
}

// A live column's tier, given the visibility of its own list, read with it.
export const valuesTier = (
  field: FieldRow,
  listVisibility: string | null,
): Tier => {
  const type = typeOf(field);
  return type.tier(type.settings(field), () => storedTier(listVisibility));
};

// A column's value for one person, as the change history records it: the chosen choices, or a link.
export type FieldValue = string[] | Link;

// Each person's values, by person and column, for the people and columns given: chosen choices in
// their list's order, and links.
export async function readValues(
  reader: Reader,
  personIds: readonly string[],
  fieldIds: readonly string[],
): Promise<Map<string, Map<string, FieldValue>>> {
  const values = new Map<string, Map<string, FieldValue>>();
  for (const [personId, byField] of await readChoices(
    reader,
    personIds,
    fieldIds,
  )) {
    values.set(personId, new Map(byField));
  }
  for (const [personId, byField] of await readLinks(
    reader,
    personIds,
    fieldIds,
  )) {
    const held = values.get(personId) ?? new Map<string, FieldValue>();
    for (const [fieldId, link] of byField) held.set(fieldId, link);
    values.set(personId, held);
  }
  return values;
}

// Each person's chosen choices, by person and column, in their list's order.
async function readChoices(
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
    // Joined to their choice, so never null.
    byField.set(fieldId, [...(byField.get(fieldId) ?? []), String(choiceId)]);
    values.set(personId, byField);
  }
  return values;
}

// Each person's links, by person and column.
async function readLinks(
  reader: Reader,
  personIds: readonly string[],
  fieldIds: readonly string[],
): Promise<Map<string, Map<string, Link>>> {
  const links = new Map<string, Map<string, Link>>();
  if (personIds.length === 0 || fieldIds.length === 0) return links;
  const rows = await reader
    .select({
      personId: fieldValues.personId,
      fieldId: fieldValues.fieldId,
      address: fieldValues.linkAddress,
      text: fieldValues.linkText,
    })
    .from(fieldValues)
    .where(
      and(
        inArray(fieldValues.personId, [...personIds]),
        inArray(fieldValues.fieldId, [...fieldIds]),
        isNotNull(fieldValues.linkAddress),
      ),
    );
  for (const { fieldId, address, text, ...row } of rows) {
    const personId = String(row.personId);
    const byField = links.get(personId) ?? new Map<string, Link>();
    // The database sets the text with the address.
    byField.set(fieldId, { address: String(address), text: String(text) });
    links.set(personId, byField);
  }
  return links;
}

// The rows that hold a value as the change history records it: one for each choice, or one for a
// link. Anything else holds nothing.
export function valueRows(
  personId: string,
  fieldId: string,
  value: unknown,
): (typeof fieldValues.$inferInsert)[] {
  if (Array.isArray(value)) {
    return value.map((choiceId) => ({
      fieldId,
      personId,
      choiceId: String(choiceId),
    }));
  }
  if (isLink(value)) {
    return [
      { fieldId, personId, linkAddress: value.address, linkText: value.text },
    ];
  }
  return [];
}

// Replaces a person's value for a column, as the change history records it.
export async function writeValues(
  transaction: Pick<Database, "delete" | "insert">,
  personId: string,
  fieldId: string,
  value: unknown,
): Promise<void> {
  await transaction
    .delete(fieldValues)
    .where(
      and(eq(fieldValues.personId, personId), eq(fieldValues.fieldId, fieldId)),
    );
  const rows = valueRows(personId, fieldId, value);
  if (rows.length > 0) await transaction.insert(fieldValues).values(rows);
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
