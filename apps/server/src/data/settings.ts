// SPDX-License-Identifier: Apache-2.0

// Fathom's settings: the time zone that decides which day is today, and the password settings.
// Part of the data access layer.

import { appInfo, type Database, type Reader } from "@fathom/db";
import {
  chosenPasswordProblem,
  dayIn,
  type PasswordOwner,
  type PasswordSettings,
  passwordSettingsSchema,
  recipeProblems,
  type Settings,
  type TimeZoneSetting,
} from "@fathom/shared";
import { isGuessable } from "@fathom/shared/guessable-passwords";
import { eq, sql } from "drizzle-orm";
import { type Actor, requirePermission } from "../access.ts";
import { BadRequestError } from "../errors.ts";
import { readDataClasses } from "./data-classes.ts";
import { recordEvent } from "./history.ts";

const timeZoneKey = "time-zone";
const passwordsKey = "password-settings";

// Locked for a change when asked, so two changes made at once are recorded one after the other.
export async function readTimeZone(
  reader: Reader,
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
export async function readToday(reader: Reader): Promise<string> {
  return dayIn(await readTimeZone(reader));
}

// Stored as JSON, which the migrations write and only this module changes.
export async function readPasswordSettings(
  reader: Reader,
  { lock = false } = {},
): Promise<PasswordSettings> {
  const query = reader
    .select({ value: appInfo.value })
    .from(appInfo)
    .where(eq(appInfo.key, passwordsKey));
  const [row] = await (lock ? query.for("update") : query);
  if (row === undefined)
    throw new Error("The password settings are missing; apply the migrations");
  return passwordSettingsSchema.parse(JSON.parse(row.value));
}

export async function readSettings(reader: Reader): Promise<Settings> {
  return {
    timeZone: await readTimeZone(reader),
    passwords: await readPasswordSettings(reader),
    dataClasses: await readDataClasses(reader),
  };
}

// Refuses a password a person chose that does not meet the rules, saying what it lacks, or that is
// too common or easy to guess, including one built from their own name or email address, which no
// setting allows.
export async function checkChosenPassword(
  reader: Reader,
  password: string,
  owner: PasswordOwner,
): Promise<void> {
  const problem = chosenPasswordProblem(
    (await readPasswordSettings(reader)).rules,
    password,
    owner,
    isGuessable,
  );
  if (problem !== undefined) throw new BadRequestError(problem);
}

const sameSettings = (one: PasswordSettings, other: PasswordSettings) =>
  JSON.stringify(passwordSettingsSchema.parse(one)) ===
  JSON.stringify(passwordSettingsSchema.parse(other));

// Changes the password settings, refusing a recipe whose passwords would break the rules, and
// records the change in the access history together with it, unless nothing changed. Tighter rules
// apply from each person's next change of password.
export async function changePasswordSettings(
  database: Database,
  actor: Actor,
  requested: PasswordSettings,
): Promise<PasswordSettings> {
  requirePermission(actor, "administration:edit");
  const [problem] = recipeProblems(requested);
  if (problem !== undefined) throw new BadRequestError(problem);
  const passwords = passwordSettingsSchema.parse(requested);
  return database.transaction(async (transaction) => {
    const before = await readPasswordSettings(transaction, { lock: true });
    if (sameSettings(before, passwords)) return passwords;
    await transaction
      .update(appInfo)
      .set({ value: JSON.stringify(passwords) })
      .where(eq(appInfo.key, passwordsKey));
    await recordEvent(transaction, {
      actorId: actor.user.id,
      action: "password-settings-changed",
      subjectId: null,
      details: { passwords, previousPasswords: before },
    });
    return passwords;
  });
}

// Changes the time zone, recording the change in the access history together with it, unless it is
// already the one given.
export async function changeTimeZone(
  database: Database,
  actor: Actor,
  requested: string,
): Promise<TimeZoneSetting> {
  requirePermission(actor, "administration:edit");
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
