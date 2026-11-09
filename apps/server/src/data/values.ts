// SPDX-License-Identifier: Apache-2.0

// The values of columns on people, planned hires, and features: one row for each record, column, and chosen
// choice, or for each record and web link, note, or number column, as ADR 0005 sets out. Part of
// the data access layer. In the change history, a record's values for a column are one field of
// the record, named after the column, holding the chosen choices in the list's order, the link,
// the note, or the number, as sensitive as the column's list, or the column's own visibility.

import { storedTier } from "../access.ts";
import { isNote, isNumber, typeOf } from "./column-types.ts";
import {
  type Database,
  fields,
  fieldValues,
  inChunks,
  listItems,
  lists,
} from "@fathom/db";
import { type ColumnTable, isLink, type Link, type Tier } from "@fathom/shared";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

type Reader = Pick<Database, "select">;
export type FieldRow = typeof fields.$inferSelect;

import { fieldOfValue, valueField } from "@fathom/db";
export { fieldOfValue, valueField } from "@fathom/db";

// The kinds of record that hold values in added columns, each in its own owner column.
export type ValueOwner = "person" | "planned-hire" | "feature";

const ownerColumns = {
  person: { column: fieldValues.personId, key: "personId" },
  "planned-hire": { column: fieldValues.plannedHireId, key: "plannedHireId" },
  feature: { column: fieldValues.featureId, key: "featureId" },
} as const;

const ownerColumn = (owner: ValueOwner) =>
  // The owner is always one of the fixed kinds above.
  // eslint-disable-next-line security/detect-object-injection
  ownerColumns[owner].column;

const ownerKey = (owner: ValueOwner) =>
  // The owner is always one of the fixed kinds above.
  // eslint-disable-next-line security/detect-object-injection
  ownerColumns[owner].key;

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

// Every column on a table, people's by default, with the tier of its values. A change to the
// records' values locks the columns against change until it is saved, so a column cannot become
// required, or take one choice, while values that would not fit are being saved.
export async function readColumns(
  reader: Reader,
  lock = false,
  table: ColumnTable = "people",
): Promise<PeopleColumns> {
  if (lock) {
    await reader
      .select({ id: fields.id })
      .from(fields)
      .where(eq(fields.tableName, table))
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
    .where(eq(fields.tableName, table))
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
// a note, or a number.
export type FieldValue = string[] | Link | string | number;

// Each record's values, by record and column, for the people, or planned hires, and columns given:
// chosen choices in their list's order, links, notes, and numbers.
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
  for (const read of [readLinks, readNotes, readNumbers]) {
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

// Reads what a column of one value holds in the values table, by record and column.
const readerOf =
  <Held>(column: PgColumn, held: (value: unknown) => Held) =>
  async (
    reader: Reader,
    recordIds: readonly string[],
    fieldIds: readonly string[],
    owner: ValueOwner,
  ): Promise<Map<string, Map<string, Held>>> => {
    const found = new Map<string, Map<string, Held>>();
    if (recordIds.length === 0 || fieldIds.length === 0) return found;
    const rows = await reader
      .select({
        recordId: ownerColumn(owner),
        fieldId: fieldValues.fieldId,
        value: column,
      })
      .from(fieldValues)
      .where(
        and(
          inArray(ownerColumn(owner), [...recordIds]),
          inArray(fieldValues.fieldId, [...fieldIds]),
          isNotNull(column),
        ),
      );
    for (const { fieldId, value, ...row } of rows) {
      const recordId = String(row.recordId);
      const byField = found.get(recordId) ?? new Map<string, Held>();
      byField.set(fieldId, held(value));
      found.set(recordId, byField);
    }
    return found;
  };

const readNotes = readerOf(fieldValues.note, String);
const readNumbers = readerOf(fieldValues.number, Number);

// The names of the added columns' values any version of a record holds.
export const valueFieldsIn = (
  ...versions: (Record<string, unknown> | undefined)[]
): string[] => [
  ...new Set(
    versions.flatMap((version) =>
      Object.keys(version ?? {}).filter(
        (field) => fieldOfValue(field) !== null,
      ),
    ),
  ),
];

// Values as a record holds them, by the name of each column's field, leaving out those with nothing
// chosen.
export function recordedValues(
  values: ReadonlyMap<string, FieldValue>,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [fieldId, value] of values) {
    if (isLink(value)) record[valueField(fieldId)] = { ...value };
    else if (isNote(value) || isNumber(value)) {
      record[valueField(fieldId)] = value;
    } else if (value.length > 0) record[valueField(fieldId)] = [...value];
  }
  return record;
}

// The rows that hold a value as the change history records it: one for each choice, or one for a
// link, a note, or a number. Anything else holds nothing.
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
  if (isNumber(value)) return [{ ...held, number: value }];
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
