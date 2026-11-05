// SPDX-License-Identifier: Apache-2.0

// Tests for account administration against a migrated PostgreSQL server: which roles may manage
// accounts; creating accounts and changing their names, email addresses, roles, passwords, and
// whether they can sign in; administrators changing their own account, except that the last active
// Administrator keeps the role and stays active; signing users out when their password is reset or
// their account deactivated; and users changing their own password, and the access history that
// records each change.

import {
  accounts,
  createDatabase,
  createPool,
  type Database,
  databaseCodes,
  hasDatabaseCode,
  rolePermissions,
  roles as roleTable,
  runMigrations,
  userRoles,
  users,
} from "@fathom/db";
import { type Role, roleSchema } from "@fathom/shared";
import {
  createTestCertificate,
  startTestDatabase,
  type TestCertificate,
  type TestDatabase,
} from "@fathom/test-utils";
import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { grants, rolesGranting } from "./access.ts";
import { addRoles } from "./data/roles.ts";
import { type App, buildApp } from "./app.ts";
import { createAccount } from "./data/accounts.ts";
import { type Auth, createAuth } from "./data/auth.ts";
import { createDataAccess } from "./data/index.ts";

let database: TestDatabase;
let certificate: TestCertificate;
let pool: ReturnType<typeof createPool>;
let connection: Database;
let auth: Auth;
let app: App;
// A fictional address for Fathom, and a session secret used only by these tests.
const publicUrl = "https://fathom.example.test";
const secret = "fictional-session-secret-for-tests-only-0123456789";
const password = "fictional password 1";
const newPassword = "fictional password 2";

beforeAll(async () => {
  certificate = createTestCertificate();
  database = await startTestDatabase();
  await runMigrations(database.migrator);
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
  // A second Better Auth for creating accounts directly, as the account command does.
  auth = createAuth(connection, { publicUrl, secret });
  app = await buildApp({
    data: createDataAccess(connection),
    database: connection,
    auth: { publicUrl, secret },
    tls: certificate,
    logStream: { write: () => undefined },
    // Many sign-ins from one address; sign-in limits are tested elsewhere.
    requestsPerMinute: 10_000,
  });
});

afterAll(async () => {
  await app.close();
  await pool.end();
  await database.container.stop();
  certificate.remove();
});

let accountCount = 0;
let addressCount = 10;

interface TestAccount {
  id: string;
  email: string;
}

async function newAccount(roles: Role[]): Promise<TestAccount> {
  accountCount += 1;
  const email = `person${String(accountCount)}@example.test`;
  const id = await createAccount(auth, connection, {
    name: `Fictional Person ${String(accountCount)}`,
    email,
    password,
    roles,
  });
  return { id, email };
}

// Signs in from a fictional address of its own, so sign-in limits never interfere, and returns the
// session cookie, or "" when sign-in is refused.
async function signIn(email: string, withPassword = password): Promise<string> {
  addressCount += 1;
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    remoteAddress: `192.0.2.${String(addressCount % 250)}`,
    headers: { origin: publicUrl },
    payload: { email, password: withPassword },
  });
  const cookie = [response.headers["set-cookie"]]
    .flat()
    .find((value) => value?.includes("session_token="));
  return cookie?.split(";")[0] ?? "";
}

async function signedIn(roles: Role[]) {
  const account = await newAccount(roles);
  return { ...account, cookie: await signIn(account.email) };
}

function request(
  cookie: string,
  method: "GET" | "POST" | "PUT" | "PATCH",
  url: string,
  payload?: object,
) {
  return app.inject({
    method,
    url,
    headers: { cookie, origin: publicUrl },
    ...(payload === undefined ? {} : { payload }),
  });
}

