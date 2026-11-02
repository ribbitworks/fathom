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
  DraftsAsked,
  Field,
  FieldRequest,
  HistoryEntry,
  List,
  ListRequest,
  Person,
  PersonChange,
  PersonRequest,
  RetiredRequest,
  Role,
  SavedView,
  SavedViewChange,
  SavedViewRequest,
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
import { readHistory, recordRestrictedView } from "./history.ts";
import * as lists from "./lists.ts";
import * as peopleData from "./people.ts";
import type { Saved } from "./changes.ts";
import { undoChangeSet } from "./undo.ts";
import { readActorRoles } from "./roles.ts";
import * as views from "./views.ts";

export interface DataAccess {
  // Fails, with a message naming the settings to check, unless the database can be queried.
  checkConnection(): Promise<void>;
  // The roles of the signed-in user making a request, or null if their account is deactivated. The
  // server needs them to know who is asking, so it is the one function that checks no permission.
  readActorRoles(userId: string): Promise<Role[] | null>;
  readGreeting(actor: Actor): Promise<string>;
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
  // Lists of choices, which everyone who sees planning configuration may read, and only those who may
  // edit it may change.
  lists: ListAccess;
  // Approving and rejecting drafts of every kind, several kinds at once; neither can be undone.
  drafts: DraftAccess;
  // People, and the columns on the People table.
  people: PeopleAccess;
  // Undoes a change set the actor made, returning the change set that undid it.
  undo(actor: Actor, changeSetId: string): Promise<ChangeSetId>;
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
  // Everyone the actor may see, with the columns whose values they may see, and the saved views they
  // may see. Reading anyone's Restricted details is recorded in the access history.
  read(actor: Actor): Promise<{
    people: Person[];
    fields: Field[];
    order: string[];
    orderDraft?: ColumnOrderDraft;
    views: SavedView[];
  }>;
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
  // Discards a draft of a column or of the column order, or sends a rejected one for approval again.
  discardColumnDraft(
    actor: Actor,
    target: ColumnDraftTarget,
  ): Promise<ChangeSetId>;
  resubmitColumnDraft(
    actor: Actor,
    target: ColumnDraftTarget,
  ): Promise<ChangeSetId>;
  // Saved views of the People table, which anyone who sees people may save, and only their maker, or
  // someone who may change planning configuration, may change or delete.
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
      return lists.readLists(database);
    },
    create: async (actor, request) =>
      lists.createList(database, editor(actor), request),
    update: async (actor, id, request) =>
      lists.updateList(database, editor(actor), id, request),
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

function createPeopleAccess(database: Database): PeopleAccess {
  return {
    read: async (actor) => {
      requirePermission(actor, "people:view");
      const read = await peopleData.readPeople(database, actor);
      if (read.includedRestricted) {
        await recordRestrictedView(database, actor.user.id);
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
        views: await views.readViews(database, actor),
      };
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
    createField: async (actor, request) =>
      columnDrafts.createField(database, editor(actor), request),
    updateField: async (actor, id, request) =>
      columnDrafts.updateField(database, editor(actor), id, request),
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
    readActorRoles: (userId) => readActorRoles(database, userId),
    readHistory: async (actor) => {
      requirePermission(actor, "history:view");
      return readHistory(database, actor.permissions.includes("people:view"));
    },
    readChanges: async (actor, before, search) => {
      requirePermission(actor, "changes:view");
      const read = await readChangeHistory(database, actor, before, search);
      if (read.includedSensitive) {
        await recordRestrictedView(database, actor.user.id);
      }
      return { entries: read.entries, next: read.next };
    },
    lists: createListAccess(database),
    drafts: {
      approve: async (actor, asked) =>
        approveDrafts(database, actor, draftsRequestSchema.parse(asked)),
      reject: async (actor, asked, reason) =>
        rejectDrafts(database, actor, draftsRequestSchema.parse(asked), reason),
    },
    people: createPeopleAccess(database),
    undo: async (actor, changeSetId) =>
      undoChangeSet(database, actor, changeSetId),
    readGreeting: async (actor) => {
      requirePermission(actor, "plan:view");
      return readGreeting(database);
    },
  };
}
