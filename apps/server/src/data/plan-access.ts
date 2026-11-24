// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface to the plan: release streams and releases, customers, projects,
// proposals and features, each bound to a database, and the interface to allocations.

import type { Database } from "@fathom/db";
import type {
  CycleLengthRequest,
  CyclePatternRequest,
  Field,
  FieldRequest,
  FeatureProjectsRequest,
  ActivityDuplicateRequest,
  ActivityRequest,
  Duplicated,
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
import * as columnDrafts from "./column-drafts.ts";
import { editsKind, recordEditor } from "./draft-editors.ts";
import * as projectData from "./projects.ts";
import * as projectReads from "./project-reads.ts";
import { readScopeHistory } from "./scope-history.ts";
import type { PlanKind, PlanRecordRequest } from "./projects.ts";
import * as releases from "./releases.ts";
import type { Saved, ChangeSetId } from "./changes.ts";
import {
  planOrFeatures,
  seenPlan,
  seenRecords,
  seenStreams,
} from "./page-reads.ts";
import { activityPlace, activityTypes } from "@fathom/shared";
import { columnEditor } from "./column-state.ts";
import { duplicateActivity, duplicateFeature } from "./duplicates.ts";

export interface ReleasePlace {
  streamId: string;
  releaseId: string;
}

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
  addActivity(
    actor: Actor,
    release: ReleasePlace,
    request: ActivityRequest,
  ): Promise<Saved<ReleaseStream>>;
  updateActivity(
    actor: Actor,
    activity: ReleasePlace & { id: string },
    request: ActivityRequest,
  ): Promise<Saved<ReleaseStream>>;
  deleteActivity(
    actor: Actor,
    activity: ReleasePlace & { id: string },
  ): Promise<ChangeSetId>;
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
// change which customers a feature is for. Each answers with every record as the editor now sees
// them.
export interface ProjectAccess {
  read(actor: Actor): Promise<ProjectPlan>;
  // What the plan's records can be given, which everyone who sees the plan may read, though they
  // may not see People or Lists.
  readChoices(actor: Actor): Promise<PlanChoices>;
  // Drafts adding, changing, and removing the columns added to Features.
  createFeatureColumn(
    actor: Actor,
    request: FieldRequest,
  ): Promise<Saved<Field>>;
  updateFeatureColumn(
    actor: Actor,
    id: string,
    request: FieldRequest,
  ): Promise<Saved<Field>>;
  deleteFeatureColumn(actor: Actor, id: string): Promise<ChangeSetId>;
  discardFeatureColumnDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  resubmitFeatureColumnDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  add(actor: Actor, added: PlanRecordRequest): Promise<Saved<ProjectPlan>>;
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
  addMilestone(
    actor: Actor,
    projectId: string,
    request: MilestoneRequest,
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
  addActivity(
    actor: Actor,
    projectId: string,
    request: ActivityRequest,
  ): Promise<Saved<ProjectPlan>>;
  changeActivity(
    actor: Actor,
    projectId: string,
    id: string,
    request: ActivityRequest,
  ): Promise<Saved<ProjectPlan>>;
  removeActivity(
    actor: Actor,
    projectId: string,
    id: string,
  ): Promise<ChangeSetId>;
  duplicateFeature(actor: Actor, id: string): Promise<Duplicated>;
  // By those who edit activities where the copy goes and read the original's kind.
  duplicateActivity(
    actor: Actor,
    id: string,
    into: ActivityDuplicateRequest,
  ): Promise<Duplicated>;
}

export interface AllocationAccess {
  read(actor: Actor): Promise<Allocations>;
  change(actor: Actor, change: AllocationChange): Promise<ChangeSetId>;
}

export function createReleaseAccess(database: Database): ReleaseAccess {
  const streams = (actor: Actor) => recordEditor(actor, "release-stream");
  const plan = (actor: Actor) => recordEditor(actor, "release");
  const activities = (actor: Actor) => recordEditor(actor, "release-activity");
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
    addActivity: async (actor, { streamId, releaseId }, request) =>
      releases.draftReleaseActivity(
        database,
        activities(actor),
        streamId,
        releaseId,
        undefined,
        request,
      ),
    updateActivity: async (actor, { streamId, releaseId, id }, request) =>
      releases.draftReleaseActivity(
        database,
        activities(actor),
        streamId,
        releaseId,
        id,
        request,
      ),
    deleteActivity: async (actor, { streamId, releaseId, id }) =>
      releases.removeReleaseActivity(
        database,
        activities(actor),
        streamId,
        releaseId,
        id,
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

const edited = async (
  actor: Actor,
  saved: Promise<Saved<projectReads.PlanRecords>>,
): Promise<Saved<ProjectPlan>> => {
  const { result, changeSetId } = await saved;
  return {
    result: { ...seenRecords(actor, result), ...planAbilities(actor) },
    changeSetId,
  };
};

// How each kind of record is added and changed.
const planChanges = {
  customer: {
    add: projectData.addCustomer,
    change: projectData.changeCustomer,
  },
  project: { add: projectData.addProject, change: projectData.changeProject },
  proposal: {
    add: projectData.addProposal,
    change: projectData.changeProposal,
  },
  feature: { add: projectData.addFeature, change: projectData.changeFeature },
} as const;

export function createProjectAccess(database: Database): ProjectAccess {
  return {
    read: async (actor) => ({
      ...(await seenPlan(database, actor)),
      ...planAbilities(actor),
    }),
    readChoices: async (actor) => {
      requireAnyPermission(actor, planOrFeatures);
      return projectReads.readPlanChoices(database);
    },
    createFeatureColumn: async (actor, request) =>
      columnDrafts.createField(
        database,
        columnEditor(actor, "features"),
        request,
        "features",
      ),
    updateFeatureColumn: async (actor, id, request) =>
      columnDrafts.updateField(
        database,
        columnEditor(actor, "features"),
        id,
        request,
        "features",
      ),
    deleteFeatureColumn: async (actor, id) =>
      columnDrafts.deleteField(
        database,
        columnEditor(actor, "features"),
        id,
        "features",
      ),
    discardFeatureColumnDraft: async (actor, id) =>
      columnDrafts.discardColumnDraft(
        database,
        columnEditor(actor, "features"),
        {
          id,
          table: "features",
        },
      ),
    resubmitFeatureColumnDraft: async (actor, id) =>
      columnDrafts.resubmitColumnDraft(
        database,
        columnEditor(actor, "features"),
        {
          id,
          table: "features",
        },
      ),
    // The kind is one of the fixed kinds above, and the request the one it takes, as
    // PlanRecordRequest pairs them.
    add: async (actor, { type, request }) =>
      edited(
        actor,
        // eslint-disable-next-line security/detect-object-injection
        planChanges[type].add(
          database,
          recordEditor(actor, type),
          request as never,
        ),
      ),
    change: async (actor, id, { type, request }) =>
      edited(
        actor,
        // eslint-disable-next-line security/detect-object-injection
        planChanges[type].change(
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
    // A project's or proposal's scope history is the plan's, removal reasons included.
    readScopeHistory: async (actor, type, id) => {
      requirePermission(actor, "plan:view");
      return readScopeHistory(database, type, id);
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
    addMilestone: async (actor, projectId, request) =>
      edited(
        actor,
        projectData.addMilestone(
          database,
          recordEditor(actor, "milestone"),
          projectId,
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
      projectData.removeBelonging(
        database,
        recordEditor(actor, "milestone"),
        "milestone",
        projectId,
        id,
      ),
    addActivity: async (actor, projectId, request) =>
      edited(
        actor,
        projectData.addProjectActivity(
          database,
          recordEditor(actor, "project-activity"),
          projectId,
          request,
        ),
      ),
    changeActivity: async (actor, projectId, id, request) =>
      edited(
        actor,
        projectData.changeProjectActivity(
          database,
          recordEditor(actor, "project-activity"),
          projectId,
          id,
          request,
        ),
      ),
    duplicateFeature: async (actor, id) =>
      duplicateFeature(database, recordEditor(actor, "feature"), id),
    duplicateActivity: async (actor, id, into) =>
      duplicateActivity(
        database,
        recordEditor(actor, activityTypes[activityPlace(into).owner]),
        id,
        into,
      ),
    removeActivity: async (actor, projectId, id) =>
      projectData.removeBelonging(
        database,
        recordEditor(actor, "project-activity"),
        "project-activity",
        projectId,
        id,
      ),
  };
}
