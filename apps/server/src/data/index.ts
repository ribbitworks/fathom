// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface: functions bound to a database, which are all that the rest of
// the server receives, so no other code can query the database directly. Functions that read or
// change Fathom's data take the actor making the request, and refuse when the actor's roles do not
// allow it.

import type { Database } from "@fathom/db";
import type {
  Choice,
  ChoiceRequest,
  HistoryEntry,
  List,
  ListRequest,
  RetiredRequest,
  Role,
} from "@fathom/shared";
import { sql } from "drizzle-orm";
import { type Actor, requirePermission } from "../access.ts";
import { readGreeting } from "./greeting.ts";
import { readHistory } from "./history.ts";
import * as lists from "./lists.ts";
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
}

export interface ListAccess {
  read(actor: Actor): Promise<List[]>;
  create(actor: Actor, request: ListRequest): Promise<List>;
  update(actor: Actor, id: string, request: ListRequest): Promise<List>;
  setRetired(actor: Actor, id: string, request: RetiredRequest): Promise<void>;
  delete(actor: Actor, id: string): Promise<void>;
  addChoices(
    actor: Actor,
    listId: string,
    requests: readonly ChoiceRequest[],
  ): Promise<Choice[]>;
  updateChoice(
    actor: Actor,
    listId: string,
    id: string,
    request: ChoiceRequest,
  ): Promise<Choice>;
  // Moves a choice to just after another, or to the top when there is none.
  moveChoice(
    actor: Actor,
    listId: string,
    id: string,
    after: string | null,
  ): Promise<void>;
  setChoiceRetired(
    actor: Actor,
    listId: string,
    id: string,
    request: RetiredRequest,
  ): Promise<void>;
  deleteChoice(actor: Actor, listId: string, id: string): Promise<void>;
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
    setChoiceRetired: async (actor, listId, id, { retired, keepPlace }) =>
      lists.setChoiceRetired(
        database,
        editor(actor),
        listId,
        id,
        retired,
        keepPlace,
      ),
    deleteChoice: async (actor, listId, id) =>
      lists.deleteChoice(database, editor(actor), listId, id),
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
      return readHistory(database);
    },
    lists: createListAccess(database),
    readGreeting: async (actor) => {
      requirePermission(actor, "plan:view");
      return readGreeting(database);
    },
  };
}
