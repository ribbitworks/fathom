// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface to the plan: release streams and releases, customers, projects,
// proposals, features and activities, each bound to a database, and the interface to allocations.

import type { Database } from "@fathom/db";
import type {
  ActivityRequest,
  CycleLengthRequest,
  CyclePatternRequest,
  FeatureProjectsRequest,
  MilestoneRequest,
  PlanChoices,
  ProjectPlan,
  ReleaseNoteRequest,
  RemovalReasonRequest,
  ScopeHistory,
  ReleaseRequest,
  ReleaseStream,
  ReleaseStreamRequest,
  ReleaseStreams,
  RetiredRequest,
  AllocationChange,
  Allocations,
} from "@fathom/shared";
import {
  type Actor,
  requireAnyPermission,
  requirePermission,
} from "../access.ts";
import * as activityData from "./activities.ts";
import { editsKind, recordEditor } from "./draft-editors.ts";
import * as projectData from "./projects.ts";
import * as projectReads from "./project-reads.ts";
import { readScopeHistory } from "./scope-history.ts";
import type { PlanAdding, PlanKind, PlanRecordRequest } from "./projects.ts";
import * as releases from "./releases.ts";
import type { Added, Saved, ChangeSetId } from "./changes.ts";
import { planOrFeatures, seenPlan, seenStreams } from "./page-reads.ts";

// Every change to release streams, patterns, and releases is a draft. Streams and their patterns
// are planning configuration, edited by those who edit it; releases are part of the plan.
export interface ReleaseAccess {
  read(actor: Actor): Promise<ReleaseStreams>;
  createStream(
    actor: Actor,
    request: ReleaseStreamRequest,
  ): Promise<Saved<ReleaseStream>>;
  updateStream(
    actor: Actor,
    id: string,
    change: Partial<ReleaseStreamRequest & RetiredRequest>,
  ): Promise<Saved<ReleaseStream>>;
  setStreamEnd(
    actor: Actor,
    id: string,
    endsOn: string | null,
  ): Promise<Saved<ReleaseStream>>;
  addPattern(
    actor: Actor,
    streamId: string,
    request: CyclePatternRequest,
  ): Promise<Saved<ReleaseStream>>;
  updatePattern(
    actor: Actor,
    streamId: string,
    id: string,
    request: CyclePatternRequest,
  ): Promise<Saved<ReleaseStream>>;
  deletePattern(
    actor: Actor,
    streamId: string,
    id: string,
  ): Promise<ChangeSetId>;
  addRelease(
    actor: Actor,
    streamId: string,
    request: ReleaseRequest,
  ): Promise<Saved<ReleaseStream>>;
  updateRelease(
    actor: Actor,
    streamId: string,
    id: string,
    request: ReleaseRequest,
  ): Promise<Saved<ReleaseStream>>;
  deleteRelease(
    actor: Actor,
    streamId: string,
    id: string,
  ): Promise<ChangeSetId>;
  updateReleaseNote(
    actor: Actor,
    streamId: string,
    id: string,
    request: ReleaseNoteRequest,
  ): Promise<Saved<ReleaseStream>>;
  // Changing one cycle's length changes the stream's patterns, and moves the releases on cycles
  // that move, which those who change cycles may do.
  changeCycleLength(
    actor: Actor,
    streamId: string,
    startsOn: string,
    request: CycleLengthRequest,
  ): Promise<Saved<ReleaseStream>>;
}

