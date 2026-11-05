// SPDX-License-Identifier: Apache-2.0

// Records and reads the access history: who did what, when, and to whom. Part of the data access
// layer, the only server code that queries the database. Entries are only ever added; the
// database refuses any change or deletion.

import {
  accessHistory,
  type Database,
  inChunks,
  people,
  users,
} from "@fathom/db";
import {
  type AccessAction,
  type HistoryDetails,
  type HistoryEntry,
  type Role,
  roleSchema,
} from "@fathom/shared";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

// The most recent entries the History page shows.
const shownEntries = 200;

export interface HistoryEvent {
  // Null for the server's operators, such as when the account command creates an account.
  actorId: string | null;
  action: AccessAction;
  // An account or a person, or null when the entry names no one.
  subjectId: string | null;
  details?: HistoryDetails;
}

// Takes the database or a transaction, so an entry is added together with the change it records.
export async function recordEvent(
  database: Pick<Database, "insert">,
  event: HistoryEvent,
): Promise<void> {
  await recordEvents(database, [event]);
}

// Several entries at once, as when one change set touches many people.
export async function recordEvents(
  database: Pick<Database, "insert">,
  events: readonly HistoryEvent[],
): Promise<void> {
  for (const chunk of inChunks(events)) {
    await database.insert(accessHistory).values(
      chunk.map(({ actorId, action, subjectId, details = {} }) => ({
        actorId,
        action,
        subjectId,
        details,
      })),
    );
  }
}

// Records that a user saw people's Restricted details, or the hiring plan, at most once a day for
// each user and kind of view, by the database's date, so what they see often does not bury other
// entries.
export async function recordRestrictedView(
  database: Database,
  actorId: string,
  action: "restricted-viewed" | "hiring-plan-viewed" = "restricted-viewed",
): Promise<void> {
  const today = await database
    .select({ id: accessHistory.id })
    .from(accessHistory)
    .where(
      and(
        eq(accessHistory.actorId, actorId),
        eq(accessHistory.action, action),
        gte(accessHistory.occurredAt, sql`current_date`),
      ),
    )
    .limit(1);
  if (today.length > 0) return;
  await recordEvent(database, { actorId, action, subjectId: null });
}

// Details as stored, read leniently: entries can never be changed, so a role renamed since one was
// recorded is left out rather than making the whole history unreadable.
const storedDetailsSchema = z
  .object({
    roles: z.array(z.string()).optional(),
    previousRoles: z.array(z.string()).optional(),
    role: z.string().optional(),
    previousName: z.string().optional(),
    granted: z.array(z.string()).optional(),
    withdrawn: z.array(z.string()).optional(),
  })
  .catch({});

function knownRoles(roles: string[] | undefined): Role[] | undefined {
  return roles?.flatMap((role) => {
    const known = roleSchema.safeParse(role);
    return known.success ? [known.data] : [];
  });
}

function knownDetails(details: unknown): HistoryDetails {
  const { roles, previousRoles, ...role } = storedDetailsSchema.parse(details);
  return {
    // A role's name and permissions are shown as stored, so one renamed since still reads.
    ...role,
    ...(roles === undefined ? {} : { roles: knownRoles(roles) }),
    ...(previousRoles === undefined
      ? {}
      : { previousRoles: knownRoles(previousRoles) }),
  };
}

// People whose Restricted details changed are named only to readers who may see people; others see
// that a change happened, and who made it, but not whose details changed.
export async function readHistory(
  database: Database,
  namesPeople: boolean,
): Promise<HistoryEntry[]> {
  const actors = alias(users, "actors");
  const subjects = alias(users, "subjects");
  const rows = await database
    .select({
      id: accessHistory.id,
      occurredAt: accessHistory.occurredAt,
      action: accessHistory.action,
      details: accessHistory.details,
      actorId: accessHistory.actorId,
      actorName: actors.name,
      actorEmail: actors.email,
      subjectId: accessHistory.subjectId,
      subjectEmail: subjects.email,
      // A subject is an account or, for changes to Restricted details, a person.
      subjectName: namesPeople
        ? sql<
            string | null
          >`coalesce(${subjects.name}, ${people.preferredName})`
        : subjects.name,
    })
    .from(accessHistory)
    .leftJoin(actors, eq(actors.id, accessHistory.actorId))
    .leftJoin(subjects, eq(subjects.id, accessHistory.subjectId))
    .leftJoin(people, sql`${people.id}::text = ${accessHistory.subjectId}`)
    .orderBy(desc(accessHistory.occurredAt), desc(accessHistory.id))
    .limit(shownEntries);
  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    action: row.action,
    details: knownDetails(row.details),
    actor:
      row.actorId === null
        ? null
        : { id: row.actorId, name: row.actorName, email: row.actorEmail },
    subject:
      row.subjectId === null
        ? null
        : { id: row.subjectId, name: row.subjectName, email: row.subjectEmail },
  }));
}
