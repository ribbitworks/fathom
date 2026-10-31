// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface: functions bound to a database, which are all that the rest of
// the server receives, so no other code can query the database directly. Functions that read or
// change Fathom's data take the actor making the request, and refuse when the actor's roles do not
// allow it.

import type { Database } from "@fathom/db";
import type {
  Choice,
  ChoiceRequest,
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
} from "@fathom/shared";
import { sql } from "drizzle-orm";
import { type Actor, requirePermission, seesTier } from "../access.ts";
import { readGreeting } from "./greeting.ts";
import { moveColumn, readColumnOrder } from "./column-order.ts";
import * as fieldData from "./fields.ts";
import { readHistory, recordRestrictedView } from "./history.ts";
import * as lists from "./lists.ts";
import * as peopleData from "./people.ts";
import type { Saved } from "./changes.ts";
import { undoChangeSet } from "./undo.ts";
import { readActorRoles } from "./roles.ts";

export interface DataAccess {
  // Fails, with a message naming the settings to check, unless the database can be queried.
  checkConnection(): Promise<void>;
  // The roles of the signed-in user making a request, or null if their account is deactivated. The
  // server needs them to know who is asking, so it is the one function that checks no permission.
  readActorRoles(userId: string): Promise<Role[] | null>;
  readGreeting(actor: Actor): Promise<string>;
  // The most recent entries in the access history.
  readHistory(actor: Actor): Promise<HistoryEntry[]>;
  // Lists of choices, which everyone who sees planning configuration may read, and only those who may
  // edit it may change.
  lists: ListAccess;
  // People, and the columns on the People table.
  people: PeopleAccess;
  // Undoes a change set the actor made, returning the change set that undid it.
  undo(actor: Actor, changeSetId: string): Promise<ChangeSetId>;
}

// The change set a change was saved in, which undoing it names; null when nothing changed.
export type ChangeSetId = string | null;

export type { Saved } from "./changes.ts";

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
}

export interface PeopleAccess {
  // Everyone the actor may see, with the columns whose values they may see. Reading anyone's
  // Restricted details is recorded in the access history.
  read(
    actor: Actor,
  ): Promise<{ people: Person[]; fields: Field[]; order: string[] }>;
  create(
    actor: Actor,
    requests: readonly PersonRequest[],
  ): Promise<Saved<string[]>>;
  update(actor: Actor, id: string, change: PersonChange): Promise<ChangeSetId>;
  delete(actor: Actor, id: string): Promise<ChangeSetId>;
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
}

// Checks the actor may change lists, and returns who to record as making the change.
function editor(actor: Actor): string {
  requirePermission(actor, "configuration:edit");
  return actor.user.id;
}

function createListAccess(database: Database): ListAccess {
  return {
    read: async (actor) => {
      requirePermission(actor, "configuration:view");
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
      // The order of only the columns the actor sees: dates only with Restricted details.
      const visible = new Set([
        "preferredName",
        "employeeId",
        ...(seesTier(actor, "restricted") ? ["startDate", "endDate"] : []),
        ...read.columns.map(({ id }) => id),
      ]);
      return {
        people: read.people,
        fields: read.columns.map(fieldData.toField),
        order: (await readColumnOrder(database)).filter((key) =>
          visible.has(key),
        ),
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
    createField: async (actor, request) =>
      fieldData.createField(database, editor(actor), request),
    updateField: async (actor, id, request) =>
      fieldData.updateField(database, editor(actor), id, request),
    moveColumn: async (actor, key, after) =>
      moveColumn(database, editor(actor), key, after),
    deleteField: async (actor, id) => {
      editor(actor);
      return fieldData.deleteField(database, actor, id);
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
    lists: createListAccess(database),
    people: createPeopleAccess(database),
    undo: async (actor, changeSetId) =>
      undoChangeSet(database, actor, changeSetId),
    readGreeting: async (actor) => {
      requirePermission(actor, "plan:view");
      return readGreeting(database);
    },
  };
}