// Every change to customers, projects, milestones, proposals, and features is a draft, made by those
// who edit the plan, or, for features, those who edit features, though only those who edit the plan
// change which customers a feature is for, and only those who edit feature teams its feature team.
// Each answers with every record as the editor now sees them, and adding with the records' ids.
export interface ProjectAccess {
  read(actor: Actor): Promise<ProjectPlan>;
  // What the plan's records can be given, which everyone who sees the plan may read, though they
  // may not see People or Lists.
  readChoices(actor: Actor): Promise<PlanChoices>;
  add(actor: Actor, added: PlanAdding): Promise<Added<ProjectPlan>>;
  change(
    actor: Actor,
    id: string,
    changed: PlanRecordRequest,
  ): Promise<Saved<ProjectPlan>>;
  remove(actor: Actor, type: PlanKind, id: string): Promise<ChangeSetId>;
  // Changes which projects need a feature and which proposals propose it, drafting each project
  // and proposal, so it takes those who edit the plan.
  changeFeatureProjects(
    actor: Actor,
    featureId: string,
    request: FeatureProjectsRequest,
  ): Promise<Saved<ProjectPlan>>;
  // The features a project or proposal was given and had removed, as approved.
  readScopeHistory(
    actor: Actor,
    type: "project" | "proposal",
    id: string,
  ): Promise<ScopeHistory>;
  // Changes the reason for removing a feature from a proposal while a draft removes it, so it takes
  // those who edit the plan.
  changeRemovalReason(
    actor: Actor,
    featureId: string,
    proposalId: string,
    request: RemovalReasonRequest,
  ): Promise<Saved<ProjectPlan>>;
  changeMilestone(
    actor: Actor,
    projectId: string,
    id: string,
    request: MilestoneRequest,
  ): Promise<Saved<ProjectPlan>>;
  removeMilestone(
    actor: Actor,
    projectId: string,
    id: string,
  ): Promise<ChangeSetId>;
}

export interface AllocationAccess {
  read(actor: Actor): Promise<Allocations>;
  change(actor: Actor, change: AllocationChange): Promise<ChangeSetId>;
}

export function createReleaseAccess(database: Database): ReleaseAccess {
  const streams = (actor: Actor) => recordEditor(actor, "release-stream");
  const plan = (actor: Actor) => recordEditor(actor, "release");
  return {
    read: async (actor) => {
      return {
        streams: await seenStreams(database, actor),
        canEditStreams: editsKind(actor, "release-stream"),
        canEditReleases: editsKind(actor, "release"),
      };
    },
    createStream: async (actor, request) =>
      releases.createStream(database, streams(actor), request),
    updateStream: async (actor, id, change) =>
      releases.updateStream(database, streams(actor), id, change),
    setStreamEnd: async (actor, id, endsOn) =>
      releases.setStreamEnd(database, streams(actor), id, endsOn),
    addPattern: async (actor, streamId, request) =>
      releases.addToStream(database, streams(actor), streamId, {
        type: "cycle-pattern",
        request,
      }),
    updatePattern: async (actor, streamId, id, request) =>
      releases.changeInStream(database, streams(actor), streamId, id, {
        type: "cycle-pattern",
        request,
      }),
    deletePattern: async (actor, streamId, id) =>
      releases.removeFromStream(
        database,
        streams(actor),
        streamId,
        "cycle-pattern",
        id,
      ),
    addRelease: async (actor, streamId, request) =>
      releases.addToStream(database, plan(actor), streamId, {
        type: "release",
        request,
      }),
    updateRelease: async (actor, streamId, id, request) =>
      releases.changeInStream(database, plan(actor), streamId, id, {
        type: "release",
        request,
      }),
    deleteRelease: async (actor, streamId, id) =>
      releases.removeFromStream(database, plan(actor), streamId, "release", id),
    updateReleaseNote: async (actor, streamId, id, request) =>
      releases.changeReleaseNote(
        database,
        plan(actor),
        streamId,
        id,
        request.note,
      ),
    changeCycleLength: async (actor, streamId, startsOn, request) =>
      releases.changeCycleLength(
        database,
        streams(actor),
        streamId,
        startsOn,
        request,
      ),
  };
}

// Which of the plan's records the actor may change.
const planAbilities = (actor: Actor) => ({
  canEdit: actor.permissions.includes("plan:edit"),
  canEditFeatures: actor.permissions.includes("features:edit"),
});

