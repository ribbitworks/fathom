// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface: functions bound to a database, which are all that the rest of
// the server receives, so no other code can query the database directly. Functions that read or
// change Fathom's data take the actor making the request, and refuse when the actor's roles do not
// allow it.

import type { Database } from "@fathom/db";
import type { Role } from "@fathom/shared";
import { sql } from "drizzle-orm";
import { type Actor, requirePermission } from "../access.ts";
import { readGreeting } from "./greeting.ts";
import { readActorRoles } from "./roles.ts";

export interface DataAccess {
  // Fails, with a message naming the settings to check, unless the database can be queried.
  checkConnection(): Promise<void>;
  // The roles of the signed-in user making a request, or null if their account is deactivated. The
  // server needs them to know who is asking, so it is the one function that checks no permission.
  readActorRoles(userId: string): Promise<Role[] | null>;
  readGreeting(actor: Actor): Promise<string>;
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
    readGreeting: async (actor) => {
      requirePermission(actor, "plan:view");
      return readGreeting(database);
    },
  };
}
