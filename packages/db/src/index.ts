// SPDX-License-Identifier: Apache-2.0

// The database package's public interface: the connection settings, the client, the schema, error
// reporting, and the migration runner. Deployments run migrations separately, with this package's
// migrate command (src/migrate.ts); in development, with 'pnpm db:migrate'.

export { createDatabase, createPool, type Database } from "./client.ts";
export { type DatabaseConfig, loadDatabaseConfig } from "./config.ts";
export { databaseCodes, describeError, hasDatabaseCode } from "./errors.ts";
export {
  type ChangeRecord,
  type ChangeSetKind,
  fieldOfValue,
  inChunks,
  recordChanges,
  valueField,
} from "./history.ts";
export { runMigrations } from "./migrate.ts";
export {
  accessHistory,
  accounts,
  appInfo,
  changes,
  changeSets,
  columnOrders,
  cyclePatterns,
  drafts,
  fields,
  fieldValues,
  fathomSchema,
  hiringStateNames,
  listItems,
  lists,
  people,
  plannedHires,
  rateLimits,
  releases,
  releaseStreams,
  reportingLines,
  savedViews,
  sessions,
  teams,
  unpublishedDrafts,
  userRoles,
  users,
  verifications,
} from "./schema.ts";
