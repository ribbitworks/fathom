// SPDX-License-Identifier: Apache-2.0

// The tables of the columns people add to Fathom's tables, each table's column order, and the
// columns' values.

import {
  boolean,
  check,
  index,
  jsonb,
  numeric,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { fathomSchema } from "./schema-core.ts";
import { lists, listItems } from "./schema-lists.ts";
import { people, plannedHires } from "./schema-people.ts";
import { activities, features } from "./schema-plan.ts";

// The columns people add to Fathom's tables, as ADR 0005 sets out, each drawing on a list or
// holding a web link, a note or a number. A column decides what it is called, whether one choice
// or several can be picked, and whether a value is required. Its names are unique within its table,
// ignoring letter case. A list cannot be deleted while a column draws on it. A column on people can
// be offered on planned hires too, where a value is never required.
export const fields = fathomSchema.table(
  "fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The table the column is on, such as "people", checked by the server.
    tableName: text("table_name").notNull(),
    name: text("name").notNull(),
    // "choice" for a column drawing on a list, "link" for a web link, "note" for a note, or
    // "number" for a number.
    type: text("type").notNull().default("choice"),
    listId: uuid("list_id").references(() => lists.id, {
      onDelete: "restrict",
    }),
    // The tier of a link, note, or number column's values, which a choice column takes from its
    // list instead.
    visibility: text("visibility"),
    multiple: boolean("multiple").notNull().default(false),
    required: boolean("required").notNull().default(false),
    onPlannedHires: boolean("on_planned_hires").notNull().default(false),
  },
  (table) => [
    uniqueIndex("fields_table_name_index").on(
      table.tableName,
      sql`lower(${table.name})`,
    ),
    // Only People's columns are offered on planned hires.
    check(
      "fields_planned_hires_from_people",
      sql`NOT ${table.onPlannedHires} OR ${table.tableName} = 'people'`,
    ),
    check(
      "fields_type_settings",
      sql`(${table.type} = 'choice' AND ${table.listId} IS NOT NULL AND ${table.visibility} IS NULL) OR (${table.type} IN ('link', 'note', 'number') AND ${table.listId} IS NULL AND ${table.visibility} IS NOT NULL AND NOT ${table.multiple})`,
    ),
  ],
);

// The order of each table's columns, built-in and added alike, as the keys of its columns: a built-in
// column's name, such as "employeeId", or an added column's identifier. Keys of deleted columns are
// left in place, so undoing a deletion puts the column back where it was, and are skipped when read.
export const columnOrders = fathomSchema.table("column_orders", {
  tableName: text("table_name").primaryKey(),
  keys: jsonb("keys").$type<string[]>().notNull().default([]),
});

