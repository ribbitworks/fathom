// SPDX-License-Identifier: Apache-2.0

// Records and reads the access history: who did what, when, and to whom. Part of the data access
// layer, the only server code that queries the database. Entries are only ever added; the
// database refuses any change or deletion.

import { accessHistory, type Database, users } from "@fathom/db";
import {
  type AccessAction,
  type HistoryDetails,
  type HistoryEntry,
  type Role,
  roleSchema,
} from "@fathom/shared";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

// The most recent entries the History page shows.
const shownEntries = 200;

export interface HistoryEvent {
  // Null for the server's operators, such as when the account command creates an account.
  actorId: string | null;
  action: AccessAction;
  subjectId: string;
  details?: HistoryDetails;
}

// Takes the database or a transaction, so an entry is added together with the change it records.
export async function recordEvent(
  database: Pick<Database, "insert">,
  { actorId, action, subjectId, details = {} }: HistoryEvent,
): Promise<void> {
  await database
    .insert(accessHistory)
    .values({ actorId, action, subjectId, details });
}

// Details as stored, read leniently: entries can never be changed, so a role renamed since one was
// recorded is left out rather than making the whole history unreadable.
const storedDetailsSchema = z
  .object({
    roles: z.array(z.string()).optional(),
    previousRoles: z.array(z.string()).optional(),
  })
  .catch({});

function knownRoles(roles: string[] | undefined): Role[] | undefined {
  return roles?.flatMap((role) => {
    const known = roleSchema.safeParse(role);
    return known.success ? [known.data] : [];
  });
}

function knownDetails(details: unknown): HistoryDetails {
  const { roles, previousRoles } = storedDetailsSchema.parse(details);
  return {
    ...(roles === undefined ? {} : { roles: knownRoles(roles) }),
    ...(previousRoles === undefined
      ? {}
      : { previousRoles: knownRoles(previousRoles) }),
  };
}

export async function readHistory(database: Database): Promise<HistoryEntry[]> {
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
      subjectId: accessHistory.subjectId,
      subjectName: subjects.name,
    })
    .from(accessHistory)
    .leftJoin(actors, eq(actors.id, accessHistory.actorId))
    .leftJoin(subjects, eq(subjects.id, accessHistory.subjectId))
    .orderBy(desc(accessHistory.occurredAt), desc(accessHistory.id))
    .limit(shownEntries);
  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    action: row.action,
    details: knownDetails(row.details),
    actor:
      row.actorId === null ? null : { id: row.actorId, name: row.actorName },
    subject: { id: String(row.subjectId), name: row.subjectName },
  }));
}
