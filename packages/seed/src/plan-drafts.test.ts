// SPDX-License-Identifier: Apache-2.0

// Tests for the seed's drafts of the plan and feature teams, against a migrated PostgreSQL server:
// what each persona drafts, publishes, holds, and rejects, that seeding again makes none of them
// again, and that removing the seed data discards them, leaving drafts of other records alone.

import {
  createDatabase,
  createPool,
  type Database,
  drafts,
  runMigrations,
  unpublishedDrafts,
  users,
} from "@fathom/db";
import { fictionalOrganization } from "@fathom/fixtures";
import { createDataAccess } from "@fathom/server/data";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { eq, inArray } from "drizzle-orm";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { actorOf, rejection } from "./drafts.ts";
import {
  addedCustomer,
  addedFeature,
  addedMilestone,
  addedRelease,
  draftedFeatureTeamName,
  heldFeatureTeamName,
  heldStreamName,
  present,
  seededDraftTypes,
  seedPlanDrafts,
  seedUnpublishedPlan,
  unseedPlanDrafts,
} from "./plan-drafts.ts";
import { developmentSize, seedCommand } from "./seed.ts";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;
let folder: string;

beforeAll(async () => {
  database = await startTestDatabase();
  await runMigrations(database.migrator);
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
  folder = mkdtempSync(join(tmpdir(), "fathom-plan-drafts-"));
});

afterAll(async () => {
  await pool.end();
  await database.container.stop();
  rmSync(folder, { recursive: true, force: true });
});

// A session secret and an account password used only by tests.
const sessionSecret = "fictional-session-secret-for-tests-only-0123456789";
const accountPassword = "fictional-seed-password";

const environment = () => {
  writeFileSync(join(folder, "password"), database.app.password);
  writeFileSync(join(folder, "secret"), sessionSecret);
  writeFileSync(join(folder, "accounts"), `${accountPassword}\n`);
  return {
    FATHOM_PUBLIC_URL: "https://fathom.example.test",
    FATHOM_AUTH_SECRET_FILE: join(folder, "secret"),
    FATHOM_SEED_PASSWORD_FILE: join(folder, "accounts"),
    FATHOM_DB_HOST: database.app.host,
    FATHOM_DB_PORT: String(database.app.port),
    FATHOM_DB_NAME: database.app.database,
    FATHOM_DB_USER: database.app.user,
    FATHOM_DB_PASSWORD_FILE: join(folder, "password"),
  };
};

const planDrafts = () =>
  connection
    .select({
      recordType: drafts.recordType,
      recordId: drafts.recordId,
      action: drafts.action,
      state: drafts.state,
      reason: drafts.reason,
      fields: drafts.fields,
    })
    .from(drafts)
    .where(inArray(drafts.recordType, [...seededDraftTypes]));

const holders = async () =>
  (
    await connection
      .select({
        recordType: unpublishedDrafts.recordType,
        email: users.email,
      })
      .from(unpublishedDrafts)
      .innerJoin(users, eq(users.id, unpublishedDrafts.userId))
      .where(inArray(unpublishedDrafts.recordType, [...seededDraftTypes]))
  )
    .map(({ recordType, email }) => `${recordType} ${email}`)
    .sort();