// The values of columns, one row for each record, column, and choice, or for each record and link,
// note, or number column, as ADR 0005 sets out. Each table that can have columns has its own owner
// column, and exactly one is set. A value is deleted with its record or column, and a choice cannot be deleted
// while a value uses it.
export const fieldValues = fathomSchema.table(
  "field_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => people.id, {
      onDelete: "cascade",
    }),
    plannedHireId: uuid("planned_hire_id").references(() => plannedHires.id, {
      onDelete: "cascade",
    }),
    featureId: uuid("feature_id").references(() => features.id, {
      onDelete: "cascade",
    }),
    activityId: uuid("activity_id").references(() => activities.id, {
      onDelete: "cascade",
    }),
    choiceId: uuid("choice_id").references(() => listItems.id, {
      onDelete: "restrict",
    }),
    linkAddress: text("link_address"),
    // Empty to show the address itself.
    linkText: text("link_text"),
    // Markdown, as the server checks it; a note removed has no row.
    note: text("note"),
    number: numeric("number", { mode: "number" }),
  },
  (table) => [
    // Each owner's values are indexed apart, so each index holds only its own owner's rows.
    uniqueIndex("field_values_person_choice_index")
      .on(table.fieldId, table.personId, table.choiceId)
      .where(sql`${table.personId} IS NOT NULL`),
    uniqueIndex("field_values_person_link_index")
      .on(table.fieldId, table.personId)
      .where(
        sql`${table.personId} IS NOT NULL AND ${table.linkAddress} IS NOT NULL`,
      ),
    uniqueIndex("field_values_person_note_index")
      .on(table.fieldId, table.personId)
      .where(sql`${table.personId} IS NOT NULL AND ${table.note} IS NOT NULL`),
    uniqueIndex("field_values_person_number_index")
      .on(table.fieldId, table.personId)
      .where(
        sql`${table.personId} IS NOT NULL AND ${table.number} IS NOT NULL`,
      ),
    uniqueIndex("field_values_planned_hire_choice_index")
      .on(table.fieldId, table.plannedHireId, table.choiceId)
      .where(sql`${table.plannedHireId} IS NOT NULL`),
    uniqueIndex("field_values_planned_hire_link_index")
      .on(table.fieldId, table.plannedHireId)
      .where(
        sql`${table.plannedHireId} IS NOT NULL AND ${table.linkAddress} IS NOT NULL`,
      ),
    uniqueIndex("field_values_planned_hire_note_index")
      .on(table.fieldId, table.plannedHireId)
      .where(
        sql`${table.plannedHireId} IS NOT NULL AND ${table.note} IS NOT NULL`,
      ),
    uniqueIndex("field_values_planned_hire_number_index")
      .on(table.fieldId, table.plannedHireId)
      .where(
        sql`${table.plannedHireId} IS NOT NULL AND ${table.number} IS NOT NULL`,
      ),
    uniqueIndex("field_values_feature_choice_index")
      .on(table.fieldId, table.featureId, table.choiceId)
      .where(sql`${table.featureId} IS NOT NULL`),
    uniqueIndex("field_values_feature_link_index")
      .on(table.fieldId, table.featureId)
      .where(
        sql`${table.featureId} IS NOT NULL AND ${table.linkAddress} IS NOT NULL`,
      ),
    uniqueIndex("field_values_feature_note_index")
      .on(table.fieldId, table.featureId)
      .where(sql`${table.featureId} IS NOT NULL AND ${table.note} IS NOT NULL`),
    uniqueIndex("field_values_feature_number_index")
      .on(table.fieldId, table.featureId)
      .where(
        sql`${table.featureId} IS NOT NULL AND ${table.number} IS NOT NULL`,
      ),
    uniqueIndex("field_values_activity_choice_index")
      .on(table.fieldId, table.activityId, table.choiceId)
      .where(sql`${table.activityId} IS NOT NULL`),
    uniqueIndex("field_values_activity_link_index")
      .on(table.fieldId, table.activityId)
      .where(
        sql`${table.activityId} IS NOT NULL AND ${table.linkAddress} IS NOT NULL`,
      ),
    uniqueIndex("field_values_activity_note_index")
      .on(table.fieldId, table.activityId)
      .where(
        sql`${table.activityId} IS NOT NULL AND ${table.note} IS NOT NULL`,
      ),
    uniqueIndex("field_values_activity_number_index")
      .on(table.fieldId, table.activityId)
      .where(
        sql`${table.activityId} IS NOT NULL AND ${table.number} IS NOT NULL`,
      ),
    index("field_values_feature_index")
      .on(table.featureId)
      .where(sql`${table.featureId} IS NOT NULL`),
    index("field_values_activity_index")
      .on(table.activityId)
      .where(sql`${table.activityId} IS NOT NULL`),
    index("field_values_person_index")
      .on(table.personId)
      .where(sql`${table.personId} IS NOT NULL`),
    index("field_values_planned_hire_index")
      .on(table.plannedHireId)
      .where(sql`${table.plannedHireId} IS NOT NULL`),
    index("field_values_choice_index").on(table.choiceId),
    check(
      "field_values_one_owner",
      sql`num_nonnulls(${table.personId}, ${table.plannedHireId}, ${table.featureId}, ${table.activityId}) = 1`,
    ),
    check(
      "field_values_one_kind",
      sql`num_nonnulls(${table.choiceId}, ${table.linkAddress}, ${table.note}, ${table.number}) = 1 AND (${table.linkAddress} IS NULL) = (${table.linkText} IS NULL)`,
    ),
    // The server checks each address in full; this keeps anything but a web address out whatever
    // writes the row.
    check(
      "field_values_web_address",
      sql`${table.linkAddress} IS NULL OR ${table.linkAddress} ~ '^https?://'`,
    ),
    check("field_values_note_not_empty", sql`${table.note} <> ''`),
  ],
);
