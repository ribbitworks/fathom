// SPDX-License-Identifier: Apache-2.0

// The tables of the change history, drafts, private changes and record keys.

import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  check,
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
import { users, roles } from "./schema-accounts.ts";
import { fathomSchema } from "./schema-core.ts";

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
    // rejected drafts sent for approval again unchanged, "withdrawal" for a user's private
    // changes discarded all at once, "gone" for a user's private changes withdrawn because their
    // record is gone, and "given-up" for fields of a user's private changes given up, on
    // publishing, for the values someone else changed them to.
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
    // Whether the change set holds private changes, which only its maker sees. Publishing them
    // clears it and sets publishedAt, once, the one change the change history allows.
    private: boolean("private").notNull().default(false),
    // When others could first see it: its time of saving, unless it was private, then when its
    // maker published it, and null while it is private. Who changed a draft counts from then.
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // For an undo, the change set it undid, so a give-up leaves a private change set and its undo,
    // which cancel each other, out of what it takes back.
    undoes: uuid("undoes").references((): AnyPgColumn => changeSets.id),
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
    action: text("action").$type<"created" | "changed" | "deleted">().notNull(),
    field: text("field").notNull(),
    // The sensitivity tier of the field, so each user sees only changes to data they may see.
    tier: text("tier").notNull(),
    // Null when the field had no value, as before a record is created or after it is deleted.
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    // Whether the change is to a record's draft, rather than to the live record.
    draft: boolean("draft").notNull().default(false),
    // For a change taking back one of its maker's private changes, as giving it up on publishing
    // does, the change it takes back, so each is taken back exactly once; null otherwise.
    takesBack: bigint("takes_back", { mode: "number" }).references(
      (): AnyPgColumn => changes.id,
    ),
  },
  (table) => [
    index("changes_record_index").on(table.recordType, table.recordId),
    index("changes_change_set_index").on(table.changeSetId),
    // A change is taken back at most once.
    uniqueIndex("changes_takes_back_index").on(table.takesBack),
    // Each record's changes to a field, which the change history filters by to find the latest name
    // and list it holds for a record, taking the latest by its change set's time.
    index("changes_record_field_index").on(
      table.recordId,
      table.field,
      table.id.desc(),
    ),
  ],
);

// Draft rows: the changes waiting for approval, at most one draft for each record. A draft adds a
// record, changes some of its fields, or removes it. It holds the record as the change history
// records it: all of an added record's fields, only the fields a change makes differ from the live
// record, and none for a removal. A rejected draft keeps the Approver's reason until a change to it
// is published, or it is discarded. Who made and changed each draft is read from the change
// history. The kinds of record with drafts are listed in packages/shared/src/drafts.ts. These are
// the published drafts; each user's private changes are kept apart, as below.
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

// Each user's sets of private changes: one, made with their first private change.
export const privateSets = fathomSchema.table(
  "private_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    madeAt: timestamp("made_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (table) => [index("private_sets_user_index").on(table.userId)],
);

// Private changes: the changes a user has made to drafts and not yet submitted, which only they
// see, as ADR 0008 sets out. Each holds the whole draft the user intends, shaped as a draft row,
// one for each record and user. Until records stop being held, a record has at most one, and no
// one else may change, approve, or reject it until the user publishes or discards their changes. A
// draft that changes nothing, which submitting makes into no draft at all, is a change with no
// fields.
export const privateChanges = fathomSchema.table(
  "private_changes",
  {
    // The kind of record, such as "person", checked by the server.
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    // The user whose changes these are.
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    setId: uuid("set_id")
      .notNull()
      .references(() => privateSets.id),
    // "created", "changed", or "deleted", checked by the server.
    action: text("action").notNull(),
    fields: jsonb("fields")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    // For each field its maker changed, the value it started from: its keys are the fields that
    // stand over the published draft, and its values are what a check on publishing is to compare.
    // Empty for a change that holds its whole draft, such as a record its maker adds.
    startedFrom: jsonb("started_from")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    // When the user began the changes a give-up may take back: when they first changed the record
    // since they last published, discarded or reverted their changes to it.
    since: timestamp("since", { withTimezone: true }).notNull().defaultNow(),
    // Rises with each private change made, so records the user drafts to be added keep the order
    // they were drafted in when published.
    sequence: bigint("sequence", { mode: "number" })
      .notNull()
      .generatedAlwaysAsIdentity(),
  },
  (table) => [
    primaryKey({ columns: [table.recordType, table.recordId, table.userId] }),
    index("private_changes_user_index").on(table.userId),
    index("private_changes_set_index").on(table.setId),
  ],
);

// Each record's key number, by the kind's word as packages/shared/src/record-keys.ts fixes it and
// the record's identifier. Triggers number a record when it's added, or drafted to be added, in the
// same transaction, so every way of adding one is covered. Rows outlive their records, so numbers
// are never reused and a removed record's key still names it; the application's role cannot change
// or delete them.
export const recordKeys = fathomSchema.table(
  "record_keys",
  {
    kind: text("kind").notNull(),
    keyNumber: integer("key_number").notNull(),
    recordId: text("record_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.keyNumber] }),
    uniqueIndex("record_keys_record_index").on(table.kind, table.recordId),
    check("record_keys_number_positive", sql`${table.keyNumber} > 0`),
  ],
);

// The last key number given to each kind, which numbering a record raises under the row's lock.
export const recordKeyCounters = fathomSchema.table("record_key_counters", {
  kind: text("kind").primaryKey(),
  lastNumber: integer("last_number").notNull(),
});