describe("the seed's drafts of the plan and feature teams", () => {
  it("make nothing while the records they change are not there", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await seedCommand(["accounts"], environment())).toBe(0);
    const organization = fictionalOrganization({ size: developmentSize });
    expect(await seedPlanDrafts(connection, organization)).toBe(false);
    expect(await seedUnpublishedPlan(connection, organization)).toBe(false);
    expect(await unseedPlanDrafts(connection, organization)).toBe(0);
  });

  it("are drafted, held, and rejected once, and discarded with the seed data", async () => {
    // Given the seed data, with its drafts
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await seedCommand(["seed"], environment())).toBe(0);

    // Then each persona's drafts wait or are rejected, and some changes are left unpublished
    const made = await planDrafts();
    expect(
      made.map(({ recordType, action, state }) =>
        [recordType, action, state].join(" "),
      ),
    ).toEqual(
      expect.arrayContaining([
        "release created waiting",
        "release changed waiting",
        "release changed rejected",
        "release-stream changed waiting",
        "project changed rejected",
        "milestone created waiting",
        "milestone changed waiting",
        "proposal changed waiting",
        "customer created waiting",
        "feature changed waiting",
        "feature created waiting",
        "feature-team changed waiting",
      ]),
    );
    expect(made).toHaveLength(15);
    expect(
      made
        .filter(({ state }) => state === "rejected")
        .map(({ reason }) => reason),
    ).toEqual([rejection, rejection]);
    expect(
      made
        .filter(({ action }) => action === "created")
        .map(({ fields }) => fields.name)
        .sort(),
    ).toEqual(
      [addedCustomer, addedFeature, addedMilestone, addedRelease].sort(),
    );
    expect(
      made.find(({ recordType }) => recordType === "release-stream")?.fields,
    ).toMatchObject({ retired: true });
    expect(
      made
        .filter(({ recordType }) => recordType === "feature-team")
        .map(({ fields }) => fields.name),
    ).toContain(draftedFeatureTeamName);
    expect(await holders()).toEqual([
      "feature project.manager@fathom.test",
      "feature-team engineering.operations.manager.2@fathom.test",
      "release-stream engineering.operations.manager.2@fathom.test",
    ]);
    const data = createDataAccess(connection);
    const approver = await actorOf(
      connection,
      "engineering.director@fathom.test",
    );
    const { streams } = await data.releases.read(approver);
    expect(streams.map(({ name, heldBy }) => [name, heldBy])).toEqual([
      ["Platform", expect.any(String)],
      ["Patches", undefined],
    ]);
    const held = await data.releases.read(
      await actorOf(connection, "engineering.operations.manager.2@fathom.test"),
    );
    expect(held.streams[0]?.name).toBe(heldStreamName);
    const { teams } = await data.featureTeams.read(
      await actorOf(connection, "engineering.operations.manager.2@fathom.test"),
    );
    expect(teams.map(({ name }) => name)).toContain(heldFeatureTeamName);

    // When the seed data is added again
    const organization = fictionalOrganization({ size: developmentSize });

    // Then nothing more is drafted or held
    expect(await seedPlanDrafts(connection, organization)).toBe(false);
    expect(await seedUnpublishedPlan(connection, organization)).toBe(false);
    expect(await planDrafts()).toHaveLength(15);

    // When a draft of another record is made by hand, and the seed's are discarded
    // These are drafts of records the seed never made, which the data access layer would refuse, so
    // they are written directly.
    const handDrafts = [
      {
        recordType: "customer",
        recordId: "00000000-0000-4000-8000-0000000000d1",
        action: "changed",
        fields: { name: "Fictional Hand Customer" },
      },
      {
        recordType: "customer",
        recordId: "00000000-0000-4000-8000-0000000000d2",
        action: "created",
        fields: { name: "Fictional Hand Added" },
      },
    ];
    await connection.insert(drafts).values(handDrafts);
    await data.unpublished.discard(
      await actorOf(connection, "project.manager@fathom.test"),
    );
    await data.unpublished.discard(
      await actorOf(connection, "engineering.operations.manager.2@fathom.test"),
    );
    expect(await unseedPlanDrafts(connection, organization)).toBe(15);

    // Then only the drafts made by hand are left
    expect((await planDrafts()).map(({ recordId }) => recordId).sort()).toEqual(
      handDrafts.map(({ recordId }) => recordId),
    );
    await connection.delete(drafts).where(
      inArray(
        drafts.recordId,
        handDrafts.map(({ recordId }) => recordId),
      ),
    );

    // And removing the seed data says what it discarded, unpublished changes included
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    expect(await seedCommand(["seed"], environment())).toBe(0);
    expect(await planDrafts()).toHaveLength(15);
    log.mockClear();
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    expect(log.mock.calls.map(([line]) => line as string)).toContain(
      "Discarded 15 drafts of releases, projects, features, and feature teams",
    );
    expect(await planDrafts()).toEqual([]);
    expect(await holders()).toEqual([]);
  });
});

describe("a seeded record the drafts need", () => {
  it("is given back when the seed data has it", () => {
    expect(present("Fictional value", "fictional record")).toBe(
      "Fictional value",
    );
  });

  it("stops the seed, naming what is missing, when it has not", () => {
    expect(() => {
      present(undefined, "fictional record");
    }).toThrow("The seed data has no fictional record");
  });
});
