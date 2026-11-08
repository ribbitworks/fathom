// SPDX-License-Identifier: Apache-2.0

// The values of columns on people and planned hires: one row for each record, column, and chosen
// choice, or for each record and web link or note column, as ADR 0005 sets out. Part of the data
// access layer. In the change history, a record's values for a column are one field of the record,
// named after the column, holding the chosen choices in the list's order, the link, or the note, as
// sensitive as the column's list, or a web link or note column's own visibility.

import { storedTier } from "../access.ts";
import { isNote, typeOf } from "./column-types.ts";
import {
  type Database,
  fields,
  fieldValues,
  inChunks,
  listItems,
  lists,
} from "@fathom/db";
import { isLink, type Link, type Tier } from "@fathom/shared";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

type Reader = Pick<Database, "select">;
export type FieldRow = typeof fields.$inferSelect;

export { fieldOfValue, valueField } from "@fathom/db";

// The kinds of record that hold values in People's columns, each in its own owner column.
export type ValueOwner = "person" | "planned-hire";

const ownerColumn = (owner: ValueOwner) =>
  owner === "person" ? fieldValues.personId : fieldValues.plannedHireId;

const ownerKey = (owner: ValueOwner) =>
  owner === "person" ? "personId" : "plannedHireId";

// A column with the tier of its values, which is its list's visibility, or a web link column's own,
// and whether its list is retired.
export interface ColumnInfo extends FieldRow {
  tier: Tier;
  listRetired: boolean;
}

// The People table's columns, carrying the tiers of the built-in Position and State columns with
// them, so every tier worked out from the columns read has them.
export type PeopleColumns = readonly ColumnInfo[] & {
  readonly positionTier: Tier;
  readonly stateTier: Tier;
};

// The tier of each of the People table's built-in columns, by key, as readers are sent them: the
// manager is General, though a drafted one is Restricted, since everyone is sent each live manager.
export function builtInColumnTiers(
  columns: Pick<PeopleColumns, "positionTier" | "stateTier">,
): Map<string, Tier> {
  return new Map<string, Tier>([
    ["preferredName", "general"],
    ["employeeId", "general"],
    ["positionId", columns.positionTier],
    ["stateId", columns.stateTier],
    ["startDate", "restricted"],
    ["expected", "general"],
    ["endDate", "restricted"],
    ["managerId", "general"],
    ["isManager", "general"],
    ["managerFrom", "restricted"],
    ["team", "general"],
    ["teamName", "general"],
  ]);
}

// The tier of a built-in list's values: its live visibility, or the most sensitive tier when the
// list cannot be read, rather than trusted.
export async function builtInTier(reader: Reader, key: string): Promise<Tier> {
  const [list] = await reader
    .select({ visibility: lists.visibility })
    .from(lists)
    .where(eq(lists.builtIn, key));
  return storedTier(list?.visibility);
}

// Every column on people, with the tier of its values. A change to people's values locks the columns
// against change until it is saved, so a column cannot become required, or take one choice, while
// values that would not fit are being saved.
export async function readColumns(
  reader: Reader,
  lock = false,
): Promise<PeopleColumns> {
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
  const columns = rows.map(({ field, visibility, retired }) => ({
    ...field,
    tier: valuesTier(field, visibility),
    listRetired: retired ?? false,
  }));
  return Object.assign(columns, {
    positionTier: await builtInTier(reader, "positions"),
    stateTier: await builtInTier(reader, "hiring-states"),
  });
}

// A live column's tier, given the visibility of its own list, read with it.
export const valuesTier = (
  field: FieldRow,
  listVisibility: string | null,
): Tier => {
  const type = typeOf(field);
  return type.tier(type.settings(field), () => storedTier(listVisibility));
};

// A column's value for one person, as the change history records it: the chosen choices, a link, or
// a note.
export type FieldValue = string[] | Link | string;

// Each record's values, by record and column, for the people, or planned hires, and columns given:
// chosen choices in their list's order, links, and notes.
export async function readValues(
  reader: Reader,
  recordIds: readonly string[],
  fieldIds: readonly string[],
  owner: ValueOwner,
): Promise<Map<string, Map<string, FieldValue>>> {
  const values = new Map<string, Map<string, FieldValue>>();
  for (const [recordId, byField] of await readChoices(
    reader,
    recordIds,
    fieldIds,
    owner,
  )) {
    values.set(recordId, new Map(byField));
  }
  for (const read of [readLinks, readNotes]) {
    for (const [recordId, byField] of await read(
      reader,
      recordIds,
      fieldIds,
      owner,
    )) {
      const held = values.get(recordId) ?? new Map<string, FieldValue>();
      for (const [fieldId, value] of byField) held.set(fieldId, value);
      values.set(recordId, held);
    }
  }
  return values;
}

