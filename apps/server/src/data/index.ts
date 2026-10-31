// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface: functions bound to a database, which are all that the rest of
// the server receives, so no other code can query the database directly. Functions that read or
// change Fathom's data take the actor making the request, and refuse when the actor's roles do not
// allow it.

import type { Database } from "@fathom/db";
import type {
  HistoryEntry,
  ListItem,
  ListItemRequest,
  ListName,
  Lists,
  Role,
} from "@fathom/shared";
import { sql } from "drizzle-orm";
import { type Actor, requirePermission, visibleTiers } from "../access.ts";
import { readGreeting } from "./greeting.ts";
import { readHistory } from "./history.ts";
import {
  addListItem,
  deleteListItem,
  readLists,
  updateListItem,
} from "./lists.ts";
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
  // The lists of choices for people's details, which everyone who sees planning configuration may
  // read, and only those who may edit it may change.
  readLists(actor: Actor): Promise<Lists>;
  addListItem(
    actor: Actor,
    list: ListName,
    item: ListItemRequest,
  ): Promise<ListItem>;
  updateListItem(
    actor: Actor,
    list: ListName,
    id: string,
    item: ListItemRequest,
  ): Promise<ListItem>;
  deleteListItem(actor: Actor, list: ListName, id: string): Promise<void>;
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
    readLists: async (actor) => {
      requirePermission(actor, "configuration:view");
      return readLists(database, visibleTiers(actor));
    },
    addListItem: async (actor, list, item) => {
      requirePermission(actor, "configuration:edit");
      return addListItem(
        database,
        actor.user.id,
        list,
        item,
        visibleTiers(actor),
      );
    },
    updateListItem: async (actor, list, id, item) => {
      requirePermission(actor, "configuration:edit");
      return updateListItem(
        database,
        actor.user.id,
        list,
        id,
        item,
        visibleTiers(actor),
      );
    },
    deleteListItem: async (actor, list, id) => {
      requirePermission(actor, "configuration:edit");
      await deleteListItem(database, actor.user.id, list, id);
    },
    readGreeting: async (actor) => {
      requirePermission(actor, "plan:view");
      return readGreeting(database);
    },
  };
}
