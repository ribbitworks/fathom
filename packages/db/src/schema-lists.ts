// SPDX-License-Identifier: Apache-2.0

// The tables of lists and their choices, for columns to draw on.

import {
  boolean,
  check,
  integer,
  numeric,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { fathomSchema } from "./schema-core.ts";

// The lists Fathom builds in, for its built-in columns to draw on, and the meanings Fathom fixes for
// the choices of those that have them, as SQL lists.
const sqlList = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(", ");
const builtInListList = sqlList([
  "positions",
  "hiring-states",
  "proposal-statuses",
  "feature-statuses",
  "feature-priorities",
  "feature-sizes",
  "feature-risks",
]);
const meaningList = sqlList([
  "proposed",
  "open",
  "hired",
  "left",
  "possible",
  "planned",
  "in-progress",
  "done",
  "cancelled",
]);

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
// one of them, which the server checks, as it does that each meaning keeps a choice offered. A
// choice of feature sizes has a weight, how many of the size S it counts as.
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
    weight: numeric("weight", { mode: "number", precision: 6, scale: 2 }),
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
    check(
      "list_items_weight_positive",
      sql`${table.weight} > 0 AND ${table.weight} <> 'NaN'`,
    ),
  ],
);
