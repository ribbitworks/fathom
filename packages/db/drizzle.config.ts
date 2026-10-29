// SPDX-License-Identifier: Apache-2.0

// drizzle-kit settings: where the schema is defined, where generated SQL migrations are written, and
// where applied migrations are recorded.

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  schemaFilter: ["fathom"],
  migrations: { schema: "fathom_migrations", table: "migrations" },
});
