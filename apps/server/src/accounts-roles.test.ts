// SPDX-License-Identifier: Apache-2.0

// Integration tests for accounts' roles against a migrated PostgreSQL server: the roles stored,
// which roles may manage accounts, and holding several roles.

import {
  databaseCodes,
  hasDatabaseCode,
  rolePermissions,
  roles as roleTable,
  sessions,
  userRoles,
  users,
} from "@fathom/db";
import { roleSchema, startingRoles } from "@fathom/shared";
import { eq, isNotNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actorWith, rolesGranting } from "./access.ts";
import { findStartingRole } from "./data/roles.ts";
import { createDataAccess } from "./data/index.ts";
import { missingRecord } from "./test-app.ts";
import {
  connection,
  app,
  publicUrl,
  password,
  newPassword,
  nextAddress,
  roleId,
  newAccount,
  signedIn,
  request,
  startAccountTests,
  closeAccountTests,
} from "./test-accounts.ts";

beforeAll(startAccountTests);

afterAll(closeAccountTests);

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
    ["PATCH", `/api/accounts/${missingRecord}`, { name: "Fictional Person" }],
    ["POST", `/api/accounts/${missingRecord}/password`, {}],
    ["PUT", `/api/accounts/${missingRecord}/active`, { active: false }],
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
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      remoteAddress: nextAddress(),
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
