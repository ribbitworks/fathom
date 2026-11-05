// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional release streams, against a PostgreSQL server of their own: seeding them
// once, recorded as made by Fathom itself, with releases that keep the rules for cycles, and
// removing only what seeding added.

import {
  changes,
  changeSets,
  createDatabase,
  createPool,
  cyclePatterns,
  type Database,
  drafts,
  releases,
  releaseStreams,
  runMigrations,
} from "@fathom/db";
import { actorFor } from "@fathom/server/access";
import { createDataAccess } from "@fathom/server/data";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { seededStreams, seedReleases, unseedReleases } from "./releases.ts";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;

beforeAll(async () => {
  database = await startTestDatabase();
  await runMigrations(database.migrator);
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
});

afterEach(async () => {
  await connection.delete(drafts);
  await connection.delete(releases);
  await connection.delete(cyclePatterns);
  await connection.delete(releaseStreams);
});

afterAll(async () => {
  await pool.end();
  await database.container.stop();
});

const streamNames = async () =>
  (await connection.select({ name: releaseStreams.name }).from(releaseStreams))
    .map(({ name }) => name)
    .sort();

describe("seeding release streams", () => {
  it("adds the streams, their patterns, and their releases once, recorded as made by Fathom itself", async () => {
    expect(await seedReleases(connection)).toBe(true);
    expect(await seedReleases(connection)).toBe(false);
    expect(await streamNames()).toEqual(["Patches", "Platform"]);
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
    await seedReleases(connection);
    const viewer = actorFor({ id: randomUUID(), name: "", email: "" }, [
      "viewer",
    ]);
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
      seededStreams.flatMap(({ releases: seeded }) => seeded).length,
    );
  });
});

describe("removing release streams", () => {
  it("removes what seeding added", async () => {
    await seedReleases(connection);
    expect(await unseedReleases(connection)).toEqual([]);
    expect(await streamNames()).toEqual([]);
  });

  it("does nothing when there is nothing seeded", async () => {
    expect(await unseedReleases(connection)).toEqual([]);
  });

  it("keeps a stream with a release added by hand", async () => {
    await seedReleases(connection);
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
      "The Platform release stream, which has releases or cycles added by hand",
    ]);
    expect(await streamNames()).toEqual(["Platform"]);
  });

  it("discards the drafts of a stream's records and of records drafted to be added to it", async () => {
    await seedReleases(connection);
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

  it("keeps the drafts of a stream it keeps", async () => {
    await seedReleases(connection);
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
    await seedReleases(connection);
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
    await seedReleases(connection);
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
    expect([await seedReleases(connection), await streamNames()]).toEqual([
      true,
      ["Patches", "Platform"],
    ]);
  });

  it("does not seed a stream whose name a stream added by hand has", async () => {
    await connection
      .insert(releaseStreams)
      .values({ name: "patches", cyclesUntil: "2028-12-31" });
    await seedReleases(connection);
    expect(await streamNames()).toEqual(["Platform", "patches"]);
  });
});
