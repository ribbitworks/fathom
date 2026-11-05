// SPDX-License-Identifier: Apache-2.0

// Tests for local accounts, sign-in, and sessions against a migrated PostgreSQL server: creating
// accounts with their roles, what the signed-in user's roles let them do, signing in and out, the
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
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type App, buildApp } from "./app.ts";
import { createAccountCommand } from "./create-account.ts";
import { createAccount } from "./data/accounts.ts";
import { type Auth, createAuth } from "./data/auth.ts";
import { createDataAccess } from "./data/index.ts";

let database: TestDatabase;
let certificate: TestCertificate;
let pool: ReturnType<typeof createPool>;
let connection: Database;
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

  it("says what the signed-in user's roles let them do", async () => {
    await createAccount(auth, connection, {
      name: "Fictional Planner",
      email: "planner@example.test",
      password,
      roles: ["project-planner"],
    });
    const cookie = sessionCookie(
      (await signIn("planner@example.test")).headers["set-cookie"],
    );
    const session = await app.inject({
      url: "/api/session",
      headers: { cookie },
    });
    expect(session.json()).toMatchObject({
      roles: ["project-planner"],
      permissions: ["changes:view", "drafts:submit", "plan:edit", "plan:view"],
    });
  });

  it("applies a change of roles on the next request, without signing in again", async () => {
    const email = await newAccount();
    const cookie = sessionCookie((await signIn(email)).headers["set-cookie"]);
    const roles = async () =>
      (await app.inject({ url: "/api/session", headers: { cookie } })).json<{
        roles: string[];
      }>().roles;
    expect(await roles()).toEqual([]);
    await database.superuserQuery(
      `INSERT INTO fathom.user_roles (user_id, role_id) SELECT u.id, r.id FROM fathom.users u, fathom.roles r WHERE u.email = '${email}' AND r.key = 'leadership'`,
    );
    expect(await roles()).toEqual(["leadership"]);
  });

  it("grants what a role stores, whether or not it is a starting role, and nothing the server does not know", async () => {
    const email = await newAccount();
    await database.superuserQuery(
      `INSERT INTO fathom.roles (key, name) VALUES ('retired-role', 'Fictional Retired Role'), (NULL, 'Fictional Copied Role')`,
    );
    await database.superuserQuery(
      `INSERT INTO fathom.role_permissions (role_id, permission) SELECT id, p FROM fathom.roles, (VALUES ('people:view'), ('retired:permission')) AS g (p) WHERE name = 'Fictional Copied Role'`,
    );
    await database.superuserQuery(
      `INSERT INTO fathom.user_roles (user_id, role_id) SELECT u.id, r.id FROM fathom.users u, fathom.roles r WHERE u.email = '${email}' AND r.name IN ('Fictional Retired Role', 'Fictional Copied Role')`,
    );
    const cookie = sessionCookie((await signIn(email)).headers["set-cookie"]);
    const session = async () =>
      (await app.inject({ url: "/api/session", headers: { cookie } })).json<{
        roles: string[];
        permissions: string[];
      }>();
    expect(await session()).toMatchObject({
      roles: [],
      permissions: ["people:view"],
    });
    // A change to what a role grants takes effect at the next request.
    await database.superuserQuery(
      `INSERT INTO fathom.role_permissions (role_id, permission) SELECT id, 'restricted:edit' FROM fathom.roles WHERE name = 'Fictional Copied Role'`,
    );
    expect((await session()).permissions).toEqual([
      "people:view",
      "restricted:edit",
      "restricted:view",
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
      }),
    ).rejects.toThrow("An account with this email address already exists");
  });

  it("refuses email addresses that are not valid", async () => {
    await expect(
      createAccount(auth, connection, {
        name: "Fictional Person",
        email: "not an address",
        password,
      }),
    ).rejects.toThrow("The email address is not valid");
  });

  it("refuses passwords that are too short or too long", async () => {
    for (const [tried, message] of [
      ["short", "at least 12"],
      ["x".repeat(129), "at most 128"],
    ] as const) {
      await expect(
        createAccount(auth, connection, {
          name: "Fictional Person",
          email: "length@example.test",
          password: tried,
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

  it("creates an account with the password from standard input", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const status = await createAccountCommand(
        [
          "--name",
          "Fictional Administrator",
          "--email",
          "admin@example.test",
          "--role",
          "administrator",
          "--role",
          "workforce-administrator",
        ],
        Promise.resolve(`${password}\n`),
        environment,
      );
      expect(status).toBe(0);
      expect(log).toHaveBeenCalledWith(
        "Created the account for admin@example.test",
      );
    } finally {
      log.mockRestore();
    }
    const cookie = sessionCookie(
      (await signIn("admin@example.test")).headers["set-cookie"],
    );
    const session = await app.inject({
      url: "/api/session",
      headers: { cookie },
    });
    expect(session.json()).toMatchObject({
      roles: ["viewer", "workforce-administrator", "administrator"],
    });
  });

  it("leaves Viewer off when asked, as for a person who only runs Fathom", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      expect(
        await createAccountCommand(
          [
            "--name",
            "Fictional Operator",
            "--email",
            "operator@example.test",
            "--role",
            "administrator",
            "--no-viewer",
          ],
          Promise.resolve(password),
          environment,
        ),
      ).toBe(0);
    } finally {
      log.mockRestore();
    }
    const cookie = sessionCookie(
      (await signIn("operator@example.test")).headers["set-cookie"],
    );
    const session = await app.inject({
      url: "/api/session",
      headers: { cookie },
    });
    expect(session.json()).toMatchObject({
      roles: ["administrator"],
      permissions: ["accounts:manage", "history:view", "roles:edit"],
    });
  });

  it("reports what is wrong, and fails", async () => {
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      expect(
        await createAccountCommand(
          ["--email", "nameless@example.test"],
          Promise.resolve(password),
          environment,
        ),
      ).toBe(1);
      expect(errors).toHaveBeenLastCalledWith(
        expect.stringMatching(/^error: Usage: create-account/),
      );
      expect(
        await createAccountCommand(
          ["--name", "Fictional Person", "--email", "short@example.test"],
          Promise.resolve("short"),
          environment,
        ),
      ).toBe(1);
      expect(errors).toHaveBeenLastCalledWith(
        "error: The password must have at least 12 characters",
      );
      expect(
        await createAccountCommand(
          [
            "--name",
            "Fictional Person",
            "--email",
            "role@example.test",
            "--role",
            "emperor",
          ],
          Promise.resolve(password),
          environment,
        ),
      ).toBe(1);
      expect(errors).toHaveBeenLastCalledWith(
        expect.stringMatching(/^error: Unknown role emperor\nUsage/),
      );
    } finally {
      errors.mockRestore();
    }
  });
});