describe("stored roles", () => {
  it("start as the roles Fathom has always had, granting exactly what the server grants each", async () => {
    const rows = await connection
      .select({ key: roleTable.key, permission: rolePermissions.permission })
      .from(roleTable)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roleTable.id))
      .where(isNotNull(roleTable.key));
    const stored = new Map<string, string[]>();
    for (const { key, permission } of rows) {
      if (key !== null)
        stored.set(key, [...(stored.get(key) ?? []), permission]);
    }
    expect(
      Object.fromEntries(
        [...stored].map(([key, permissions]) => [key, permissions.sort()]),
      ),
    ).toEqual(
      Object.fromEntries(
        Object.entries(grants).map(([role, granted]) => [
          role,
          [...granted].sort(),
        ]),
      ),
    );
  });

  it("cannot be deleted while an account holds them", async () => {
    const [role] = await connection
      .insert(roleTable)
      .values({ name: "Fictional Held Role" })
      .returning({ id: roleTable.id });
    if (role === undefined) throw new Error("No role was made");
    await connection.insert(users).values({
      id: "fictional-holder",
      name: "Fictional Holder",
      email: "holder@example.com",
    });
    try {
      await connection
        .insert(userRoles)
        .values({ userId: "fictional-holder", roleId: role.id });
      const refused: unknown = await connection
        .delete(roleTable)
        .where(eq(roleTable.id, role.id))
        .then(
          () => undefined,
          (error: unknown) => error,
        );
      expect(hasDatabaseCode(refused, databaseCodes.restrictViolation)).toBe(
        true,
      );
    } finally {
      await connection.delete(users).where(eq(users.id, "fictional-holder"));
      await connection.delete(roleTable).where(eq(roleTable.id, role.id));
    }
  });

  it("must all exist for an account to be given them", async () => {
    // Only the migration role can change a key. The change is undone when the transaction fails.
    const migratorPool = createPool(database.migrator, () => undefined);
    const migrator = createDatabase(migratorPool);
    await expect(
      migrator.transaction(async (transaction) => {
        await transaction
          .update(roleTable)
          .set({ key: null })
          .where(eq(roleTable.key, "leadership"));
        await addRoles(transaction, "fictional-nobody", [
          "viewer",
          "leadership",
        ]);
      }),
    ).rejects.toThrow("A role to be given is missing from the database");
    await migratorPool.end();
    const [leadership] = await connection
      .select({ id: roleTable.id })
      .from(roleTable)
      .where(eq(roleTable.key, "leadership"));
    expect(leadership).toBeDefined();
  });

  it("have names unique whatever their case", async () => {
    const refused: unknown = await connection
      .insert(roleTable)
      .values({ name: "VIEWER" })
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    expect(hasDatabaseCode(refused, databaseCodes.uniqueViolation)).toBe(true);
  });
});

describe("who may manage accounts", () => {
  // The access control pattern: every role on its own, allowed exactly when it grants the permission.
  it.each(roleSchema.options)(
    "a %s may list accounts only if the role lets them manage accounts",
    async (role) => {
      const { cookie } = await signedIn([role]);
      const response = await request(cookie, "GET", "/api/accounts");
      if (rolesGranting("accounts:manage").includes(role)) {
        expect(response.statusCode).toBe(200);
      } else {
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({ error: "Forbidden" });
      }
    },
  );

  const changes = [
    [
      "POST",
      "/api/accounts",
      {
        name: "Fictional Person",
        email: "x@example.test",
        password,
        roles: [],
      },
    ],
    ["PATCH", "/api/accounts/any", { roles: [] }],
    ["PUT", "/api/accounts/any/password", { password }],
    ["PUT", "/api/accounts/any/active", { active: false }],
  ] as const;
  const refusedRoles = roleSchema.options.filter(
    (role) => !rolesGranting("accounts:manage").includes(role),
  );

  it.each(
    changes.flatMap((change) =>
      refusedRoles.map((role) => [role, ...change] as const),
    ),
  )("refuses a %s %s %s", async (role, method, url, payload) => {
    const { cookie } = await signedIn([role]);
    const response = await request(cookie, method, url, payload);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Forbidden" });
  });

  it.each(changes)(
    "refuses a signed-out %s %s before reading what it sends",
    async (method, url) => {
      const response = await app.inject({
        method,
        url,
        headers: { origin: publicUrl },
        payload: { not: "what it expects" },
      });
      expect(response.statusCode).toBe(401);
    },
  );
});

