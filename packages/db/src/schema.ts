// SPDX-License-Identifier: Apache-2.0

// Fathom's database tables, defined for Drizzle, including the accounts, sessions, and sign-in rate
// limits that Better Auth keeps.

import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Every Fathom table lives in this schema, which the migration role owns. The application role can
// only read and write data in it.
export const fathomSchema = pgSchema("fathom");

export const appInfo = fathomSchema.table("app_info", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// The tables Better Auth needs, with the fields it reads and writes. Each user's email address is
// their user name; Fathom sends no email.
export const users = fathomSchema.table("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Set when an administrator deactivates the account, which then cannot sign in.
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Signed-in sessions. Each records the address and browser it was signed in from, for
// investigating security problems.
export const sessions = fathomSchema.table(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("sessions_user_id_index").on(table.userId)],
);

// How each user signs in. Fathom uses passwords only, stored as hashes.
export const accounts = fathomSchema.table(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("accounts_user_id_index").on(table.userId)],
);

export const verifications = fathomSchema.table(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("verifications_identifier_index").on(table.identifier)],
);

// Sign-in attempts by client address, so limits hold across restarts.
export const rateLimits = fathomSchema.table("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// The roles each user holds. Role names are checked by the server,
// not the database, so renaming a role needs no migration.
export const userRoles = fathomSchema.table(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

// Who did what, and when, to accounts and to protected data, without the values. It can only be
// added to: the application's role cannot change or delete entries, and a trigger refuses any
// change or deletion by anyone. It names users without foreign keys, so it outlives any account.
export const accessHistory = fathomSchema.table(
  "access_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Null for the server's operators, such as when the account command creates an account.
    actorId: text("actor_id"),
    action: text("action").notNull(),
    subjectId: text("subject_id"),
    details: jsonb("details").notNull().default({}),
  },
  (table) => [index("access_history_occurred_at_index").on(table.occurredAt)],
);

// Lists of choices that people define, such as locations or skills, for columns elsewhere to draw on.
// A list's name is unique, ignoring letter case. Its visibility is the sensitivity tier of the values
// chosen from it, checked by the server. A retired list is no longer offered for new values.
export const lists = fathomSchema.table(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    visibility: text("visibility").notNull().default("general"),
    retired: boolean("retired").notNull().default(false),
  },
  (table) => [uniqueIndex("lists_name_index").on(sql`lower(${table.name})`)],
);

// The choices in each list, in the order set for it. Labels are unique within a list, ignoring
// letter case, so two people saving at once cannot add the same choice twice. A retired choice stays
// on records that have it, but is no longer offered. Deleting a list deletes its choices; the change
// history keeps a record of both.
export const listItems = fathomSchema.table(
  "list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    // Lower comes first.
    position: integer("position").notNull().default(0),
    retired: boolean("retired").notNull().default(false),
  },
  (table) => [
    uniqueIndex("list_items_list_label_index").on(
      table.listId,
      sql`lower(${table.label})`,
    ),
  ],
);

// The change history: every change made to Fathom's data, with its old and new values, grouped into
// the change sets that were saved together. Who created and last changed a record is read from it.
// Like the access history, it can only be added to. Changes to drafts are recorded as they are saved,
// and an approval records the changes it makes to the live data as a change set of its own.
export const changeSets = fathomSchema.table(
  "change_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // What the change set did, checked by the server: "edit" for changes saved, "approval" for drafts
    // approved, "rejection" for drafts rejected, "discard" for drafts discarded, and "resubmission"
    // for rejected drafts sent for approval again unchanged.
    kind: text("kind").notNull().default("edit"),
    // Null for Fathom itself, such as for data made by setup or seed scripts. Accounts are deactivated,
    // never deleted, so the user who made a change always exists.
    madeBy: text("made_by").references(() => users.id),
    // The time of saving itself, not when its transaction began, so a change that waited for another
    // is not dated before it.
    madeAt: timestamp("made_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (table) => [index("change_sets_made_at_index").on(table.madeAt)],
);

export const changes = fathomSchema.table(
  "changes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    changeSetId: uuid("change_set_id")
      .notNull()
      .references(() => changeSets.id),
    // The kind of record changed, such as "list-item", checked by the server.
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    // "created", "changed", or "deleted", checked by the server.
    action: text("action").notNull(),
    field: text("field").notNull(),
    // The sensitivity tier of the field, so each user sees only changes to data they may see.
    tier: text("tier").notNull(),
    // Null when the field had no value, as before a record is created or after it is deleted.
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    // Whether the change is to a record's draft, rather than to the live record.
    draft: boolean("draft").notNull().default(false),
  },
  (table) => [
    index("changes_record_index").on(table.recordType, table.recordId),
    index("changes_change_set_index").on(table.changeSetId),
    // The latest name and list the history holds for each record, which the change history reads.
    index("changes_record_field_index").on(
      table.recordId,
      table.field,
      table.id.desc(),
    ),
  ],
);

