// SPDX-License-Identifier: Apache-2.0

// Tests for account administration against a migrated PostgreSQL server: which roles may manage
// accounts; creating accounts and changing their names, email addresses, the one role each holds,
// passwords, and whether they can sign in; administrators changing their own account, except that
// the last active Administrator keeps the role and stays active; signing users out when their password is reset or
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
  sessions,
  userRoles,
  users,
} from "@fathom/db";
import { type Role, roleSchema, startingRoles } from "@fathom/shared";
import {
  createTestCertificate,
  startTestDatabase,
  type TestCertificate,
  type TestDatabase,
} from "@fathom/test-utils";
import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { actorWith, rolesGranting } from "./access.ts";
import { findStartingRole } from "./data/roles.ts";
import { type App, buildApp } from "./app.ts";
import { createAccount } from "./data/accounts.ts";
import { type Auth, createAuth } from "./data/auth.ts";
import { createDataAccess } from "./data/index.ts";
import { missingRecord } from "./test-app.ts";

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
  await database.remove();
  certificate.remove();
});

let accountCount = 0;
let addressCount = 10;

interface TestAccount {
  id: string;
  email: string;
}

// Whether an access history entry records a sign-in, which tests of other entries leave out.
const isSignIn = ({ action }: { action: string }) => action === "signed-in";

// The ID of a starting role, as the Accounts page sends it.
const roleId = (key: Role) => findStartingRole(connection, key);

async function newAccount(role: Role = "team-member"): Promise<TestAccount> {
  accountCount += 1;
  const email = `person${String(accountCount)}@example.test`;
  const id = await createAccount(auth, connection, {
    name: `Fictional Person ${String(accountCount)}`,
    email,
    password,
    roleId: await roleId(role),
  });
  return { id, email };
}

// A role made later, granting just these permissions.
async function madeRole(name: string, permissions: string[]): Promise<string> {
  const [made] = await connection
    .insert(roleTable)
    .values({ name })
    .returning({ id: roleTable.id });
  if (made === undefined) throw new Error("No role was made");
  if (permissions.length > 0) {
    await connection
      .insert(rolePermissions)
      .values(
        permissions.map((permission) => ({ roleId: made.id, permission })),
      );
  }
  return made.id;
}