const edited = async <Extra extends object>(
  actor: Actor,
  saved: Promise<Saved<projectReads.PlanRecords> & Extra>,
): Promise<Saved<ProjectPlan> & Extra> => {
  const answer = await saved;
  return {
    ...answer,
    result: { ...answer.result, ...planAbilities(actor) },
  };
};

// How each kind of record is changed.
const planChanges = {
  customer: projectData.changeCustomer,
  project: projectData.changeProject,
  proposal: projectData.changeProposal,
  feature: projectData.changeFeature,
} as const;

export function createProjectAccess(database: Database): ProjectAccess {
  return {
    read: async (actor) => ({
      ...(await seenPlan(database, actor)),
      ...planAbilities(actor),
    }),
    readChoices: async (actor) => {
      requireAnyPermission(actor, planOrFeatures);
      return projectReads.readPlanChoices(database, actor);
    },
    add: async (actor, added) =>
      edited(
        actor,
        projectData.addRecords(
          database,
          recordEditor(actor, added.type),
          added,
        ),
      ),
    // The kind is one of the fixed kinds above, and the request the one it takes, as
    // PlanRecordRequest pairs them.
    change: async (actor, id, { type, request }) =>
      edited(
        actor,
        // eslint-disable-next-line security/detect-object-injection
        planChanges[type](
          database,
          recordEditor(actor, type),
          id,
          request as never,
        ),
      ),
    remove: async (actor, type, id) =>
      projectData.removeRecord(database, recordEditor(actor, type), type, id),
    changeFeatureProjects: async (actor, featureId, request) =>
      edited(
        actor,
        projectData.changeFeatureProjects(
          database,
          recordEditor(actor, "project"),
          featureId,
          request,
        ),
      ),
    // A project's or proposal's scope history is the plan's, removal reasons included. It names
    // only features, so a role that doesn't see them, which the plan's read withholds, gets none.
    readScopeHistory: async (actor, type, id) => {
      requirePermission(actor, "plan:view");
      return actor.permissions.includes("features:view")
        ? readScopeHistory(database, type, id)
        : { changes: [] };
    },
    changeRemovalReason: async (actor, featureId, proposalId, request) =>
      edited(
        actor,
        projectData.changeRemovalReason(
          database,
          recordEditor(actor, "proposal"),
          featureId,
          proposalId,
          request,
        ),
      ),
    changeMilestone: async (actor, projectId, id, request) =>
      edited(
        actor,
        projectData.changeMilestone(
          database,
          recordEditor(actor, "milestone"),
          projectId,
          id,
          request,
        ),
      ),
    removeMilestone: async (actor, projectId, id) =>
      projectData.removeMilestone(
        database,
        recordEditor(actor, "milestone"),
        projectId,
        id,
      ),
  };
}

// Activities are drafted with Features' permissions, whichever release or project each belongs to,
// and read with the plan; each change answers with the plan as the editor now sees it.
export interface ActivityAccess {
  add(
    actor: Actor,
    requests: readonly ActivityRequest[],
  ): Promise<Added<ProjectPlan>>;
  change(
    actor: Actor,
    id: string,
    request: ActivityRequest,
  ): Promise<Saved<ProjectPlan>>;
  remove(actor: Actor, id: string): Promise<ChangeSetId>;
}

export function createActivityAccess(database: Database): ActivityAccess {
  return {
    add: async (actor, requests) =>
      edited(
        actor,
        activityData.addActivities(
          database,
          recordEditor(actor, "activity"),
          requests,
        ),
      ),
    change: async (actor, id, request) =>
      edited(
        actor,
        activityData.changeActivity(
          database,
          recordEditor(actor, "activity"),
          id,
          request,
        ),
      ),
    remove: async (actor, id) =>
      projectData.removeRecord(
        database,
        recordEditor(actor, "activity"),
        "activity",
        id,
      ),
  };
}