// Each record's chosen choices, by record and column, in their list's order.
async function readChoices(
  reader: Reader,
  recordIds: readonly string[],
  fieldIds: readonly string[],
  owner: ValueOwner,
): Promise<Map<string, Map<string, string[]>>> {
  const values = new Map<string, Map<string, string[]>>();
  if (recordIds.length === 0 || fieldIds.length === 0) return values;
  const rows = await reader
    .select({
      recordId: ownerColumn(owner),
      fieldId: fieldValues.fieldId,
      choiceId: fieldValues.choiceId,
    })
    .from(fieldValues)
    .innerJoin(listItems, eq(listItems.id, fieldValues.choiceId))
    .where(
      and(
        inArray(ownerColumn(owner), [...recordIds]),
        inArray(fieldValues.fieldId, [...fieldIds]),
      ),
    )
    .orderBy(asc(listItems.position), asc(listItems.id));
  for (const { fieldId, choiceId, ...row } of rows) {
    // Values found by their record always have one.
    const recordId = String(row.recordId);
    const byField = values.get(recordId) ?? new Map<string, string[]>();
    // Joined to their choice, so never null.
    byField.set(fieldId, [...(byField.get(fieldId) ?? []), String(choiceId)]);
    values.set(recordId, byField);
  }
  return values;
}

// Each record's links, by record and column.
async function readLinks(
  reader: Reader,
  recordIds: readonly string[],
  fieldIds: readonly string[],
  owner: ValueOwner,
): Promise<Map<string, Map<string, Link>>> {
  const links = new Map<string, Map<string, Link>>();
  if (recordIds.length === 0 || fieldIds.length === 0) return links;
  const rows = await reader
    .select({
      recordId: ownerColumn(owner),
      fieldId: fieldValues.fieldId,
      address: fieldValues.linkAddress,
      text: fieldValues.linkText,
    })
    .from(fieldValues)
    .where(
      and(
        inArray(ownerColumn(owner), [...recordIds]),
        inArray(fieldValues.fieldId, [...fieldIds]),
        isNotNull(fieldValues.linkAddress),
      ),
    );
  for (const { fieldId, address, text, ...row } of rows) {
    const recordId = String(row.recordId);
    const byField = links.get(recordId) ?? new Map<string, Link>();
    // The database sets the text with the address.
    byField.set(fieldId, { address: String(address), text: String(text) });
    links.set(recordId, byField);
  }
  return links;
}

// Each record's notes, by record and column.
async function readNotes(
  reader: Reader,
  recordIds: readonly string[],
  fieldIds: readonly string[],
  owner: ValueOwner,
): Promise<Map<string, Map<string, string>>> {
  const notes = new Map<string, Map<string, string>>();
  if (recordIds.length === 0 || fieldIds.length === 0) return notes;
  const rows = await reader
    .select({
      recordId: ownerColumn(owner),
      fieldId: fieldValues.fieldId,
      note: fieldValues.note,
    })
    .from(fieldValues)
    .where(
      and(
        inArray(ownerColumn(owner), [...recordIds]),
        inArray(fieldValues.fieldId, [...fieldIds]),
        isNotNull(fieldValues.note),
      ),
    );
  for (const { fieldId, note, ...row } of rows) {
    const recordId = String(row.recordId);
    const byField = notes.get(recordId) ?? new Map<string, string>();
    byField.set(fieldId, String(note));
    notes.set(recordId, byField);
  }
  return notes;
}

// The rows that hold a value as the change history records it: one for each choice, or one for a
// link or a note. Anything else holds nothing.
export function valueRows(
  recordId: string,
  fieldId: string,
  value: unknown,
  owner: ValueOwner,
): (typeof fieldValues.$inferInsert)[] {
  const held = { fieldId, [ownerKey(owner)]: recordId };
  if (Array.isArray(value)) {
    return value.map((choiceId) => ({ ...held, choiceId: String(choiceId) }));
  }
  if (isLink(value)) {
    return [{ ...held, linkAddress: value.address, linkText: value.text }];
  }
  if (isNote(value)) return [{ ...held, note: value }];
  return [];
}

// Replaces a person's or planned hire's value for a column, as the change history records it.
export async function writeValues(
  transaction: Pick<Database, "delete" | "insert">,
  recordId: string,
  fieldId: string,
  value: unknown,
  owner: ValueOwner,
): Promise<void> {
  await transaction
    .delete(fieldValues)
    .where(
      and(eq(ownerColumn(owner), recordId), eq(fieldValues.fieldId, fieldId)),
    );
  const rows = valueRows(recordId, fieldId, value, owner);
  if (rows.length > 0) await transaction.insert(fieldValues).values(rows);
}

// The labels of the choices given, by choice.
export async function choiceLabels(
  reader: Reader,
  choiceIds: readonly string[],
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  for (const chunk of inChunks([...new Set(choiceIds)])) {
    for (const { id, label } of await reader
      .select({ id: listItems.id, label: listItems.label })
      .from(listItems)
      .where(inArray(listItems.id, chunk))) {
      labels.set(id, label);
    }
  }
  return labels;
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
