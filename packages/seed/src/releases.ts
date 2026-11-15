// SPDX-License-Identifier: Apache-2.0

// The fictional organization's release streams, added live and dated from the day they are added:
// Platform, in quarters and then halves, with three releases, Patches, in four-week cycles, with
// two, and Field Apps, in six-month cycles, with three, each recorded in the change history as made
// by Fathom itself. Removing them first discards every draft, published or not, of their records or
// of records drafted to be added to them, and keeps a stream that has a live pattern or release
// added by hand. A development-only package, never included in the runtime image.

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
import { fieldAppsKeys, fieldAppsStream } from "./field-apps.ts";
import { recorded, type SeededChange } from "./recorded.ts";

// Harbor 3's plan, a few pages long, so a long note shows on Releases.
const harborThreePlan = [
  "## What Harbor 3 is for",
  "",
  "Harbor 3 is the release that makes the platform easier to run for the teams that build on it. Most of its work is out of sight: faster builds, clearer errors, and fewer steps to put a change live. A few changes are visible to every user, and those are listed first so support can prepare.",
  "",
  "### Changes users will see",
  "",
  "- A clearer sign-in page, with the reason shown when signing in fails",
  "- Search that finds records by any word in them, ignoring accents",
  "- Exports that keep the columns and order the table shows",
  "- Notifications that say what changed, not only that something did",
  "",
  "### Changes for the teams building on the platform",
  "",
  "- Builds that reuse what has not changed, about a third faster",
  "- Errors that name the setting at fault and how to fix it",
  "- One command to start every service on a laptop",
  "- Test data that is the same on every machine",
  "- Logs that leave out personal details by default",
  "",
  "## Scope",
  "",
  "The scope was agreed at planning and is frozen at the end of the first cycle. Anything that misses the freeze moves to Harbor 4, unless the release lead agrees it is small and safe. Each item below has a named owner in the tracker.",
  "",
  "- [x] Agree the scope with every team that builds on the platform",
  "- [x] Write the upgrade notes for the build changes",
  "- [ ] Freeze the scope at the end of the first cycle",
  "- [ ] Agree the support plan for the first two weeks",
  "- [ ] Confirm the date with the teams that ship on top of it",
  "",
  "### Out of scope",
  "",
  "- A new design for the settings pages, which waits for research",
  "- Moving the old reports, which need their own release",
  "- Anything that changes how accounts are made",
  "",
  "## Risks",
  "",
  "**The build changes touch every team.** A mistake there slows everyone. The changes are behind a switch for the first cycle, so any team can go back to the old build in a minute while the problem is fixed.",
  "",
  "**Search is slower on the largest tables.** Early tests show a slight delay on tables of many thousands of rows. The team is trying two fixes and will choose one by the middle of the second cycle.",
  "",
  "**Translations may be late.** The new words on the sign-in page and in notifications need translating. If they are not ready a week before the release, the release ships with the old words in those languages and the new ones follow in a patch.",
  "",
  "## Testing",
  "",
  "Every change has its automated tests, written with the change. On top of those, the release is checked by hand in the last week, following the manual tests for each page it changes. Each team checks its own pages, and the release lead checks the pages nobody owns.",
  "",
  "- [ ] Run the manual tests for sign-in, search and exports",
  "- [ ] Check every page in dark mode",
  "- [ ] Check the upgrade notes on a copy of last month's data",
  "- [ ] Try the switch back to the old build on a test machine",
  "",
  "## Upgrade notes",
  "",
  "Most teams need do nothing to take Harbor 3. Three changes need a few minutes' work, and each is described below with the steps to take. The steps are the same on every team's services.",
  "",
  "### The faster build",
  "",
  "The build now reuses what has not changed since the last one. It keeps what it reuses in a folder beside the code, which should not be committed. Add the folder to the list of files version control ignores, then build once from clean to fill it.",
  "",
  "- [ ] Add the build's folder to the ignored files",
  "- [ ] Build once from clean on every machine that builds",
  "",
  "### Clearer settings",
  "",
  "Settings are now checked when a service starts, and a service with a setting it does not know stops with an error naming it. Before taking Harbor 3, start each service once on a test machine and fix any setting it names; most are old ones no longer used.",
  "",
  "### Logs without personal details",
  "",
  "Logs now leave out names, email addresses and other personal details unless a service asks for them by name. A team that relied on them in its logs should use the record's identifier instead, which is always kept.",
  "",
  "## Who to ask",
  "",
  "- **The release as a whole:** the release lead, in the platform channel",
  "- **The build:** the build team, who hold a drop-in every Tuesday",
  "- **Search:** the search team, through their issue board",
  "- **Support's plan:** the support lead, before the freeze",
  "",
  "## Release day",
  "",
  "The release goes out on the morning of its ship day, so the whole day is there to watch it. The release lead posts in the platform channel when it starts and when it is done, and the support team is told an hour before.",
  "",
  "- Announce the start in the platform channel",
  "- Release to the test environment and run the quick checks",
  "- Release to everyone in three steps, an hour apart",
  "- Watch the dashboards for the rest of the day",
  "- Post the release notes and close the release in the tracker",
  "",
  "## After the release",
  "",
  "Two weeks after it ships, the teams meet for half an hour to look back: what went well, what to change for Harbor 4, and anything still waiting. The notes from that meeting are added here.",
].join("\n");

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
    // A Ships on day of its own, rather than its last cycle's end.
    shipsOn?: string;
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
  fieldAppsKeys,
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
// cycles to come, each named after the month it ships in; and Field Apps, as its module sets out.
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
          note: harborThreePlan,
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
    fieldAppsStream(today),
  ];
}

export const streamId = (stream: { name: string }) =>
  fictionalId(`release-stream:${stream.name}`);
const patternId = (stream: { name: string }, key: string) =>
  fictionalId(`cycle-pattern:${stream.name}:${key}`);
export const releaseId = (stream: { name: string }, key: string) =>
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
