// SPDX-License-Identifier: Apache-2.0

// Tests for seeding a database with the fictional organization and removing it again, against a
// migrated PostgreSQL server: what is added and recorded, that seeding twice adds nothing more, that
// removing keeps what was added by hand and what it still uses, and the command that runs both.

import {
  changes,
  changeSets,
  columnOrders,
  createDatabase,
  drafts,
  createPool,
  type Database,
  fields,
  fieldValues,
  listItems,
  lists,
  people,
  recordChanges,
  runMigrations,
  users,
} from "@fathom/db";
import { fictionalOrganization } from "@fathom/fixtures";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { personaAccounts } from "./accounts.ts";
import { actorFor } from "@fathom/server/access";
import { createDataAccess } from "@fathom/server/data";
import { columnRejection, listRejection } from "./list-drafts.ts";
import { rejection, seedDrafts, unseedDrafts } from "./drafts.ts";
import { seed, seedCommand, unseed } from "./seed.ts";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;
let folder: string;

beforeAll(async () => {
  database = await startTestDatabase();
  await runMigrations(database.migrator);
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
  folder = mkdtempSync(join(tmpdir(), "fathom-seed-"));
});

afterAll(async () => {
  await pool.end();
  await database.container.stop();
  rmSync(folder, { recursive: true, force: true });
});

const organization = fictionalOrganization({ size: 20 });

// A session secret and an account password used only by tests.
const sessionSecret = "fictional-session-secret-for-tests-only-0123456789";
const accountPassword = "fictional-seed-password";

async function totalOf(table: typeof people | typeof lists | typeof fields) {
  const [row] = await connection.select({ total: count() }).from(table);
  return row?.total;
}

describe("seeding", () => {
  it("adds the lists, columns, and people, recorded as made by Fathom itself, and adds nothing the second time", async () => {
    expect(await seed(connection, organization)).toBe(true);
    expect(await totalOf(people)).toBe(20);
    expect(await totalOf(lists)).toBe(6);
    expect(await totalOf(fields)).toBe(4);
    const [order] = await connection.select().from(columnOrders);
    expect(order?.keys.slice(0, 3)).toEqual([
      "preferredName",
      "employeeId",
      organization.columns[0]?.id,
    ]);
    const recorded = await connection
      .select({ total: count() })
      .from(changes)
      .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
      .where(isNull(changeSets.madeBy));
    expect(recorded[0]?.total).toBeGreaterThan(80);
    const [person] = organization.people;
    const history = await connection
      .select({ field: changes.field, tier: changes.tier })
      .from(changes)
      .where(eq(changes.recordId, String(person?.id)));
    expect(history).toContainEqual({ field: "startDate", tier: "restricted" });
    expect(await seed(connection, organization)).toBe(false);
    expect(await totalOf(people)).toBe(20);
  });

  it("removes only what seeding added, keeping a column and list that people added by hand use", async () => {
    const [site] = organization.columns;
    const [sites, positions] = organization.lists;
    await connection.insert(people).values({
      id: "00000000-0000-4000-8000-000000000001",
      preferredName: "Fictional Hand Entry",
      employeeId: "H-1",
    });
    await connection.insert(fieldValues).values({
      fieldId: String(site?.id),
      personId: "00000000-0000-4000-8000-000000000001",
      choiceId: String(sites?.choices[0]?.id),
    });
    await connection.insert(listItems).values({
      listId: String(positions?.id),
      label: "Fictional Hand Choice",
    });
    const kept = await unseed(connection, organization);
    expect(kept).toEqual([
      "The Site column, which people added by hand have values in, live or in drafts",
      "The Sites list, which a column uses",
      "The Positions list, which has choices added by hand",
    ]);
    expect(await totalOf(people)).toBe(1);
    expect(await totalOf(fields)).toBe(1);
    expect(await totalOf(lists)).toBe(2);
    expect(await unseed(connection, organization)).toEqual(kept);
  });

  it("puts seeded columns right after Employee ID in a stored order, once each, when seeding again", async () => {
    await connection.delete(people);
    await connection.delete(fields);
    await connection.delete(lists);
    await connection.delete(columnOrders);
    await connection.insert(columnOrders).values({
      tableName: "people",
      keys: ["employeeId", "preferredName", "startDate", "endDate"],
    });
    const seeded = [
      "employeeId",
      ...organization.columns.map(({ id }) => id),
      "preferredName",
      "startDate",
      "endDate",
    ];
    await seed(connection, organization);
    expect(await unseed(connection, organization)).toEqual([]);
    await seed(connection, organization);
    const [order] = await connection.select().from(columnOrders);
    expect(order?.keys).toEqual(seeded);
    expect(await unseed(connection, organization)).toEqual([]);
    expect(await totalOf(people)).toBe(0);
  });
});

