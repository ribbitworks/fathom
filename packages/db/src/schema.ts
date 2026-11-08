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
  type AnyPgColumn,
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

// Roles, each a set of permissions that can be edited and copied, as the Decisions Log sets out.
// The roles Fathom starts with keep a key, so setup and seed data can find them however they are
// renamed; roles made later have none. Names are unique whatever their case.
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

// The roles each user holds, as the Decisions Log sets out: one or more, exactly one of them the
// default, which the server checks; the database refuses a second default. A role held by any
// account cannot be deleted, so nobody's access vanishes unseen.
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

// The lists Fathom builds in, for its built-in columns to draw on, and the meanings Fathom fixes for
// the choices of those that have them, as SQL lists.
const sqlList = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(", ");
const builtInListList = sqlList([
  "positions",
  "hiring-states",
  "proposal-statuses",
]);
const meaningList = sqlList(["proposed", "open", "hired", "left"]);

// Lists of choices, such as locations or skills, for columns elsewhere to draw on. Most are defined
// by people; a built-in list is known by its key, cannot be removed, and is drawn on by a built-in
// column. A list's name is unique, ignoring letter case. Its visibility is the sensitivity tier of
// the values chosen from it, checked by the server. A retired list is no longer offered for new
// values.
export const lists = fathomSchema.table(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    visibility: text("visibility").notNull().default("general"),
    retired: boolean("retired").notNull().default(false),
    builtIn: text("built_in"),
  },
  (table) => [
    uniqueIndex("lists_name_index").on(sql`lower(${table.name})`),
    uniqueIndex("lists_built_in_index").on(table.builtIn),
    check(
      "lists_built_in_known",
      sql`${table.builtIn} IS NULL OR ${table.builtIn} IN (${sql.raw(builtInListList)})`,
    ),
    check(
      "lists_built_in_kept",
      sql`${table.builtIn} IS NULL OR NOT ${table.retired}`,
    ),
  ],
);

// The choices in each list, in the order set for it. Labels are unique within a list, ignoring
// letter case, so two people saving at once cannot add the same choice twice. A retired choice stays
// on records that have it, but is no longer offered. In a list with meanings, each choice is tied to
// one of them, which the server checks, as it does that each meaning keeps a choice offered.
// Deleting a list deletes its choices; the change history keeps a record of both.
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
    meaning: text("meaning"),
  },
  (table) => [
    uniqueIndex("list_items_list_label_index").on(
      table.listId,
      sql`lower(${table.label})`,
    ),
    check(
      "list_items_meaning_known",
      sql`${table.meaning} IS NULL OR ${table.meaning} IN (${sql.raw(meaningList)})`,
    ),
  ],
);

// Release streams, each with its own cycles and releases, such as major releases or patches. A
// stream's name is unique, ignoring letter case. Streams are retired, never deleted, since releases
// and features refer to their cycles. A stream's cycles are those starting on or before its
// cycles-until date, which the server sets when the stream is drafted, since a stream is added only
// once approved.
export const releaseStreams = fathomSchema.table(
  "release_streams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Lower comes first.
    position: integer("position").notNull().default(0),
    retired: boolean("retired").notNull().default(false),
    cyclesUntil: date("cycles_until").notNull(),
  },
  (table) => [
    uniqueIndex("release_streams_name_index").on(sql`lower(${table.name})`),
  ],
);

// How a stream's cycles are made, from the date a pattern starts until the stream's next pattern
// starts: their length, in weeks or months, and the pattern their names follow. A stream's cycles are
// worked out from its patterns, not stored, so a cycle is known by its stream and its start date.
export const cyclePatterns = fathomSchema.table(
  "cycle_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamId: uuid("stream_id")
      .notNull()
      .references(() => releaseStreams.id, { onDelete: "restrict" }),
    startsOn: date("starts_on").notNull(),
    length: integer("length").notNull(),
    unit: text("unit").notNull(),
    naming: text("naming").notNull(),
  },
  (table) => [
    uniqueIndex("cycle_patterns_stream_start_index").on(
      table.streamId,
      table.startsOn,
    ),
    check("cycle_patterns_length_positive", sql`${table.length} > 0`),
    check(
      "cycle_patterns_unit_known",
      sql`${table.unit} IN ('weeks', 'months')`,
    ),
  ],
);

