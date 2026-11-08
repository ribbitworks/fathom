// SPDX-License-Identifier: Apache-2.0

// The fictional organization's release streams, added live and dated from the day they are added:
// Platform, in quarters and then halves, with three releases, and Patches, in four-week cycles, with
// two, each recorded in the change history as made by Fathom itself. Removing them first
// discards every draft, published or not, of their records or of records drafted to be added to
// them, and keeps a stream that has a live pattern or release added by hand. A development-only
// package, never included in the runtime image.

import {
  cyclePatterns,
  type Database,
  features,
  drafts,
  recordChanges,
  releases,
  releaseStreams,
  unpublishedDrafts,
} from "@fathom/db";
import { fictionalId } from "@fathom/fixtures";
import {
  addDays,
  addMonths,
  lastDayOfMonth,
  type PaletteColour,
} from "@fathom/shared";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { recorded, type SeededChange } from "./recorded.ts";

export interface SeededStream {
  name: string;
  cyclesUntil: string;
  // Each pattern and release has a key of its own, which its identifier is made from, so the seed
  // data added on one day is found and removed on another, when its dates and names have moved.
  patterns: {
    key: string;
    startsOn: string;
    length: number;
    unit: "weeks" | "months";
    naming: string;
  }[];
  releases: {
    key: string;
    name: string;
    firstCycle: string;
    lastCycle: string;
    colour?: PaletteColour;
    // As Markdown, within what notes allow.
    note?: string;
  }[];
}

// Each stream's name, and the keys of its patterns and releases, in the order it lists them.
export const seededKeys = [
  {
    name: "Platform",
    patterns: ["quarters", "halves"],
    releases: ["harbor-1", "harbor-2", "harbor-3"],
  },
  {
    name: "Patches",
    patterns: ["four-weeks"],
    releases: ["patch-1", "patch-2"],
  },
] as const;

// Platform starts some quarters before today's, is in halves from some quarters after it, and is
// planned to the end of a year some years on. Patches starts some cycles before this week's, in
// cycles of some weeks, and is planned to the end of the month before two years on.
const platformDates = {
  quartersBefore: 3,
  quartersUntilHalves: 3,
  yearsPlanned: 3,
} as const;
const patchDates = { weeks: 4, cyclesBefore: 2, monthsPlanned: 23 } as const;

// The first day of the quarter a day is in, as YYYY-MM-DD.
function quarterStart(of: string): string {
  const [year, month] = of.split("-").map(Number);
  const first = Math.floor((Number(month) - 1) / 3) * 3 + 1;
  return `${String(year)}-${String(first).padStart(2, "0")}-01`;
}

// The Monday on or before a day.
const mondayOf = (of: string): string =>
  addDays(of, -((new Date(`${of}T00:00:00Z`).getUTCDay() + 6) % 7));

const monthName = (of: string): string =>
  new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
    new Date(`${of}T00:00:00Z`),
  );

