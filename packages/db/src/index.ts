// SPDX-License-Identifier: Apache-2.0

// The database package's public interface: the connection settings, the client, and the schema.
// Migrations run separately, with this package's migrate command (src/migrate.ts); in development,
// with 'pnpm db:migrate'.

export { createDatabase, createPool, type Database } from "./client.ts";
export { type DatabaseConfig, loadDatabaseConfig } from "./config.ts";
export { appInfo, fathomSchema } from "./schema.ts";
