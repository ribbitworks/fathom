// SPDX-License-Identifier: Apache-2.0

// The tables of reporting lines, teams, feature teams and their leads and members, and
// allocations.

import {
  boolean,
  check,
  date,
  index,
  jsonb,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { fathomSchema } from "./schema-core.ts";
import { people, plannedHires } from "./schema-people.ts";
import { activities, features } from "./schema-plan.ts";

// Who each person reports to, from a date until their next line starts, so past managers are kept
// and capacity by manager can be counted for past months. A line with no manager records that the
// person has none from that date. Anyone named as a manager is kept, since past lines name them.
export const reportingLines = fathomSchema.table(
  "reporting_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    managerId: uuid("manager_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    fromDate: date("from_date").notNull(),
  },
  (table) => [
    uniqueIndex("reporting_lines_person_from_index").on(
      table.personId,
      table.fromDate,
    ),
    index("reporting_lines_manager_index").on(table.managerId),
    check(
      "reporting_lines_not_self",
      sql`${table.managerId} IS NULL OR ${table.managerId} <> ${table.personId}`,
    ),
  ],
);

// A team is the people who report directly to one manager, so its name is kept with the manager and
// stays with them when reports move. Only named teams have a row. A team may name a colour from the
// palette, which the server checks, so the palette can change without a migration.
export const teams = fathomSchema.table(
  "teams",
  {
    managerId: uuid("manager_id")
      .primaryKey()
      .references(() => people.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colour: text("colour"),
  },
  (table) => [uniqueIndex("teams_name_index").on(sql`lower(${table.name})`)],
);

// Feature teams: the people working on a set of related features, apart from reporting lines. A
// team's name is required and unique, ignoring letter case. A team may name a colour from the
// palette, for the feature team chart, as a manager's team does.
export const featureTeams = fathomSchema.table(
  "feature_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    colour: text("colour"),
  },
  (table) => [
    uniqueIndex("feature_teams_name_index").on(sql`lower(${table.name})`),
  ],
);

// Who leads a feature team: each record names its lead, a person or a planned hire, or none, from a
// date, in force until the team's next record, so past and planned leads are kept. The server checks
// a new lead is one of the team's members on that date, and refuses removing someone who leads a team
// today or later, so removing a person only clears them from past records, leaving those periods
// with no lead; removing a planned hire clears it the same way.
export const featureTeamLeads = fathomSchema.table(
  "feature_team_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => featureTeams.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => people.id, {
      onDelete: "set null",
    }),
    leadPlannedHireId: uuid("lead_planned_hire_id").references(
      () => plannedHires.id,
      { onDelete: "set null" },
    ),
    fromDate: date("from_date").notNull(),
  },
  (table) => [
    uniqueIndex("feature_team_leads_from_index").on(
      table.teamId,
      table.fromDate,
    ),
    index("feature_team_leads_lead_index").on(table.leadId),
    index("feature_team_leads_planned_hire_index").on(table.leadPlannedHireId),
    check(
      "feature_team_leads_one_lead",
      sql`num_nonnulls(${table.leadId}, ${table.leadPlannedHireId}) <= 1`,
    ),
  ],
);

// Joining and leaving feature teams: each record puts a person or a planned hire on a team, or takes
// them off it, from a date, in force until their next record for that team, so past memberships are
// kept, as reporting lines are.
export const featureTeamMemberships = fathomSchema.table(
  "feature_team_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => featureTeams.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => people.id, {
      onDelete: "cascade",
    }),
    plannedHireId: uuid("planned_hire_id").references(() => plannedHires.id, {
      onDelete: "cascade",
    }),
    member: boolean("member").notNull(),
    fromDate: date("from_date").notNull(),
  },
  (table) => [
    uniqueIndex("feature_team_memberships_from_index").on(
      table.teamId,
      table.personId,
      table.fromDate,
    ),
    uniqueIndex("feature_team_memberships_planned_hire_from_index").on(
      table.teamId,
      table.plannedHireId,
      table.fromDate,
    ),
    index("feature_team_memberships_person_index").on(table.personId),
    index("feature_team_memberships_planned_hire_index").on(
      table.plannedHireId,
    ),
    check(
      "feature_team_memberships_one_member",
      sql`(${table.personId} IS NULL) <> (${table.plannedHireId} IS NULL)`,
    ),
  ],
);

// Allocations: one person or planned hire on one feature or one activity, holding the percentage of
// a month that takes effect from each month it changes, such as {"2027-01": 50, "2027-07": null}, in
// force until the next, where null stops it; the server checks its shape. A person or planned hire
// has at most one allocation to a feature or activity, so each is one draft. Removing a person or
// planned hire removes their allocations, which the server records; a feature or activity with
// allocations is refused removal by name before the database refuses it.
export const allocations = fathomSchema.table(
  "allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id").references(() => people.id, {
      onDelete: "cascade",
    }),
    plannedHireId: uuid("planned_hire_id").references(() => plannedHires.id, {
      onDelete: "cascade",
    }),
    featureId: uuid("feature_id").references(() => features.id, {
      onDelete: "restrict",
    }),
    activityId: uuid("activity_id").references(() => activities.id, {
      onDelete: "restrict",
    }),
    months: jsonb("months").$type<Record<string, number | null>>().notNull(),
  },
  (table) => [
    uniqueIndex("allocations_person_feature_index").on(
      table.personId,
      table.featureId,
    ),
    uniqueIndex("allocations_planned_hire_feature_index").on(
      table.plannedHireId,
      table.featureId,
    ),
    uniqueIndex("allocations_person_activity_index").on(
      table.personId,
      table.activityId,
    ),
    uniqueIndex("allocations_planned_hire_activity_index").on(
      table.plannedHireId,
      table.activityId,
    ),
    index("allocations_feature_index").on(table.featureId),
    index("allocations_activity_index").on(table.activityId),
    check(
      "allocations_one_work",
      sql`num_nonnulls(${table.featureId}, ${table.activityId}) = 1`,
    ),
    check(
      "allocations_one_assignee",
      sql`(${table.personId} IS NULL) <> (${table.plannedHireId} IS NULL)`,
    ),
    check(
      "allocations_months_object",
      sql`jsonb_typeof(${table.months}) = 'object'`,
    ),
  ],
);