// Gives an account a role directly, as only a test may, in place of the one it holds.
async function holdRole(userId: string, id: string): Promise<void> {
  await connection
    .update(userRoles)
    .set({ roleId: id })
    .where(eq(userRoles.userId, userId));
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

async function signedIn(role: Role) {
  const account = await newAccount(role);
  return { ...account, cookie: await signIn(account.email) };
}

// Each from a fictional address of its own, so Better Auth's limits on changing passwords never
// interfere.
function request(
  cookie: string,
  method: "GET" | "POST" | "PUT" | "PATCH",
  url: string,
  payload?: object,
) {
  addressCount += 1;
  return app.inject({
    method,
    url,
    remoteAddress: `192.0.2.${String(addressCount % 250)}`,
    headers: { cookie, origin: publicUrl },
    ...(payload === undefined ? {} : { payload }),
  });
}

describe("stored roles", () => {
  it("start as the persona roles, granting exactly what the shared starting roles list", async () => {
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
        Object.entries(startingRoles).map(([role, { permissions }]) => [
          role,
          [...permissions].sort(),
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

  it("are found by key, refusing a key no starting role has", async () => {
    await expect(findStartingRole(connection, "viewer")).rejects.toThrow(
      "The starting role viewer is missing from the database",
    );
  });

  it("are held several to an account, with one default: the database refuses a second", async () => {
    const holder = await newAccount("team-member");
    await connection
      .insert(userRoles)
      .values({ userId: holder.id, roleId: await roleId("executive") });
    const refused: unknown = await connection
      .insert(userRoles)
      .values({
        userId: holder.id,
        roleId: await roleId("feature-lead"),
        isDefault: true,
      })
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    expect(hasDatabaseCode(refused, databaseCodes.uniqueViolation)).toBe(true);
  });

  it("have names unique whatever their case", async () => {
    const refused: unknown = await connection
      .insert(roleTable)
      .values({ name: "TEAM MEMBER" })
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
    "a %s may list accounts only if the role lets them see accounts",
    async (role) => {
      const { cookie } = await signedIn(role);
      const response = await request(cookie, "GET", "/api/accounts");
      if (rolesGranting("administration:view").includes(role)) {
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
        roleId: missingRecord,
      },
    ],
    ["PATCH", "/api/accounts/any", { name: "Fictional Person" }],
    ["POST", "/api/accounts/any/password", {}],
    ["PUT", "/api/accounts/any/active", { active: false }],
  ] as const;
  const refusedRoles = roleSchema.options.filter(
    (role) => !rolesGranting("administration:edit").includes(role),
  );

  it.each(
    changes.flatMap((change) =>
      refusedRoles.map((role) => [role, ...change] as const),
    ),
  )("refuses a %s %s %s", async (role, method, url, payload) => {
    const { cookie } = await signedIn(role);
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
  it("lists accounts with their one role and whether they can sign in", async () => {
    const { cookie } = await signedIn("administrator");
    const listed = await newAccount("executive");
    const response = await request(cookie, "GET", "/api/accounts");
    expect(
      response
        .json<{ accounts: { id: string }[] }>()
        .accounts.find((account) => account.id === listed.id),
    ).toMatchObject({
      email: listed.email,
      role: { id: await roleId("executive"), name: "Executive" },
      active: true,
    });
  });

  it("creates an account with a generated password, which must be changed, recording when", async () => {
    const { cookie } = await signedIn("administrator");
    const before = Date.now();
    const response = await request(cookie, "POST", "/api/accounts", {
      name: "Fictional Newcomer",
      email: "newcomer@example.test",
      roleId: await roleId("product-manager"),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      account: {
        name: "Fictional Newcomer",
        role: { id: await roleId("product-manager"), name: "Product Manager" },
        active: true,
      },
      password: expect.stringMatching(/^[A-Za-z2-9]{20}$/u) as unknown,
    });
    const created = response.json<{
      account: { createdAt: string };
      password: string;
    }>();
    expect(Date.parse(created.account.createdAt)).toBeGreaterThanOrEqual(
      before,
    );
    const session = await request(
      await signIn("newcomer@example.test", created.password),
      "GET",
      "/api/session",
    );
    expect(session.json()).toMatchObject({ mustChangePassword: true });
  });

  it("ignores a password sent for a new account, generating its own each time", async () => {
    const { cookie } = await signedIn("administrator");
    const passwords = [];
    for (const name of ["First", "Second"]) {
      const response = await request(cookie, "POST", "/api/accounts", {
        name: `Fictional ${name} Generated`,
        email: `${name.toLowerCase()}.generated@example.test`,
        password,
        roleId: await roleId("team-member"),
      });
      expect(response.statusCode).toBe(201);
      passwords.push(response.json<{ password: string }>().password);
    }
    expect(passwords[0]).not.toBe(password);
    expect(passwords[0]).not.toBe(passwords[1]);
    expect(await signIn("first.generated@example.test")).toBe("");
  });

  it("creates an account holding a role made later", async () => {
    const { cookie } = await signedIn("administrator");
    const id = await madeRole("Fictional Made Role", ["administration:view"]);
    const response = await request(cookie, "POST", "/api/accounts", {
      name: "Fictional Custom Holder",
      email: "custom.holder@example.test",
      roleId: id,
    });
    expect(response.json()).toMatchObject({
      account: { role: { id, name: "Fictional Made Role" } },
    });
    const session = await request(
      await signIn(
        "custom.holder@example.test",
        response.json<{ password: string }>().password,
      ),
      "GET",
      "/api/session",
    );
    expect(session.json()).toMatchObject({
      role: { id, key: null, name: "Fictional Made Role" },
      permissions: ["administration:view"],
    });
  });

  it.each([
    ["no role", {}],
    ["a role that is not an ID", { roleId: "team-member" }],
  ])("refuses an account with %s", async (_case, role) => {
    const { cookie } = await signedIn("administrator");
    const response = await request(cookie, "POST", "/api/accounts", {
      name: "Fictional Roleless",
      email: "roleless@example.test",
      ...role,
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses an account with a role that does not exist, keeping no account", async () => {
    const { cookie } = await signedIn("administrator");
    const response = await request(cookie, "POST", "/api/accounts", {
      name: "Fictional Unknown Role",
      email: "unknown.role@example.test",
      roleId: missingRecord,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "There is no such role" });
    expect(await signIn("unknown.role@example.test")).toBe("");
  });

  it("refuses an account whose email address is already used", async () => {
    const { cookie } = await signedIn("administrator");
    const existing = await newAccount();
    const response = await request(cookie, "POST", "/api/accounts", {
      name: "Fictional Twin",
      email: existing.email,
      roleId: await roleId("team-member"),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "An account with this email address already exists",
    });
  });

  it("changes an account's role, which applies on its next request", async () => {
    const { cookie } = await signedIn("administrator");
    const other = await signedIn("team-member");
    const response = await request(
      cookie,
      "PATCH",
      `/api/accounts/${other.id}`,
      { roleId: await roleId("feature-lead") },
    );
    expect(response.json()).toMatchObject({
      account: { role: { name: "Feature Lead" } },
    });
    const session = await request(other.cookie, "GET", "/api/session");
    expect(session.json()).toMatchObject({
      role: { key: "feature-lead", name: "Feature Lead" },
      permissions: expect.arrayContaining(["people:view"]) as unknown,
    });
  });

  it("gives a role made later in place of the one held, so the account holds exactly one", async () => {
    const { cookie } = await signedIn("administrator");
    const other = await signedIn("executive");
    const made = await madeRole("Fictional Given Role", [
      "administration:view",
    ]);
    await request(cookie, "PATCH", `/api/accounts/${other.id}`, {
      roleId: made,
    });
    const session = await request(other.cookie, "GET", "/api/session");
    expect(session.json()).toMatchObject({
      role: { id: made, key: null, name: "Fictional Given Role" },
      permissions: ["administration:view"],
    });
    const held = await connection
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, other.id));
    expect(held).toEqual([{ roleId: made }]);
  });

  it("refuses a role that does not exist, changing nothing", async () => {
    const { cookie } = await signedIn("administrator");
    const other = await newAccount("executive");
    const response = await request(
      cookie,
      "PATCH",
      `/api/accounts/${other.id}`,
      {
        name: "Fictional Unchanged",
        roleId: missingRecord,
      },
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "There is no such role" });
    const listed = await request(cookie, "GET", "/api/accounts");
    expect(
      listed
        .json<{ accounts: { id: string }[] }>()
        .accounts.find((account) => account.id === other.id),
    ).toMatchObject({
      name: expect.stringMatching(/^Fictional Person/u) as unknown,
      role: { name: "Executive" },
    });
  });

  it("shows an account left without a role as holding none, granting nothing, until it is given one", async () => {
    const { cookie } = await signedIn("administrator");
    const other = await signedIn("team-member");
    await connection.delete(userRoles).where(eq(userRoles.userId, other.id));
    expect(
      (await request(other.cookie, "GET", "/api/session")).json(),
    ).toMatchObject({ role: null, permissions: [] });
    const listed = await request(cookie, "GET", "/api/accounts");
    expect(
      listed
        .json<{ accounts: { id: string }[] }>()
        .accounts.find((account) => account.id === other.id),
    ).toMatchObject({ role: null });
    const given = await request(cookie, "PATCH", `/api/accounts/${other.id}`, {
      roleId: await roleId("team-member"),
    });
    expect(given.json()).toMatchObject({
      account: { role: { name: "Team Member" } },
    });
    const history = await request(cookie, "GET", "/api/access-history");
    expect(
      history
        .json<{ entries: { subject: { id: string } }[] }>()
        .entries.find((entry) => entry.subject.id === other.id),
    ).toEqual(
      expect.objectContaining({
        action: "roles-changed",
        details: {
          role: "Team Member",
          roles: ["Team Member"],
          previousRoles: [],
        },
      }),
    );
  });

  it("lets administrators change their own roles, which apply on their next request", async () => {
    await signedIn("administrator");
    const admin = await signedIn("administrator");
    const response = await request(
      admin.cookie,
      "PATCH",
      `/api/accounts/${admin.id}`,
      { roleId: await roleId("team-member") },
    );
    expect(response.json()).toMatchObject({
      account: { role: { name: "Team Member" } },
    });
    expect(
      (await request(admin.cookie, "GET", "/api/accounts")).statusCode,
    ).toBe(403);
  });

  it("lets administrators change their own name and email address", async () => {
    const admin = await signedIn("administrator");
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
    const { cookie } = await signedIn("administrator");
    const other = await newAccount("team-member");
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
        role: { name: "Team Member" },
      },
    });
    expect(await signIn(other.email)).toBe("");
    expect(await signIn("renamed@example.test")).not.toBe("");
  });

  it("refuses an email address another account uses, but keeps the account's own", async () => {
    const { cookie } = await signedIn("administrator");
    const other = await newAccount();
    const existing = await newAccount();
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
    const { cookie } = await signedIn("administrator");
    const other = await newAccount();
    const response = await request(
      cookie,
      "PATCH",
      `/api/accounts/${other.id}`,
      payload,
    );
    expect(response.statusCode).toBe(400);
  });

  it.each([
    ["PATCH", "/api/accounts/no-such-account", { name: "Fictional Person" }],
    ["POST", "/api/accounts/no-such-account/password", {}],
    ["PUT", "/api/accounts/no-such-account/active", { active: false }],
  ] as const)(
    "answers %s %s for a missing account with not found",
    async (method, url, payload) => {
      const { cookie } = await signedIn("administrator");
      const response = await request(cookie, method, url, payload);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "There is no such account" });
    },
  );

  it("resets a password to a generated one, which must be changed, signing the user out everywhere", async () => {
    const { cookie } = await signedIn("administrator");
    const other = await signedIn("team-member");
    const response = await request(
      cookie,
      "POST",
      `/api/accounts/${other.id}/password`,
      {},
    );
    expect(response.statusCode).toBe(200);
    const { password: generated } = response.json<{ password: string }>();
    expect(generated).toMatch(/^[A-Za-z2-9]{20}$/u);
    expect(
      (await request(other.cookie, "GET", "/api/session")).statusCode,
    ).toBe(401);
    expect(await signIn(other.email)).toBe("");
    const session = await request(
      await signIn(other.email, generated),
      "GET",
      "/api/session",
    );
    expect(session.json()).toMatchObject({ mustChangePassword: true });
  });

  it("refuses to reset one's own password, which needs the current one", async () => {
    const admin = await signedIn("administrator");
    const response = await request(
      admin.cookie,
      "POST",
      `/api/accounts/${admin.id}/password`,
      {},
    );
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error:
        "This account's own password is changed from its account menu, with the current password",
    });
  });

  it("deactivates an account, signing the user out and refusing sign-in, until it is reactivated", async () => {
    const { cookie } = await signedIn("administrator");
    const other = await signedIn("team-member");
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
    const { cookie } = await signedIn("administrator");
    const other = await newAccount("team-member");
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
    const other = await signedIn("team-member");
    // As if a sign-in had finished just as the account was deactivated.
    await database.superuserQuery(
      `UPDATE fathom.users SET deactivated_at = now() WHERE id = '${other.id}'`,
    );
    expect(
      (await request(other.cookie, "GET", "/api/session")).statusCode,
    ).toBe(401);
  });

  it("lets administrators deactivate their own account, signing them out and recording it", async () => {
    const reader = await signedIn("administrator");
    const admin = await signedIn("administrator");
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
    const admin = await signedIn("administrator");
    const deactivated = await newAccount("administrator");
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
      { roleId: await roleId("team-member") },
    );
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "The last active account with Edit Administration keeps it",
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
      {
        name: "Fictional Unsaved",
        email: "unsaved@example.test",
        roleId: await roleId("team-member"),
      },
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
      error:
        "The last active account with Edit Administration cannot be deactivated",
    });
    expect(
      (await request(admin.cookie, "GET", "/api/session")).statusCode,
    ).toBe(200);
  });

  it("may be given the role they hold, which changes nothing, and can give it up once another account is reactivated with it", async () => {
    const admin = await lastAdministrator();
    const kept = await request(
      admin.cookie,
      "PATCH",
      `/api/accounts/${admin.id}`,
      { roleId: await roleId("administrator") },
    );
    expect(kept.json()).toMatchObject({
      account: { role: { name: "Administrator" } },
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
      { roleId: await roleId("team-member") },
    );
    expect(given.statusCode).toBe(200);
  });

  it("may give up the role while another active account holds Edit Administration through a role of its own", async () => {
    const admin = await lastAdministrator();
    const holder = await newAccount();
    const keeper = await madeRole("Fictional Keeper", ["administration:edit"]);
    try {
      const refused = await request(
        admin.cookie,
        "PATCH",
        `/api/accounts/${admin.id}`,
        { roleId: await roleId("team-member") },
      );
      expect(refused.statusCode).toBe(409);
      await holdRole(holder.id, keeper);
      const given = await request(
        admin.cookie,
        "PATCH",
        `/api/accounts/${admin.id}`,
        { roleId: await roleId("team-member") },
      );
      expect(given.statusCode).toBe(200);
    } finally {
      // Later tests make their own last Administrator, so nobody else may keep these permissions.
      await connection
        .update(users)
        .set({ deactivatedAt: new Date() })
        .where(eq(users.id, holder.id));
    }
  });

  it("is kept when two administrators each remove the other's role at once", async () => {
    const first = await lastAdministrator();
    const second = await signedIn("administrator");
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
      { roleId: await roleId("team-member") },
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
    const user = await signedIn("team-member");
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
    const user = await signedIn("team-member");
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
    const user = await signedIn("team-member");
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

describe("changing a generated password first", () => {
  // An Administrator whose password Fathom generated, signed in with it.
  async function flaggedAdministrator() {
    accountCount += 1;
    const email = `flagged${String(accountCount)}@example.test`;
    const id = await createAccount(auth, connection, {
      name: `Fictional Flagged ${String(accountCount)}`,
      email,
      password,
      roleId: await roleId("administrator"),
      mustChangePassword: true,
    });
    return { id, email, cookie: await signIn(email) };
  }

  const refused = { error: "The password must be changed before continuing." };

  it.each([
    ["GET", "/api/accounts", undefined],
    ["GET", "/api/access-history", undefined],
    ["GET", "/api/roles", undefined],
    ["PUT", "/api/account/name", { name: "Fictional Impatient" }],
    ["POST", "/api/accounts/any/password", {}],
  ] as const)(
    "refuses %s %s until the password is changed",
    async (method, url, payload) => {
      const user = await flaggedAdministrator();
      const response = await request(user.cookie, method, url, payload);
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual(refused);
    },
  );

  it("still reads the session, saying the password must be changed, and signs out", async () => {
    const user = await flaggedAdministrator();
    const session = await request(user.cookie, "GET", "/api/session");
    expect(session.statusCode).toBe(200);
    expect(session.json()).toMatchObject({
      user: { id: user.id },
      mustChangePassword: true,
    });
    const signedOut = await request(
      user.cookie,
      "POST",
      "/api/auth/sign-out",
      {},
    );
    expect(signedOut.statusCode).toBe(200);
    expect((await request(user.cookie, "GET", "/api/session")).statusCode).toBe(
      401,
    );
  });

  it("lets the user go on once they change it, recording the change", async () => {
    const user = await flaggedAdministrator();
    const changed = await request(
      user.cookie,
      "POST",
      "/api/auth/change-password",
      { currentPassword: password, newPassword },
    );
    expect(changed.statusCode).toBe(200);
    const cookie = await signIn(user.email, newPassword);
    expect((await request(cookie, "GET", "/api/session")).json()).toMatchObject(
      { mustChangePassword: false },
    );
    const history = await request(cookie, "GET", "/api/access-history");
    expect(history.statusCode).toBe(200);
    expect(
      history
        .json<{ entries: { action: string; subject: { id: string } }[] }>()
        .entries.filter(
          (entry) => entry.subject.id === user.id && !isSignIn(entry),
        )
        .map(({ action }) => action),
    ).toEqual(["password-changed", "account-created"]);
  });

  it("keeps asking when an administrator resets the password while it is being changed", async () => {
    const user = await flaggedAdministrator();
    // Holds the account's row, so the change saves the new password and then waits to clear the
    // flag, while a reset saves another password and sets the flag again.
    let release = () => undefined as unknown;
    const held = new Promise((resolve) => {
      release = resolve as () => unknown;
    });
    let locked = () => undefined as unknown;
    const isLocked = new Promise((resolve) => {
      locked = resolve as () => unknown;
    });
    const reset = connection.transaction(async (transaction) => {
      await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, user.id))
        .for("no key update");
      locked();
      await held;
      await transaction
        .update(accounts)
        .set({ password: "fictional reset hash" })
        .where(eq(accounts.userId, user.id));
      await transaction
        .update(users)
        .set({ mustChangePassword: true })
        .where(eq(users.id, user.id));
    });
    await isLocked;
    const changing = request(user.cookie, "POST", "/api/auth/change-password", {
      currentPassword: password,
      newPassword,
    });
    await vi.waitFor(
      async () => {
        const waiting = await connection.execute<{ total: string }>(
          sql`SELECT count(*) AS total FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()`,
        );
        expect(Number(waiting.rows[0]?.total)).toBeGreaterThan(0);
      },
      { timeout: 10_000 },
    );
    release();
    await reset;
    expect((await changing).statusCode).toBe(200);
    const [flag] = await connection
      .select({ mustChangePassword: users.mustChangePassword })
      .from(users)
      .where(eq(users.id, user.id));
    expect(flag).toEqual({ mustChangePassword: true });
  });

  it("refuses the generated password as the new one, and keeps asking", async () => {
    const user = await flaggedAdministrator();
    const response = await request(
      user.cookie,
      "POST",
      "/api/auth/change-password",
      { currentPassword: password, newPassword: password },
    );
    expect(response.statusCode).toBe(400);
    expect(
      (await request(user.cookie, "GET", "/api/session")).json(),
    ).toMatchObject({ mustChangePassword: true });
  });

  it("keeps asking when the current password is wrong", async () => {
    const user = await flaggedAdministrator();
    await request(user.cookie, "POST", "/api/auth/change-password", {
      currentPassword: "not the password",
      newPassword,
    });
    expect(
      (await request(user.cookie, "GET", "/api/session")).json(),
    ).toMatchObject({ mustChangePassword: true });
  });

  it("asks nothing of an account given its password directly, as seed and test accounts are", async () => {
    const user = await signedIn("administrator");
    expect(
      (await request(user.cookie, "GET", "/api/session")).json(),
    ).toMatchObject({ mustChangePassword: false });
    expect(
      (await request(user.cookie, "GET", "/api/accounts")).statusCode,
    ).toBe(200);
  });
});

describe("recording one's own password change", () => {
  type Entry = { action: string; subject: { id: string } };
  async function entriesFor(id: string) {
    const admin = await signedIn("administrator");
    const history = await request(admin.cookie, "GET", "/api/access-history");
    return history
      .json<{ entries: Entry[] }>()
      .entries.filter((entry) => entry.subject.id === id && !isSignIn(entry));
  }

  it("records the change, naming the user as both who and whom, without the passwords", async () => {
    const user = await signedIn("team-member");
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
    const user = await signedIn("team-member");
    await request(user.cookie, "POST", "/api/auth/change-password", {
      currentPassword: "not the password",
      newPassword,
    });
    expect(await entriesFor(user.id)).toMatchObject([
      { action: "account-created" },
    ]);
  });

  it("refuses, with an error, a password saved through Better Auth with no one signed in, but not other changes to an account", async () => {
    const user = await newAccount();
    const [account] = await connection
      .select({ id: accounts.id, password: accounts.password })
      .from(accounts)
      .where(eq(accounts.userId, user.id));
    const { internalAdapter } = await auth.$context;
    await expect(
      internalAdapter.updateAccount(String(account?.id), {
        password: "not a hash",
      }),
    ).rejects.toThrow("Sign in to change the password");
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
    const user = await signedIn("team-member");
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
    const user = await signedIn("team-member");
    const response = await request(user.cookie, "PUT", "/api/account/name", {
      name: " Fictional Self-Renamed ",
    });
    expect(response.statusCode).toBe(204);
    const session = await request(user.cookie, "GET", "/api/session");
    expect(session.json()).toMatchObject({
      user: { name: "Fictional Self-Renamed", email: user.email },
    });
    const admin = await signedIn("administrator");
    const history = await request(admin.cookie, "GET", "/api/access-history");
    const self = {
      id: user.id,
      name: "Fictional Self-Renamed",
      email: user.email,
    };
    expect(
      history
        .json<{ entries: { action: string; subject: { id: string } }[] }>()
        .entries.filter(
          (entry) => entry.subject.id === user.id && !isSignIn(entry),
        ),
    ).toMatchObject([
      { action: "own-name-changed", actor: self, subject: self },
      { action: "account-created" },
    ]);
  });

  it("records nothing when the name is the same", async () => {
    const user = await signedIn("team-member");
    const { name } = (await request(user.cookie, "GET", "/api/session")).json<{
      user: { name: string };
    }>().user;
    await request(user.cookie, "PUT", "/api/account/name", { name });
    const admin = await signedIn("administrator");
    const history = await request(admin.cookie, "GET", "/api/access-history");
    expect(
      history
        .json<{ entries: { action: string; subject: { id: string } }[] }>()
        .entries.filter(
          (entry) => entry.subject.id === user.id && !isSignIn(entry),
        )
        .map((entry) => entry.action),
    ).toEqual(["account-created"]);
  });

  it("changes only the name, never the email address or role sent with it", async () => {
    const user = await signedIn("team-member");
    await request(user.cookie, "PUT", "/api/account/name", {
      name: "Fictional Climber",
      email: "climber@example.test",
      roleId: await roleId("administrator"),
    });
    expect(
      (await request(user.cookie, "GET", "/api/session")).json(),
    ).toMatchObject({
      user: { name: "Fictional Climber", email: user.email },
      role: { key: "team-member" },
    });
  });

  it("refuses a name another account has, ignoring letter case and extra spaces", async () => {
    const other = await newAccount();
    await request(
      (await signedIn("administrator")).cookie,
      "PATCH",
      `/api/accounts/${other.id}`,
      { name: "Fictional Director" },
    );
    const user = await signedIn("team-member");
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
    const user = await signedIn("team-member");
    const response = await request(user.cookie, "PUT", "/api/account/name", {
      name,
    });
    expect(response.statusCode).toBe(400);
  });

  it("holds an Administrator's new accounts to the same rules for names", async () => {
    const admin = await signedIn("administrator");
    const response = await request(admin.cookie, "POST", "/api/accounts", {
      name: "n".repeat(101),
      email: "long-name@example.test",
      roleId: await roleId("team-member"),
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses an empty name", async () => {
    const user = await signedIn("team-member");
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
      const { cookie } = await signedIn(role);
      const response = await request(cookie, "GET", "/api/access-history");
      expect(response.statusCode).toBe(
        rolesGranting("administration:view").includes(role) ? 200 : 403,
      );
    },
  );

  it("records each change to accounts, newest first, with who made it and the roles involved, by name, but no passwords", async () => {
    const admin = await signedIn("administrator");
    const created = await request(admin.cookie, "POST", "/api/accounts", {
      name: "Fictional Recorded",
      email: "recorded@example.test",
      roleId: await roleId("team-member"),
    });
    const { id } = created.json<{ account: { id: string } }>().account;
    await request(admin.cookie, "PATCH", `/api/accounts/${id}`, {
      roleId: await roleId("executive"),
    });
    const reset = await request(
      admin.cookie,
      "POST",
      `/api/accounts/${id}/password`,
      {},
    );
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
        details: {
          previousRole: "Team Member",
          role: "Executive",
          previousRoles: ["Team Member"],
          roles: ["Executive"],
        },
      },
      {
        action: "account-created",
        actor,
        subject,
        details: { role: "Team Member", roles: ["Team Member"] },
      },
    ]);
    expect(history.body).not.toContain(
      created.json<{ password: string }>().password,
    );
    expect(history.body).not.toContain(
      reset.json<{ password: string }>().password,
    );
  });

  it("records each change to an account's name and email address, without the values, and nothing when neither changes", async () => {
    const admin = await signedIn("administrator");
    const other = await newAccount();
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
    await signedIn("administrator");
    const admin = await signedIn("administrator");
    const url = `/api/accounts/${admin.id}`;
    await request(admin.cookie, "PATCH", url, {
      name: "Fictional Myself",
      email: "myself@example.test",
      roleId: await roleId("workforce-administrator"),
    });
    const history = await request(
      (await signedIn("administrator")).cookie,
      "GET",
      "/api/access-history",
    );
    const self = { id: admin.id, name: "Fictional Myself" };
    expect(
      history
        .json<{ entries: { action: string; subject: { id: string } }[] }>()
        .entries.filter(
          (entry) => entry.subject.id === admin.id && !isSignIn(entry),
        ),
    ).toMatchObject([
      {
        action: "roles-changed",
        actor: self,
        subject: self,
        details: {
          previousRole: "Administrator",
          role: "Workforce Administrator",
        },
      },
      { action: "email-changed", actor: self, subject: self },
      { action: "name-changed", actor: self, subject: self },
      { action: "account-created" },
    ]);
  });

  it("stays readable with entries from another version of Fathom, or naming accounts that no longer exist", async () => {
    const admin = await signedIn("administrator");
    await database.superuserQuery(
      `INSERT INTO fathom.access_history (actor_id, action, subject_id, details) VALUES ('removed-actor', 'future-action', 'removed-subject', '{"roles": ["viewer"], "role": 7}')`,
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
      details: {},
    });
  });

  it("names no one for accounts the server's operators created with the account command", async () => {
    const admin = await signedIn("administrator");
    const { id } = await newAccount();
    const history = await request(admin.cookie, "GET", "/api/access-history");
    expect(
      history
        .json<{ entries: { subject: { id: string } }[] }>()
        .entries.find((entry) => entry.subject.id === id),
    ).toMatchObject({ action: "account-created", actor: null });
  });
});

