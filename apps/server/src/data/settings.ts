// SPDX-License-Identifier: Apache-2.0

// Fathom's settings, kept in the application information the migrations store: the time zone that
// decides which day is today, read by the rest of the data access layer whenever it needs today.
// Part of the data access layer, the only server code that queries the database.

import { appInfo, type Database } from "@fathom/db";
import { dayIn, type Settings } from "@fathom/shared";
import { eq, sql } from "drizzle-orm";
import { type Actor, requirePermission } from "../access.ts";
import { BadRequestError } from "../errors.ts";
import { recordEvent } from "./history.ts";

const timeZoneKey = "time-zone";

// Locked for a change when asked, so two changes made at once are recorded one after the other.
export async function readTimeZone(
  reader: Pick<Database, "select">,
  { lock = false } = {},
): Promise<string> {
  const query = reader
    .select({ value: appInfo.value })
    .from(appInfo)
    .where(eq(appInfo.key, timeZoneKey));
  const [row] = await (lock ? query.for("update") : query);
  if (row === undefined)
    throw new Error("The time zone is missing; apply the migrations");
  return row.value;
}

// Today, in Fathom's time zone.
export async function readToday(
  reader: Pick<Database, "select">,
): Promise<string> {
  return dayIn(await readTimeZone(reader));
}

export async function readSettings(
  reader: Pick<Database, "select">,
): Promise<Settings> {
  return { timeZone: await readTimeZone(reader) };
}

// Changes the time zone, recording the change in the access history together with it, unless it is
// already the one given.
export async function changeTimeZone(
  database: Database,
  actor: Actor,
  requested: string,
): Promise<Settings> {
  requirePermission(actor, "settings:edit");
  return database.transaction(async (transaction) => {
    // Days are also worked out by PostgreSQL, whose time zone data may lack a name added lately.
    // Its own spelling is kept, so a name typed in another case still works there.
    const known = await transaction.execute<{ name: string }>(
      sql`SELECT name FROM pg_timezone_names WHERE lower(name) = lower(${requested}) LIMIT 1`,
    );
    const timeZone = known.rows[0]?.name;
    if (timeZone === undefined) {
      throw new BadRequestError("Fathom does not know that time zone.");
    }
    const before = await readTimeZone(transaction, { lock: true });
    if (before === timeZone) return { timeZone };
    await transaction
      .update(appInfo)
      .set({ value: timeZone })
      .where(eq(appInfo.key, timeZoneKey));
    await recordEvent(transaction, {
      actorId: actor.user.id,
      action: "time-zone-changed",
      subjectId: null,
      details: { timeZone, previousTimeZone: before },
    });
    return { timeZone };
  });
}
