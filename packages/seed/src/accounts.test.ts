// SPDX-License-Identifier: Apache-2.0

// Tests for the persona accounts, against a migrated PostgreSQL server: seeding them, removing the
// seed data, and seeding again.

import {
  accessHistory,
  accounts,
  createDatabase,
  createPool,
  type Database,
  lastViews,
  rolePermissions,
  roles as roleTable,
  sessions,
  userRoles,
  users,
} from "@fathom/db";
import { createAccount } from "@fathom/server/accounts";
import { createAuth } from "@fathom/server/auth";
import { findStartingRole } from "@fathom/server/roles";
import { permissionSchema, roleSchema, startingRoles } from "@fathom/shared";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  personaAccounts,
  personaActor,
  seedAccounts,
  superuserRole,
  unseedAccounts,
} from "./accounts.ts";

let database: TestDatabase;
let pool: ReturnType<typeof createPool>;
let connection: Database;
let auth: ReturnType<typeof createAuth>;

// A session secret and an account password used only by tests.
const secret = "fictional-session-secret-for-tests-only-0123456789";
const password = "fictional-seed-password";

// An account added by hand, which removing the seeded accounts leaves alone.
const handMade = {
  name: "Fictional Hand Account",
  email: "hand.account@example.test",
  password,
};

const addresses = personaAccounts.map(({ email }) => email);

beforeAll(async () => {
  database = await startTestDatabase();
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
  auth = createAuth(connection, {
    publicUrl: "https://fathom.example.test",
    secret,
  });
});

afterAll(async () => {
  await pool.end();
  await database.remove();
});

// Each test starts with no accounts but the hand-made one.
beforeEach(async () => {
  await connection.delete(users);
  await connection
    .delete(roleTable)
    .where(eq(roleTable.name, superuserRole.name));
  await createAccount(
    auth,
    connection,
    {
      ...handMade,
      roleId: await findStartingRole(connection, "team-member"),
    },
    null,
  );
});

async function accountsByEmail() {
  return connection
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      deactivatedAt: users.deactivatedAt,
    })
    .from(users)
    .orderBy(asc(users.email));
}

async function idOf(email: string): Promise<string> {
  const [row] = await connection
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  return String(row?.id);
}

async function actionsFor(id: string) {
  return connection
    .select({ action: accessHistory.action, actorId: accessHistory.actorId })
    .from(accessHistory)
    .where(eq(accessHistory.subjectId, id))
    .orderBy(asc(accessHistory.id));
}

describe("the persona accounts", () => {
  it("include a Superuser whose role grants every permission", () => {
    const superuser = personaAccounts.find(({ name }) => name === "Superuser");
    const actor = personaActor(
      { id: "", name: "", email: "" },
      superuser?.role ?? "team-member",
    );
    expect(actor.permissions).toEqual([...permissionSchema.options].sort());
  });

  it("give the Superuser every starting role besides its own default", () => {
    const superuser = personaAccounts.find(({ name }) => name === "Superuser");
    expect(superuser?.role).toBe("superuser");
    expect(superuser?.otherRoles).toEqual(roleSchema.options);
  });

  it("act as their persona's starting role", () => {
    const manager = personaActor(
      { id: "", name: "", email: "" },
      "product-manager",
    );
    expect(manager.permissions).toEqual(
      expect.arrayContaining([...startingRoles["product-manager"].permissions]),
    );
  });
});

