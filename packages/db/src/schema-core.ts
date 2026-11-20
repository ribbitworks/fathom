// SPDX-License-Identifier: Apache-2.0

// The PostgreSQL schema every Fathom table lives in, and the tables of Fathom's own details:
// its app information and the class each built-in detail is kept in.

import { pgSchema, text } from "drizzle-orm/pg-core";

// Every Fathom table lives in this schema, which the migration role owns. The application role can
// only read and write data in it.
export const fathomSchema = pgSchema("fathom");

export const appInfo = fathomSchema.table("app_info", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// The class the organization keeps each of Fathom's built-in details in, such as start dates, by
// the detail's name; both checked by the server. A detail with no row is in its default class.
export const dataClasses = fathomSchema.table("data_classes", {
  field: text("field").primaryKey(),
  dataClass: text("data_class").notNull(),
});
