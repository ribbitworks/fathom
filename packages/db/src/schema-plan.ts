// SPDX-License-Identifier: Apache-2.0

// The tables of the plan: release streams and their cycles, releases, customers, proposals,
// projects, milestones, features and the planning settings.

import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { fathomSchema } from "./schema-core.ts";
import { listItems } from "./schema-lists.ts";
import { people } from "./schema-people.ts";
import { featureTeams } from "./schema-teams.ts";

// Release streams, each with its own cycles and releases, such as major releases or patches. A
// stream's name is unique, ignoring letter case. Streams are retired, never deleted, since releases
// and features refer to their cycles. A stream's cycles are those starting on or before its
// cycles-until date, which the server sets when the stream is drafted, since a stream is added only
// once approved. A stream that ends has a last day instead, which cuts its last cycle short; its
// cycles-until date is kept, unused, so it can keep going again from that day.
export const releaseStreams = fathomSchema.table(
  "release_streams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Lower comes first.
    position: integer("position").notNull().default(0),
    retired: boolean("retired").notNull().default(false),
    endsOn: date("ends_on"),
  },
  (table) => [
    uniqueIndex("release_streams_name_index").on(sql`lower(${table.name})`),
  ],
);

// How a stream's cycles are made, from the date a pattern starts until the stream's next pattern
// starts: their length, in weeks or months, and the pattern their names follow. A stream's cycles are
// worked out from its patterns, not stored, so a cycle is known by its stream and its start date.
export const cyclePatterns = fathomSchema.table(
  "cycle_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamId: uuid("stream_id")
      .notNull()
      .references(() => releaseStreams.id, { onDelete: "restrict" }),
    startsOn: date("starts_on").notNull(),
    length: integer("length").notNull(),
    unit: text("unit").notNull(),
    naming: text("naming").notNull(),
  },
  (table) => [
    uniqueIndex("cycle_patterns_stream_start_index").on(
      table.streamId,
      table.startsOn,
    ),
    check("cycle_patterns_length_positive", sql`${table.length} > 0`),
    check(
      "cycle_patterns_unit_known",
      sql`${table.unit} IN ('weeks', 'months')`,
    ),
  ],
);

// Releases, each including the consecutive cycles of its stream from its first cycle to its last,
// named by the start dates of those cycles. A release's name is unique within its stream, ignoring
// letter case. That no cycle is in two releases is checked by the server. A release ships at the
// end of its last cycle unless it has a ships-on date, earlier or later, but not before its first
// cycle starts. A release's colour is a palette name checked by the server, not the database, so the
// palette can change without a migration; a release with none, or with a name the palette no longer
// has, shows the default colour. A release's note is Markdown checked by the server, as a note
// column's is; a release without one has none rather than an empty one.
export const releases = fathomSchema.table(
  "releases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamId: uuid("stream_id")
      .notNull()
      .references(() => releaseStreams.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    firstCycle: date("first_cycle").notNull(),
    lastCycle: date("last_cycle").notNull(),
    shipsOn: date("ships_on"),
    colour: text("colour"),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("releases_stream_name_index").on(
      table.streamId,
      sql`lower(${table.name})`,
    ),
    check(
      "releases_cycles_in_order",
      sql`${table.lastCycle} >= ${table.firstCycle}`,
    ),
    check(
      "releases_ships_after_first_cycle",
      sql`${table.shipsOn} IS NULL OR ${table.shipsOn} >= ${table.firstCycle}`,
    ),
    check("releases_note_not_empty", sql`${table.note} <> ''`),
  ],
);

// Customers, whom projects and proposals are for. A customer's name is unique, ignoring letter case.
// Its description and note are null rather than empty.
export const customers = fathomSchema.table(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("customers_name_index").on(sql`lower(${table.name})`),
    check("customers_description_not_empty", sql`${table.description} <> ''`),
    check("customers_note_not_empty", sql`${table.note} <> ''`),
  ],
);

