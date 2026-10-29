// SPDX-License-Identifier: Apache-2.0

// Reads the greeting stored by the migrations. Part of the data access layer, the only server code
// that queries the database.

import { appInfo, type Database } from "@fathom/db";
import { eq } from "drizzle-orm";

export async function readGreeting(database: Database): Promise<string> {
  const rows = await database
    .select({ value: appInfo.value })
    .from(appInfo)
    .where(eq(appInfo.key, "greeting"));
  const greeting = rows[0]?.value;
  if (greeting === undefined)
    throw new Error("The greeting is missing; apply the migrations");
  return greeting;
}
