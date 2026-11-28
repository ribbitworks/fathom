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
  historyDetailsSchema,
} from "@fathom/shared";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

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

// Records that a user saw people's Personal details, or the hiring plan, at most once a day for
// each user and kind of view, by the day in Fathom's time zone, so what they see often does not bury
// other entries. Changing the time zone checks PostgreSQL knows it.
export async function recordPersonalView(
  database: Database,
  actorId: string,
  timeZone: string,
  action: "personal-viewed" | "hiring-plan-viewed" = "personal-viewed",
): Promise<void> {
  const startOfToday = sql`(now() AT TIME ZONE ${timeZone})::date::timestamp AT TIME ZONE ${timeZone}`;
  const today = await database
    .select({ id: accessHistory.id })
    .from(accessHistory)
    .where(
      and(
        eq(accessHistory.actorId, actorId),
        eq(accessHistory.action, action),
        gte(accessHistory.occurredAt, startOfToday),
      ),
    )
    .limit(1);
  if (today.length > 0) return;
  await recordEvent(database, { actorId, action, subjectId: null });
}

// Details as stored, read leniently: entries can never be changed, so details another version of
// Fathom stored in another shape are left out rather than making the whole history unreadable. Roles
// are named as they were then, so a role renamed since still reads.
const storedDetailsSchema = historyDetailsSchema.catch({});

const knownDetails = (details: unknown): HistoryDetails =>
  storedDetailsSchema.parse(details);

// People whose Personal details changed are named only to readers who may see people; others see
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
      // A subject is an account or, for changes to Personal details, a person.
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
