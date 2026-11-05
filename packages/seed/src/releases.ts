// SPDX-License-Identifier: Apache-2.0

// The fictional organization's release streams, added live: Platform, in quarters from 2026 and in
// halves from July 2027, with three releases, and Patches, in four-week cycles from September 2026,
// with two, each recorded in the change history as made by Fathom itself. Removing them first
// discards every draft, published or not, of their records or of records drafted to be added to
// them, and keeps a stream that has a live pattern or release added by hand. A development-only
// package, never included in the runtime image.

import {
  type ChangeRecord,
  cyclePatterns,
  type Database,
  drafts,
  recordChanges,
  releases,
  releaseStreams,
  unpublishedDrafts,
} from "@fathom/db";
import { fictionalId } from "@fathom/fixtures";
import type { ReleaseColour } from "@fathom/shared";
import { and, eq, inArray, or, sql } from "drizzle-orm";

interface SeededStream {
  name: string;
  cyclesUntil: string;
  patterns: {
    startsOn: string;
    length: number;
    unit: "weeks" | "months";
    naming: string;
  }[];
  releases: {
    name: string;
    firstCycle: string;
    lastCycle: string;
    colour?: ReleaseColour;
  }[];
}

export const seededStreams: readonly SeededStream[] = [
  {
    name: "Platform",
    cyclesUntil: "2029-12-31",
    patterns: [
      { startsOn: "2026-01-01", length: 3, unit: "months", naming: "{YY}.{N}" },
      { startsOn: "2027-07-01", length: 6, unit: "months", naming: "{YY}.{N}" },
    ],
    releases: [
      { name: "Harbor 1", firstCycle: "2026-01-01", lastCycle: "2026-04-01" },
      {
        name: "Harbor 2",
        firstCycle: "2026-07-01",
        lastCycle: "2026-10-01",
        colour: "grape",
      },
      { name: "Harbor 3", firstCycle: "2027-01-01", lastCycle: "2027-07-01" },
    ],
  },
  {
    name: "Patches",
    cyclesUntil: "2028-08-31",
    patterns: [
      { startsOn: "2026-09-07", length: 4, unit: "weeks", naming: "P{YY}.{N}" },
    ],
    releases: [
      {
        name: "Patch October",
        firstCycle: "2026-10-05",
        lastCycle: "2026-10-05",
      },
      {
        name: "Patch December",
        firstCycle: "2026-11-02",
        lastCycle: "2026-11-30",
        colour: "orange",
      },
    ],
  },
];

const streamId = (stream: SeededStream) =>
  fictionalId(`release-stream:${stream.name}`);
const patternId = (stream: SeededStream, startsOn: string) =>
  fictionalId(`cycle-pattern:${stream.name}:${startsOn}`);
const releaseId = (stream: SeededStream, name: string) =>
  fictionalId(`release:${stream.name}:${name}`);

type Change = ChangeRecord & { action: "created" | "deleted" };

const recorded = (
  recordType: string,
  recordId: string,
  action: Change["action"],
  values: Record<string, unknown>,
): Change[] =>
  Object.entries(values).map(([field, value]) => ({
    recordType,
    recordId,
    action,
    field,
    tier: "general",
    oldValue: action === "deleted" ? value : null,
    newValue: action === "created" ? value : null,
  }));