describe("administering accounts", () => {
  it("lists accounts with their roles and whether they can sign in", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const listed = await newAccount(["viewer", "leadership"]);
    const response = await request(cookie, "GET", "/api/accounts");
    expect(
      response
        .json<{ accounts: { id: string }[] }>()
        .accounts.find((account) => account.id === listed.id),
    ).toMatchObject({
      email: listed.email,
      roles: ["viewer", "leadership"],
      active: true,
    });
  });

  it("creates an account that can sign in, recording when", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const before = Date.now();
    const response = await request(cookie, "POST", "/api/accounts", {
      name: "Fictional Newcomer",
      email: "newcomer@example.test",
      password,
      roles: ["viewer", "project-planner"],
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      account: {
        name: "Fictional Newcomer",
        roles: ["viewer", "project-planner"],
        active: true,
      },
    });
    const { account } = response.json<{ account: { createdAt: string } }>();
    expect(Date.parse(account.createdAt)).toBeGreaterThanOrEqual(before);
    expect(await signIn("newcomer@example.test")).not.toBe("");
  });

  it("refuses an account whose email address is already used", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const existing = await newAccount([]);
    const response = await request(cookie, "POST", "/api/accounts", {
      name: "Fictional Twin",
      email: existing.email,
      password,
      roles: [],
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "An account with this email address already exists",
    });
  });

  it("refuses an account with a password that is too short", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const response = await request(cookie, "POST", "/api/accounts", {
      name: "Fictional Person",
      email: "short@example.test",
      password: "short",
      roles: [],
    });
    expect(response.statusCode).toBe(400);
  });

  it("changes an account's roles, which apply on its next request", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const other = await signedIn(["viewer"]);
    const response = await request(
      cookie,
      "PATCH",
      `/api/accounts/${other.id}`,
      {
        roles: ["viewer", "resource-planner"],
      },
    );
    expect(response.json()).toMatchObject({
      account: { roles: ["viewer", "resource-planner"] },
    });
    const session = await request(other.cookie, "GET", "/api/session");
    expect(session.json()).toMatchObject({
      roles: ["viewer", "resource-planner"],
    });
  });

  it("lets administrators change their own roles, which apply on their next request", async () => {
    await signedIn(["administrator"]);
    const admin = await signedIn(["administrator"]);
    const response = await request(
      admin.cookie,
      "PATCH",
      `/api/accounts/${admin.id}`,
      { roles: ["viewer"] },
    );
    expect(response.json()).toMatchObject({ account: { roles: ["viewer"] } });
    expect(
      (await request(admin.cookie, "GET", "/api/accounts")).statusCode,
    ).toBe(403);
  });

  it("lets administrators change their own name and email address", async () => {
    const admin = await signedIn(["administrator"]);
    const response = await request(
      admin.cookie,
      "PATCH",
      `/api/accounts/${admin.id}`,
      { name: "Fictional Self", email: "self@example.test" },
    );
    expect(response.json()).toMatchObject({
      account: { name: "Fictional Self", email: "self@example.test" },
    });
    expect(
      (await request(admin.cookie, "GET", "/api/session")).json(),
    ).toMatchObject({
      user: { name: "Fictional Self", email: "self@example.test" },
    });
  });

  it("changes an account's name and email address, which it then signs in with", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const other = await newAccount(["viewer"]);
    const response = await request(
      cookie,
      "PATCH",
      `/api/accounts/${other.id}`,
      { name: " Fictional Renamed ", email: "Renamed@Example.TEST" },
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      account: {
        name: "Fictional Renamed",
        email: "renamed@example.test",
        roles: ["viewer"],
      },
    });
    expect(await signIn(other.email)).toBe("");
    expect(await signIn("renamed@example.test")).not.toBe("");
  });

  it("refuses an email address another account uses, but keeps the account's own", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const other = await newAccount([]);
    const existing = await newAccount([]);
    const taken = await request(cookie, "PATCH", `/api/accounts/${other.id}`, {
      name: "Fictional Person",
      email: existing.email.toUpperCase(),
    });
    expect(taken.statusCode).toBe(409);
    expect(taken.json()).toEqual({
      error: "An account with this email address already exists",
    });
    const kept = await request(cookie, "PATCH", `/api/accounts/${other.id}`, {
      name: "Fictional Kept",
      email: other.email,
    });
    expect(kept.json()).toMatchObject({
      account: { name: "Fictional Kept", email: other.email },
    });
  });

  it.each([
    ["an empty name", { name: "  ", email: "valid@example.test" }],
    ["an email address that is not valid", { name: "Fictional", email: "x" }],
  ])("refuses %s", async (_case, payload) => {
    const { cookie } = await signedIn(["administrator"]);
    const other = await newAccount([]);
    const response = await request(
      cookie,
      "PATCH",
      `/api/accounts/${other.id}`,
      payload,
    );
    expect(response.statusCode).toBe(400);
  });

  it.each([
    ["PATCH", "/api/accounts/no-such-account", { roles: [] }],
    ["PUT", "/api/accounts/no-such-account/password", { password }],
    ["PUT", "/api/accounts/no-such-account/active", { active: false }],
  ] as const)(
    "answers %s %s for a missing account with not found",
    async (method, url, payload) => {
      const { cookie } = await signedIn(["administrator"]);
      const response = await request(cookie, method, url, payload);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "There is no such account" });
    },
  );

  it("resets a password, signing the user out everywhere", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const other = await signedIn(["viewer"]);
    const response = await request(
      cookie,
      "PUT",
      `/api/accounts/${other.id}/password`,
      {
        password: newPassword,
      },
    );
    expect(response.statusCode).toBe(204);
    expect(
      (await request(other.cookie, "GET", "/api/session")).statusCode,
    ).toBe(401);
    expect(await signIn(other.email)).toBe("");
    expect(await signIn(other.email, newPassword)).not.toBe("");
  });

  it("refuses to reset one's own password, which needs the current one", async () => {
    const admin = await signedIn(["administrator"]);
    const response = await request(
      admin.cookie,
      "PUT",
      `/api/accounts/${admin.id}/password`,
      { password: newPassword },
    );
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error:
        "Change your own password from your account, giving your current password",
    });
  });

  it("refuses a reset password that is too long", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const other = await newAccount([]);
    const tooLong = "x".repeat(129);
    const response = await request(
      cookie,
      "PUT",
      `/api/accounts/${other.id}/password`,
      {
        password: tooLong,
      },
    );
    expect(response.statusCode).toBe(400);
  });

  it("deactivates an account, signing the user out and refusing sign-in, until it is reactivated", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const other = await signedIn(["viewer"]);
    const deactivated = await request(
      cookie,
      "PUT",
      `/api/accounts/${other.id}/active`,
      {
        active: false,
      },
    );
    expect(deactivated.json()).toMatchObject({ account: { active: false } });
    expect(
      (await request(other.cookie, "GET", "/api/session")).statusCode,
    ).toBe(401);
    expect(await signIn(other.email)).toBe("");
    await request(cookie, "PUT", `/api/accounts/${other.id}/active`, {
      active: true,
    });
    expect(await signIn(other.email)).not.toBe("");
  });

  it("answers a deactivated account's right password as it answers a wrong one", async () => {
    const { cookie } = await signedIn(["administrator"]);
    const other = await newAccount(["viewer"]);
    await request(cookie, "PUT", `/api/accounts/${other.id}/active`, {
      active: false,
    });
    const signInAs = (withPassword: string) =>
      app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        remoteAddress: "198.51.100.7",
        headers: { origin: publicUrl },
        payload: { email: other.email, password: withPassword },
      });
    const rightPassword = await signInAs(password);
    const wrongPassword = await signInAs("not the password");
    expect(rightPassword.statusCode).toBe(401);
    expect(rightPassword.json()).toEqual(wrongPassword.json());
  });

  it("grants nothing to a session that outlives its account's deactivation", async () => {
    const other = await signedIn(["viewer"]);
    // As if a sign-in had finished just as the account was deactivated.
    await database.superuserQuery(
      `UPDATE fathom.users SET deactivated_at = now() WHERE id = '${other.id}'`,
    );
    expect(
      (await request(other.cookie, "GET", "/api/session")).statusCode,
    ).toBe(401);
  });

  it("lets administrators deactivate their own account, signing them out and recording it", async () => {
    const reader = await signedIn(["administrator"]);
    const admin = await signedIn(["administrator"]);
    const response = await request(
      admin.cookie,
      "PUT",
      `/api/accounts/${admin.id}/active`,
      { active: false },
    );
    expect(response.statusCode).toBe(200);
    expect(
      (await request(admin.cookie, "GET", "/api/session")).statusCode,
    ).toBe(401);
    const history = await request(reader.cookie, "GET", "/api/access-history");
    const self = { id: admin.id, name: expect.any(String) as unknown };
    expect(
      history
        .json<{ entries: { subject: { id: string } }[] }>()
        .entries.find((entry) => entry.subject.id === admin.id),
    ).toMatchObject({
      action: "account-deactivated",
      actor: self,
      subject: self,
    });
  });
});

