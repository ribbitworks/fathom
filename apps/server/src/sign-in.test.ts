// SPDX-License-Identifier: Apache-2.0

// Tests for local accounts, sign-in, and sessions against a migrated PostgreSQL server: creating
// accounts with their role, what the signed-in user's role lets them do, signing in and out, the
// signed-in user, secure session cookies that last 30 minutes from last use, no public sign-up or
// other Better Auth features, logs without users' details, and sign-in limits that a client cannot
// dodge by naming another address.

import {
  createDatabase,
  createPool,
  type Database,
  runMigrations,
} from "@fathom/db";
import {
  createTestCertificate,
  startTestDatabase,
  type TestCertificate,
  type TestDatabase,
} from "@fathom/test-utils";
import { sql } from "drizzle-orm";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type App, buildApp } from "./app.ts";
import { createAccountCommand } from "./create-account.ts";
import { createAdministratorCommand } from "./create-administrator.ts";
import { createAccount, createFirstAdministrator } from "./data/accounts.ts";
import { type Auth, createAuth } from "./data/auth.ts";
import { createDataAccess } from "./data/index.ts";
import { findStartingRole, lockAccessManagers } from "./data/roles.ts";

let database: TestDatabase;
let certificate: TestCertificate;
let pool: ReturnType<typeof createPool>;
let connection: Database;
// The role accounts made here hold.
let teamMember: string;
let auth: Auth;
let app: App;
const logLines: string[] = [];
// A fictional address for Fathom, and a session secret used only by these tests.
const publicUrl = "https://fathom.example.test";
const secret = "fictional-session-secret-for-tests-only-0123456789";
const password = "fictional password 1";
// Each test signs in from its own fictional address, so sign-in limits do not carry between tests.
let nextAddress = 10;
const newAddress = () => `192.0.2.${String((nextAddress += 1))}`;

beforeAll(async () => {
  certificate = createTestCertificate();
  database = await startTestDatabase();
  await runMigrations(database.migrator);
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
  teamMember = await findStartingRole(connection, "team-member");
  // A second Better Auth for creating accounts directly, as the account command does.
  auth = createAuth(connection, { publicUrl, secret });
  app = await buildApp({
    data: createDataAccess(connection),
    database: connection,
    auth: { publicUrl, secret },
    tls: certificate,
    logStream: { write: (line) => logLines.push(line) },
  });
});

afterAll(async () => {
  await app.close();
  await pool.end();
  await database.container.stop();
  certificate.remove();
});

let nextAccount = 0;
// Creates a fictional account and returns its email address.
async function newAccount(): Promise<string> {
  nextAccount += 1;
  const email = `person${String(nextAccount)}@example.test`;
  await createAccount(auth, connection, {
    name: `Fictional Person ${String(nextAccount)}`,
    email,
    password,
    roleId: teamMember,
  });
  return email;
}

function signIn(
  email: string,
  attempt: {
    password?: string;
    from?: string;
    claimedAddress?: string;
    extra?: object;
  } = {},
) {
  return app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    remoteAddress: attempt.from ?? newAddress(),
    headers: {
      origin: publicUrl,
      ...(attempt.claimedAddress === undefined
        ? {}
        : { "x-fathom-client-address": attempt.claimedAddress }),
    },
    payload: {
      email,
      password: attempt.password ?? password,
      ...attempt.extra,
    },
  });
}

// Sets a user's session as if its expiry was last pushed back the given interval ago.
async function lastExtendedAgo(email: string, interval: string) {
  await database.superuserQuery(
    `UPDATE fathom.sessions SET expires_at = now() + interval '30 minutes' - interval '${interval}' WHERE user_id = (SELECT id FROM fathom.users WHERE email = '${email}')`,
  );
}

// The session cookie, as a browser would send it back.
function sessionCookie(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
  const session = cookies.find((cookie) => cookie.includes("session_token="));
  return session?.split(";")[0] ?? "";
}

