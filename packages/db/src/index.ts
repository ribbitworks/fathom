// SPDX-License-Identifier: Apache-2.0

// The database package's public interface: the connection settings, the client, the schema, error
// reporting, and the migration runner. Deployments run migrations separately, with this package's
// migrate command (src/migrate.ts); in development, with 'pnpm db:migrate'.

export {
  createDatabase,
  createPool,
  type Database,
  type Reader,
} from "./client.ts";
export { type DatabaseConfig, loadDatabaseConfig } from "./config.ts";
export { databaseCodes, describeError, hasDatabaseCode } from "./errors.ts";
export {
  type ChangeMaker,
  type ChangeRecord,
  type ChangeSetKind,
  fieldOfValue,
  inChunks,
  recordChanges,
  valueField,
} from "./history.ts";
export { runMigrations } from "./migrate.ts";
export { privateSetOf } from "./private-sets.ts";
export {
  accessHistory,
  accounts,
  activities,
  allocations,
  appInfo,
  changes,
  changeSets,
  columnOrders,
  customers,
  cyclePatterns,
  dataClasses,
  drafts,
  fields,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
  fieldValues,
  fathomSchema,
  planningSettings,
  planningSettingsId,
  features,
  listItems,
  lastViews,
  lists,
  milestones,
  people,
  plannedHires,
  plannedHireTemporaryNumbers,
  privateChanges,
  privatePages,
  privateRows,
  privateSets,
  projects,
  proposals,
  rateLimits,
  recordKeyCounters,
  recordKeys,
  releases,
  releaseStreams,
  reportingLines,
  rolePermissions,
  roles,
  savedViews,
  sessions,
  teams,
  userRoles,
  users,
  verifications,
} from "./schema.ts";
