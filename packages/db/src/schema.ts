import { pgSchema, text } from "drizzle-orm/pg-core";

// Every Fathom table lives in this schema, which the migration role owns. The application role can
// only read and write data in it.
export const fathomSchema = pgSchema("fathom");

export const appInfo = fathomSchema.table("app_info", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