describe("the last active Administrator", () => {
  // Leaves one active Administrator, counting deactivated ones as gone, and a second account with
  // the role that has been deactivated.
  async function lastAdministrator() {
    const admin = await signedIn(["administrator", "viewer"]);
    const deactivated = await newAccount(["administrator"]);
    await connection
      .update(users)
      .set({ deactivatedAt: new Date() })
      .where(
        and(
          isNull(users.deactivatedAt),
          ne(users.id, admin.id),
          inArray(
            users.id,
            connection
              .select({ id: userRoles.userId })
              .from(userRoles)
              .innerJoin(roleTable, eq(roleTable.id, userRoles.roleId))
              .where(eq(roleTable.key, "administrator")),
          ),
        ),
      );
    return { ...admin, deactivated };
  }

  it("keeps the Administrator role, even when it is their own account", async () => {
    const admin = await lastAdministrator();
    const response = await request(
      admin.cookie,
      "PATCH",
      `/api/accounts/${admin.id}`,
      { roles: ["viewer"] },
    );
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "The last active Administrator keeps the Administrator role",
    });
    expect(
      (await request(admin.cookie, "GET", "/api/accounts")).statusCode,
    ).toBe(200);
  });

  it("saves nothing of a change that would take the role away", async () => {
    const admin = await lastAdministrator();
    const response = await request(
      admin.cookie,
      "PATCH",
      `/api/accounts/${admin.id}`,
      { name: "Fictional Unsaved", email: "unsaved@example.test", roles: [] },
    );
    expect(response.statusCode).toBe(409);
    expect(
      (await request(admin.cookie, "GET", "/api/session")).json(),
    ).toMatchObject({ user: { email: admin.email } });
  });

  it("cannot be deactivated", async () => {
    const admin = await lastAdministrator();
    const response = await request(
      admin.cookie,
      "PUT",
      `/api/accounts/${admin.id}/active`,
      { active: false },
    );
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "The last active Administrator cannot be deactivated",
    });
    expect(
      (await request(admin.cookie, "GET", "/api/session")).statusCode,
    ).toBe(200);
  });

  it("can change their other roles, and can give up the role once another account is reactivated with it", async () => {
    const admin = await lastAdministrator();
    const kept = await request(
      admin.cookie,
      "PATCH",
      `/api/accounts/${admin.id}`,
      { roles: ["administrator"] },
    );
    expect(kept.json()).toMatchObject({
      account: { roles: ["administrator"] },
    });
    await request(
      admin.cookie,
      "PUT",
      `/api/accounts/${admin.deactivated.id}/active`,
      { active: true },
    );
    const given = await request(
      admin.cookie,
      "PATCH",
      `/api/accounts/${admin.id}`,
      { roles: [] },
    );
    expect(given.statusCode).toBe(200);
  });

  it("is kept when two administrators each remove the other's role at once", async () => {
    const first = await lastAdministrator();
    const second = await signedIn(["administrator"]);
    // The first administrator's change to the second, holding the lock until the second's change
    // to the first, already allowed to manage accounts, is waiting for it.
    let release = () => undefined as unknown;
    const held = new Promise((resolve) => {
      release = resolve as () => unknown;
    });
    let locked = () => undefined as unknown;
    const isLocked = new Promise((resolve) => {
      locked = resolve as () => unknown;
    });
    const other = connection.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended('fathom.administrators', 0))`,
      );
      await transaction
        .delete(userRoles)
        .where(eq(userRoles.userId, second.id));
      locked();
      await held;
    });
    await isLocked;
    const removing = request(
      second.cookie,
      "PATCH",
      `/api/accounts/${first.id}`,
      { roles: [] },
    );
    await vi.waitFor(
      async () => {
        const waiting = await connection.execute<{ total: string }>(
          sql`SELECT count(*) AS total FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND wait_event = 'advisory' AND datname = current_database()`,
        );
        expect(Number(waiting.rows[0]?.total)).toBeGreaterThan(0);
      },
      { timeout: 10_000 },
    );
    release();
    await other;
    expect((await removing).statusCode).toBe(409);
    expect(
      (await request(first.cookie, "GET", "/api/accounts")).statusCode,
    ).toBe(200);
  });
});

describe("changing one's own password", () => {
  it("needs the current password, and signs out every other session", async () => {
    const user = await signedIn(["viewer"]);
    const otherSession = await signIn(user.email);
    const response = await request(
      user.cookie,
      "POST",
      "/api/auth/change-password",
      {
        currentPassword: password,
        newPassword,
      },
    );
    expect(response.statusCode).toBe(200);
    // Without the new session's token, which the browser receives as a cookie.
    expect(response.json()).toEqual({});
    expect(
      (await request(otherSession, "GET", "/api/session")).statusCode,
    ).toBe(401);
    expect(await signIn(user.email, newPassword)).not.toBe("");
  });

  it("refuses the wrong current password", async () => {
    const user = await signedIn(["viewer"]);
    const response = await request(
      user.cookie,
      "POST",
      "/api/auth/change-password",
      {
        currentPassword: "not the password",
        newPassword,
      },
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "INVALID_PASSWORD" });
    expect(await signIn(user.email, newPassword)).toBe("");
  });

  it("refuses a new password that is too short, before asking Better Auth", async () => {
    const user = await signedIn(["viewer"]);
    const response = await request(
      user.cookie,
      "POST",
      "/api/auth/change-password",
      {
        currentPassword: password,
        newPassword: "short",
      },
    );
    expect(response.statusCode).toBe(400);
  });
});

describe("recording one's own password change", () => {
  type Entry = { action: string; subject: { id: string } };
  async function entriesFor(id: string) {
    const admin = await signedIn(["administrator"]);
    const history = await request(admin.cookie, "GET", "/api/access-history");
    return history
      .json<{ entries: Entry[] }>()
      .entries.filter((entry) => entry.subject.id === id);
  }

  it("records the change, naming the user as both who and whom, without the passwords", async () => {
    const user = await signedIn(["viewer"]);
    await request(user.cookie, "POST", "/api/auth/change-password", {
      currentPassword: password,
      newPassword,
    });
    const self = { id: user.id, name: expect.any(String) as unknown };
    expect(await entriesFor(user.id)).toMatchObject([
      { action: "password-changed", actor: self, subject: self, details: {} },
      { action: "account-created" },
    ]);
  });

  it("records nothing when the current password is wrong", async () => {
    const user = await signedIn(["viewer"]);
    await request(user.cookie, "POST", "/api/auth/change-password", {
      currentPassword: "not the password",
      newPassword,
    });
    expect(await entriesFor(user.id)).toMatchObject([
      { action: "account-created" },
    ]);
  });

  it("refuses, with an error, a password saved through Better Auth with no one signed in, but not other changes to an account", async () => {
    const user = await newAccount([]);
    const [account] = await connection
      .select({ id: accounts.id, password: accounts.password })
      .from(accounts)
      .where(eq(accounts.userId, user.id));
    const { internalAdapter } = await auth.$context;
    await expect(
      internalAdapter.updateAccount(String(account?.id), {
        password: "not a hash",
      }),
    ).rejects.toThrow("Sign in to change your password");
    await internalAdapter.updateAccount(String(account?.id), {
      scope: "fictional",
    });
    const [after] = await connection
      .select({ password: accounts.password, scope: accounts.scope })
      .from(accounts)
      .where(eq(accounts.userId, user.id));
    expect(after).toEqual({ password: account?.password, scope: "fictional" });
    expect(await entriesFor(user.id)).toMatchObject([
      { action: "account-created" },
    ]);
  });

  it("keeps the old password when the change cannot be recorded", async () => {
    const user = await signedIn(["viewer"]);
    await database.superuserQuery(
      "ALTER TABLE fathom.access_history ADD CONSTRAINT fictional_refusal CHECK (action <> 'password-changed') NOT VALID",
    );
    try {
      const response = await request(
        user.cookie,
        "POST",
        "/api/auth/change-password",
        { currentPassword: password, newPassword },
      );
      expect(response.statusCode).not.toBe(200);
    } finally {
      await database.superuserQuery(
        "ALTER TABLE fathom.access_history DROP CONSTRAINT fictional_refusal",
      );
    }
    expect(await signIn(user.email, newPassword)).toBe("");
    expect(await signIn(user.email)).not.toBe("");
  });
});

describe("changing one's own name", () => {
  it("lets any user change it, recorded with them as both who and whom", async () => {
    const user = await signedIn([]);
    const response = await request(user.cookie, "PUT", "/api/account/name", {
      name: " Fictional Self-Renamed ",
    });
    expect(response.statusCode).toBe(204);
    const session = await request(user.cookie, "GET", "/api/session");
    expect(session.json()).toMatchObject({
      user: { name: "Fictional Self-Renamed", email: user.email },
    });
    const admin = await signedIn(["administrator"]);
    const history = await request(admin.cookie, "GET", "/api/access-history");
    const self = {
      id: user.id,
      name: "Fictional Self-Renamed",
      email: user.email,
    };
    expect(
      history
        .json<{ entries: { subject: { id: string } }[] }>()
        .entries.filter((entry) => entry.subject.id === user.id),
    ).toMatchObject([
      { action: "own-name-changed", actor: self, subject: self },
      { action: "account-created" },
    ]);
  });

  it("records nothing when the name is the same", async () => {
    const user = await signedIn([]);
    const { name } = (await request(user.cookie, "GET", "/api/session")).json<{
      user: { name: string };
    }>().user;
    await request(user.cookie, "PUT", "/api/account/name", { name });
    const admin = await signedIn(["administrator"]);
    const history = await request(admin.cookie, "GET", "/api/access-history");
    expect(
      history
        .json<{ entries: { action: string; subject: { id: string } }[] }>()
        .entries.filter((entry) => entry.subject.id === user.id)
        .map((entry) => entry.action),
    ).toEqual(["account-created"]);
  });

  it("changes only the name, never the email address or roles sent with it", async () => {
    const user = await signedIn(["viewer"]);
    await request(user.cookie, "PUT", "/api/account/name", {
      name: "Fictional Climber",
      email: "climber@example.test",
      roles: ["administrator"],
    });
    expect(
      (await request(user.cookie, "GET", "/api/session")).json(),
    ).toMatchObject({
      user: { name: "Fictional Climber", email: user.email },
      roles: ["viewer"],
    });
  });

  it("refuses a name another account has, ignoring letter case and extra spaces", async () => {
    const other = await newAccount([]);
    await request(
      (await signedIn(["administrator"])).cookie,
      "PATCH",
      `/api/accounts/${other.id}`,
      { name: "Fictional Director" },
    );
    const user = await signedIn([]);
    const response = await request(user.cookie, "PUT", "/api/account/name", {
      name: " fictional   DIRECTOR ",
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: "Another account already has that name; choose another",
    });
  });

  it.each([
    ["longer than 100 characters", "n".repeat(101)],
    ["holding a control character", "Fictional\u0007Name"],
    ["holding a zero-width space", "Fictional\u200BName"],
  ])("refuses a name %s", async (_, name) => {
    const user = await signedIn([]);
    const response = await request(user.cookie, "PUT", "/api/account/name", {
      name,
    });
    expect(response.statusCode).toBe(400);
  });

  it("holds an Administrator's new accounts to the same rules for names", async () => {
    const admin = await signedIn(["administrator"]);
    const response = await request(admin.cookie, "POST", "/api/accounts", {
      name: "n".repeat(101),
      email: "long-name@example.test",
      password,
      roles: [],
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses an empty name", async () => {
    const user = await signedIn([]);
    const response = await request(user.cookie, "PUT", "/api/account/name", {
      name: " ",
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses a request with no one signed in", async () => {
    const response = await request("", "PUT", "/api/account/name", {
      name: "Fictional Nobody",
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("the access history", () => {
  it.each(roleSchema.options)(
    "is shown to a %s only if the role lets them view it",
    async (role) => {
      const { cookie } = await signedIn([role]);
      const response = await request(cookie, "GET", "/api/access-history");
      expect(response.statusCode).toBe(
        rolesGranting("history:view").includes(role) ? 200 : 403,
      );
    },
  );

  it("records each change to accounts, newest first, with who made it and the roles involved, but no passwords", async () => {
    const admin = await signedIn(["administrator"]);
    const created = await request(admin.cookie, "POST", "/api/accounts", {
      name: "Fictional Recorded",
      email: "recorded@example.test",
      password,
      roles: ["viewer"],
    });
    const { id } = created.json<{ account: { id: string } }>().account;
    await request(admin.cookie, "PATCH", `/api/accounts/${id}`, {
      roles: ["viewer", "leadership"],
    });
    await request(admin.cookie, "PUT", `/api/accounts/${id}/password`, {
      password: newPassword,
    });
    await request(admin.cookie, "PUT", `/api/accounts/${id}/active`, {
      active: false,
    });
    await request(admin.cookie, "PUT", `/api/accounts/${id}/active`, {
      active: true,
    });
    const history = await request(admin.cookie, "GET", "/api/access-history");
    const entries = history
      .json<{ entries: { subject: { id: string } }[] }>()
      .entries.filter((entry) => entry.subject.id === id);
    const actor = { id: admin.id, name: expect.any(String) as unknown };
    const subject = { id, name: "Fictional Recorded" };
    expect(entries).toMatchObject([
      { action: "account-reactivated", actor, subject, details: {} },
      { action: "account-deactivated", actor, subject, details: {} },
      { action: "password-reset", actor, subject, details: {} },
      {
        action: "roles-changed",
        actor,
        subject,
        details: { previousRoles: ["viewer"], roles: ["viewer", "leadership"] },
      },
      {
        action: "account-created",
        actor,
        subject,
        details: { roles: ["viewer"] },
      },
    ]);
    expect(history.body).not.toContain(newPassword);
    expect(history.body).not.toContain(password);
  });

  it("records each change to an account's name and email address, without the values, and nothing when neither changes", async () => {
    const admin = await signedIn(["administrator"]);
    const other = await newAccount([]);
    const url = `/api/accounts/${other.id}`;
    await request(admin.cookie, "PATCH", url, {
      name: "Fictional Before",
      email: other.email,
    });
    await request(admin.cookie, "PATCH", url, {
      name: "Fictional After",
      email: "after@example.test",
    });
    await request(admin.cookie, "PATCH", url, {
      name: "Fictional After",
      email: "after@example.test",
    });
    const history = await request(admin.cookie, "GET", "/api/access-history");
    const entries = history
      .json<{ entries: { subject: { id: string } }[] }>()
      .entries.filter((entry) => entry.subject.id === other.id);
    const actor = { id: admin.id, name: expect.any(String) as unknown };
    expect(entries).toMatchObject([
      { action: "email-changed", actor, details: {} },
      { action: "name-changed", actor, details: {} },
      { action: "name-changed", actor, details: {} },
      { action: "account-created" },
    ]);
    expect(history.body).not.toContain("Fictional Before");
    expect(history.body).not.toContain(other.email);
  });

  it("records every change administrators make to their own account, naming them as both who and whom", async () => {
    await signedIn(["administrator"]);
    const admin = await signedIn(["administrator"]);
    const url = `/api/accounts/${admin.id}`;
    await request(admin.cookie, "PATCH", url, {
      name: "Fictional Myself",
      email: "myself@example.test",
      roles: ["administrator", "workforce-administrator"],
    });
    const history = await request(admin.cookie, "GET", "/api/access-history");
    const self = { id: admin.id, name: "Fictional Myself" };
    expect(
      history
        .json<{ entries: { subject: { id: string } }[] }>()
        .entries.filter((entry) => entry.subject.id === admin.id),
    ).toMatchObject([
      {
        action: "roles-changed",
        actor: self,
        subject: self,
        details: {
          previousRoles: ["administrator"],
          roles: ["workforce-administrator", "administrator"],
        },
      },
      { action: "email-changed", actor: self, subject: self },
      { action: "name-changed", actor: self, subject: self },
      { action: "account-created" },
    ]);
  });

  it("stays readable with entries from another version of Fathom, or naming accounts that no longer exist", async () => {
    const admin = await signedIn(["administrator"]);
    await database.superuserQuery(
      `INSERT INTO fathom.access_history (actor_id, action, subject_id, details) VALUES ('removed-actor', 'future-action', 'removed-subject', '{"roles": ["viewer", "retired-role"]}')`,
    );
    const history = await request(admin.cookie, "GET", "/api/access-history");
    expect(history.statusCode).toBe(200);
    expect(
      history
        .json<{ entries: { subject: { id: string } }[] }>()
        .entries.find((entry) => entry.subject.id === "removed-subject"),
    ).toMatchObject({
      action: "future-action",
      actor: { id: "removed-actor", name: null },
      subject: { id: "removed-subject", name: null },
      details: { roles: ["viewer"] },
    });
  });

  it("names no one for accounts the server's operators created with the account command", async () => {
    const admin = await signedIn(["administrator"]);
    const { id } = await newAccount([]);
    const history = await request(admin.cookie, "GET", "/api/access-history");
    expect(
      history
        .json<{ entries: { subject: { id: string } }[] }>()
        .entries.find((entry) => entry.subject.id === id),
    ).toMatchObject({ action: "account-created", actor: null });
  });
});