// Adds each stream that is not already there, as one seeded before or one of the same name added by
// hand. Returns whether it added any.
export async function seedReleases(database: Database): Promise<boolean> {
  return database.transaction(async (transaction) => {
    const present = await transaction
      .select({ id: releaseStreams.id, name: releaseStreams.name })
      .from(releaseStreams);
    const missing = seededStreams.filter(
      (stream) =>
        !present.some(
          ({ id, name }) =>
            id === streamId(stream) ||
            name.toLowerCase() === stream.name.toLowerCase(),
        ),
    );
    if (missing.length === 0) return false;
    const [last] = await transaction
      .select({
        position: sql<number>`coalesce(max(${releaseStreams.position}), 0)`,
      })
      .from(releaseStreams);
    const made: Change[] = [];
    for (const [index, stream] of missing.entries()) {
      const id = streamId(stream);
      await transaction.insert(releaseStreams).values({
        id,
        name: stream.name,
        cyclesUntil: stream.cyclesUntil,
        position: Number(last?.position) + index + 1,
      });
      made.push(
        ...recorded("release-stream", id, "created", {
          name: stream.name,
          retired: false,
          cyclesUntil: stream.cyclesUntil,
        }),
      );
      for (const pattern of stream.patterns) {
        const row = { streamId: id, ...pattern };
        const recordId = patternId(stream, pattern.startsOn);
        await transaction
          .insert(cyclePatterns)
          .values({ id: recordId, ...row });
        made.push(...recorded("cycle-pattern", recordId, "created", row));
      }
      for (const release of stream.releases) {
        const row = { streamId: id, ...release };
        const recordId = releaseId(stream, release.name);
        await transaction.insert(releases).values({ id: recordId, ...row });
        made.push(...recorded("release", recordId, "created", row));
      }
    }
    await recordChanges(transaction, null, made);
    return true;
  });
}

// Removes the drafts, published or not, of the records given or of patterns and releases in the
// streams given.
async function discardDraftsOf(
  transaction: Pick<Database, "delete">,
  recordIds: readonly string[],
  streamIds: readonly string[],
): Promise<void> {
  for (const table of [drafts, unpublishedDrafts]) {
    await transaction
      .delete(table)
      .where(
        or(
          inArray(table.recordId, [...recordIds]),
          and(
            inArray(table.recordType, ["cycle-pattern", "release"]),
            inArray(sql`${table.fields}->>'streamId'`, [...streamIds]),
          ),
        ),
      );
  }
}

// Removes the streams seeding added, and returns those it kept because something added by hand uses
// them.
export async function unseedReleases(database: Database): Promise<string[]> {
  return database.transaction(async (transaction) => {
    const kept: string[] = [];
    const made: Change[] = [];
    for (const stream of seededStreams) {
      const id = streamId(stream);
      const [row] = await transaction
        .select()
        .from(releaseStreams)
        .where(eq(releaseStreams.id, id));
      if (row === undefined) continue;
      const patternRows = await transaction
        .select()
        .from(cyclePatterns)
        .where(eq(cyclePatterns.streamId, id));
      const releaseRows = await transaction
        .select()
        .from(releases)
        .where(eq(releases.streamId, id));
      const seeded = new Set([
        ...stream.patterns.map(({ startsOn }) => patternId(stream, startsOn)),
        ...stream.releases.map(({ name }) => releaseId(stream, name)),
      ]);
      const own = [...patternRows, ...releaseRows].map((record) => record.id);
      // A stream kept keeps every draft of it and its records, which may be people's own.
      if (own.some((recordId) => !seeded.has(recordId))) {
        kept.push(
          `The ${row.name} release stream, which has releases or cycles added by hand`,
        );
        continue;
      }
      await discardDraftsOf(transaction, [id, ...own], [id]);
      for (const release of releaseRows) {
        const { id: recordId, ...values } = release;
        made.push(...recorded("release", recordId, "deleted", values));
      }
      for (const pattern of patternRows) {
        const { id: recordId, ...values } = pattern;
        made.push(...recorded("cycle-pattern", recordId, "deleted", values));
      }
      made.push(
        ...recorded("release-stream", id, "deleted", {
          name: row.name,
          retired: row.retired,
          cyclesUntil: row.cyclesUntil,
        }),
      );
      await transaction.delete(releases).where(eq(releases.streamId, id));
      await transaction
        .delete(cyclePatterns)
        .where(eq(cyclePatterns.streamId, id));
      await transaction.delete(releaseStreams).where(eq(releaseStreams.id, id));
    }
    await recordChanges(transaction, null, made);
    return kept;
  });
}