describe("seed drafts", () => {
  it("need the personas' accounts, and are discarded only when there are some", async () => {
    await expect(seedDrafts(connection, organization)).rejects.toThrow(
      /^The account engineering\.operations\.manager@fathom\.test is missing/,
    );
    expect(await unseedDrafts(connection, organization)).toBe(0);
  });
});

describe("the seed command", () => {
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

  it("seeds, says when it already has, and unseeds", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await seedCommand(["seed"], environment())).toBe(0);
    const made = await connection.select().from(drafts);
    // Of people, then of lists: a site renamed and described by two people, a role retired, Roles on
    // the team renamed, Languages retired, the Sites, Levels, and Positions orders, and a Positions
    // description; the Skills list, its two choices, and Harbourside added; and a person, an unused
    // position, and the Certifications list removed.
    expect(made.map(({ action }) => action).sort()).toEqual([
      ...Array<string>(13).fill("changed"),
      ...Array<string>(7).fill("created"),
      ...Array<string>(4).fill("deleted"),
    ]);
    expect(
      made
        .filter(({ state }) => state === "rejected")
        .map(({ reason }) => reason)
        .sort(),
    ).toEqual(
      [
        columnRejection,
        listRejection,
        listRejection,
        listRejection,
        rejection,
        rejection,
      ].sort(),
    );
    expect(await seedCommand(["seed"], environment())).toBe(0);
    expect(await totalOf(people)).toBe(150);
    expect(await connection.select().from(drafts)).toHaveLength(24);
    // Seeding again after the Approver approves the waiting drafts makes none again, and leaves
    // alone a draft made by hand of another seeded person, which removing the seed data discards,
    // since it removes that person.
    const waiting = await connection
      .select({ id: drafts.recordId })
      .from(drafts)
      .where(and(eq(drafts.state, "waiting"), eq(drafts.recordType, "person")));
    const [director] = await connection
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, "engineering.director@fathom.test"));
    await createDataAccess(connection).drafts.approve(
      actorFor(director as { id: string; name: string; email: string }, [
        "approver",
        "leadership",
      ]),
      {
        people: waiting.map(({ id }) => id),
        lists: [],
        choices: [],
        orders: [],
      },
    );
    const seeded = fictionalOrganization({ size: 150 });
    await connection.insert(drafts).values({
      recordType: "person",
      recordId: String(seeded.people[10]?.id),
      action: "changed",
      fields: { preferredName: "Fictional Hand Draft" },
    });
    await recordChanges(connection, director?.id ?? null, [
      {
        recordType: "person",
        recordId: String(seeded.people[10]?.id),
        action: "changed",
        field: "preferredName",
        tier: "general",
        oldValue: seeded.people[10]?.preferredName,
        newValue: "Fictional Hand Draft",
        draft: true,
      },
    ]);
    expect(await seedCommand(["seed"], environment())).toBe(0);
    // The two rejected drafts of people, the one made by hand, the fourteen of lists, and the four
    // of columns.
    expect(await connection.select().from(drafts)).toHaveLength(21);
    const positions = fictionalOrganization({ size: 1 }).lists[1];
    await connection.insert(listItems).values({
      listId: String(positions?.id),
      label: "Fictional Hand Choice",
    });
    // A column drafted by hand on the list kept is not the seed's, so is left alone.
    const handColumn = {
      recordType: "field",
      recordId: "00000000-0000-4000-8000-0000000000c1",
      action: "created",
      fields: {
        tableName: "people",
        name: "Fictional Hand Column",
        listId: String(positions?.id),
        multiple: false,
        required: false,
      },
    };
    await connection.insert(drafts).values(handColumn);
    // The newcomer approved is no longer seed data, so is removed by hand first.
    await connection
      .delete(people)
      .where(eq(people.employeeId, String(seeded.newcomers[0]?.employeeId)));
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    const addresses = personaAccounts.map(({ email }) => email);
    expect(log.mock.calls.map(([line]) => line as string)).toEqual([
      "Added 150 fictional people, with their lists and columns",
      ...addresses.map((email) => `Account ready: ${email}`),
      "Added drafts made by the personas",
      "Added drafts of lists and columns made by the personas",
      "The fictional data is already in the database",
      "The fictional data is already in the database",
      "Discarded 16 drafts of lists and columns made by the personas",
      "Discarded 3 drafts made by the personas",
      "Removed the fictional data",
      "Kept: The Positions list, which has choices added by hand",
      ...addresses.map((email) => `Deactivated the account ${email}`),
    ]);
    expect(
      await connection
        .select({ recordId: drafts.recordId })
        .from(drafts)
        .where(eq(drafts.recordType, "field")),
    ).toEqual([{ recordId: handColumn.recordId }]);
    await connection
      .delete(drafts)
      .where(eq(drafts.recordId, handColumn.recordId));
    // With nothing left to discard, unseeding again says nothing of drafts.
    log.mockClear();
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    expect(log.mock.calls.map(([line]) => line as string)).not.toContainEqual(
      expect.stringMatching(/^Discarded/),
    );
    log.mockRestore();
  });

  it("makes every draft anew when the seed data is removed and added again", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const ofLists = () =>
      connection
        .select()
        .from(drafts)
        .where(
          inArray(drafts.recordType, [
            "list",
            "list-item",
            "choice-order",
            "field",
            "column-order",
          ]),
        );
    // The Positions list kept by the test before, for the choice added to it by hand.
    await connection
      .delete(listItems)
      .where(eq(listItems.label, "Fictional Hand Choice"));
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    expect(await seedCommand(["seed"], environment())).toBe(0);
    expect(await ofLists()).toHaveLength(18);
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    expect(await ofLists()).toHaveLength(0);
    expect(await seedCommand(["seed"], environment())).toBe(0);
    expect(await ofLists()).toHaveLength(18);
    expect(await seedCommand(["unseed"], environment())).toBe(0);
    log.mockRestore();
  });

  it("stops before adding anything when sign-in settings or the accounts' password are missing or unusable", async () => {
    const problems = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    writeFileSync(join(folder, "short"), "too-short\n");
    for (const changed of [
      { FATHOM_PUBLIC_URL: undefined },
      { FATHOM_SEED_PASSWORD_FILE: join(folder, "short") },
    ]) {
      expect(
        await seedCommand(["seed"], { ...environment(), ...changed }),
      ).toBe(1);
    }
    expect(await totalOf(people)).toBe(0);
    expect(problems.mock.calls.map(([line]) => line as string)).toEqual([
      expect.stringMatching(/^error: Invalid server configuration: /),
      "error: The file FATHOM_SEED_PASSWORD_FILE names must hold a password of 12 to 128 characters",
    ]);
    vi.restoreAllMocks();
  });

  it("says what went wrong: a wrong command, missing settings, or data in the way", async () => {
    const problems = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await seedCommand(["grow"], environment())).toBe(1);
    expect(await seedCommand(["seed"], {})).toBe(1);
    const withoutPassword = {
      ...environment(),
      FATHOM_SEED_PASSWORD_FILE: undefined,
    };
    expect(await seedCommand(["seed"], withoutPassword)).toBe(1);
    expect(await totalOf(people)).toBe(0);
    await connection.insert(lists).values({ name: "Sites" });
    expect(await seedCommand(["seed"], environment())).toBe(1);
    expect(problems.mock.calls.map(([line]) => line as string)).toEqual([
      "error: Usage: seed.ts seed | unseed",
      expect.stringMatching(/^error: /),
      "error: FATHOM_SEED_PASSWORD_FILE is not set",
      "error: A list, column, or Employee ID in the fictional data is already used by something added by hand; rename that, then try again",
    ]);
    vi.restoreAllMocks();
  });
});