describe("seeding the accounts", () => {
  it("creates each, named after its persona, holding its persona's role as its default, and any others", async () => {
    expect(await seedAccounts(auth, connection, password)).toEqual(addresses);
    for (const account of personaAccounts) {
      const id = await idOf(account.email);
      const [row] = await connection
        .select({ name: users.name, deactivatedAt: users.deactivatedAt })
        .from(users)
        .where(eq(users.id, id));
      expect(row).toEqual({ name: account.name, deactivatedAt: null });
      const roles = await connection
        .select({
          key: roleTable.key,
          name: roleTable.name,
          isDefault: userRoles.isDefault,
        })
        .from(userRoles)
        .innerJoin(roleTable, eq(roleTable.id, userRoles.roleId))
        .where(eq(userRoles.userId, id))
        .orderBy(desc(userRoles.isDefault), asc(roleTable.key));
      expect(roles).toEqual([
        account.role === "superuser"
          ? { key: null, name: superuserRole.name, isDefault: true }
          : {
              key: account.role,
              name: expect.any(String) as unknown,
              isDefault: true,
            },
        ...[...(account.otherRoles ?? [])].sort().map((key) => ({
          key,
          name: expect.any(String) as unknown,
          isDefault: false,
        })),
      ]);
    }
  });

  it("makes the Superuser role, granting every permission, only when it is missing", async () => {
    await seedAccounts(auth, connection, password);
    await unseedAccounts(auth, connection);
    await seedAccounts(auth, connection, password, [
      {
        name: "Fictional Second Superuser",
        email: "second.superuser@example.test",
        role: "superuser",
      },
    ]);
    const made = await connection
      .select({ id: roleTable.id, key: roleTable.key })
      .from(roleTable)
      .where(eq(roleTable.name, superuserRole.name));
    expect(made).toEqual([{ id: expect.any(String) as unknown, key: null }]);
    const granted = await connection
      .select({ permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, String(made[0]?.id)));
    expect(granted.map(({ permission }) => permission).sort()).toEqual(
      [...permissionSchema.options].sort(),
    );
  });

  it("gives each the shared password, stored only as a hash", async () => {
    await seedAccounts(auth, connection, password);
    const hashes = await connection
      .select({ hash: accounts.password })
      .from(accounts)
      .innerJoin(users, eq(users.id, accounts.userId))
      .where(inArray(users.email, addresses));
    expect(hashes).toHaveLength(addresses.length);
    const { verify } = (await auth.$context).password;
    for (const { hash } of hashes) {
      expect(hash).not.toBe(password);
      expect(await verify({ hash: String(hash), password })).toBe(true);
    }
  });

  it("asks none of them to change the shared password", async () => {
    await seedAccounts(auth, connection, password);
    const flags = await connection
      .select({ mustChangePassword: users.mustChangePassword })
      .from(users)
      .where(inArray(users.email, addresses));
    expect(flags).toHaveLength(addresses.length);
    expect(flags.every(({ mustChangePassword }) => !mustChangePassword)).toBe(
      true,
    );
  });

  it("records each creation in the access history as done by the server's operators", async () => {
    await seedAccounts(auth, connection, password);
    for (const email of addresses) {
      expect(await actionsFor(await idOf(email))).toEqual([
        { action: "account-created", actorId: null },
      ]);
    }
  });

  it("adds nothing when the accounts are already there", async () => {
    await seedAccounts(auth, connection, password);
    expect(await seedAccounts(auth, connection, password)).toEqual([]);
    expect(await accountsByEmail()).toHaveLength(addresses.length + 1);
  });

  it("reactivates the accounts removed before, recorded as done by the server's operators", async () => {
    await seedAccounts(auth, connection, password);
    await unseedAccounts(auth, connection);
    expect(await seedAccounts(auth, connection, password)).toEqual(addresses);
    const rows = await accountsByEmail();
    expect(rows.every(({ deactivatedAt }) => deactivatedAt === null)).toBe(
      true,
    );
    expect(await actionsFor(await idOf(String(addresses[0])))).toEqual([
      { action: "account-created", actorId: null },
      { action: "account-deactivated", actorId: null },
      { action: "account-reactivated", actorId: null },
    ]);
  });
});

describe("removing the accounts", () => {
  it("deactivates only the seeded accounts, in order, and records it", async () => {
    await seedAccounts(auth, connection, password);
    expect(await unseedAccounts(auth, connection)).toEqual(addresses);
    for (const row of await accountsByEmail()) {
      expect(row.deactivatedAt === null).toBe(row.email === handMade.email);
    }
    expect(await actionsFor(await idOf(String(addresses[0])))).toEqual([
      { action: "account-created", actorId: null },
      { action: "account-deactivated", actorId: null },
    ]);
  });

  it("signs the seeded accounts out", async () => {
    await seedAccounts(auth, connection, password);
    const id = await idOf(String(addresses[0]));
    await connection.insert(sessions).values({
      id: "fictional-session",
      token: "fictional-session-token",
      userId: id,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await unseedAccounts(auth, connection);
    expect(
      await connection.select().from(sessions).where(eq(sessions.userId, id)),
    ).toEqual([]);
  });

  it("forgets the views the seeded accounts last showed, and no other account's", async () => {
    await seedAccounts(auth, connection, password);
    const seededId = await idOf(String(addresses[0]));
    const handId = await idOf(handMade.email);
    for (const userId of [seededId, handId]) {
      await connection.insert(lastViews).values({
        userId,
        page: "people",
        tableName: "people",
        definition: {},
      });
    }
    await unseedAccounts(auth, connection);
    expect(
      await connection.select({ userId: lastViews.userId }).from(lastViews),
    ).toEqual([{ userId: handId }]);
  });

  it("does nothing when the accounts are already deactivated", async () => {
    await seedAccounts(auth, connection, password);
    await unseedAccounts(auth, connection);
    expect(await unseedAccounts(auth, connection)).toEqual([]);
  });
});
