// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional release streams, against a PostgreSQL server of their own: seeding them
// once, recorded as made by Fathom itself, with releases that keep the rules for cycles, and
// removing only what seeding added.

import {
  activities,
  changes,
  changeSets,
  createDatabase,
  createPool,
  cyclePatterns,
  type Database,
  drafts,
  listItems,
  lists,
  releases,
  releaseStreams,
} from "@fathom/db";
import { actorFor } from "@fathom/server/access";
import { cyclesOf, horizonFrom, noteProblem } from "@fathom/shared";
import { createDataAccess } from "@fathom/server/data";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fieldAppsKeys } from "./field-apps.ts";
import {
  seededKeys,
  seededStreams,
  seedReleases,
  unseedReleases,
} from "./releases.ts";

// The day the tests seed on, which the streams are dated from, as they are from today when seeded.
const today = "2026-11-07";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;

beforeAll(async () => {
  database = await startTestDatabase();
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
});

afterEach(async () => {
  await connection.delete(drafts);
  await connection.delete(activities);
  await connection.delete(releases);
  await connection.delete(cyclePatterns);
  await connection.delete(releaseStreams);
});

afterAll(async () => {
  await pool.end();
  await database.remove();
});

const streamNames = async () =>
  (await connection.select({ name: releaseStreams.name }).from(releaseStreams))
    .map(({ name }) => name)
    .sort();

describe("seeding release streams", () => {
  it("adds the streams, their patterns, and their releases once, recorded as made by Fathom itself", async () => {
    expect(await seedReleases(connection, today)).toBe(true);
    expect(await seedReleases(connection, today)).toBe(false);
    expect(await streamNames()).toEqual(["Field Apps", "Patches", "Platform"]);
    const made = await connection
      .select({ recordType: changes.recordType })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(isNull(changeSets.madeBy));
    expect(new Set(made.map(({ recordType }) => recordType))).toEqual(
      new Set(["release-stream", "cycle-pattern", "release"]),
    );
  });

  it("gives releases that start and end with cycles of their streams", async () => {
    await seedReleases(connection, today);
    const viewer = actorFor(
      { id: randomUUID(), name: "", email: "" },
      "team-member",
    );
    const { streams } =
      await createDataAccess(connection).releases.read(viewer);
    for (const stream of streams) {
      const starts = new Set(stream.cycles.map(({ startsOn }) => startsOn));
      for (const release of stream.releases) {
        expect([
          starts.has(release.firstCycle),
          starts.has(release.lastCycle),
        ]).toEqual([true, true]);
      }
    }
    expect(streams.flatMap(({ releases: found }) => found)).toHaveLength(
      seededStreams(today).flatMap(({ releases: seeded }) => seeded).length,
    );
  });

  it("gives notes that notes allow, kept as written", async () => {
    await seedReleases(connection, today);
    const seeded = seededStreams(today).flatMap(({ releases: found }) =>
      found.flatMap(({ note }) => (note === undefined ? [] : [note])),
    );
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.map(noteProblem)).toEqual(seeded.map(() => undefined));
    const kept = await connection
      .select({ note: releases.note })
      .from(releases);
    expect(
      kept.flatMap(({ note }) => (note === null ? [] : [note])).sort(),
    ).toEqual([...seeded].sort());
  });
});

