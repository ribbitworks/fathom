// SPDX-License-Identifier: Apache-2.0

// Integration tests for users changing their own account against a migrated PostgreSQL server:
// their password, a generated password first, recording that change, and their name.

import { accounts, users } from "@fathom/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAccount } from "./data/accounts.ts";
import { missingRecord } from "./test-app.ts";
import {
  database,
  connection,
  auth,
  password,
  newPassword,
  nextAccountNumber,
  isSignIn,
  roleId,
  newAccount,
  signIn,
  signedIn,
  request,
  startAccountTests,
  closeAccountTests,
} from "./test-accounts.ts";

beforeAll(startAccountTests);

afterAll(closeAccountTests);

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
    const number = nextAccountNumber();
    const email = `flagged${String(number)}@example.test`;
    const id = await createAccount(auth, connection, {
      name: `Fictional Flagged ${String(number)}`,
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
    ["POST", `/api/accounts/${missingRecord}/password`, {}],
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