// Proposals: work offered or requested that may become a project, such as a bid. A proposal's name
// is unique, ignoring letter case, and so is its Proposal ID when it has one. Its status is a
// choice in the built-in proposal statuses list, which the server checks. Its customers are kept
// as a list of identifiers, which the server checks name customers, since a proposal picks several
// and its draft changes them together. The features it proposes are kept and checked the same way.
// The reasons given for taking features off it are kept by feature, each only while that feature is
// off it, so approving a removal records its reason in the change history beside it.
export const proposals = fathomSchema.table(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    externalId: text("external_id"),
    link: text("link"),
    ownerId: uuid("owner_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    customerIds: uuid("customer_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    statusId: uuid("status_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "restrict" }),
    featureIds: uuid("feature_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    removalReasons: jsonb("removal_reasons")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
  },
  (table) => [
    uniqueIndex("proposals_name_index").on(sql`lower(${table.name})`),
    uniqueIndex("proposals_external_id_index").on(
      sql`lower(${table.externalId})`,
    ),
    index("proposals_owner_index").on(table.ownerId),
    index("proposals_status_index").on(table.statusId),
  ],
);

// Projects. A project's name is unique, ignoring letter case, and so is its Project ID when it has
// one. Its dates are not kept: they come from its milestones. Its customers, the proposals it links
// to, and the features it needs are kept as lists of identifiers, which the server checks name
// records.
export const projects = fathomSchema.table(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    externalId: text("external_id"),
    ownerId: uuid("owner_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    customerIds: uuid("customer_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    proposalIds: uuid("proposal_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    featureIds: uuid("feature_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
  },
  (table) => [
    uniqueIndex("projects_name_index").on(sql`lower(${table.name})`),
    uniqueIndex("projects_external_id_index").on(
      sql`lower(${table.externalId})`,
    ),
    index("projects_owner_index").on(table.ownerId),
  ],
);

// Milestones, each of one project or one feature, on a day, and either a customer delivery or not.
export const milestones = fathomSchema.table(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "restrict",
    }),
    featureId: uuid("feature_id").references(() => features.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    date: date("date").notNull(),
    customerDelivery: boolean("customer_delivery").notNull().default(false),
  },
  (table) => [
    index("milestones_project_index").on(table.projectId),
    index("milestones_feature_index").on(table.featureId),
    check(
      "milestones_one_owner",
      sql`num_nonnulls(${table.projectId}, ${table.featureId}) = 1`,
    ),
  ],
);

// Features: the planned work on the roadmap. A feature's name is unique, ignoring letter case. A
// project's general feature has no name of its own, since it shows its project's and follows it. A
// target cycle is known by its stream and start date, as cycles are worked out rather than stored;
// a feature with none is in Later. Its status is a choice of the built-in list of feature statuses,
// and its priority, size and risk, each optional, choices of their built-in lists.
// The month it is needed by is kept as text such as 2027-03. Its note is Markdown checked by the
// server. The estimate is one value, in hours, whichever unit it is shown in; PostgreSQL ranks NaN
// above every number, so it must be refused by name.
export const features = fathomSchema.table(
  "features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    statusId: uuid("status_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "restrict" }),
    priorityId: uuid("priority_id").references(() => listItems.id, {
      onDelete: "restrict",
    }),
    sizeId: uuid("size_id").references(() => listItems.id, {
      onDelete: "restrict",
    }),
    riskId: uuid("risk_id").references(() => listItems.id, {
      onDelete: "restrict",
    }),
    neededBy: text("needed_by"),
    customerIds: uuid("customer_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    targetStreamId: uuid("target_stream_id").references(
      () => releaseStreams.id,
      { onDelete: "restrict" },
    ),
    targetCycle: date("target_cycle"),
    estimateHours: numeric("estimate_hours", {
      mode: "number",
      precision: 12,
      scale: 2,
    }),
    featureTeamId: uuid("feature_team_id").references(() => featureTeams.id, {
      onDelete: "restrict",
    }),
    description: text("description"),
    note: text("note"),
    generalForProjectId: uuid("general_for_project_id").references(
      () => projects.id,
      { onDelete: "restrict" },
    ),
  },
  (table) => [
    uniqueIndex("features_name_index").on(sql`lower(${table.name})`),
    uniqueIndex("features_general_for_project_index").on(
      table.generalForProjectId,
    ),
    index("features_target_index").on(table.targetStreamId, table.targetCycle),
    index("features_feature_team_index").on(table.featureTeamId),
    index("features_status_index").on(table.statusId),
    check(
      "features_needed_by_month",
      sql`${table.neededBy} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
    check("features_note_not_empty", sql`${table.note} <> ''`),
    check(
      "features_named_or_general",
      sql`(${table.name} IS NULL) = (${table.generalForProjectId} IS NOT NULL)`,
    ),
    check(
      "features_target_whole",
      sql`(${table.targetStreamId} IS NULL) = (${table.targetCycle} IS NULL)`,
    ),
    check(
      "features_estimate_not_negative",
      sql`${table.estimateHours} >= 0 AND ${table.estimateHours} <> 'NaN'`,
    ),
    check("features_description_not_empty", sql`${table.description} <> ''`),
  ],
);

// The one row of planning settings for the whole of Fathom, which the migrations add with the
// starting settings. Its fixed identifier names it in the change history.
export const planningSettingsId = "planning-settings";

export const planningSettings = fathomSchema.table(
  "planning_settings",
  {
    id: text("id").primaryKey().default(planningSettingsId),
    hoursPerDay: numeric("hours_per_day", {
      mode: "number",
      precision: 3,
      scale: 1,
    }).notNull(),
    daysPerWeek: integer("days_per_week").notNull(),
    daysPerMonth: integer("days_per_month").notNull(),
    focusPercent: integer("focus_percent").notNull(),
    bufferPercent: integer("buffer_percent").notNull(),
    // A new starter's share of full output in each of their first months, in order.
    rampUpPercents: integer("ramp_up_percents").array().notNull(),
  },
  (table) => [
    check(
      "planning_settings_one_row",
      sql`${table.id} = ${sql.raw(`'${planningSettingsId}'`)}`,
    ),
    check(
      "planning_settings_hours_per_day",
      sql`${table.hoursPerDay} BETWEEN 0.5 AND 24 AND ${table.hoursPerDay} * 2 = trunc(${table.hoursPerDay} * 2)`,
    ),
    check(
      "planning_settings_days_per_week",
      sql`${table.daysPerWeek} BETWEEN 1 AND 7`,
    ),
    check(
      "planning_settings_days_per_month",
      sql`${table.daysPerMonth} BETWEEN 1 AND 31`,
    ),
    check(
      "planning_settings_focus_percent",
      sql`${table.focusPercent} BETWEEN 1 AND 100`,
    ),
    check(
      "planning_settings_buffer_percent",
      sql`${table.bufferPercent} BETWEEN 0 AND 100`,
    ),
    check(
      "planning_settings_ramp_up_percents",
      sql`array_ndims(${table.rampUpPercents}) = 1 AND array_position(${table.rampUpPercents}, NULL) IS NULL AND cardinality(${table.rampUpPercents}) <= 12 AND 1 <= ALL(${table.rampUpPercents}) AND 100 >= ALL(${table.rampUpPercents})`,
    ),
  ],
);
