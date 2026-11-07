// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface: functions bound to a database, which are all that the rest of
// the server receives, so no other code can query the database directly. Functions that read or
// change Fathom's data take the actor making the request, and refuse when the actor's roles do not
// allow it.

import type { Database } from "@fathom/db";
import type {
  ChangeHistory,
  Choice,
  ChoiceRequest,
  ColumnOrderDraft,
  CycleLengthRequest,
  CyclePatternRequest,
  CyclesUntilRequest,
  DraftsAsked,
  Field,
  FieldRequest,
  HireChange,
  HireRequest,
  Hires,
  HistoryEntry,
  List,
  ListRequest,
  OrgChart,
  PaletteColour,
  Permission,
  Person,
  PersonChange,
  PersonRequest,
  RecordType,
  ReleaseNoteRequest,
  ReleaseRequest,
  ReleaseStream,
  ReleaseStreamRequest,
  ReleaseStreams,
  RetiredRequest,
  SavedView,
  SavedViewChange,
  SavedViewRequest,
  PasswordOwner,
  PasswordSettings,
  Settings,
  TimeZoneSetting,
  Unpublished,
} from "@fathom/shared";
import { draftsRequestSchema } from "@fathom/shared";
import { sql } from "drizzle-orm";
import {
  type Actor,
  requireAnyPermission,
  requirePermission,
} from "../access.ts";
import { approveDrafts, rejectDrafts } from "./approvals.ts";
import { readGreeting } from "./greeting.ts";
import * as columnDrafts from "./column-drafts.ts";
import { type ColumnDraftTarget, readColumnsOut } from "./column-drafts.ts";
import { readChangeHistory } from "./change-history.ts";
import * as lists from "./lists.ts";
import * as peopleData from "./people.ts";
import { readOrgChart, setTeamColour } from "./org-chart.ts";
import * as hireData from "./hires.ts";
import { readHistory, recordRestrictedView } from "./history.ts";
import { discardRecordDraft, resubmitRecordDraft } from "./records.ts";
import * as releases from "./releases.ts";
import type { Saved } from "./changes.ts";
import { undoChangeSet } from "./undo.ts";
import {
  discardUnpublished,
  publishUnpublished,
  readUnpublished,
} from "./unpublished.ts";
import { type ActorAccess, readActorAccess } from "./roles.ts";
import {
  changePasswordSettings,
  changeTimeZone,
  checkChosenPassword,
  readSettings,
  readTimeZone,
} from "./settings.ts";
import * as views from "./views.ts";

