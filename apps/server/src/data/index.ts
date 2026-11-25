// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface: functions bound to a database, which are all that the rest of
// the server receives.

import { type ColumnAccess, createColumnAccess } from "./column-access.ts";
import type { Database } from "@fathom/db";
import type {
  EffortConversions,
  PlanningSettings,
  PlanningSettingsChange,
  ChangeHistory,
  ClassifiedField,
  DataClasses,
  Tier,
  DraftsAsked,
  DraftsRequest,
  UnpublishedPublished,
  ExportRequest,
  ExportRecorded,
  HistoryEntry,
  RecordType,
  ListedView,
  SavedViewChange,
  LastViews,
  LastViewRequest,
  SavedViewRequest,
  ViewPage,
  ViewTable,
  PasswordOwner,
  PasswordSettings,
  Settings,
  TimeZoneSetting,
  Unpublished,
  RecordKeyKind,
  RecordLookup,
} from "@fathom/shared";
import { changeHistoryViews, draftsRequestSchema } from "@fathom/shared";
import { sql } from "drizzle-orm";
import {
  type Actor,
  requireAnyPermission,
  requirePermission,
} from "../access.ts";
import { approveDrafts, rejectDrafts } from "./approvals.ts";
import {
  changePlanningSettings,
  readEffortConversions,
  readPlanningSettings,
} from "./planning-settings.ts";
import { changeAllocation, readAllocations } from "./allocations.ts";
import { readGreeting } from "./greeting.ts";
import * as columnDrafts from "./column-drafts.ts";
import { readChangeHistory } from "./change-history.ts";
import { moveFieldClass } from "./data-classes.ts";
import * as lists from "./lists.ts";
import { recordExport } from "./exports.ts";
import { readHistory, recordPersonalView } from "./history.ts";
import { discardRecordDraft, resubmitRecordDraft } from "./record-decisions.ts";
import type { ChangeSetId, Saved } from "./changes.ts";
import { undoChangeSet } from "./undo.ts";
import {
  discardUnpublished,
  publishUnpublished,
  readUnpublished,
} from "./unpublished.ts";
import {
  type ActorAccess,
  keepSessionRole,
  readActorAccess,
  switchRole,
} from "./roles.ts";
import {
  changePasswordSettings,
  changeTimeZone,
  checkChosenPassword,
  readSettings,
  readTimeZone,
} from "./settings.ts";
import { readLastViews, saveLastView } from "./last-views.ts";
import * as views from "./views.ts";
import { createRecordFinders, findKeyedRecord } from "./record-links.ts";
import { recordEditor } from "./draft-editors.ts";
import {
  createReleaseAccess,
  createActivityAccess,
  createProjectAccess,
  type ReleaseAccess,
  type ProjectAccess,
  type ActivityAccess,
  type AllocationAccess,
} from "./plan-access.ts";
import {
  createFeatureTeamAccess,
  createHireAccess,
  createPeopleAccess,
  type PeopleAccess,
  type HireAccess,
  type FeatureTeamAccess,
} from "./people-access.ts";
import { createListAccess, type ListAccess } from "./configuration-access.ts";

export type { PlanKind, PlanRecordRequest } from "./projects.ts";
export { firstOffered } from "./built-in-lists.ts";