// People: employees, current and former, with the details every person has. A person is current
// from their start date until their end date passes; one with no start date counts as current.
// Employee IDs are unique, ignoring letter case. People who leave are kept, not deleted; deleting is
// only for a person entered by mistake whom nothing uses. Other details are columns drawing on lists.
export const people = fathomSchema.table(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    preferredName: text("preferred_name").notNull(),
    employeeId: text("employee_id").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
  },
  (table) => [
    uniqueIndex("people_employee_id_index").on(sql`lower(${table.employeeId})`),
    check(
      "people_dates_in_order",
      sql`${table.endDate} IS NULL OR ${table.startDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
  ],
);

// The columns people add to Fathom's tables, as ADR 0005 sets out; for now only columns on people
// that draw on a list. A column decides what it is called, whether one choice or several can be
// picked, and whether a value is required. Its names are unique within its table, ignoring letter
// case. A list cannot be deleted while a column draws on it.
export const fields = fathomSchema.table(
  "fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The table the column is on, such as "people", checked by the server.
    tableName: text("table_name").notNull(),
    name: text("name").notNull(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "restrict" }),
    multiple: boolean("multiple").notNull().default(false),
    required: boolean("required").notNull().default(false),
  },
  (table) => [
    uniqueIndex("fields_table_name_index").on(
      table.tableName,
      sql`lower(${table.name})`,
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

// The values of columns, one row for each record, column, and choice, as ADR 0005 sets out. Each
// table that can have columns has its own owner column, and exactly one is set. A value is deleted
// with its record or column, and a choice cannot be deleted while a value uses it.
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
    choiceId: uuid("choice_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("field_values_person_choice_index").on(
      table.fieldId,
      table.personId,
      table.choiceId,
    ),
    index("field_values_person_index").on(table.personId),
    index("field_values_choice_index").on(table.choiceId),
    check("field_values_one_owner", sql`num_nonnulls(${table.personId}) = 1`),
  ],
);

// Saved views: a table's search, filters, and sort, saved under a name that is unique within the
// table, ignoring letter case, and shared with everyone who sees the table. Who made each view is
// kept with it, since its maker may change it; the change history records every change to it.
export const savedViews = fathomSchema.table(
  "saved_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The table the view is of, such as "people", checked by the server.
    tableName: text("table_name").notNull(),
    name: text("name").notNull(),
    // The view as the page address holds it, checked by the server.
    definition: jsonb("definition").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex("saved_views_table_name_index").on(
      table.tableName,
      sql`lower(${table.name})`,
    ),
  ],
);

// Draft rows: the changes waiting for approval, at most one draft for each record, as the Decisions
// Log sets out. A draft adds a record, changes some of its fields, or removes it. It holds the record
// as the change history records it: all of an added record's fields, only the fields a change makes
// differ from the live record, and none for a removal. A rejected draft keeps the Approver's reason
// until it is changed again or discarded. Who made and changed each draft is read from the change
// history. People, lists, choices, and the order of each list's choices have drafts.
export const drafts = fathomSchema.table(
  "drafts",
  {
    // The kind of record, such as "person", checked by the server.
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    // "created", "changed", or "deleted", checked by the server.
    action: text("action").notNull(),
    fields: jsonb("fields")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    // "waiting" or "rejected", checked by the server.
    state: text("state").notNull().default("waiting"),
    reason: text("reason"),
    // Rises with each draft made, and is kept as the draft changes, so records drafted to be added,
    // such as choices pasted at once, keep the order they were drafted in.
    sequence: bigint("sequence", { mode: "number" })
      .notNull()
      .generatedAlwaysAsIdentity(),
  },
  (table) => [primaryKey({ columns: [table.recordType, table.recordId] })],
);