export interface DataAccess {
  // Fails, with a message naming the settings to check, unless the database can be queried.
  checkConnection(): Promise<void>;
  // The role of the signed-in user making a request, and what it grants, or null if their account
  // is deactivated. The server needs them to know who is asking, so it is the one function that
  // checks no permission.
  readActorAccess(userId: string): Promise<ActorAccess | null>;
  readGreeting(actor: Actor): Promise<string>;
  // Settings for the whole of Fathom, which every signed-in user's screens follow, so reading them
  // checks no permission.
  readSettings(): Promise<Settings>;
  changeTimeZone(actor: Actor, timeZone: string): Promise<TimeZoneSetting>;
  changePasswordSettings(
    actor: Actor,
    passwords: PasswordSettings,
  ): Promise<PasswordSettings>;
  // Refuses a password a person chose that the rules in the password settings do not allow, or that
  // is too common or easy to guess for its owner. Anyone may ask, since the rules are no secret.
  checkChosenPassword(password: string, owner: PasswordOwner): Promise<void>;
  // The most recent entries in the access history.
  readHistory(actor: Actor): Promise<HistoryEntry[]>;
  // The change sets saved before the one named, or the latest, holding only the changes the actor
  // may see, and every word of a search, if any. Seeing Restricted or Confidential changes is
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
  // Planned hires: the hiring plan, or its placeholders.
  hires: HireAccess;
  // The actor's own unpublished changes to drafts, which only they see until they publish them.
  unpublished: UnpublishedAccess;
  // Release streams, their cycle patterns, and their releases, which everyone who sees the plan or
  // planning configuration may read.
  releases: ReleaseAccess;
  // Discarding and resubmitting drafts of the plan's records, whatever their kind.
  records: RecordAccess;
  // Undoes a change set the actor made, returning the change set that undid it.
  undo(actor: Actor, changeSetId: string): Promise<ChangeSetId>;
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
    change: Partial<ReleaseStreamRequest & RetiredRequest & CyclesUntilRequest>,
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
  // that move, which those who change cycles may do, as the Decisions Log sets out.
  changeCycleLength(
    actor: Actor,
    streamId: string,
    startsOn: string,
    request: CycleLengthRequest,
  ): Promise<Saved<ReleaseStream>>;
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

// The change set a change was saved in, which undoing it names; null when nothing changed.
export type ChangeSetId = string | null;

export type { Saved } from "./changes.ts";
export type { ColumnDraftTarget } from "./column-drafts.ts";

export interface DraftAccess {
  approve(actor: Actor, asked: DraftsAsked): Promise<ChangeSetId>;
  reject(
    actor: Actor,
    asked: DraftsAsked,
    reason: string,
  ): Promise<ChangeSetId>;
}

// Each user's changes to drafts are theirs alone until they publish them, all at once, or discard
// them, all at once; both answer how many records' changes they took.
export interface UnpublishedAccess {
  read(actor: Actor): Promise<Unpublished>;
  publish(actor: Actor): Promise<number>;
  discard(actor: Actor): Promise<number>;
}

// Which draft of a list: the list's own, one of its choices', or that of its choices' order.
export type ListDraftTarget =
  | { kind: "list"; listId: string }
  | { kind: "choice"; listId: string; choiceId: string }
  | { kind: "order"; listId: string };

// Every change to lists and choices is a draft, which reaches the live lists once approved.
export interface ListAccess {
  read(actor: Actor): Promise<List[]>;
  create(actor: Actor, request: ListRequest): Promise<Saved<List>>;
  update(actor: Actor, id: string, request: ListRequest): Promise<Saved<List>>;
  setRetired(
    actor: Actor,
    id: string,
    request: RetiredRequest,
  ): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  addChoices(
    actor: Actor,
    listId: string,
    requests: readonly ChoiceRequest[],
  ): Promise<Saved<Choice[]>>;
  updateChoice(
    actor: Actor,
    listId: string,
    id: string,
    request: ChoiceRequest,
  ): Promise<Saved<Choice>>;
  // Moves a choice to just after another, or to the top when there is none.
  moveChoice(
    actor: Actor,
    listId: string,
    id: string,
    after: string | null,
  ): Promise<ChangeSetId>;
  setChoiceRetired(
    actor: Actor,
    listId: string,
    id: string,
    request: RetiredRequest,
  ): Promise<ChangeSetId>;
  deleteChoice(actor: Actor, listId: string, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, target: ListDraftTarget): Promise<ChangeSetId>;
  // Sends a rejected draft for approval again, unchanged.
  resubmitDraft(actor: Actor, target: ListDraftTarget): Promise<ChangeSetId>;
}

export interface PeopleAccess {
  // Everyone the actor may see, with the columns whose values they may see, and the saved views
  // they may see. Reading anyone's Restricted details is recorded in the access history.
  read(actor: Actor): Promise<{
    people: Person[];
    fields: Field[];
    order: string[];
    orderDraft?: ColumnOrderDraft;
    orderHeldBy?: string;
    positionHidden?: true;
    views: SavedView[];
  }>;
  // Today's reporting lines as approved, with General details only, each person's draft of their
  // manager and team name beside, and the chart as drafts make it, as the reader may see them.
  // Telling anyone that a manager has left, or showing them a draft's Restricted details, such as
  // its manager, its dates, or someone it adds, is recorded in the access history.
  readOrgChart(actor: Actor): Promise<OrgChart>;
  // Sets the colour of a manager's named team, or removes it, at once rather than as a draft.
  setTeamColour(
    actor: Actor,
    managerId: string,
    colour: PaletteColour | null,
  ): Promise<void>;
  // Changes to people are drafts, which reach the live people once approved.
  create(
    actor: Actor,
    requests: readonly PersonRequest[],
  ): Promise<Saved<string[]>>;
  update(actor: Actor, id: string, change: PersonChange): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  // Sends a rejected draft for approval again, unchanged.
  resubmitDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  createField(actor: Actor, request: FieldRequest): Promise<Saved<Field>>;
  updateField(
    actor: Actor,
    id: string,
    request: FieldRequest,
  ): Promise<Saved<Field>>;
  // Moves a column, built-in or added, to just after another, or to the start when there is none.
  moveColumn(
    actor: Actor,
    key: string,
    after: string | null,
  ): Promise<ChangeSetId>;
  deleteField(actor: Actor, id: string): Promise<ChangeSetId>;
  // Discards a draft of a column or of the column order, or sends a rejected one for approval
  // again.
  discardColumnDraft(
    actor: Actor,
    target: ColumnDraftTarget,
  ): Promise<ChangeSetId>;
  resubmitColumnDraft(
    actor: Actor,
    target: ColumnDraftTarget,
  ): Promise<ChangeSetId>;
  // Saved views of the People table, which anyone who sees people may save, and only their maker,
  // or someone who may change planning configuration, may change or delete.
  createView(
    actor: Actor,
    request: SavedViewRequest,
  ): Promise<Saved<SavedView>>;
  updateView(
    actor: Actor,
    id: string,
    change: SavedViewChange,
  ): Promise<Saved<SavedView>>;
  deleteView(actor: Actor, id: string): Promise<ChangeSetId>;
}

// Every change to planned hires is a draft, which reaches the live hires once approved. Reading the
// whole hiring plan is recorded in the access history, as is reading placeholders whose position or
// state is more sensitive than General.
export interface HireAccess {
  read(actor: Actor): Promise<Hires>;
  create(
    actor: Actor,
    requests: readonly HireRequest[],
  ): Promise<Saved<string[]>>;
  update(actor: Actor, id: string, change: HireChange): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
  discardDraft(actor: Actor, id: string): Promise<ChangeSetId>;
  resubmitDraft(actor: Actor, id: string): Promise<ChangeSetId>;
}

function createHireAccess(database: Database): HireAccess {
  return {
    read: async (actor) => {
      const { includedRestricted, ...read } = await hireData.readHires(
        database,
        actor,
      );
      if (read.wholePlan && read.hires.length > 0) {
        await recordRestrictedView(
          database,
          actor.user.id,
          await readTimeZone(database),
          "hiring-plan-viewed",
        );
      } else if (includedRestricted) {
        await recordRestrictedView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      return read;
    },
    create: async (actor, requests) => {
      const { ids, changeSetId } = await hireData.createHires(
        database,
        actor,
        requests,
      );
      return { result: ids, changeSetId };
    },
    update: async (actor, id, change) =>
      hireData.updateHire(database, actor, id, change),
    delete: async (actor, id) => hireData.deleteHire(database, actor, id),
    discardDraft: async (actor, id) =>
      hireData.discardHireDraft(database, actor, id),
    resubmitDraft: async (actor, id) =>
      hireData.resubmitHireDraft(database, actor, id),
  };
}

// Checks the actor may change lists, and returns who to record as making the change.
function editor(actor: Actor): string {
  requirePermission(actor, "configuration:edit");
  return actor.user.id;
}

function createListAccess(database: Database): ListAccess {
  return {
    // Lists' choices are also read by those who see People, whose columns draw on them.
    read: async (actor) => {
      requireAnyPermission(actor, ["configuration:view", "people:view"]);
      return lists.readLists(database, actor.user.id);
    },
    create: async (actor, request) => {
      editor(actor);
      return lists.createList(database, actor, request);
    },
    update: async (actor, id, request) => {
      editor(actor);
      return lists.updateList(database, actor, id, request);
    },
    setRetired: async (actor, id, { retired }) =>
      lists.setListRetired(database, editor(actor), id, retired),
    delete: async (actor, id) => lists.deleteList(database, editor(actor), id),
    addChoices: async (actor, listId, requests) =>
      lists.addChoices(database, editor(actor), listId, requests),
    updateChoice: async (actor, listId, id, request) =>
      lists.updateChoice(database, editor(actor), listId, id, request),
    moveChoice: async (actor, listId, id, after) =>
      lists.moveChoice(database, editor(actor), listId, id, after),
    setChoiceRetired: async (actor, listId, id, { retired }) =>
      lists.setChoiceRetired(database, editor(actor), listId, id, retired),
    deleteChoice: async (actor, listId, id) =>
      lists.deleteChoice(database, editor(actor), listId, id),
    discardDraft: async (actor, target) =>
      lists.discardListDraft(
        database,
        editor(actor),
        target.kind,
        target.listId,
        target.kind === "choice" ? target.choiceId : undefined,
      ),
    resubmitDraft: async (actor, target) =>
      lists.resubmitListDraft(
        database,
        editor(actor),
        target.kind,
        target.listId,
        target.kind === "choice" ? target.choiceId : undefined,
      ),
  };
}

// Who may change each kind of the plan's records.
const recordEditors: Record<RecordType, Permission> = {
  "release-stream": "configuration:edit",
  "cycle-pattern": "configuration:edit",
  release: "plan:edit",
};

function recordEditor(actor: Actor, type: RecordType): string {
  // The kind is always one of the fixed kinds listed above.
  // eslint-disable-next-line security/detect-object-injection
  requirePermission(actor, recordEditors[type]);
  return actor.user.id;
}

function createReleaseAccess(database: Database): ReleaseAccess {
  const streams = (actor: Actor) => recordEditor(actor, "release-stream");
  const plan = (actor: Actor) => recordEditor(actor, "release");
  return {
    // Planning configuration is seen with the plan, as Roles proposes.
    read: async (actor) => {
      requireAnyPermission(actor, ["plan:view", "configuration:view"]);
      return {
        streams: await releases.readReleaseStreams(database, actor.user.id),
        canEditStreams: actor.permissions.includes("configuration:edit"),
        canEditReleases: actor.permissions.includes("plan:edit"),
      };
    },
    createStream: async (actor, request) =>
      releases.createStream(database, streams(actor), request),
    updateStream: async (actor, id, change) =>
      releases.updateStream(database, streams(actor), id, change),
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
        true,
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
      releases.removeFromStream(
        database,
        plan(actor),
        streamId,
        "release",
        id,
        actor.permissions.includes(recordEditors["cycle-pattern"]),
      ),
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

function createPeopleAccess(database: Database): PeopleAccess {
  return {
    read: async (actor) => {
      requirePermission(actor, "people:view");
      const read = await peopleData.readPeople(database, actor);
      if (read.includedRestricted) {
        await recordRestrictedView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      if (read.hiringPlanViewed) {
        await recordRestrictedView(
          database,
          actor.user.id,
          await readTimeZone(database),
          "hiring-plan-viewed",
        );
      }
      // The columns as their drafts make them, and their order, as the actor may see them.
      // Read as of one moment, so an approval saved meanwhile is seen whole or not at all.
      const columns = await database.transaction(
        (transaction) => readColumnsOut(transaction, actor),
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
      return {
        people: read.people,
        ...columns,
        ...(read.positionHidden ? { positionHidden: true as const } : {}),
        views: await views.readViews(database, actor),
      };
    },
    readOrgChart: async (actor) => {
      requirePermission(actor, "org-chart:view");
      const { includedRestricted, ...chart } = await readOrgChart(
        database,
        actor,
      );
      if (includedRestricted) {
        await recordRestrictedView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      return chart;
    },
    setTeamColour: async (actor, managerId, colour) => {
      requirePermission(actor, "org-chart:view");
      requirePermission(actor, "team-colours:edit");
      await setTeamColour(database, managerId, colour);
    },
    create: async (actor, requests) => {
      const { ids, changeSetId } = await peopleData.createPeople(
        database,
        actor,
        requests,
      );
      return { result: ids, changeSetId };
    },
    update: async (actor, id, change) =>
      peopleData.updatePerson(database, actor, id, change),
    delete: async (actor, id) => peopleData.deletePerson(database, actor, id),
    discardDraft: async (actor, id) =>
      peopleData.discardPersonDraft(database, actor, id),
    resubmitDraft: async (actor, id) =>
      peopleData.resubmitPersonDraft(database, actor, id),
    createField: async (actor, request) => {
      editor(actor);
      return columnDrafts.createField(database, actor, request);
    },
    updateField: async (actor, id, request) => {
      editor(actor);
      return columnDrafts.updateField(database, actor, id, request);
    },
    moveColumn: async (actor, key, after) =>
      columnDrafts.moveColumn(database, editor(actor), key, after),
    deleteField: async (actor, id) => {
      editor(actor);
      return columnDrafts.deleteField(database, actor, id);
    },
    discardColumnDraft: async (actor, target) =>
      columnDrafts.discardColumnDraft(database, editor(actor), target),
    resubmitColumnDraft: async (actor, target) =>
      columnDrafts.resubmitColumnDraft(database, editor(actor), target),
    createView: async (actor, request) => {
      requirePermission(actor, "people:view");
      return views.createView(database, actor, request);
    },
    updateView: async (actor, id, change) => {
      requirePermission(actor, "people:view");
      return views.updateView(database, actor, id, change);
    },
    deleteView: async (actor, id) => {
      requirePermission(actor, "people:view");
      return views.deleteView(database, actor, id);
    },
  };
}

export function createDataAccess(database: Database): DataAccess {
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
    readActorAccess: (userId) => readActorAccess(database, userId),
    readHistory: async (actor) => {
      requirePermission(actor, "history:view");
      return readHistory(database, actor.permissions.includes("people:view"));
    },
    readChanges: async (actor, before, search) => {
      requirePermission(actor, "changes:view");
      const read = await readChangeHistory(database, actor, before, search);
      if (read.includedSensitive) {
        await recordRestrictedView(
          database,
          actor.user.id,
          await readTimeZone(database),
        );
      }
      return { entries: read.entries, next: read.next };
    },
    lists: createListAccess(database),
    releases: createReleaseAccess(database),
    records: {
      discardDraft: async (actor, type, id) =>
        discardRecordDraft(
          database,
          recordEditor(actor, type),
          type,
          id,
          actor.permissions.includes(recordEditors["cycle-pattern"]),
        ),
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
    hires: createHireAccess(database),
    unpublished: {
      read: async (actor) => readUnpublished(database, actor),
      publish: async (actor) => publishUnpublished(database, actor),
      discard: async (actor) => discardUnpublished(database, actor),
    },
    undo: async (actor, changeSetId) =>
      undoChangeSet(database, actor, changeSetId),
    readGreeting: async (actor) => {
      requirePermission(actor, "plan:view");
      return readGreeting(database);
    },
    readSettings: async () => readSettings(database),
    changeTimeZone: async (actor, timeZone) =>
      changeTimeZone(database, actor, timeZone),
    changePasswordSettings: async (actor, passwords) =>
      changePasswordSettings(database, actor, passwords),
    checkChosenPassword: async (password, owner) =>
      checkChosenPassword(database, password, owner),
  };
}
