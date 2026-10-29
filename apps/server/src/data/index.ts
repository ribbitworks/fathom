// SPDX-License-Identifier: Apache-2.0

// The data access layer's interface: functions bound to a database, which are all that the rest of
// the server receives, so no other code can query the database directly.

import type { Database } from "@fathom/db";
import { sql } from "drizzle-orm";
import { readGreeting } from "./greeting.ts";

export interface DataAccess {
  // Fails, with a message naming the settings to check, unless the database can be queried.
  checkConnection(): Promise<void>;
  readGreeting(): Promise<string>;
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
    readGreeting: () => readGreeting(database),
  };
}