describe("the streams as dated from a day", () => {
  // Days through a year, with the ends and starts of months, quarters and years, a leap day, and
  // each day of a week.
  const days = [
    "2026-11-07",
    "2026-11-08",
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-12-31",
    "2027-01-01",
    "2027-01-31",
    "2027-02-28",
    "2027-03-31",
    "2027-04-01",
    "2027-06-30",
    "2027-09-30",
    "2027-10-01",
    "2028-02-29",
  ];

  // Each release with the days its first cycle starts and its last cycle ends, by key, each cycle
  // one its stream makes.
  function placed(on: string) {
    return new Map(
      seededStreams(on).flatMap((stream) => {
        const cycles = cyclesOf(stream.patterns, horizonFrom(on));
        return stream.releases.map(({ key, name, firstCycle, lastCycle }) => {
          const first = cycles.find(({ startsOn }) => startsOn === firstCycle);
          const last = cycles.find(({ startsOn }) => startsOn === lastCycle);
          expect([first, last]).not.toContain(undefined);
          return [
            key,
            {
              name,
              starts: String(first?.startsOn),
              ends: String(last?.endsOn),
            },
          ] as const;
        });
      }),
    );
  }

  it.each(days)("on %s, keep the names and keys removing them reads", (on) => {
    expect(
      seededStreams(on).map(({ name, patterns, releases: made }) => ({
        name,
        patterns: patterns.map(({ key }) => key),
        releases: made.map(({ key }) => key),
      })),
    ).toEqual(seededKeys);
  });

  it.each(days)(
    "on %s, start and end each release with its stream's cycles, in order, with none shared",
    (on) => {
      for (const stream of seededStreams(on)) {
        const cycles = cyclesOf(stream.patterns, horizonFrom(on));
        let after = -1;
        for (const { firstCycle, lastCycle } of stream.releases) {
          const first = cycles.findIndex(
            ({ startsOn }) => startsOn === firstCycle,
          );
          const last = cycles.findIndex(
            ({ startsOn }) => startsOn === lastCycle,
          );
          expect(first).toBeGreaterThan(after);
          expect(first).toBeGreaterThanOrEqual(0);
          expect(last).toBeGreaterThanOrEqual(first);
          after = last;
        }
      }
    },
  );

  it.each(days)(
    "on %s, give each stream a release that has shipped and one under way, and Platform and Field Apps one to come",
    (on) => {
      const releases = placed(on);
      const shipped = (key: string) => String(releases.get(key)?.ends) < on;
      const underWay = (key: string) =>
        String(releases.get(key)?.starts) <= on &&
        on <= String(releases.get(key)?.ends);
      expect([
        shipped("harbor-1"),
        underWay("harbor-2"),
        String(releases.get("harbor-3")?.starts) > on,
        shipped("patch-1"),
        underWay("patch-2"),
        shipped("lantern-1"),
        underWay("lantern-2"),
        String(releases.get("lantern-3")?.starts) > on,
      ]).toEqual([true, true, true, true, true, true, true, true]);
    },
  );

  it.each(days)(
    "on %s, ship Lantern 2 after its cycle ends and leave the next cycle in no release",
    (on) => {
      const fieldApps = seededStreams(on).find(
        ({ name }) => name === fieldAppsKeys.name,
      );
      const [, current, coming] = fieldApps?.releases ?? [];
      const cycles = cyclesOf(fieldApps?.patterns ?? [], horizonFrom(on));
      const ofCurrent = cycles.find(
        ({ startsOn }) => startsOn === current?.lastCycle,
      );
      const next = cycles.at(
        cycles.findIndex(({ startsOn }) => startsOn === current?.lastCycle) + 1,
      );
      expect(String(current?.shipsOn) > String(ofCurrent?.endsOn)).toBe(true);
      expect(String(next?.startsOn) < String(coming?.firstCycle)).toBe(true);
    },
  );

  it("names each patch release after the month it ships in", () => {
    const releases = placed(today);
    expect([
      releases.get("patch-1")?.name,
      releases.get("patch-2")?.name,
    ]).toEqual(["Patch November", "Patch December"]);
  });
});

