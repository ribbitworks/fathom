import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  schemaFilter: ["fathom"],
  migrations: { schema: "fathom_migrations", table: "migrations" },
});