// Releases, each including the consecutive cycles of its stream from its first cycle to its last,
// named by the start dates of those cycles. A release's name is unique within its stream, ignoring
// letter case. That no cycle is in two releases is checked by the server. A release ships at the
// end of its last cycle unless it has a ships-on date, earlier or later, but not before its first
// cycle starts. A release's colour is a palette name checked by the server, not the database, so the
// palette can change without a migration; a release with none, or with a name the palette no longer
// has, shows the default colour. A release's note is Markdown checked by the server, as a note
// column's is; a release without one has none rather than an empty one.
export const releases = fathomSchema.table(
  "releases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamId: uuid("stream_id")
      .notNull()
      .references(() => releaseStreams.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    firstCycle: date("first_cycle").notNull(),
    lastCycle: date("last_cycle").notNull(),
    shipsOn: date("ships_on"),
    colour: text("colour"),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("releases_stream_name_index").on(
      table.streamId,
      sql`lower(${table.name})`,
    ),
    check(
      "releases_cycles_in_order",
      sql`${table.lastCycle} >= ${table.firstCycle}`,
    ),
    check(
      "releases_ships_after_first_cycle",
      sql`${table.shipsOn} IS NULL OR ${table.shipsOn} >= ${table.firstCycle}`,
    ),
    check("releases_note_not_empty", sql`${table.note} <> ''`),
  ],
);

// Customers, whom projects and proposals are for. A customer's name is unique, ignoring letter case.
export const customers = fathomSchema.table(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
  },
  (table) => [
    uniqueIndex("customers_name_index").on(sql`lower(${table.name})`),
  ],
);