describe("removing release streams", () => {
  it("removes what seeding added", async () => {
    await seedReleases(connection, today);
    expect(await unseedReleases(connection)).toEqual([]);
    expect(await streamNames()).toEqual([]);
  });

  it("does nothing when there is nothing seeded", async () => {
    expect(await unseedReleases(connection)).toEqual([]);
  });

  it("keeps a stream with a release added by hand", async () => {
    await seedReleases(connection, today);
    const [platform] = await connection
      .select({ id: releaseStreams.id })
      .from(releaseStreams)
      .where(eq(releaseStreams.name, "Platform"));
    await connection.insert(releases).values({
      streamId: String(platform?.id),
      name: "Fictional By Hand",
      firstCycle: "2027-07-01",
      lastCycle: "2027-07-01",
    });
    expect(await unseedReleases(connection)).toEqual([
      "The Platform schedule, which has releases, cycles, features, or activities added by hand",
    ]);
    expect(await streamNames()).toEqual(["Platform"]);
  });

  it("keeps a stream with a release that has an activity added by hand", async () => {
    await seedReleases(connection, today);
    const [harbor] = await connection
      .select({ id: releases.id })
      .from(releases)
      .where(eq(releases.name, "Harbor 1"));
    const [status] = await connection
      .select({ id: listItems.id })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(eq(lists.builtIn, "feature-statuses"))
      .limit(1);
    await connection.insert(activities).values({
      releaseId: String(harbor?.id),
      name: "Fictional By Hand",
      statusId: String(status?.id),
    });
    expect(await unseedReleases(connection)).toEqual([
      "The Platform schedule, which has releases, cycles, features, or activities added by hand",
    ]);
    expect(await streamNames()).toContain("Platform");
  });

  it("discards the drafts of a stream's records and of records drafted to be added to it", async () => {
    await seedReleases(connection, today);
    const [patches] = await connection
      .select({ id: releaseStreams.id })
      .from(releaseStreams)
      .where(inArray(releaseStreams.name, ["Patches"]));
    await connection.insert(drafts).values({
      recordType: "release",
      recordId: randomUUID(),
      action: "created",
      fields: { streamId: String(patches?.id), name: "Fictional Drafted" },
    });
    await connection.insert(drafts).values({
      recordType: "release-stream",
      recordId: String(patches?.id),
      action: "changed",
      fields: { name: "Fictional Renamed" },
    });
    expect(await unseedReleases(connection)).toEqual([]);
    expect(await connection.select().from(drafts)).toEqual([]);
    expect(await streamNames()).toEqual([]);
  });

  it("discards the drafts of activities drafted to be added to a release it removes", async () => {
    await seedReleases(connection, today);
    const [harbor] = await connection
      .select({ id: releases.id })
      .from(releases)
      .where(eq(releases.name, "Harbor 1"));
    await connection.insert(drafts).values({
      recordType: "activity",
      recordId: randomUUID(),
      action: "created",
      fields: { releaseId: String(harbor?.id), name: "Fictional Drafted" },
    });
    await connection.insert(drafts).values({
      recordType: "activity",
      recordId: randomUUID(),
      action: "created",
      fields: { releaseId: randomUUID(), name: "Fictional Elsewhere" },
    });
    expect(await unseedReleases(connection)).toEqual([]);
    expect(
      (await connection.select().from(drafts)).map(({ fields }) => fields),
    ).toEqual([expect.objectContaining({ name: "Fictional Elsewhere" })]);
  });

  it("keeps the drafts of a stream it keeps", async () => {
    await seedReleases(connection, today);
    const [platform] = await connection
      .select({ id: releaseStreams.id })
      .from(releaseStreams)
      .where(eq(releaseStreams.name, "Platform"));
    await connection.insert(releases).values({
      streamId: String(platform?.id),
      name: "Fictional By Hand",
      firstCycle: "2027-07-01",
      lastCycle: "2027-07-01",
    });
    await connection.insert(drafts).values({
      recordType: "release-stream",
      recordId: String(platform?.id),
      action: "changed",
      fields: { name: "Fictional Kept Name" },
    });
    await unseedReleases(connection);
    expect(
      (await connection.select().from(drafts)).map(({ fields }) => fields),
    ).toEqual([{ name: "Fictional Kept Name" }]);
  });

  it("leaves drafts of other kinds that name a seeded stream in their fields", async () => {
    await seedReleases(connection, today);
    const [patches] = await connection
      .select({ id: releaseStreams.id })
      .from(releaseStreams)
      .where(eq(releaseStreams.name, "Patches"));
    await connection.insert(drafts).values({
      recordType: "list",
      recordId: randomUUID(),
      action: "created",
      fields: { streamId: String(patches?.id), name: "Fictional List" },
    });
    await unseedReleases(connection);
    expect(await connection.select().from(drafts)).toHaveLength(1);
  });

  it("seeding again adds back a seeded stream that was removed, leaving the one kept", async () => {
    await seedReleases(connection, today);
    const [platform] = await connection
      .select({ id: releaseStreams.id })
      .from(releaseStreams)
      .where(eq(releaseStreams.name, "Platform"));
    await connection.insert(releases).values({
      streamId: String(platform?.id),
      name: "Fictional By Hand",
      firstCycle: "2027-07-01",
      lastCycle: "2027-07-01",
    });
    await unseedReleases(connection);
    expect([
      await seedReleases(connection, today),
      await streamNames(),
    ]).toEqual([true, ["Field Apps", "Patches", "Platform"]]);
  });

  it("does not seed a stream whose name a stream added by hand has", async () => {
    await connection.insert(releaseStreams).values({ name: "patches" });
    await seedReleases(connection, today);
    expect(await streamNames()).toEqual(["Field Apps", "Platform", "patches"]);
  });
});