describe("signing in", () => {
  it("signs in with the right password, and knows who is signed in", async () => {
    const email = await newAccount();
    const response = await signIn(email);
    expect(response.statusCode).toBe(200);
    const session = await app.inject({
      url: "/api/session",
      headers: { cookie: sessionCookie(response.headers["set-cookie"]) },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json()).toMatchObject({ user: { email } });
  });

  it("keeps the session in a cookie that scripts cannot read, sent only over HTTPS to Fathom's own pages, for 30 minutes", async () => {
    const response = await signIn(await newAccount());
    const cookie = [response.headers["set-cookie"]]
      .flat()
      .find((value) => value?.includes("session_token="));
    expect(cookie).toMatch(/^__Secure-/);
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; Secure/i);
    expect(cookie).toMatch(/; SameSite=Lax/i);
    expect(cookie).toMatch(/; Max-Age=1800/i);
  });

  it("names the session cookie after Fathom's port, so copies on one machine keep their own sessions", async () => {
    const email = await newAccount();
    const sessionCookieFor = async (url: string) => {
      const { headers } = await createAuth(connection, {
        publicUrl: new URL(url).origin,
        secret,
      }).api.signInEmail({ body: { email, password }, returnHeaders: true });
      return (
        headers
          .getSetCookie()
          .find((value) => value.includes("session_token="))
          ?.split(";")[0] ?? ""
      );
    };
    const name = (cookie: string) => cookie.split("=")[0];
    expect(name(await sessionCookieFor(publicUrl))).toBe(
      "__Secure-better-auth.session_token",
    );
    expect(name(await sessionCookieFor(`${publicUrl}:443`))).toBe(
      "__Secure-better-auth.session_token",
    );
    const copy = createAuth(connection, {
      publicUrl: "https://localhost:8453",
      secret,
    });
    const portCookie = await sessionCookieFor("https://localhost:8453");
    expect(name(portCookie)).toBe("__Secure-fathom-8453.session_token");
    const sessionOf = (cookie: string) =>
      copy.api.getSession({ headers: new Headers({ cookie }) });
    expect(await sessionOf(portCookie)).toMatchObject({ user: { email } });
    expect(await sessionOf(await sessionCookieFor(publicUrl))).toBeNull();
  });

  it("does not let a client ask for a session of a different length", async () => {
    const response = await signIn(await newAccount(), {
      extra: { rememberMe: false },
    });
    const cookie = [response.headers["set-cookie"]]
      .flat()
      .find((value) => value?.includes("session_token="));
    expect(cookie).toMatch(/; Max-Age=1800/i);
  });

  it("refuses sign-in requests that are not an email address and password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      remoteAddress: newAddress(),
      headers: { origin: publicUrl },
      payload: { email: await newAccount() },
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses the wrong password, without starting a session, logging no details of who tried", async () => {
    const email = await newAccount();
    const response = await signIn(email, { password: "not the password" });
    expect(response.statusCode).toBe(401);
    expect(sessionCookie(response.headers["set-cookie"])).toBe("");
    const logs = logLines.join("");
    expect(logs).toContain("Invalid password");
    expect(logs).not.toContain(email);
  });

  it("extends a session last extended over a minute ago, giving the browser a new cookie", async () => {
    const email = await newAccount();
    const cookie = sessionCookie((await signIn(email)).headers["set-cookie"]);
    await lastExtendedAgo(email, "2 minutes");
    const response = await app.inject({
      url: "/api/session",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(sessionCookie(response.headers["set-cookie"])).not.toBe("");
  });

  it("does not extend a session again within a minute", async () => {
    const cookie = sessionCookie(
      (await signIn(await newAccount())).headers["set-cookie"],
    );
    const response = await app.inject({
      url: "/api/session",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(sessionCookie(response.headers["set-cookie"])).toBe("");
  });

  it("ends a session after 30 minutes without use", async () => {
    const email = await newAccount();
    const cookie = sessionCookie((await signIn(email)).headers["set-cookie"]);
    await lastExtendedAgo(email, "31 minutes");
    const response = await app.inject({
      url: "/api/session",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(401);
  });

  it("offers none of Better Auth's other features, such as users changing their own name", async () => {
    const cookie = sessionCookie(
      (await signIn(await newAccount())).headers["set-cookie"],
    );
    for (const path of ["update-user", "list-sessions", "revoke-sessions"]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/auth/${path}`,
        headers: { cookie, origin: publicUrl },
        payload: { name: "Fictional New Name" },
      });
      expect(response.statusCode).toBe(404);
    }
  });

  it("passes Better Auth's own requests that read, such as its session check", async () => {
    const email = await newAccount();
    const cookie = sessionCookie((await signIn(email)).headers["set-cookie"]);
    const response = await app.inject({
      url: "/api/auth/get-session",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { email } });
  });

  it("says what the signed-in user's role lets them do", async () => {
    await createAccount(auth, connection, {
      name: "Fictional Planner",
      email: "planner@example.test",
      password,
      roleId: await findStartingRole(connection, "product-manager"),
    });
    const cookie = sessionCookie(
      (await signIn("planner@example.test")).headers["set-cookie"],
    );
    const session = await app.inject({
      url: "/api/session",
      headers: { cookie },
    });
    expect(session.json()).toMatchObject({
      role: {
        key: "product-manager",
        name: "Product Manager",
        description: expect.stringMatching(/^Edits projects/u) as unknown,
      },
      permissions: [
        "allocations:view",
        "changes:view",
        "drafts:submit",
        "features:edit",
        "org-chart:view",
        "plan:approve",
        "plan:edit",
        "plan:view",
      ],
    });
  });

  it("applies a change of role on the next request, without signing in again", async () => {
    const email = await newAccount();
    const cookie = sessionCookie((await signIn(email)).headers["set-cookie"]);
    const role = async () =>
      (await app.inject({ url: "/api/session", headers: { cookie } })).json<{
        role: { key: string };
      }>().role.key;
    expect(await role()).toBe("team-member");
    await database.superuserQuery(
      `UPDATE fathom.user_roles SET role_id = (SELECT id FROM fathom.roles WHERE key = 'executive') WHERE user_id = (SELECT id FROM fathom.users WHERE email = '${email}')`,
    );
    expect(await role()).toBe("executive");
  });

  it("grants what a role stores, whether or not it is a starting role, and nothing the server does not know", async () => {
    const email = await newAccount();
    await database.superuserQuery(
      `INSERT INTO fathom.roles (key, name) VALUES (NULL, 'Fictional Copied Role')`,
    );
    await database.superuserQuery(
      `INSERT INTO fathom.role_permissions (role_id, permission) SELECT id, p FROM fathom.roles, (VALUES ('people:view'), ('retired:permission')) AS g (p) WHERE name = 'Fictional Copied Role'`,
    );
    await database.superuserQuery(
      `UPDATE fathom.user_roles SET role_id = (SELECT id FROM fathom.roles WHERE name = 'Fictional Copied Role') WHERE user_id = (SELECT id FROM fathom.users WHERE email = '${email}')`,
    );
    const cookie = sessionCookie((await signIn(email)).headers["set-cookie"]);
    const session = async () =>
      (await app.inject({ url: "/api/session", headers: { cookie } })).json<{
        permissions: string[];
      }>();
    expect(await session()).toMatchObject({
      role: { key: null, name: "Fictional Copied Role" },
      permissions: ["people:view"],
    });
    // A change to what a role grants takes effect at the next request.
    await database.superuserQuery(
      `INSERT INTO fathom.role_permissions (role_id, permission) SELECT id, 'personal:edit' FROM fathom.roles WHERE name = 'Fictional Copied Role'`,
    );
    expect((await session()).permissions).toEqual([
      "people:view",
      "personal:edit",
      "personal:view",
    ]);
    await database.superuserQuery(
      `DELETE FROM fathom.role_permissions WHERE role_id = (SELECT id FROM fathom.roles WHERE name = 'Fictional Copied Role')`,
    );
    expect((await session()).permissions).toEqual([]);
  });

  it("does not say who is signed in without a session", async () => {
    const response = await app.inject("/api/session");
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
  });

  it("ends the session on signing out", async () => {
    const cookie = sessionCookie(
      (await signIn(await newAccount())).headers["set-cookie"],
    );
    const signOut = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { cookie, origin: publicUrl },
      payload: {},
    });
    expect(signOut.statusCode).toBe(200);
    const session = await app.inject({
      url: "/api/session",
      headers: { cookie },
    });
    expect(session.statusCode).toBe(401);
  });

  it("has no public sign-up", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      remoteAddress: newAddress(),
      headers: { origin: publicUrl },
      payload: {
        name: "Fictional Stranger",
        email: "stranger@example.test",
        password,
      },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect((await signIn("stranger@example.test")).statusCode).toBe(401);
  });

  it("refuses sign-in from another site's page", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin: "https://another.example.test" },
      payload: { email: await newAccount(), password },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("sign-in limits", () => {
  it("limit each client address to five attempts a minute, whatever address the client claims", async () => {
    const email = await newAccount();
    const from = newAddress();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await signIn(email, {
        from,
        password: "not the password",
        claimedAddress: `198.51.100.${String(attempt)}`,
      });
      expect(response.statusCode).toBe(401);
    }
    const blocked = await signIn(email, {
      from,
      claimedAddress: "198.51.100.99",
    });
    expect(blocked.statusCode).toBe(429);
    // Another client is not affected.
    expect((await signIn(email)).statusCode).toBe(200);
  });
});

describe("creating accounts", () => {
  it("creates an account that can sign in, ignoring the case of its email address", async () => {
    await createAccount(auth, connection, {
      name: "Fictional Mixed Case",
      email: " Mixed.Case@Example.TEST ",
      password,
      roleId: teamMember,
    });
    expect((await signIn("mixed.case@example.test")).statusCode).toBe(200);
  });

  it("refuses a second account with the same email address", async () => {
    const email = await newAccount();
    await expect(
      createAccount(auth, connection, {
        name: "Someone Else",
        email,
        password,
        roleId: teamMember,
      }),
    ).rejects.toThrow("An account with this email address already exists");
  });

  it("refuses email addresses that are not valid", async () => {
    await expect(
      createAccount(auth, connection, {
        name: "Fictional Person",
        email: "not an address",
        password,
        roleId: teamMember,
      }),
    ).rejects.toThrow("The email address is not valid");
  });

  it("refuses passwords that are too short or too long", async () => {
    for (const [tried, message] of [
      ["short", "at least 8"],
      ["x".repeat(129), "at most 128"],
    ] as const) {
      await expect(
        createAccount(auth, connection, {
          name: "Fictional Person",
          email: "length@example.test",
          password: tried,
          roleId: teamMember,
        }),
      ).rejects.toThrow(message);
    }
  });

  it("removes the account again if its password cannot be stored", async () => {
    const context = await auth.$context;
    const failing = vi
      .spyOn(context.internalAdapter, "linkAccount")
      .mockRejectedValueOnce(new Error("A fictional storage failure"));
    try {
      await expect(
        createAccount(auth, connection, {
          name: "Fictional Person",
          email: "unstored@example.test",
          password,
          roleId: teamMember,
        }),
      ).rejects.toThrow("A fictional storage failure");
      expect(
        await context.internalAdapter.findUserByEmail("unstored@example.test"),
      ).toBeNull();
    } finally {
      failing.mockRestore();
    }
  });
});

describe("account command", () => {
  let folder: string;
  let environment: NodeJS.ProcessEnv;

  beforeAll(() => {
    folder = mkdtempSync(join(tmpdir(), "fathom-account-command-"));
    writeFileSync(join(folder, "password"), database.app.password);
    writeFileSync(join(folder, "secret"), secret);
    environment = {
      FATHOM_PUBLIC_URL: publicUrl,
      FATHOM_AUTH_SECRET_FILE: join(folder, "secret"),
      FATHOM_DB_HOST: database.app.host,
      FATHOM_DB_PORT: String(database.app.port),
      FATHOM_DB_NAME: database.app.database,
      FATHOM_DB_USER: database.app.user,
      FATHOM_DB_PASSWORD_FILE: join(folder, "password"),
    };
  });

  afterAll(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  // Runs a command, returning its exit status and what it printed.
  async function run(
    command: (
      args: string[],
      environment: NodeJS.ProcessEnv,
    ) => Promise<number>,
    args: string[],
  ) {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const status = await command(args, environment);
      return {
        status,
        printed: log.mock.calls.map((call) => String(call[0])),
        errors: error.mock.calls.map((call) => String(call[0])),
      };
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  }

  // The password a command printed.
  const printedPassword = (printed: string[]) =>
    printed
      .find((line) => line.startsWith("Password: "))
      ?.slice("Password: ".length) ?? "";

  // The session of a user who signed in with a password, as /api/session answers it.
  async function sessionOf(email: string, withPassword: string) {
    const cookie = sessionCookie(
      (await signIn(email, { password: withPassword })).headers["set-cookie"],
    );
    return (
      await app.inject({ url: "/api/session", headers: { cookie } })
    ).json<{
      mustChangePassword: boolean;
    }>();
  }

  it("creates an account with a generated password, printed once, which must be changed", async () => {
    const { status, printed } = await run(createAccountCommand, [
      "--name",
      "Fictional Planner",
      "--email",
      "Command.Planner@example.test",
      "--role",
      "product-manager",
    ]);
    expect(status).toBe(0);
    expect(printed).toEqual([
      "Created the account for command.planner@example.test.",
      expect.stringMatching(/^Password: [A-Za-z2-9]{20}$/u),
      "Fathom shows this password only once, and asks for a new one at first sign-in.",
    ]);
    expect(
      await sessionOf("command.planner@example.test", printedPassword(printed)),
    ).toMatchObject({
      role: { key: "product-manager", name: "Product Manager" },
      mustChangePassword: true,
    });
  });

  it("gives the Team Member role when no role is named", async () => {
    const { status, printed } = await run(createAccountCommand, [
      "--name",
      "Fictional Operator",
      "--email",
      "operator@example.test",
    ]);
    expect(status).toBe(0);
    expect(
      await sessionOf("operator@example.test", printedPassword(printed)),
    ).toMatchObject({
      role: { key: "team-member", name: "Team Member" },
      permissions: ["allocations:view", "org-chart:view", "plan:view"],
    });
  });

  it("reports what is wrong, and fails", async () => {
    for (const [args, error] of [
      [["--email", "nameless@example.test"], /^error: Usage: create-account/u],
      [
        [
          "--name",
          "Fictional Person",
          "--email",
          "role@example.test",
          "--role",
          "emperor",
        ],
        /^error: Unknown role emperor\nUsage/u,
      ],
      [["--name", "Fictional Person", "--unknown"], /^error: Unknown option/u],
      [
        ["--name", "Fictional Person", "--email", "not an address"],
        /^error: The email address is not valid$/u,
      ],
    ] as const) {
      const result = await run(createAccountCommand, [...args]);
      expect(result.status).toBe(1);
      expect(result.errors).toEqual([expect.stringMatching(error)]);
    }
  });
});

describe("administrator command", () => {
  let folder: string;
  let environment: NodeJS.ProcessEnv;
  // The command runs against a database of its own, which starts with no Administrator.
  let ownDatabase: TestDatabase;

  beforeAll(async () => {
    ownDatabase = await startTestDatabase();
    await runMigrations(ownDatabase.migrator);
    folder = mkdtempSync(join(tmpdir(), "fathom-administrator-command-"));
    writeFileSync(join(folder, "password"), ownDatabase.app.password);
    writeFileSync(join(folder, "secret"), secret);
    environment = {
      FATHOM_PUBLIC_URL: publicUrl,
      FATHOM_AUTH_SECRET_FILE: join(folder, "secret"),
      FATHOM_DB_HOST: ownDatabase.app.host,
      FATHOM_DB_PORT: String(ownDatabase.app.port),
      FATHOM_DB_NAME: ownDatabase.app.database,
      FATHOM_DB_USER: ownDatabase.app.user,
      FATHOM_DB_PASSWORD_FILE: join(folder, "password"),
    };
  });

  afterAll(async () => {
    rmSync(folder, { recursive: true, force: true });
    await ownDatabase.container.stop();
  });

  async function run(args: string[]) {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      return {
        status: await createAdministratorCommand(args, environment),
        printed: log.mock.calls.map((call) => String(call[0])),
        errors: error.mock.calls.map((call) => String(call[0])),
      };
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  }

  // Each account, with whether it must change its password and its role's key.
  function accounts() {
    return ownDatabase.superuserQuery(
      "SELECT u.name, u.email, u.must_change_password, r.key FROM fathom.users u JOIN fathom.user_roles ur ON ur.user_id = u.id JOIN fathom.roles r ON r.id = ur.role_id",
    );
  }

  it("asks for the email address", async () => {
    expect(await run([])).toEqual({
      status: 1,
      printed: [],
      errors: ["error: Usage: create-administrator --email <email address>"],
    });
  });

  it("creates the Fathom Administrator once, with a generated password that must be changed", async () => {
    const first = await run(["--email", "Install.Admin@example.test"]);
    expect(first).toEqual({
      status: 0,
      printed: [
        "Created the Fathom Administrator account for install.admin@example.test.",
        expect.stringMatching(/^Password: [A-Za-z2-9]{20}$/u),
        "Fathom shows this password only once, and asks for a new one at first sign-in.",
      ],
      errors: [],
    });
    expect(await accounts()).toBe(
      "Fathom Administrator|install.admin@example.test|t|administrator",
    );
    expect(
      await ownDatabase.superuserQuery(
        "SELECT action, actor_id IS NULL FROM fathom.access_history",
      ),
    ).toBe("account-created|t");

    expect(await run(["--email", "second.admin@example.test"])).toEqual({
      status: 0,
      printed: [
        "An account already holds the Administrator role, so nothing was changed.",
      ],
      errors: [],
    });
    expect(await accounts()).toBe(
      "Fathom Administrator|install.admin@example.test|t|administrator",
    );
  });

  it("creates only one when run twice at once", async () => {
    // No account holds the Administrator role again.
    await ownDatabase.superuserQuery(
      "UPDATE fathom.user_roles SET role_id = (SELECT id FROM fathom.roles WHERE key = 'team-member')",
    );
    const ownPool = createPool(ownDatabase.app, () => undefined);
    const own = createDatabase(ownPool);
    const ownAuth = createAuth(own, { publicUrl, secret });
    try {
      // Both runs start while the lock is held, so each would see no Administrator without it.
      let release = () => undefined as unknown;
      const held = new Promise((resolve) => {
        release = resolve as () => unknown;
      });
      let locked = () => undefined as unknown;
      const isLocked = new Promise((resolve) => {
        locked = resolve as () => unknown;
      });
      const holding = own.transaction(async (transaction) => {
        await lockAccessManagers(transaction);
        locked();
        await held;
      });
      await isLocked;
      const runs = ["first", "second"].map((name) =>
        createFirstAdministrator(ownAuth, own, `${name}.admin@example.test`),
      );
      await vi.waitFor(
        async () => {
          const waiting = await own.execute<{ total: string }>(
            sql`SELECT count(*) AS total FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND wait_event = 'advisory' AND datname = current_database()`,
          );
          expect(Number(waiting.rows[0]?.total)).toBe(2);
        },
        { timeout: 10_000 },
      );
      release();
      await holding;
      const created = await Promise.all(runs);
      expect(created.filter((result) => result !== null)).toHaveLength(1);
      expect(
        await ownDatabase.superuserQuery(
          "SELECT count(*) FROM fathom.user_roles ur JOIN fathom.roles r ON r.id = ur.role_id WHERE r.key = 'administrator'",
        ),
      ).toBe("1");
    } finally {
      await ownPool.end();
    }
  });
});
