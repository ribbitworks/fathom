// SPDX-License-Identifier: Apache-2.0

// Integration tests for administering accounts against a migrated PostgreSQL server: creating them
// and changing their names, email addresses, roles, passwords and whether they can sign in, signing
// users out when their password is reset or their account deactivated, and keeping the last active
// Administrator.

import { roles as roleTable, userRoles, users } from "@fathom/db";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { missingRecord } from "./test-app.ts";
import {
  database,
  connection,
  app,
  publicUrl,
  password,
  roleId,
  newAccount,
  madeRole,
  holdRole,
  signIn,
  signedIn,
  request,
  startAccountTests,
  closeAccountTests,
} from "./test-accounts.ts";

beforeAll(startAccountTests);

afterAll(closeAccountTests);

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

  it("creates an account identified by a UUID, with a generated password, which must be changed, recording when", async () => {
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
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
        ) as unknown,
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
    ["PATCH", `/api/accounts/${missingRecord}`, { name: "Fictional Person" }],
    ["POST", `/api/accounts/${missingRecord}/password`, {}],
    ["PUT", `/api/accounts/${missingRecord}/active`, { active: false }],
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
      error: "No other account can manage accounts.",
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
      error: "No other account can manage accounts.",
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
