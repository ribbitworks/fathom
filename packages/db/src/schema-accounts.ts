// SPDX-License-Identifier: Apache-2.0

// The tables for accounts, sessions and sign-in rate limits that Better Auth keeps, with roles,
// their permissions, and the access history.

import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { fathomSchema } from "./schema-core.ts";

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
  // Set while the account's password is one Fathom generated, which its user must change before
  // doing anything else.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
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
    // The one role the session acts as, among the account's roles; null until the server first
    // picks it. Better Auth neither reads nor writes it.
    activeRoleId: uuid("active_role_id").references(() => roles.id),
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

// Roles, each a set of permissions that can be edited and copied. The roles Fathom starts with keep
// a key, so setup and seed data can find them however they are renamed; roles made later have none.
// Names are unique whatever their case.
export const roles = fathomSchema.table(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("roles_name_index").on(sql`lower(${table.name})`)],
);

// The permissions each role grants. Permission names are checked by the server, not the database,
// so one the server no longer knows grants nothing, and splitting a permission needs only a
// migration that gives its parts to every role holding it.
export const rolePermissions = fathomSchema.table(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permission] })],
);

// The roles each user holds: one or more, exactly one of them the default, which the server checks;
// the database refuses a second default. A role held by any account cannot be deleted, so nobody's
// access vanishes unseen.
export const userRoles = fathomSchema.table(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index("user_roles_role_id_index").on(table.roleId),
    uniqueIndex("user_roles_default_index")
      .on(table.userId)
      .where(sql`${table.isDefault}`),
  ],
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
