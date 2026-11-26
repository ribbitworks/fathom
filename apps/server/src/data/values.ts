// SPDX-License-Identifier: Apache-2.0

// The values of columns on people, planned hires, features, activities and private rows, and how
// they are recorded in the change history. Part of the data access layer.

import { storedTier } from "../access.ts";
import { isNote, isNumber, typeOf } from "./column-types.ts";
import { readDataClasses } from "./data-classes.ts";
import {
  type Database,
  fieldOfValue,
  fields,
  fieldValues,
  inChunks,
  listItems,
  lists,
  type Reader,
  valueField,
} from "@fathom/db";
import {
  builtInColumnNames,
  builtInColumnTiers,
  type BuiltInTiers,
  type ColumnTable,
  isLink,
  type Link,
  type Tier,
} from "@fathom/shared";
import { and, asc, eq, inArray, isNotNull, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export { fieldOfValue, valueField } from "@fathom/db";

export type FieldRow = typeof fields.$inferSelect;

// The kinds of record that hold values in added columns, each in its own owner column.
export type ValueOwner =
  "person" | "planned-hire" | "feature" | "activity" | "private-row";

const ownerColumns = {
  person: { column: fieldValues.personId, key: "personId" },
  "planned-hire": { column: fieldValues.plannedHireId, key: "plannedHireId" },
  feature: { column: fieldValues.featureId, key: "featureId" },
  activity: { column: fieldValues.activityId, key: "activityId" },
  "private-row": { column: fieldValues.privateRowId, key: "privateRowId" },
} as const;

// The kinds of record holding each table's added columns' values, the table's own records first.
export const valueOwnersOf: Readonly<
  Record<ColumnTable, readonly [ValueOwner, ...ValueOwner[]]>
> = {
  people: ["person", "planned-hire"],
  features: ["feature"],
  activities: ["activity"],
};

// The tables whose records are planned work, by the one kind that alone holds their values.
export const planningTableOf = {
  feature: "features",
  activity: "activities",
} as const satisfies Partial<Record<ValueOwner, ColumnTable>>;

export type PlanningOwner = keyof typeof planningTableOf;

export const planningOwners: readonly PlanningOwner[] = ["feature", "activity"];

export const ownerColumn = (owner: ValueOwner) =>
  // The owner is always one of the fixed kinds above.
  // eslint-disable-next-line security/detect-object-injection
  ownerColumns[owner].column;

export const ownerKey = <Owner extends ValueOwner>(
  owner: Owner,
): (typeof ownerColumns)[Owner]["key"] =>
  // The owner is always one of the fixed kinds above.
  // eslint-disable-next-line security/detect-object-injection
  ownerColumns[owner].key;

// A column with the tier of its values, which is its list's visibility, or a web link column's own,
// and whether its list is retired.
export interface ColumnInfo extends FieldRow {
  tier: Tier;
  listRetired: boolean;
}

// The People table's columns, carrying the tiers of its built-in details with them, so every tier
// worked out from the columns read has them.
export type TableColumns = readonly ColumnInfo[] & BuiltInTiers;

export async function readBuiltInTiers(reader: Reader): Promise<BuiltInTiers> {
  return {
    positionTier: await builtInTier(reader, "positions"),
    stateTier: await builtInTier(reader, "hiring-states"),
    dataClasses: await readDataClasses(reader),
  };
}

// The tiers of the built-in details a column set carries, apart from the columns.
export const builtInTiersOf = ({
  positionTier,
  stateTier,
  dataClasses,
}: BuiltInTiers): BuiltInTiers => ({ positionTier, stateTier, dataClasses });

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
): Promise<TableColumns> {
  if (lock) {
    await reader
      .select({ id: fields.id })
      .from(fields)
      .where(eq(fields.tableName, table))
      .for("share");
  }
  const columns = await columnsWhere(reader, eq(fields.tableName, table));
  return Object.assign(columns, await readBuiltInTiers(reader));
}

