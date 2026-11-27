// SPDX-License-Identifier: Apache-2.0

// The tables of the columns people add to Fathom's tables, each table's column order, and the
// columns' values.

import {
  type AnyPgColumn,
  boolean,
  check,
  date,
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
import {
  activities,
  customers,
  features,
  projects,
  proposals,
  releases,
} from "./schema-plan.ts";
import { privatePages, privateRows } from "./schema-private.ts";
import { featureTeams } from "./schema-teams.ts";

// The tables a Link to another table column can link to. People's links hold a person or a planned
// hire. A table that becomes linkable adds itself here, and its link column below, in its own
// migration.
export const linkableTables = [
  "people",
  "features",
  "projects",
  "proposals",
  "customers",
  "releases",
  "feature_teams",
  "activities",
] as const;

// The columns people add to Fathom's tables, as ADR 0005 sets out, and the columns of a private
// page. Names are unique within a table, or within a page, ignoring letter case. A list cannot be
// deleted while a column draws on it. A column on people is offered on planned hires too, where a
// value is never required.
export const fields = fathomSchema.table(
  "fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The table the column is on, such as "people", or "private" for a private page's, checked by
    // the server.
    tableName: text("table_name").notNull(),
    // The private page the column is on, exactly when the table is "private"; removing the page
    // removes its columns.
    pageId: uuid("page_id").references((): AnyPgColumn => privatePages.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    // "choice" for a column drawing on a list, "link" for a web link, "note" for a note, "number"
    // for a number, "flag" for a checkbox, "text" for text, "date" for a day, or "record" for a
    // link to another table's records.
    type: text("type").notNull().default("choice"),
    listId: uuid("list_id").references(() => lists.id, {
      onDelete: "restrict",
    }),
    // The class of every column's values but a choice column's, which takes its list's.
    visibility: text("visibility"),
    // Several choices, or several linked records.
    multiple: boolean("multiple").notNull().default(false),
    // The table a record column links to, one of linkableTables.
    linkedTable: text("linked_table"),
    required: boolean("required").notNull().default(false),
  },
  (table) => [
    uniqueIndex("fields_table_name_index")
      .on(table.tableName, sql`lower(${table.name})`)
      .where(sql`${table.pageId} IS NULL`),
    uniqueIndex("fields_page_name_index")
      .on(table.pageId, sql`lower(${table.name})`)
      .where(sql`${table.pageId} IS NOT NULL`),
    check(
      "fields_page_private",
      sql`(${table.pageId} IS NOT NULL) = (${table.tableName} = 'private')`,
    ),
    // A choice column has a list and takes its class; every other type has a class of its own and
    // no list. Only choice and record columns take several values, and a record column, and only
    // it, names the table it links to.
    check(
      "fields_type_settings",
      sql`((${table.linkedTable} IS NOT NULL) = (${table.type} = 'record')) AND (${table.linkedTable} IS NULL OR ${table.linkedTable} IN (${sql.raw(linkableTables.map((name) => `'${name}'`).join(", "))})) AND ((${table.type} = 'choice' AND ${table.listId} IS NOT NULL AND ${table.visibility} IS NULL) OR (${table.type} = 'record' AND ${table.listId} IS NULL AND ${table.visibility} IS NOT NULL) OR (${table.type} IN ('link', 'note', 'number', 'flag', 'text', 'date') AND ${table.listId} IS NULL AND ${table.visibility} IS NOT NULL AND NOT ${table.multiple}))`,
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

// The values of columns, one row for each record, column, and choice or linked record, or for each
// record and column of a kind held once, as ADR 0005 sets out. Each table that can have columns has
// its own owner column, and exactly one is set. A value is deleted with its record or column. A
// choice, and a linked record, cannot be deleted while a value uses it.
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
    privateRowId: uuid("private_row_id").references(() => privateRows.id, {
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
    // Only a ticked box has a row.
    flag: boolean("flag"),
    text: text("text"),
    date: date("date"),
    // A record linked from the column, which can't be deleted while a value still links it, so its
    // links are never lost unrecorded. Each key is checked when the change is saved, not at once, so
    // records that link themselves or each other can be deleted with their values; drizzle can't say
    // so, so the migration does, and field-values.test.ts fails if a key stops being deferred.
    linkedPersonId: uuid("linked_person_id").references(() => people.id, {
      onDelete: "no action",
    }),
    linkedPlannedHireId: uuid("linked_planned_hire_id").references(
      () => plannedHires.id,
      { onDelete: "no action" },
    ),
    linkedFeatureId: uuid("linked_feature_id").references(() => features.id, {
      onDelete: "no action",
    }),
    linkedProjectId: uuid("linked_project_id").references(() => projects.id, {
      onDelete: "no action",
    }),
    linkedProposalId: uuid("linked_proposal_id").references(
      () => proposals.id,
      { onDelete: "no action" },
    ),
    linkedCustomerId: uuid("linked_customer_id").references(
      () => customers.id,
      { onDelete: "no action" },
    ),
    linkedReleaseId: uuid("linked_release_id").references(() => releases.id, {
      onDelete: "no action",
    }),
    linkedFeatureTeamId: uuid("linked_feature_team_id").references(
      () => featureTeams.id,
      { onDelete: "no action" },
    ),
    linkedActivityId: uuid("linked_activity_id").references(
      () => activities.id,
      { onDelete: "no action" },
    ),
  },
  (table) => {
    // The columns linking to other tables' records, each with the name its indexes take.
    const links = [
      ["linked_person", table.linkedPersonId],
      ["linked_planned_hire", table.linkedPlannedHireId],
      ["linked_feature", table.linkedFeatureId],
      ["linked_project", table.linkedProjectId],
      ["linked_proposal", table.linkedProposalId],
      ["linked_customer", table.linkedCustomerId],
      ["linked_release", table.linkedReleaseId],
      ["linked_feature_team", table.linkedFeatureTeamId],
      ["linked_activity", table.linkedActivityId],
    ] as const;
    // The kinds a column holds once for each record, each with the name its index takes.
    const heldOnce = [
      ["link", table.linkAddress],
      ["note", table.note],
      ["number", table.number],
      ["flag", table.flag],
      ["text", table.text],
      ["date", table.date],
    ] as const;
    return [
      // Each owner's values are indexed apart, so each index holds only its own owner's rows: one row
      // for each value a column holds several of, and one row in all for a value it holds once.
      ...(
        [
          ["person", table.personId],
          ["planned_hire", table.plannedHireId],
          ["feature", table.featureId],
          ["activity", table.activityId],
          ["private_row", table.privateRowId],
        ] as const
      ).flatMap(([owner, ownerId]) => [
        uniqueIndex(`field_values_${owner}_choice_index`)
          .on(table.fieldId, ownerId, table.choiceId)
          .where(sql`${ownerId} IS NOT NULL`),
        ...links.map(([kind, held]) =>
          uniqueIndex(`field_values_${owner}_${kind}_index`)
            .on(table.fieldId, ownerId, held)
            .where(sql`${ownerId} IS NOT NULL AND ${held} IS NOT NULL`),
        ),
        ...heldOnce.map(([kind, held]) =>
          uniqueIndex(`field_values_${owner}_${kind}_index`)
            .on(table.fieldId, ownerId)
            .where(sql`${ownerId} IS NOT NULL AND ${held} IS NOT NULL`),
        ),
      ]),
      index("field_values_feature_index")
        .on(table.featureId)
        .where(sql`${table.featureId} IS NOT NULL`),
      index("field_values_activity_index")
        .on(table.activityId)
        .where(sql`${table.activityId} IS NOT NULL`),
      index("field_values_private_row_index")
        .on(table.privateRowId)
        .where(sql`${table.privateRowId} IS NOT NULL`),
      index("field_values_person_index")
        .on(table.personId)
        .where(sql`${table.personId} IS NOT NULL`),
      index("field_values_planned_hire_index")
        .on(table.plannedHireId)
        .where(sql`${table.plannedHireId} IS NOT NULL`),
      index("field_values_choice_index").on(table.choiceId),
      ...links.map(([kind, held]) =>
        index(`field_values_${kind}_index`)
          .on(held)
          .where(sql`${held} IS NOT NULL`),
      ),
      check(
        "field_values_one_owner",
        sql`num_nonnulls(${table.personId}, ${table.plannedHireId}, ${table.featureId}, ${table.activityId}, ${table.privateRowId}) = 1`,
      ),
      check(
        "field_values_one_kind",
        sql`num_nonnulls(${sql.join(
          [table.choiceId, ...[...heldOnce, ...links].map(([, held]) => held)],
          sql`, `,
        )}) = 1 AND (${table.linkAddress} IS NULL) = (${table.linkText} IS NULL)`,
      ),
      // The server checks each address in full; this keeps anything but a web address out whatever
      // writes the row.
      check(
        "field_values_web_address",
        sql`${table.linkAddress} IS NULL OR ${table.linkAddress} ~ '^https?://'`,
      ),
      check("field_values_note_not_empty", sql`${table.note} <> ''`),
      check("field_values_text_not_empty", sql`${table.text} <> ''`),
      check("field_values_flag_ticked", sql`${table.flag}`),
    ];
  },
);