// Proposals: work offered or requested that may become a project, such as a bid. A proposal's name
// is unique, ignoring letter case, and so is its Proposal ID when it has one. Its status is a
// choice in the built-in proposal statuses list, which the server checks. Its customers are kept
// as a list of identifiers, which the server checks name customers, since a proposal picks several
// and its draft changes them together.
export const proposals = fathomSchema.table(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    externalId: text("external_id"),
    link: text("link"),
    ownerId: uuid("owner_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    customerIds: uuid("customer_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    statusId: uuid("status_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("proposals_name_index").on(sql`lower(${table.name})`),
    uniqueIndex("proposals_external_id_index").on(
      sql`lower(${table.externalId})`,
    ),
    index("proposals_owner_index").on(table.ownerId),
    index("proposals_status_index").on(table.statusId),
  ],
);

// Projects. A project's name is unique, ignoring letter case, and so is its Project ID when it has
// one. Its dates are not kept: they come from its milestones. Its customers and the proposals it
// links to are kept as lists of identifiers, which the server checks name records.
export const projects = fathomSchema.table(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    externalId: text("external_id"),
    ownerId: uuid("owner_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    customerIds: uuid("customer_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    proposalIds: uuid("proposal_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
  },
  (table) => [
    uniqueIndex("projects_name_index").on(sql`lower(${table.name})`),
    uniqueIndex("projects_external_id_index").on(
      sql`lower(${table.externalId})`,
    ),
    index("projects_owner_index").on(table.ownerId),
  ],
);

// Milestones, each of one project, on a day, and either a customer delivery or not.
export const milestones = fathomSchema.table(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    date: date("date").notNull(),
    customerDelivery: boolean("customer_delivery").notNull().default(false),
  },
  (table) => [index("milestones_project_index").on(table.projectId)],
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
    // approved, "rejection" for drafts rejected, "discard" for drafts discarded, "resubmission" for
    // rejected drafts sent for approval again unchanged, and "withdrawal" for a user's unpublished
    // changes discarded all at once.
    kind: text("kind").notNull().default("edit"),
    // Null for Fathom itself, such as for data made by setup or seed scripts. Accounts are deactivated,
    // never deleted, so the user who made a change always exists.
    madeBy: text("made_by").references(() => users.id),
    // The role its maker was acting as, beside them; null for Fathom itself. Roles are never
    // deleted, so it always exists.
    madeAsRoleId: uuid("made_as_role_id").references(() => roles.id),
    // The time of saving itself, not when its transaction began, so a change that waited for another
    // is not dated before it.
    madeAt: timestamp("made_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    // Whether the change set holds changes to drafts that its maker has not published, which only
    // they see. Publishing clears it, the one change the change history allows.
    unpublished: boolean("unpublished").notNull().default(false),
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
// Employee IDs are unique, ignoring letter case, among themselves and, checked by the server, with
// planned hires' requisitions. A person's position is a choice in the built-in Positions list,
// which the server checks. People who leave are kept, not deleted; deleting is only for a person
// entered by mistake whom nothing uses. A person's state is a choice in the built-in hiring states
// list meaning Hired or Left, as their end date decides, which the server checks; none, or one of
// the other meaning, stands for the first choice offered with the meaning the end date decides.
// Other details are columns drawing on lists. Only people flagged as managers can be named as a
// manager, which the server checks rather than the database, since past reporting lines may name
// people no longer flagged.
export const people = fathomSchema.table(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    preferredName: text("preferred_name").notNull(),
    employeeId: text("employee_id").notNull(),
    positionId: uuid("position_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "restrict" }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    isManager: boolean("is_manager").notNull().default(false),
    stateId: uuid("state_id").references(() => listItems.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    uniqueIndex("people_employee_id_index").on(sql`lower(${table.employeeId})`),
    index("people_position_index").on(table.positionId),
    index("people_state_index").on(table.stateId),
    check(
      "people_dates_in_order",
      sql`${table.endDate} IS NULL OR ${table.startDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
  ],
);

// The numbers of planned hires' temporary IDs, such as 7 in TBD-7, never reused.
export const plannedHireTemporaryNumbers = fathomSchema.sequence(
  "planned_hire_temporary_numbers",
);

// Planned hires: roles to be filled, kept apart from people, so their Confidential details never sit
// among people's, but shown beside them on People. A hire is known by its requisition or, until it
// has one, by a temporary number; requisitions are unique, ignoring letter case, among themselves
// and, checked by the server, with Employee IDs, and never look like a temporary ID. Its state is a
// choice in the built-in hiring states list and its position one in Positions, which the server
// checks. A filled hire names the person who filled it. A person may fill several over time, and is
// removed only with the hires they filled, which the server does in one draft. A hire's manager is a
// person or, marked as a manager, another planned hire, never both; the server refuses loops.
export const plannedHires = fathomSchema.table(
  "planned_hires",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    requisition: text("requisition"),
    temporaryNumber: integer("temporary_number"),
    positionId: uuid("position_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "restrict" }),
    targetDate: date("target_date"),
    stateId: uuid("state_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "restrict" }),
    managerId: uuid("manager_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    managerHireId: uuid("manager_hire_id").references(
      (): AnyPgColumn => plannedHires.id,
      { onDelete: "restrict" },
    ),
    isManager: boolean("is_manager").notNull().default(false),
    filledBy: uuid("filled_by").references(() => people.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    uniqueIndex("planned_hires_requisition_index").on(
      sql`lower(${table.requisition})`,
    ),
    uniqueIndex("planned_hires_temporary_number_index").on(
      table.temporaryNumber,
    ),
    index("planned_hires_filled_by_index").on(table.filledBy),
    index("planned_hires_manager_index").on(table.managerId),
    index("planned_hires_manager_hire_index").on(table.managerHireId),
    index("planned_hires_position_index").on(table.positionId),
    index("planned_hires_state_index").on(table.stateId),
    check(
      "planned_hires_one_id",
      sql`num_nonnulls(${table.requisition}, ${table.temporaryNumber}) = 1`,
    ),
    check(
      "planned_hires_one_manager",
      sql`num_nonnulls(${table.managerId}, ${table.managerHireId}) <= 1`,
    ),
    check(
      "planned_hires_not_own_manager",
      sql`${table.managerHireId} IS NULL OR ${table.managerHireId} <> ${table.id}`,
    ),
    check(
      "planned_hires_requisition_not_temporary",
      sql`${table.requisition} IS NULL OR lower(${table.requisition}) NOT LIKE 'tbd-%'`,
    ),
  ],
);

// The columns people add to Fathom's tables, as ADR 0005 sets out; for now only columns on people
// that draw on a list. A column decides what it is called, whether one choice or several can be
// picked, and whether a value is required. Its names are unique within its table, ignoring letter
// case. A list cannot be deleted while a column draws on it. A column on people can be offered on
// planned hires too, where a value is never required.
export const fields = fathomSchema.table(
  "fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The table the column is on, such as "people", checked by the server.
    tableName: text("table_name").notNull(),
    name: text("name").notNull(),
    // "choice" for a column drawing on a list, "link" for a web link, or "note" for a note.
    type: text("type").notNull().default("choice"),
    listId: uuid("list_id").references(() => lists.id, {
      onDelete: "restrict",
    }),
    // The tier of a link or note column's values, which a choice column takes from its list instead.
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
      sql`(${table.type} = 'choice' AND ${table.listId} IS NOT NULL AND ${table.visibility} IS NULL) OR (${table.type} IN ('link', 'note') AND ${table.listId} IS NULL AND ${table.visibility} IS NOT NULL AND NOT ${table.multiple})`,
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

// The values of columns, one row for each record, column, and choice, or for each record and link
// or note column, as ADR 0005 sets out. Each table that can have columns has its own owner column, and
// exactly one is set. A value is deleted with its record or column, and a choice cannot be deleted
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
    choiceId: uuid("choice_id").references(() => listItems.id, {
      onDelete: "restrict",
    }),
    linkAddress: text("link_address"),
    // Empty to show the address itself.
    linkText: text("link_text"),
    // Markdown, as the server checks it; a note removed has no row.
    note: text("note"),
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
    index("field_values_person_index")
      .on(table.personId)
      .where(sql`${table.personId} IS NOT NULL`),
    index("field_values_planned_hire_index")
      .on(table.plannedHireId)
      .where(sql`${table.plannedHireId} IS NOT NULL`),
    index("field_values_choice_index").on(table.choiceId),
    check(
      "field_values_one_owner",
      sql`num_nonnulls(${table.personId}, ${table.plannedHireId}) = 1`,
    ),
    check(
      "field_values_one_kind",
      sql`num_nonnulls(${table.choiceId}, ${table.linkAddress}, ${table.note}) = 1 AND (${table.linkAddress} IS NULL) = (${table.linkText} IS NULL)`,
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
// until a change to it is published, or it is discarded. Who made and changed each draft is read
// from the change history. People, lists, choices, and the order of each list's choices have drafts.
// These are the published drafts; each user's unpublished ones are kept apart, as below.
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

// Unpublished drafts: the changes a user has made to drafts and not yet published, which only they
// see, as ADR 0008 sets out. Each holds the whole draft the user intends, shaped and keyed as a draft
// row, so a record has at most one, and holds the record: no one else may change, approve, or reject
// it until the user publishes or discards their changes. A draft that changes nothing, which
// publishing makes into no draft at all, is a change with no fields.
export const unpublishedDrafts = fathomSchema.table(
  "unpublished_drafts",
  {
    // The kind of record, such as "person", checked by the server.
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    // The user whose changes these are.
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // "created", "changed", or "deleted", checked by the server.
    action: text("action").notNull(),
    fields: jsonb("fields")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    // Rises with each unpublished draft made, so records the user drafts to be added keep the order
    // they were drafted in when published.
    sequence: bigint("sequence", { mode: "number" })
      .notNull()
      .generatedAlwaysAsIdentity(),
  },
  (table) => [
    primaryKey({ columns: [table.recordType, table.recordId] }),
    index("unpublished_drafts_user_index").on(table.userId),
  ],
);

// Who each person reports to, from a date until their next line starts, so past managers are kept
// and capacity by manager can be counted for past months. A line with no manager records that the
// person has none from that date. Anyone named as a manager is kept, since past lines name them.
export const reportingLines = fathomSchema.table(
  "reporting_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    managerId: uuid("manager_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    fromDate: date("from_date").notNull(),
  },
  (table) => [
    uniqueIndex("reporting_lines_person_from_index").on(
      table.personId,
      table.fromDate,
    ),
    index("reporting_lines_manager_index").on(table.managerId),
    check(
      "reporting_lines_not_self",
      sql`${table.managerId} IS NULL OR ${table.managerId} <> ${table.personId}`,
    ),
  ],
);

// A team is the people who report directly to one manager, so its name is kept with the manager and
// stays with them when reports move. Only named teams have a row. A team may name a colour from the
// palette, which the server checks, so the palette can change without a migration.
export const teams = fathomSchema.table(
  "teams",
  {
    managerId: uuid("manager_id")
      .primaryKey()
      .references(() => people.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colour: text("colour"),
  },
  (table) => [uniqueIndex("teams_name_index").on(sql`lower(${table.name})`)],
);

// Feature teams: the people working on a set of related features, apart from reporting lines, as
// the Decisions Log sets out. A team's name is required and unique, ignoring letter case; its
// feature lead, if any, is one of its current members, which the server checks. A team may name a
// colour from the palette, for the feature team chart, as a manager's team does.
export const featureTeams = fathomSchema.table(
  "feature_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    leadId: uuid("lead_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    colour: text("colour"),
  },
  (table) => [
    uniqueIndex("feature_teams_name_index").on(sql`lower(${table.name})`),
    index("feature_teams_lead_index").on(table.leadId),
  ],
);

// Joining and leaving feature teams: each record puts a person on a team, or takes them off it,
// from a date, in force until their next record for that team, so past memberships are kept, as
// reporting lines are.
export const featureTeamMemberships = fathomSchema.table(
  "feature_team_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => featureTeams.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    member: boolean("member").notNull(),
    fromDate: date("from_date").notNull(),
  },
  (table) => [
    uniqueIndex("feature_team_memberships_from_index").on(
      table.teamId,
      table.personId,
      table.fromDate,
    ),
    index("feature_team_memberships_person_index").on(table.personId),
  ],
);
