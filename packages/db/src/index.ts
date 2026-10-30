// SPDX-License-Identifier: Apache-2.0

// The database package's public interface: the connection settings, the client, the schema, error
// reporting, and the migration runner. Deployments run migrations separately, with this package's
// migrate command (src/migrate.ts); in development, with 'pnpm db:migrate'.

export { createDatabase, createPool, type Database } from "./client.ts";
export { type DatabaseConfig, loadDatabaseConfig } from "./config.ts";
export { describeError } from "./errors.ts";
export { runMigrations } from "./migrate.ts";
export {
  accounts,
  appInfo,
  fathomSchema,
  rateLimits,
  sessions,
  userRoles,
  users,
  verifications,
} from "./schema.ts";