// The streams as seeded on a day, the same whatever the day: Platform, in quarters from three
// quarters before today's and in halves from three quarters after it, with a release that has
// shipped, one ending this quarter, and one to come; and Patches, in four-week cycles from eight
// weeks before this week's Monday, with a release on one cycle that has shipped and one on two
// cycles to come, each named after the month it ships in.
export function seededStreams(today: string): readonly SeededStream[] {
  const quarter = (offset: number) =>
    addMonths(quarterStart(today), offset * 3);
  const firstQuarter = -platformDates.quartersBefore;
  const firstHalf = platformDates.quartersUntilHalves;
  const cycleDays = patchDates.weeks * 7;
  const patchStart = addDays(
    mondayOf(today),
    -patchDates.cyclesBefore * cycleDays,
  );
  const cycle = (index: number) => addDays(patchStart, index * cycleDays);
  // A patch release ships on the last day of its last cycle, the day before the next starts.
  const patchName = (lastCycle: number) =>
    `Patch ${monthName(addDays(cycle(lastCycle + 1), -1))}`;
  const [platform, patches] = seededKeys;
  return [
    {
      name: platform.name,
      cyclesUntil: `${String(Number(today.slice(0, 4)) + platformDates.yearsPlanned)}-12-31`,
      patterns: [
        {
          key: platform.patterns[0],
          startsOn: quarter(firstQuarter),
          length: 3,
          unit: "months",
          naming: "{YY}.{N}",
        },
        {
          key: platform.patterns[1],
          startsOn: quarter(firstHalf),
          length: 6,
          unit: "months",
          naming: "{YY}.{N}",
        },
      ],
      releases: [
        {
          key: platform.releases[0],
          name: "Harbor 1",
          firstCycle: quarter(firstQuarter),
          lastCycle: quarter(firstQuarter + 1),
        },
        {
          key: platform.releases[1],
          name: "Harbor 2",
          firstCycle: quarter(-1),
          lastCycle: quarter(0),
          colour: "grape",
          note: [
            "## Goals",
            "",
            "- Faster sign-in for **every** team",
            "- Retire the old *export* format",
            "",
            "## Before shipping",
            "",
            "- [x] Freeze the scope",
            "- [ ] Check the upgrade guide",
            "",
            '<span data-colour="red">Translations are late</span>; see [the plan](https://example.com/harbor-2).',
          ].join("\n"),
        },
        {
          key: platform.releases[2],
          name: "Harbor 3",
          firstCycle: quarter(1),
          lastCycle: quarter(firstHalf),
        },
      ],
    },
    {
      name: patches.name,
      cyclesUntil: lastDayOfMonth(
        addMonths(patchStart, patchDates.monthsPlanned),
      ),
      patterns: [
        {
          key: patches.patterns[0],
          startsOn: patchStart,
          length: patchDates.weeks,
          unit: "weeks",
          naming: "P{YY}.{N}",
        },
      ],
      releases: [
        {
          key: patches.releases[0],
          name: patchName(1),
          firstCycle: cycle(1),
          lastCycle: cycle(1),
        },
        {
          key: patches.releases[1],
          name: patchName(3),
          firstCycle: cycle(2),
          lastCycle: cycle(3),
          colour: "orange",
          note: "Holds the fixes found in `Harbor 2` testing. Nothing new ships in it.",
        },
      ],
    },
  ];
}

export const streamId = (stream: { name: string }) =>
  fictionalId(`release-stream:${stream.name}`);
const patternId = (stream: { name: string }, key: string) =>
  fictionalId(`cycle-pattern:${stream.name}:${key}`);
const releaseId = (stream: { name: string }, key: string) =>
  fictionalId(`release:${stream.name}:${key}`);

// Adds each stream that is not already there, as one seeded before or one of the same name added by
// hand. Returns whether it added any.
export async function seedReleases(
  database: Database,
  today: string,
): Promise<boolean> {
  return database.transaction(async (transaction) => {
    const present = await transaction
      .select({ id: releaseStreams.id, name: releaseStreams.name })
      .from(releaseStreams);
    const missing = seededStreams(today).filter(
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
    const made: SeededChange[] = [];
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
      for (const { key, ...pattern } of stream.patterns) {
        const row = { streamId: id, ...pattern };
        const recordId = patternId(stream, key);
        await transaction
          .insert(cyclePatterns)
          .values({ id: recordId, ...row });
        made.push(...recorded("cycle-pattern", recordId, "created", row));
      }
      for (const { key, ...release } of stream.releases) {
        const row = { streamId: id, ...release };
        const recordId = releaseId(stream, key);
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
          and(
            eq(table.recordType, "feature"),
            inArray(sql`${table.fields}->>'targetStreamId'`, [...streamIds]),
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
    const made: SeededChange[] = [];
    for (const stream of seededKeys) {
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
        ...stream.patterns.map((key) => patternId(stream, key)),
        ...stream.releases.map((key) => releaseId(stream, key)),
      ]);
      const own = [...patternRows, ...releaseRows].map((record) => record.id);
      const targeting = await transaction
        .select({ id: features.id })
        .from(features)
        .where(eq(features.targetStreamId, id))
        .limit(1);
      // A stream kept keeps every draft of it and its records, which may be people's own.
      if (
        own.some((recordId) => !seeded.has(recordId)) ||
        targeting.length > 0
      ) {
        kept.push(
          `The ${row.name} release stream, which has releases, cycles, or features added by hand`,
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
