// SPDX-License-Identifier: Apache-2.0

// The database package's public interface: the connection settings, the client, the schema, error
// reporting, and the migration runner. Deployments run migrations separately, with this package's
// migrate command (src/migrate.ts); in development, with 'pnpm db:migrate'.

export { createDatabase, createPool, type Database } from "./client.ts";
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
export {
  accessHistory,
  accounts,
  allocations,
  appInfo,
  changes,
  changeSets,
  columnOrders,
  customers,
  cyclePatterns,
  drafts,
  fields,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
  fieldValues,
  fathomSchema,
  effortConversions,
  effortConversionsId,
  features,
  listItems,
  lists,
  milestones,
  people,
  plannedHires,
  plannedHireTemporaryNumbers,
  projects,
  proposals,
  rateLimits,
  releases,
  releaseStreams,
  reportingLines,
  rolePermissions,
  roles,
  savedViews,
  sessions,
  teams,
  unpublishedDrafts,
  userRoles,
  users,
  verifications,
} from "./schema.ts";
