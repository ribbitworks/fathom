// SPDX-License-Identifier: Apache-2.0

// Fathom's database tables, defined for Drizzle, including the accounts, sessions, and sign-in rate
// limits that Better Auth keeps.

import {
  bigint,
  bigserial,
  boolean,
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

// The choices offered for some of a person's details, such as their site or position, one list
// each, with an optional description. List names are checked by the server, not the database. Labels are unique within a list,
// ignoring letter case, so two people saving at once cannot add the same choice twice. Who created
// and changed each item is read from the change history.
export const listItems = fathomSchema.table(
  "list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    list: text("list").notNull(),
    label: text("label").notNull(),
    // What the choice means, for anyone unsure which to pick; empty when there is none.
    description: text("description").notNull().default(""),
  },
  (table) => [
    uniqueIndex("list_items_list_label_index").on(
      table.list,
      sql`lower(${table.label})`,
    ),
  ],
);

// The change history: every change made to Fathom's data, with its old and new values, grouped into
// the change sets that were saved together. Who created and last changed a record is read from it.
// Like the access history, it can only be added to. Until plan approval arrives, changes are applied
// as they are saved, so no change set records an approver.
export const changeSets = fathomSchema.table(
  "change_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
  },
  (table) => [
    index("changes_record_index").on(table.recordType, table.recordId),
    index("changes_change_set_index").on(table.changeSetId),
  ],
);
