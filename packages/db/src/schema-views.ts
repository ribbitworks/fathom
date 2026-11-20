// SPDX-License-Identifier: Apache-2.0

// The tables of saved views and each user's last view of each page.

import {
  jsonb,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./schema-accounts.ts";
import { fathomSchema } from "./schema-core.ts";

// Saved views: a table's search, filters, and sort, saved under a name, personal to its maker or
// shared with everyone who sees the table. A name is unique, ignoring letter case, among the table's
// shared views and among each maker's personal ones, so a personal view's name never tells anyone
// else that it exists. Who made each view is kept with it, since its maker may change it; the
// change history records every change to it.
export const savedViews = fathomSchema.table(
  "saved_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The table the view is of, such as "people", checked by the server.
    tableName: text("table_name").notNull(),
    name: text("name").notNull(),
    // "personal" or "shared", checked by the server.
    scope: text("scope").notNull(),
    // The view as the page address holds it, checked by the server.
    definition: jsonb("definition").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex("saved_views_shared_name_index")
      .on(table.tableName, sql`lower(${table.name})`)
      .where(sql`${table.scope} = 'shared'`),
    uniqueIndex("saved_views_personal_name_index")
      .on(table.tableName, table.createdBy, sql`lower(${table.name})`)
      .where(sql`${table.scope} = 'personal'`),
  ],
);

// The view each account last showed on each page with a Views menu. It is the account's own
// setting, so the change history doesn't record it.
export const lastViews = fathomSchema.table(
  "last_views",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The page, such as "projects", checked by the server.
    page: text("page").notNull(),
    // The table shown on the page, such as "proposals", checked by the server.
    tableName: text("table_name").notNull(),
    definition: jsonb("definition").notNull(),
    savedViewId: uuid("saved_view_id").references(() => savedViews.id, {
      onDelete: "set null",
    }),
    mode: text("mode"),
  },
  (table) => [primaryKey({ columns: [table.userId, table.page] })],
);
