// SPDX-License-Identifier: Apache-2.0

// Finding the record a link names by its key, through the read of the page that shows it. Part of
// the data access layer.

import type { Database } from "@fathom/db";
import {
  type FoundRecord,
  opensWith,
  pageNeeds,
  type RecordKeyKind,
  type RecordLookup,
  recordPage,
  releaseActivities,
} from "@fathom/shared";
import type { Actor } from "../access.ts";
import { ForbiddenError } from "../errors.ts";
import { accountExists } from "./accounts.ts";
import { historyShowsRemoval } from "./change-history.ts";
import { readFeatureTeams } from "./feature-team-reads.ts";
import { readLiveHires } from "./hire-reads.ts";
import {
  seenLists,
  seenPeople,
  seenPeopleColumns,
  seenPlan,
  seenStreams,
} from "./page-reads.ts";
import { readKeyedRecord } from "./record-keys.ts";
import { createRoleAdministration } from "./role-administration.ts";

// What a link to a record opens, when the reader may see the record, as its page reads it.
export type Found = Omit<FoundRecord, "result">;

export type Finder = (actor: Actor, id: string) => Promise<Found | undefined>;

// How each kind's records are found, which the compiler checks names every kind.
export type Finders = Record<RecordKeyKind, Finder>;

const nothing: RecordLookup = { result: "nothing" };

// A page the reader may not open shows them nothing, as a record it leaves out does.
export async function unlessRefused<Read>(
  read: () => Promise<Read>,
): Promise<Read | undefined> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof ForbiddenError) return undefined;
    throw error;
  }
}

const among = (records: readonly { id: string }[], id: string) =>
  records.some((record) => record.id === id);

// How a link finds each kind of record: in the read of the page that shows it.
export function createRecordFinders(database: Database): Finders {
  const inPlan =
    (
      kind: RecordKeyKind,
      recordsOf: (
        plan: Awaited<ReturnType<typeof seenPlan>>,
      ) => readonly { id: string }[],
    ): Finder =>
    async (actor, id) =>
      among(recordsOf(await seenPlan(database, actor)), id)
        ? { kind, id }
        : undefined;
  const inStreams =
    (
      kind: RecordKeyKind,
      recordsOf: (
        streams: Awaited<ReturnType<typeof seenStreams>>,
      ) => readonly { id: string }[],
    ): Finder =>
    async (actor, id) =>
      among(recordsOf(await seenStreams(database, actor)), id)
        ? { kind, id }
        : undefined;
  // People's rows hold planned hires beside people.
  const onPeople = async (actor: Actor, id: string) =>
    (await seenPeople(database, actor)).people.find((row) => row.id === id);
  const roleAdministration = createRoleAdministration(database);
  return {
    feature: inPlan("feature", (plan) => plan.features),
    project: inPlan("project", (plan) => plan.projects),
    proposal: inPlan("proposal", (plan) => plan.proposals),
    customer: inPlan("customer", (plan) => plan.customers),
    milestone: inPlan("milestone", (plan) =>
      plan.projects.flatMap((project) => project.milestones),
    ),
    // A project's activity is read with the plan, and a release's with its release.
    activity: async (actor, id) => {
      const ofProject = (
        await unlessRefused(async () => seenPlan(database, actor))
      )?.activities.find((one) => one.id === id);
      if (ofProject?.projectId != null) {
        return {
          kind: "activity",
          id,
          activityOf: { owner: "project", id: ofProject.projectId },
        };
      }
      const release = (
        await unlessRefused(async () => seenStreams(database, actor))
      )
        ?.flatMap((stream) => stream.releases)
        .find((one) =>
          releaseActivities(one).some((activity) => activity.id === id),
        );
      return release === undefined
        ? undefined
        : {
            kind: "activity",
            id,
            activityOf: { owner: "release", id: release.id },
          };
    },
    release: inStreams("release", (streams) =>
      streams.flatMap((stream) => stream.releases),
    ),
    schedule: inStreams("schedule", (streams) => streams),
    person: async (actor, id) => {
      const found = await onPeople(actor, id);
      return found === undefined || found.kind === "planned-hire"
        ? undefined
        : { kind: "person", id };
    },
    // A planned hire once filled opens the person who filled it, to a reader who sees them; until
    // then People shows the hire in their place.
    hire: async (actor, id) => {
      const { people } = await seenPeople(database, actor);
      const filledBy = (await readLiveHires(database, [id])).get(id)?.filledBy;
      if (typeof filledBy === "string" && among(people, filledBy)) {
        return { kind: "person", id: filledBy };
      }
      return among(people, id) ? { kind: "hire", id } : undefined;
    },
    team: async (actor, id) =>
      among((await readFeatureTeams(database, actor)).teams, id)
        ? { kind: "team", id }
        : undefined,
    list: async (actor, id) =>
      among(await seenLists(database, actor), id)
        ? { kind: "list", id }
        : undefined,
    column: async (actor, id) => {
      const plan = await unlessRefused(async () => seenPlan(database, actor));
      if (plan !== undefined && among(plan.featureColumns.fields, id)) {
        return { kind: "column", id, table: "features" };
      }
      const people = await seenPeopleColumns(database, actor);
      return among(people.fields, id)
        ? { kind: "column", id, table: "people" }
        : undefined;
    },
    account: async (_actor, id) =>
      (await accountExists(database, id)) ? { kind: "account", id } : undefined,
    role: async (actor, id) =>
      among(await roleAdministration.listRoles(actor), id)
        ? { kind: "role", id }
        : undefined,
  };
}

export async function findKeyedRecord(
  database: Database,
  finders: Finders,
  actor: Actor,
  kind: RecordKeyKind,
  keyNumber: number,
): Promise<RecordLookup> {
  const id = await readKeyedRecord(database, kind, keyNumber);
  if (id === undefined) return nothing;
  // The kind is always one of the fixed kinds.
  // eslint-disable-next-line security/detect-object-injection
  const found = await unlessRefused(async () => finders[kind](actor, id));
  if (found !== undefined) {
    return opensWith(pageNeeds[recordPage(found)], actor)
      ? { result: "found", ...found }
      : nothing;
  }
  return (await historyShowsRemoval(database, actor, id))
    ? { result: "removed", kind, id }
    : nothing;
}