export interface DataAccess {
  // Fails, with a message naming the settings to check, unless the database can be queried.
  checkConnection(): Promise<void>;
  // The roles of the signed-in user making a request, the one their session acts as, and what it
  // grants, or null if their account is deactivated. The server needs them to know who is asking,
  // so it checks no permission. The remembered role is the browser's last choice, which a session
  // starts as if the account holds it.
  readActorAccess(
    userId: string,
    sessionId: string,
    rememberedRoleId?: string,
  ): Promise<ActorAccess | null>;
  // Switches the actor's session to another of their roles, which needs no permission, recording it
  // in the access history; a role they do not hold is refused.
  switchRole(actor: Actor, sessionId: string, roleId: string): Promise<void>;
  // Gives the session with this token, which a password change starts, the role the session it
  // replaces acted as.
  keepSessionRole(token: string, roleId: string | null): Promise<void>;
  // The record a link names by its key, as the page that shows it would to the actor, its removal
  // to those who may see its history, or nothing.
  findRecord(
    actor: Actor,
    kind: RecordKeyKind,
    keyNumber: number,
  ): Promise<RecordLookup>;
  readGreeting(actor: Actor): Promise<string>;
  // Settings for the whole of Fathom, which every signed-in user's screens follow, so reading them
  // checks no permission.
  readSettings(): Promise<Settings>;
  changeTimeZone(actor: Actor, timeZone: string): Promise<TimeZoneSetting>;
  // Moves data to another class at once, with Classify data and sight of both classes, recording
  // the move in the access history: a built-in detail, a list, or a column with a class of its own.
  moveFieldClass(
    actor: Actor,
    field: ClassifiedField,
    to: Tier,
  ): Promise<DataClasses>;
  moveListClass(actor: Actor, id: string, to: Tier): Promise<ChangeSetId>;
  moveColumnClass(actor: Actor, id: string, to: Tier): Promise<ChangeSetId>;
  changePasswordSettings(
    actor: Actor,
    passwords: PasswordSettings,
  ): Promise<PasswordSettings>;
  // Refuses a password a person chose that the rules in the password settings do not allow, or that
  // is too common or easy to guess for its owner. Anyone may ask, since the rules are no secret.
  checkChosenPassword(password: string, owner: PasswordOwner): Promise<void>;
  // The planning settings, seen by those who see configuration and changed by those who change it,
  // and the conversions between units of effort among them, seen with the plan.
  readPlanningSettings(actor: Actor): Promise<PlanningSettings>;
  readEffortConversions(actor: Actor): Promise<EffortConversions>;
  changePlanningSettings(
    actor: Actor,
    change: PlanningSettingsChange,
  ): Promise<Saved<PlanningSettings>>;
  // The most recent entries in the access history.
  readHistory(actor: Actor): Promise<HistoryEntry[]>;
  // Records an export holding Personal or Confidential data in the access history, refusing one
  // holding a column the actor can't see.
  recordExport(actor: Actor, request: ExportRequest): Promise<ExportRecorded>;
  // The change sets saved before the one named, or the latest, holding only the changes the actor
  // may see, and every word of a search, if any. Seeing Personal or Confidential changes is
  // recorded in the access history.
  readChanges(
    actor: Actor,
    before?: string,
    search?: string,
  ): Promise<ChangeHistory>;
  // Lists of choices, which everyone who sees planning configuration may read, and only those who
  // may edit it may change.
  lists: ListAccess;
  // Approving and rejecting drafts of every kind, several kinds at once; neither can be undone.
  drafts: DraftAccess;
  // People, and the columns on the People table.
  people: PeopleAccess;
  views: ViewAccess;
  // Planned hires: the hiring plan, or its placeholders.
  hires: HireAccess;
  // Feature teams, drafted by those who edit them.
  featureTeams: FeatureTeamAccess;
  // The actor's own unpublished changes to drafts, which only they see until they publish them.
  unpublished: UnpublishedAccess;
  // Release streams, their cycle patterns, and their releases, which everyone who sees the plan or
  // planning configuration may read.
  releases: ReleaseAccess;
  // Customers, projects with their milestones, proposals, and features, which everyone who sees the
  // plan may read.
  projects: ProjectAccess;
  featureColumns: ColumnAccess;
  activities: ActivityAccess;
  activityColumns: ColumnAccess;
  // Discarding and resubmitting drafts of the plan's records, whatever their kind.
  records: RecordAccess;
  // Who is put on which feature, month by month, seen by those who see allocations, and changed as
  // drafts by those who edit them.
  allocations: AllocationAccess;
  // Undoes a change set the actor made, returning the change set that undid it.
  undo(actor: Actor, changeSetId: string): Promise<ChangeSetId>;
}

export interface RecordAccess {
  discardDraft(
    actor: Actor,
    type: RecordType,
    id: string,
  ): Promise<ChangeSetId>;
  resubmitDraft(
    actor: Actor,
    type: RecordType,
    id: string,
  ): Promise<ChangeSetId>;
}

export type { ChangeSetId, Saved } from "./changes.ts";

export interface DraftAccess {
  approve(actor: Actor, asked: DraftsAsked): Promise<ChangeSetId>;
  reject(
    actor: Actor,
    asked: DraftsAsked,
    reason: string,
  ): Promise<ChangeSetId>;
}

// Each user's changes to drafts are theirs alone until they publish them, or discard them, all at
// once or those chosen; both answer how many records' changes they took, and publishing how many it
// left for another role.
export interface UnpublishedAccess {
  read(actor: Actor): Promise<Unpublished>;
  publish(actor: Actor, chosen?: DraftsRequest): Promise<UnpublishedPublished>;
  discard(actor: Actor, chosen?: DraftsRequest): Promise<number>;
}

// Saved views of each table that keeps them, seen and saved by those who open its page; only
// their maker, or someone who may share views on the table, may change or delete them.
export interface ViewAccess {
  read(actor: Actor, table: ViewTable): Promise<ListedView[]>;
  create(
    actor: Actor,
    table: ViewTable,
    request: SavedViewRequest,
  ): Promise<Saved<ListedView>>;
  update(
    actor: Actor,
    table: ViewTable,
    id: string,
    change: SavedViewChange,
  ): Promise<Saved<ListedView>>;
  delete(actor: Actor, table: ViewTable, id: string): Promise<ChangeSetId>;
  readLast(actor: Actor): Promise<LastViews>;
  saveLast(
    actor: Actor,
    page: ViewPage,
    request: LastViewRequest,
  ): Promise<void>;
}

