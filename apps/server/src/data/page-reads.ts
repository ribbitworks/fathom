// SPDX-License-Identifier: Apache-2.0

// The reads the pages make, each behind the permission its page needs, as the data access layer's
// interface serves them and as a link to a record finds it there. Part of the data access layer.

import type { Database } from "@fathom/db";
import type { List, ReleaseStream } from "@fathom/shared";
import {
  type Actor,
  requireAnyPermission,
  requirePermission,
} from "../access.ts";
import { readColumnsOut } from "./column-state.ts";
import * as lists from "./lists.ts";
import * as peopleReads from "./people-table-reads.ts";
import * as projectReads from "./project-reads.ts";
import * as releases from "./releases.ts";

// Lists' choices are also read by those who see People, whose columns draw on them.
export function seenLists(database: Database, actor: Actor): Promise<List[]> {
  requireAnyPermission(actor, ["configuration:view", "people:view"]);
  return lists.readLists(database, actor);
}

export function seenStreams(
  database: Database,
  actor: Actor,
): Promise<ReleaseStream[]> {
  requireAnyPermission(actor, ["features:view", "configuration:view"]);
  return releases.readReleaseStreams(database, actor);
}

// The plan's records, features among them, are read by those who see either, each kind shown only
// to those who may read it.
export const planOrFeatures = ["plan:view", "features:view"] as const;

// The plan's records a reader may see: features and their columns with features, and the rest with
// the plan.
function seenRecords(
  actor: Actor,
  records: projectReads.PlanRecords,
): projectReads.PlanRecords {
  const seesPlan = actor.permissions.includes("plan:view");
  const seesFeatures = actor.permissions.includes("features:view");
  return {
    ...records,
    customers: seesPlan ? records.customers : [],
    projects: seesPlan ? records.projects : [],
    proposals: seesPlan ? records.proposals : [],
    features: seesFeatures ? records.features : [],
    featureColumns: seesFeatures
      ? records.featureColumns
      : { fields: [], order: [], lists: [] },
  };
}

// The plan's records as the Projects and Features pages read them.
export async function seenPlan(
  database: Database,
  actor: Actor,
): Promise<projectReads.PlanRecords> {
  requireAnyPermission(actor, planOrFeatures);
  return seenRecords(
    actor,
    await projectReads.readPlanRecords(database, actor),
  );
}

// The columns as their drafts make them, and their order, as the actor may see them, read as of one
// moment, so an approval saved meanwhile is seen whole or not at all.
export const readPeopleColumns = (database: Database, actor: Actor) =>
  database.transaction((transaction) => readColumnsOut(transaction, actor), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });

export function seenPeopleColumns(database: Database, actor: Actor) {
  requirePermission(actor, "people:view");
  return readPeopleColumns(database, actor);
}

export function seenPeople(database: Database, actor: Actor, on?: string) {
  requirePermission(actor, "people:view");
  return on === undefined
    ? peopleReads.readPeople(database, actor)
    : peopleReads.readPeopleOn(database, actor, on);
}