// A private page's columns, with the tier of their values.
export const readPageColumns = (
  reader: Reader,
  pageId: string,
): Promise<ColumnInfo[]> => columnsWhere(reader, eq(fields.pageId, pageId));

async function columnsWhere(
  reader: Reader,
  condition: SQL,
): Promise<ColumnInfo[]> {
  const rows = await reader
    .select({
      field: fields,
      visibility: lists.visibility,
      retired: lists.retired,
    })
    .from(fields)
    .leftJoin(lists, eq(lists.id, fields.listId))
    .where(condition)
    .orderBy(asc(fields.id));
  return rows.map(({ field, visibility, retired }) => ({
    ...field,
    tier: valuesTier(field, visibility),
    listRetired: retired ?? false,
  }));
}

// Each of People's columns, built-in and added, by key, with its name and the class of its values.
// A column as its class is checked: its name, as people read it, and its tier.
export interface ClassedColumn {
  name: string;
  tier: Tier;
}

export function columnClasses(
  columns: TableColumns,
): Map<string, ClassedColumn> {
  return new Map([
    ...[...builtInColumnTiers(columns)].map(
      ([key, tier]): [string, ClassedColumn] => [
        key,
        // Every built-in column of People is named.
        { name: String(builtInColumnNames.get(key)), tier },
      ],
    ),
    ...columns.map((column): [string, ClassedColumn] => [
      column.id,
      { name: column.name, tier: column.tier },
    ]),
  ]);
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

export type ValueRow = ReturnType<typeof valueRows>[number];

// Removes a record's value for a column.
export async function deleteValues(
  transaction: Pick<Database, "delete">,
  recordId: string,
  fieldId: string,
  owner: ValueOwner,
): Promise<void> {
  await transaction
    .delete(fieldValues)
    .where(
      and(eq(ownerColumn(owner), recordId), eq(fieldValues.fieldId, fieldId)),
    );
}

export async function insertValues(
  transaction: Pick<Database, "insert">,
  rows: readonly ValueRow[],
): Promise<void> {
  for (const chunk of inChunks(rows)) {
    await transaction.insert(fieldValues).values(chunk);
  }
}

// Writes each value whose column and choices are live, and returns the rest, which use a column or
// choice only drafted to be added, to be written once those are approved. Values written before the
// columns are approved are checked against any change to a live column approved with them.
export async function insertLiveValues(
  transaction: Pick<Database, "insert" | "select">,
  values: readonly (readonly ValueRow[])[],
): Promise<(readonly ValueRow[])[]> {
  const rows = values.flat();
  const fieldIds = [...new Set(rows.map(({ fieldId }) => fieldId))];
  const choiceIds = [
    ...new Set(rows.flatMap(({ choiceId }) => choiceId ?? [])),
  ];
  const liveFields = new Set(
    fieldIds.length === 0
      ? []
      : (
          await transaction
            .select({ id: fields.id })
            .from(fields)
            .where(inArray(fields.id, fieldIds))
        ).map(({ id }) => id),
  );
  const liveChoices = new Set(
    choiceIds.length === 0
      ? []
      : (
          await transaction
            .select({ id: listItems.id })
            .from(listItems)
            .where(inArray(listItems.id, choiceIds))
        ).map(({ id }) => id),
  );
  const isLive = (row: ValueRow) =>
    liveFields.has(row.fieldId) &&
    (row.choiceId === undefined ||
      row.choiceId === null ||
      liveChoices.has(row.choiceId));
  const now = values.filter((value) => value.every(isLive));
  await insertValues(transaction, now.flat());
  return values.filter((value) => !value.every(isLive));
}

// Replaces a person's or planned hire's value for a column, as the change history records it.
export async function writeValues(
  transaction: Pick<Database, "delete" | "insert">,
  recordId: string,
  fieldId: string,
  value: unknown,
  owner: ValueOwner,
): Promise<void> {
  await deleteValues(transaction, recordId, fieldId, owner);
  await insertValues(transaction, valueRows(recordId, fieldId, value, owner));
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