describe("several roles", () => {
  interface Entry {
    action: string;
    subject: { id: string } | null;
    details: object;
  }

  async function historyOf(cookie: string, id: string): Promise<Entry[]> {
    const history = await request(cookie, "GET", "/api/access-history");
    return history
      .json<{ entries: Entry[] }>()
      .entries.filter((entry) => entry.subject?.id === id);
  }

  async function sessionOf(cookie: string) {
    const response = await request(cookie, "GET", "/api/session");
    return response.json<{
      role: { id: string; key: string | null } | null;
      roles: { id: string; name: string }[];
      defaultRoleId: string | null;
      permissions: string[];
    }>();
  }

  // An account holding Team Member, its default, and Administrator, signed in.
  async function holdingTwo(browserCookie = "") {
    const account = await newAccount("team-member");
    await connection.insert(userRoles).values({
      userId: account.id,
      roleId: await roleId("administrator"),
    });
    return {
      ...account,
      cookie: await signInWith(account.email, browserCookie),
    };
  }

  // Signs in from a browser that already holds a cookie, such as the role it remembers.
  async function signInWith(email: string, browserCookie: string) {
    addressCount += 1;
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      remoteAddress: `192.0.2.${String(addressCount % 250)}`,
      headers: { origin: publicUrl, cookie: browserCookie },
      payload: { email, password },
    });
    const cookie = [response.headers["set-cookie"]]
      .flat()
      .find((value) => value?.includes("session_token="));
    return cookie?.split(";")[0] ?? "";
  }

  const switchTo = (cookie: string, id: string) =>
    request(cookie, "PUT", "/api/session/role", { roleId: id });

  it("gives an account several roles with a default, recorded in the access history", async () => {
    const admin = await signedIn("administrator");
    const created = await request(admin.cookie, "POST", "/api/accounts", {
      name: "Fictional Several",
      email: "several@example.test",
      roleId: await roleId("executive"),
      roleIds: [await roleId("team-member"), await roleId("executive")],
    });
    expect(created.statusCode, created.body).toBe(201);
    const { account } = created.json<{
      account: { id: string; role: object; roles: object[] };
    }>();
    expect(account).toMatchObject({
      role: { id: await roleId("executive"), name: "Executive" },
      roles: [
        { id: await roleId("executive"), name: "Executive" },
        { id: await roleId("team-member"), name: "Team Member" },
      ],
    });
    expect(await historyOf(admin.cookie, account.id)).toMatchObject([
      {
        action: "account-created",
        details: { role: "Executive", roles: ["Executive", "Team Member"] },
      },
    ]);
  });

  it("refuses a default outside the roles, and no roles at all, changing nothing", async () => {
    const admin = await signedIn("administrator");
    const outside = await request(admin.cookie, "POST", "/api/accounts", {
      name: "Fictional Outside",
      email: "outside@example.test",
      roleId: await roleId("executive"),
      roleIds: [await roleId("team-member")],
    });
    expect(outside.statusCode).toBe(400);
    expect(outside.json()).toEqual({
      error: "The default role must be one of the account's roles",
    });
    const other = await newAccount("team-member");
    const url = `/api/accounts/${other.id}`;
    const refusals = [
      { roleIds: [] },
      { roleIds: [await roleId("executive")] },
      {
        roleId: await roleId("feature-lead"),
        roleIds: [await roleId("executive")],
      },
    ];
    for (const refused of refusals) {
      const response = await request(admin.cookie, "PATCH", url, refused);
      expect(response.statusCode, JSON.stringify(refused)).toBe(400);
    }
    expect(await historyOf(admin.cookie, other.id)).toHaveLength(1);
  });

  it("changes an account's roles and default together, recording them before and after, and nothing when they stay", async () => {
    const admin = await signedIn("administrator");
    const other = await newAccount("team-member");
    const url = `/api/accounts/${other.id}`;
    const roleIds = [
      await roleId("team-member"),
      await roleId("workforce-administrator"),
    ];
    const changed = await request(admin.cookie, "PATCH", url, {
      roleId: await roleId("workforce-administrator"),
      roleIds,
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(
      changed.json<{ account: { roles: object[] } }>().account.roles,
    ).toHaveLength(2);
    await request(admin.cookie, "PATCH", url, {
      roleIds: [...roleIds].reverse(),
    });
    await request(admin.cookie, "PATCH", url, {
      roleId: await roleId("team-member"),
      roleIds,
    });
    expect(await historyOf(admin.cookie, other.id)).toMatchObject([
      {
        action: "roles-changed",
        details: {
          role: "Team Member",
          previousRole: "Workforce Administrator",
          roles: ["Team Member", "Workforce Administrator"],
          previousRoles: ["Team Member", "Workforce Administrator"],
        },
      },
      {
        action: "roles-changed",
        details: {
          role: "Workforce Administrator",
          previousRole: "Team Member",
          roles: ["Team Member", "Workforce Administrator"],
          previousRoles: ["Team Member"],
        },
      },
      { action: "account-created" },
    ]);
  });

  it("refuses roles without a default for an account that has none", async () => {
    const admin = await signedIn("administrator");
    const other = await newAccount("team-member");
    await connection.delete(userRoles).where(eq(userRoles.userId, other.id));
    const response = await request(
      admin.cookie,
      "PATCH",
      `/api/accounts/${other.id}`,
      { roleIds: [await roleId("executive")] },
    );
    expect(response.statusCode).toBe(400);
  });

  it("signs in as the default role, listing every role, with only the default's permissions", async () => {
    const holder = await holdingTwo();
    const session = await sessionOf(holder.cookie);
    expect(session).toMatchObject({
      role: { id: await roleId("team-member"), key: "team-member" },
      roles: [
        { id: await roleId("administrator"), name: "Administrator" },
        { id: await roleId("team-member"), name: "Team Member" },
      ],
      defaultRoleId: await roleId("team-member"),
    });
    expect(session.permissions).not.toContain("administration:view");
    const accountsPage = await request(holder.cookie, "GET", "/api/accounts");
    expect(accountsPage.statusCode).toBe(403);
  });

  it("switches role at once, recording the switch and remembering it on the browser, with only that role's permissions", async () => {
    const holder = await holdingTwo();
    const administrator = await roleId("administrator");
    const switched = await switchTo(holder.cookie, administrator);
    expect(switched.statusCode, switched.body).toBe(204);
    const remembered = [switched.headers["set-cookie"]]
      .flat()
      .find((value) => value?.includes(`role=${administrator}`));
    expect(remembered).toMatch(
      /^__Secure-[\w.-]+\.role=[\w-]+; Max-Age=\d+; Path=\/; HttpOnly; Secure; SameSite=Lax$/u,
    );
    const session = await sessionOf(holder.cookie);
    expect(session.role?.key).toBe("administrator");
    expect(session.permissions).toContain("administration:edit");
    expect(session.permissions).not.toContain("plan:view");
    expect(
      (await request(holder.cookie, "GET", "/api/accounts")).statusCode,
    ).toBe(200);
    expect((await switchTo(holder.cookie, administrator)).statusCode).toBe(204);
    expect(await historyOf(holder.cookie, holder.id)).toMatchObject([
      {
        action: "role-switched",
        details: { role: "Administrator", previousRole: "Team Member" },
      },
      { action: "signed-in", details: { role: "Team Member" } },
      { action: "account-created" },
    ]);
  });

  it("records the role each session starts as, once, as its sign-in", async () => {
    const holder = await holdingTwo();
    await sessionOf(holder.cookie);
    const switched = await switchTo(
      holder.cookie,
      await roleId("administrator"),
    );
    const browser =
      String(
        [switched.headers["set-cookie"]]
          .flat()
          .find((value) => value?.includes(".role=")),
      ).split(";")[0] ?? "";
    const again = `${await signInWith(holder.email, browser)}; ${browser}`;
    await sessionOf(again);
    await sessionOf(again);
    const admin = await signedIn("administrator");
    const signIns = (await historyOf(admin.cookie, holder.id)).filter(
      ({ action }) => action === "signed-in",
    );
    expect(signIns).toMatchObject([
      { details: { role: "Administrator" } },
      { details: { role: "Team Member" } },
    ]);
  });

  it("keeps the role across a password change, which is not a new sign-in", async () => {
    const holder = await holdingTwo();
    await switchTo(holder.cookie, await roleId("administrator"));
    const changed = await request(
      holder.cookie,
      "POST",
      "/api/auth/change-password",
      { currentPassword: password, newPassword },
    );
    expect(changed.statusCode, changed.body).toBe(200);
    const cookie =
      [changed.headers["set-cookie"]]
        .flat()
        .find((value) => value?.includes("session_token="))
        ?.split(";")[0] ?? "";
    expect((await sessionOf(cookie)).role?.key).toBe("administrator");
    const admin = await signedIn("administrator");
    expect(
      (await historyOf(admin.cookie, holder.id)).map(({ action }) => action),
    ).toEqual([
      "password-changed",
      "role-switched",
      "signed-in",
      "account-created",
    ]);
  });

  it("refuses a switch from a deactivated account's session still open, changing nothing", async () => {
    const holder = await holdingTwo();
    await sessionOf(holder.cookie);
    await connection
      .update(users)
      .set({ deactivatedAt: new Date() })
      .where(eq(users.id, holder.id));
    const refused = await switchTo(
      holder.cookie,
      await roleId("administrator"),
    );
    expect(refused.statusCode).toBe(401);
    const [session] = await connection
      .select({ activeRoleId: sessions.activeRoleId })
      .from(sessions)
      .where(eq(sessions.userId, holder.id));
    expect(session?.activeRoleId).toBe(await roleId("team-member"));
  });

  it("refuses to switch to a role the account does not hold, changing nothing", async () => {
    const holder = await holdingTwo();
    const refused = await switchTo(holder.cookie, await roleId("executive"));
    expect(refused.statusCode).toBe(404);
    expect(refused.json()).toEqual({
      error: "This account doesn't have that role",
    });
    expect((await sessionOf(holder.cookie)).role?.key).toBe("team-member");
  });

  it("starts the next sign-in as the role last chosen on the browser, while the account holds it", async () => {
    const holder = await holdingTwo();
    const administrator = await roleId("administrator");
    const switched = await switchTo(holder.cookie, administrator);
    const browser =
      String(
        [switched.headers["set-cookie"]]
          .flat()
          .find((value) => value?.includes(".role=")),
      ).split(";")[0] ?? "";
    // The browser sends both cookies with every request, as browsers do.
    const signInFrom = async (cookie: string) =>
      `${await signInWith(holder.email, cookie)}; ${cookie}`;
    const again = await signInFrom(browser);
    expect((await sessionOf(again)).role?.key).toBe("administrator");
    const elsewhere = await signInWith(holder.email, "");
    expect((await sessionOf(elsewhere)).role?.key).toBe("team-member");
    const unreadable = await signInFrom(
      browser.replace(administrator, "not-a-role"),
    );
    expect((await sessionOf(unreadable)).role?.key).toBe("team-member");
    const admin = await signedIn("administrator");
    await request(admin.cookie, "PATCH", `/api/accounts/${holder.id}`, {
      roleId: await roleId("team-member"),
    });
    expect((await sessionOf(again)).role?.key).toBe("team-member");
    const [moved] = await historyOf(admin.cookie, holder.id);
    expect(moved).toMatchObject({
      action: "role-switched",
      actor: { id: holder.id },
      details: { role: "Team Member", previousRole: "Administrator" },
    });
    const afterwards = await signInFrom(browser);
    expect((await sessionOf(afterwards)).role?.key).toBe("team-member");
  });

  it("records a switch from a session not yet acting as a role without a role before it", async () => {
    const holder = await holdingTwo();
    const [session] = await connection
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, holder.id));
    await connection
      .update(sessions)
      .set({ activeRoleId: null })
      .where(eq(sessions.userId, holder.id));
    const data = createDataAccess(connection);
    const actor = actorWith(
      { id: holder.id, name: "", email: holder.email },
      [],
    );
    await data.switchRole(
      actor,
      String(session?.id),
      await roleId("administrator"),
    );
    await expect(
      data.switchRole(actor, "no-such-session", await roleId("team-member")),
    ).rejects.toThrow("This account doesn't have that role");
    const admin = await signedIn("administrator");
    expect(await historyOf(admin.cookie, holder.id)).toMatchObject([
      { action: "role-switched", details: { role: "Administrator" } },
      { action: "account-created" },
    ]);
    const [entry] = await historyOf(admin.cookie, holder.id);
    expect(entry?.details).not.toHaveProperty("previousRole");
  });
});
