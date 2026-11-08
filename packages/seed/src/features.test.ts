// SPDX-License-Identifier: Apache-2.0

// Tests for the fictional features, against a PostgreSQL server of their own: seeding them once,
// recorded as made by Fathom itself, across a release stream's cycles with some in Later, and
// removing them with their drafts, leaving features added by hand.

import {
  changes,
  changeSets,
  createDatabase,
  createPool,
  type Database,
  drafts,
  featureTeams,
  features,
  releaseStreams,
  runMigrations,
} from "@fathom/db";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  featureId,
  seededFeatures,
  seedFeatures,
  unseedFeatures,
} from "./features.ts";
import { seedReleases, unseedReleases } from "./releases.ts";

const today = "2026-11-08";

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
  await connection.delete(features);
  await connection.delete(featureTeams);
  await unseedReleases(connection);
});

afterAll(async () => {
  await pool.end();
  await database.container.stop();
});

const addTeam = async () => {
  const id = randomUUID();
  await connection
    .insert(featureTeams)
    .values({ id, name: `Fictional Team ${id}` });
  return id;
};

const addHandFeature = async (featureTeamId: string | null = null) => {
  const id = randomUUID();
  await connection
    .insert(features)
    .values({ id, name: `Fictional Hand ${id}`, featureTeamId });
  return id;
};

const everyFeature = () => connection.select().from(features);

describe("seeding features", () => {
  it("adds them once, recorded as made by Fathom itself", async () => {
    await seedReleases(connection, today);
    expect(await seedFeatures(connection, today, [])).toBe(true);
    expect(await seedFeatures(connection, today, [])).toBe(false);
    expect(await everyFeature()).toHaveLength(seededFeatures.length);
    const made = await connection
      .select({ recordId: changes.recordId })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(isNull(changeSets.madeBy));
    expect(made.map(({ recordId }) => recordId)).toContain(
      featureId("offline-sync"),
    );
  });

  it("adds none without the release stream they target", async () => {
    expect(await seedFeatures(connection, today, [])).toBe(false);
    expect(await everyFeature()).toEqual([]);
  });

  it("spreads them across several cycles, with some in Later", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const found = await everyFeature();
    expect(
      new Set(found.flatMap(({ targetCycle }) => targetCycle ?? [])).size,
    ).toBeGreaterThan(2);
    expect(
      found.filter(({ targetCycle }) => targetCycle === null),
    ).toHaveLength(seededFeatures.filter(({ cycle }) => cycle === null).length);
  });

  it("targets the cycle the seed day falls in for work in progress", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    const [inProgress] = await connection
      .select()
      .from(features)
      .where(eq(features.id, featureId("offline-sync")));
    expect(inProgress?.targetCycle).toBe("2026-10-01");
  });

  it("uses every status a feature can have", async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
    expect(new Set((await everyFeature()).map(({ status }) => status))).toEqual(
      new Set(["possible", "planned", "in-progress", "done", "cancelled"]),
    );
  });

  it("gives features the feature teams there are, and none past those", async () => {
    await seedReleases(connection, today);
    const team = await addTeam();
    await seedFeatures(connection, today, [team]);
    const teamed = (await everyFeature()).flatMap(
      ({ featureTeamId }) => featureTeamId ?? [],
    );
    expect(new Set(teamed)).toEqual(new Set([team]));
  });
});

describe("removing features", () => {
  const seeded = async () => {
    await seedReleases(connection, today);
    await seedFeatures(connection, today, []);
  };

  it("removes those seeded, with their drafts, and keeps those added by hand", async () => {
    await seeded();
    const hand = await addHandFeature();
    await connection.insert(drafts).values({
      recordType: "feature",
      recordId: featureId("offline-sync"),
      action: "changed",
      fields: { name: "Fictional Draft" },
    });
    await unseedFeatures(connection, []);
    expect((await everyFeature()).map(({ id }) => id)).toEqual([hand]);
    expect(await connection.select().from(drafts)).toEqual([]);
  });

  it("takes the seeded feature teams off features added by hand and out of drafts", async () => {
    const team = await addTeam();
    const hand = await addHandFeature(team);
    const other = await addHandFeature();
    await connection.insert(drafts).values({
      recordType: "feature",
      recordId: other,
      action: "changed",
      fields: { featureTeamId: team },
    });
    await unseedFeatures(connection, [team]);
    const [kept] = await connection
      .select()
      .from(features)
      .where(eq(features.id, hand));
    expect(kept?.featureTeamId).toBeNull();
    expect(await connection.select().from(drafts)).toEqual([]);
  });

  it("does nothing to feature teams when there are none to remove", async () => {
    const team = await addTeam();
    const hand = await addHandFeature(team);
    await unseedFeatures(connection, []);
    const [kept] = await connection
      .select()
      .from(features)
      .where(eq(features.id, hand));
    expect(kept?.featureTeamId).toBe(team);
  });

  it("leaves a release stream that a feature added by hand targets", async () => {
    await seedReleases(connection, today);
    const [stream] = await connection.select().from(releaseStreams);
    await connection.insert(features).values({
      name: "Fictional Targeting",
      targetStreamId: stream?.id,
      targetCycle: today,
    });
    expect(await unseedReleases(connection)).toEqual([
      expect.stringContaining("added by hand"),
    ]);
    await connection.delete(features);
  });
});
