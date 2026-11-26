// SPDX-License-Identifier: Apache-2.0

// A person's own pages, each a table of free rows, private to their maker, and the random keys
// that name a page or a row without saying how many there are.

import {
  type AnyPgColumn,
  check,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./schema-accounts.ts";
import { fields } from "./schema-columns.ts";
import { fathomSchema } from "./schema-core.ts";

// A page under its maker's Mine, named uniquely among their pages, ignoring letter case. Its first
// column names each row, set in the same transaction the page and that column are made in.
export const privatePages = fathomSchema.table(
  "private_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    // The maker's order of their pages under Mine.
    position: integer("position").notNull(),
    firstFieldId: uuid("first_field_id")
      .notNull()
      // Typed, since the two tables name each other.
      .references((): AnyPgColumn => fields.id),
    madeAt: timestamp("made_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("private_pages_name_index").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
  ],
);

// A row of a page, in the order rows were added, so a page reads in the order typed. Its values
// are field_values rows it owns; the first column's value names it.
export const privateRows = fathomSchema.table(
  "private_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => privatePages.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    madeAt: timestamp("made_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("private_rows_page_index").on(table.pageId)],
);

// The short random code naming each page and each row, such as K7QM in #PAGE-K7QM. A key outlives
// its record, so it is never given again; only the function that makes keys writes them, so the
// application's role can't change one.
export const randomKeys = fathomSchema.table(
  "random_keys",
  {
    kind: text("kind").notNull(),
    code: text("code").notNull(),
    recordId: uuid("record_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.code] }),
    uniqueIndex("random_keys_record_index").on(table.kind, table.recordId),
    check("random_keys_kind", sql`${table.kind} IN ('page', 'row')`),
    // Four characters, or five once a kind has used a tenth of its four, from the thirty that can't
    // be taken for one another: no 0, 1, I, L, O or U.
    check(
      "random_keys_code",
      sql`${table.code} ~ '^[2-9ABCDEFGHJKMNPQRSTVWXYZ]{4,5}$'`,
    ),
  ],
);