export function createDataAccess(database: Database): DataAccess {
  const finders = createRecordFinders(database);
  return {
    async checkConnection() {
      try {
        await database.execute(sql`SELECT 1`);
      } catch (error) {
        throw new Error(
          "Could not query the database; check the FATHOM_DB_* settings",
          { cause: error },
        );
      }
    },
    readActorAccess: (userId, sessionId, rememberedRoleId) =>
      readActorAccess(database, userId, sessionId, rememberedRoleId),
    findRecord: (actor, kind, keyNumber) =>
      findKeyedRecord(database, finders, actor, kind, keyNumber),
    switchRole: (actor, sessionId, roleId) =>
      switchRole(database, actor.user.id, sessionId, roleId),
    keepSessionRole: (token, roleId) =>
      keepSessionRole(database, token, roleId),
    recordExport: async (actor, request) =>
      recordExport(database, actor, request),
    readHistory: async (actor) => {
      requirePermission(actor, "administration:view");
      return readHistory(database, actor.permissions.includes("people:view"));
    },
    readChanges: async (actor, before, search) => {
      requireAnyPermission(actor, changeHistoryViews);
      const read = await readChangeHistory(database, actor, before, search);
      if (read.includedSensitive) {
        await recordPersonalView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      return { entries: read.entries, next: read.next };
    },
    lists: createListAccess(database),
    releases: createReleaseAccess(database),
    projects: createProjectAccess(database),
    featureColumns: createColumnAccess(database, "features"),
    activities: createActivityAccess(database),
    activityColumns: createColumnAccess(database, "activities"),
    allocations: {
      read: async (actor) => {
        const { includedPersonal, ...read } = await readAllocations(
          database,
          actor,
        );
        // Allocations of someone not current today tell of their start or end date, which is Personal.
        if (includedPersonal) {
          await recordPersonalView(
            database,
            actor.user.id,
            await readTimeZone(database),
          );
        }
        return read;
      },
      change: async (actor, change) =>
        changeAllocation(database, recordEditor(actor, "allocation"), change),
    },
    records: {
      discardDraft: async (actor, type, id) =>
        discardRecordDraft(database, recordEditor(actor, type), type, id),
      resubmitDraft: async (actor, type, id) =>
        resubmitRecordDraft(database, recordEditor(actor, type), type, id),
    },
    drafts: {
      approve: async (actor, asked) =>
        approveDrafts(database, actor, draftsRequestSchema.parse(asked)),
      reject: async (actor, asked, reason) =>
        rejectDrafts(database, actor, draftsRequestSchema.parse(asked), reason),
    },
    people: createPeopleAccess(database),
    views: {
      read: async (actor, table) => views.readViews(database, actor, table),
      create: async (actor, table, request) =>
        views.createView(database, actor, table, request),
      update: async (actor, table, id, change) =>
        views.updateView(database, actor, table, id, change),
      delete: async (actor, table, id) =>
        views.deleteView(database, actor, table, id),
      readLast: async (actor) => readLastViews(database, actor),
      saveLast: async (actor, page, request) =>
        saveLastView(database, actor, page, request),
    },
    hires: createHireAccess(database),
    featureTeams: createFeatureTeamAccess(database),
    unpublished: {
      read: async (actor) => readUnpublished(database, actor),
      publish: async (actor, chosen) =>
        publishUnpublished(database, actor, chosen),
      discard: async (actor, chosen) =>
        discardUnpublished(database, actor, chosen),
    },
    undo: async (actor, changeSetId) =>
      undoChangeSet(database, actor, changeSetId),
    readGreeting: async (actor) => {
      requirePermission(actor, "plan:view");
      return readGreeting(database);
    },
    readSettings: async () => readSettings(database),
    readPlanningSettings: async (actor) =>
      readPlanningSettings(database, actor),
    readEffortConversions: async (actor) =>
      readEffortConversions(database, actor),
    changePlanningSettings: async (actor, change) =>
      changePlanningSettings(database, actor, change),
    changeTimeZone: async (actor, timeZone) =>
      changeTimeZone(database, actor, timeZone),
    moveFieldClass: async (actor, field, to) =>
      moveFieldClass(database, actor, field, to),
    moveListClass: async (actor, id, to) =>
      lists.moveListClass(database, actor, id, to),
    moveColumnClass: async (actor, id, to) =>
      columnDrafts.moveColumnClass(database, actor, id, to),
    changePasswordSettings: async (actor, passwords) =>
      changePasswordSettings(database, actor, passwords),
    checkChosenPassword: async (password, owner) =>
      checkChosenPassword(database, password, owner),
  };
}
