// SPDX-License-Identifier: Apache-2.0

// Tests for editing roles through the API: who may, listing roles with what they grant and how many
// active accounts hold them, creating and changing roles, what a change would do to the accounts
// holding a role, the access history it leaves, and the refusal of any change that would leave no
// active account with Edit Administration.

import { rolePermissions, userRoles, users } from "@fathom/db";
import {
  type Permission,
  roleSchema,
  startingRoles,
  type RoleSummary,
} from "@fathom/shared";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rolesGranting } from "./access.ts";
import { giveRole } from "./data/roles.ts";
import { startTestApp, type TestApp } from "./test-app.ts";

let test: TestApp;
let cookie: string;
let editorId: string;

beforeAll(async () => {
  test = await startTestApp();
  ({ cookie, id: editorId } = await test.signedIn("administrator"));
});

afterAll(async () => {
  await test.close();
});

const send = (
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: object,
  as = cookie,
) => test.request(as, method, url, payload, { publish: false });

// A change to a role as a dialog opened just now would send it, naming when the role last changed.
async function change(id: string, payload: object, as = cookie) {
  const role = (await listRoles(as)).find((other) => other.id === id);
  return send(
    "PUT",
    `/api/roles/${id}`,
    { updatedAt: role?.updatedAt ?? new Date().toISOString(), ...payload },
    as,
  );
}

async function listRoles(as = cookie): Promise<RoleSummary[]> {
  return (await send("GET", "/api/roles", undefined, as)).json<{
    roles: RoleSummary[];
  }>().roles;
}

async function roleNamed(name: string): Promise<RoleSummary> {
  const found = (await listRoles()).find((role) => role.name === name);
  if (found === undefined) throw new Error(`No role named ${name}`);
  return found;
}

let roleCount = 0;

// A new role, made through the API, with a fictional name of its own.
async function newRole(permissions: Permission[]): Promise<RoleSummary> {
  roleCount += 1;
  const response = await send("POST", "/api/roles", {
    name: `Fictional Role ${String(roleCount)}`,
    description: "For a test.",
    permissions,
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ role: RoleSummary }>().role;
}

async function give(userId: string, roleId: string): Promise<void> {
  await giveRole(test.connection, userId, roleId);
}

async function permissionsOf(as: string): Promise<string[]> {
  return (await send("GET", "/api/session", undefined, as)).json<{
    permissions: string[];
  }>().permissions;
}

// The latest access history entries, newest first.
async function latestEntries(count: number) {
  const entries = (await send("GET", "/api/access-history")).json<{
    entries: { action: string; details: object; actor: { id: string } }[];
  }>().entries;
  return entries.slice(0, count);
}

describe("who may edit roles", () => {
  // Every other test lists roles as an Administrator, whose account must be the only one managing
  // accounts.
  it.each(roleSchema.options.filter((role) => role !== "administrator"))(
    "lets a %s list roles only if the role lets them see roles",
    async (role) => {
      const other = await test.signedIn(role);
      expect(
        (await send("GET", "/api/roles", undefined, other.cookie)).statusCode,
      ).toBe(rolesGranting("administration:view").includes(role) ? 200 : 403);
    },
  );

  it.each(roleSchema.options.filter((role) => role !== "administrator"))(
    "refuses %s, which cannot edit roles, any change",
    async (role) => {
      const other = await test.signedIn(role);
      const id = randomUUID();
      for (const [method, url, payload] of [
        [
          "POST",
          "/api/roles",
          { name: "Fictional", description: "", permissions: [] },
        ],
        [
          "PUT",
          `/api/roles/${id}`,
          {
            name: "Fictional",
            description: "",
            permissions: [],
            updatedAt: new Date().toISOString(),
          },
        ],
        ["POST", `/api/roles/${id}/effects`, { permissions: [] }],
      ] as const) {
        expect(
          (await send(method, url, payload, other.cookie)).statusCode,
        ).toBe(403);
      }
    },
  );

  it("lets those who view administration list roles, but not change them", async () => {
    const viewer = await test.signedIn(["administration:view"]);
    expect(
      (await send("GET", "/api/roles", undefined, viewer.cookie)).statusCode,
    ).toBe(200);
    expect(
      (
        await send(
          "POST",
          "/api/roles",
          { name: "Fictional Unmade", description: "", permissions: [] },
          viewer.cookie,
        )
      ).statusCode,
    ).toBe(403);
  });

  it("refuses anyone signed out", async () => {
    expect((await send("GET", "/api/roles", undefined, "")).statusCode).toBe(
      401,
    );
  });
});

describe("the roles Fathom starts with", () => {
  it("are stored as the shared starting roles describe them", async () => {
    const listed = await listRoles();
    for (const key of roleSchema.options) {
      // The key is always one of the fixed roles.
      // eslint-disable-next-line security/detect-object-injection
      const { name, description, permissions } = startingRoles[key];
      const role = listed.find((other) => other.key === key);
      expect(role).toMatchObject({ name, description });
      expect([...(role?.permissions ?? [])].sort()).toEqual(
        [...permissions].sort(),
      );
    }
  });

  it("count the active accounts holding each", async () => {
    const before = (await roleNamed("Executive")).accounts;
    const held = await test.signedIn("executive");
    expect((await roleNamed("Executive")).accounts).toBe(before + 1);
    await test.connection
      .update(users)
      .set({ deactivatedAt: new Date() })
      .where(eq(users.id, held.id));
    expect((await roleNamed("Executive")).accounts).toBe(before);
  });
});

describe("creating a role", () => {
  it("stores its permissions once each, in order, and records it", async () => {
    const response = await send("POST", "/api/roles", {
      name: "  Fictional   Created Role ",
      description: " Sees the plan. ",
      permissions: ["people:view", "plan:view", "plan:view"],
    });
    expect(response.statusCode).toBe(201);
    const { role } = response.json<{ role: RoleSummary }>();
    expect(role).toMatchObject({
      key: null,
      name: "Fictional Created Role",
      description: "Sees the plan.",
      permissions: ["plan:view", "people:view"],
      accounts: 0,
    });
    expect(await latestEntries(1)).toMatchObject([
      {
        action: "role-created",
        actor: { id: editorId },
        details: {
          role: "Fictional Created Role",
          granted: ["plan:view", "people:view"],
        },
      },
    ]);
  });

  it("may grant nothing", async () => {
    expect((await newRole([])).permissions).toEqual([]);
  });

  it("refuses a name another role has, whatever its case", async () => {
    const response = await send("POST", "/api/roles", {
      name: "TEAM MEMBER",
      description: "",
      permissions: [],
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "Another role already has that name; choose another",
    });
  });

  it("refuses a name another role takes at the same moment", async () => {
    // A connection of its own, holding the name in a transaction not yet saved.
    const client = await test.connection.$client.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO fathom.roles (name) VALUES ('Fictional Racing Role')",
      );
      const racing = send("POST", "/api/roles", {
        name: "Fictional Racing Role",
        description: "",
        permissions: [],
      });
      // The request waits on the uncommitted name, then finds it taken once it is saved.
      await new Promise((resolve) => setTimeout(resolve, 300));
      await client.query("COMMIT");
      const response = await racing;
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: "Another role already has that name; choose another",
      });
    } finally {
      client.release();
    }
  });

  it.each([
    [{ name: "", description: "", permissions: [] }],
    [{ name: "Fictional", description: "x".repeat(501), permissions: [] }],
    [{ name: "Fictional", description: "a\u0007b", permissions: [] }],
    [
      {
        name: "Fictional",
        description: "",
        permissions: ["retired:permission"],
      },
    ],
  ])("refuses a role the rules do not allow: %j", async (payload) => {
    expect((await send("POST", "/api/roles", payload)).statusCode).toBe(400);
  });
});

describe("changing a role", () => {
  it("changes its name, description, and permissions, and records what changed", async () => {
    const role = await newRole(["plan:view", "configuration:view"]);
    const response = await change(role.id, {
      name: "Fictional Changed Role",
      description: "Changed.",
      permissions: ["plan:view", "people:view"],
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ role: RoleSummary }>().role).toMatchObject({
      id: role.id,
      name: "Fictional Changed Role",
      description: "Changed.",
      permissions: ["plan:view", "people:view"],
    });
    expect(await latestEntries(1)).toMatchObject([
      {
        action: "role-changed",
        details: {
          role: "Fictional Changed Role",
          previousName: role.name,
          granted: ["people:view"],
          withdrawn: ["configuration:view"],
        },
      },
    ]);
  });

  it("takes effect for the accounts holding it at their next request", async () => {
    const role = await newRole(["plan:view"]);
    const holder = await test.signedIn([]);
    await give(holder.id, role.id);
    expect(await permissionsOf(holder.cookie)).toEqual(["plan:view"]);
    await change(role.id, {
      name: role.name,
      description: role.description,
      permissions: ["people:edit"],
    });
    expect(await permissionsOf(holder.cookie)).toEqual([
      "people:edit",
      "people:view",
    ]);
  });

  it("records nothing when nothing changes", async () => {
    const role = await newRole(["plan:view"]);
    const [before] = await latestEntries(1);
    const response = await change(role.id, {
      name: role.name,
      description: role.description,
      permissions: ["plan:view"],
    });
    expect(response.statusCode).toBe(200);
    expect(await latestEntries(1)).toEqual([before]);
  });

  it("keeps a name in a different case, and names no previous name when it is kept", async () => {
    const role = await newRole([]);
    const renamed = role.name.toUpperCase();
    expect(
      (
        await change(role.id, {
          name: renamed,
          description: role.description,
          permissions: ["plan:view"],
        })
      ).statusCode,
    ).toBe(200);
    await change(role.id, {
      name: renamed,
      description: "",
      permissions: ["plan:view"],
    });
    const [entry] = await latestEntries(1);
    expect(entry?.details).toEqual({
      role: renamed,
      granted: [],
      withdrawn: [],
    });
  });

  it("drops stored permissions the server no longer knows when it is saved", async () => {
    const role = await newRole(["plan:view"]);
    await test.connection
      .insert(rolePermissions)
      .values({ roleId: role.id, permission: "retired:permission" });
    await change(role.id, {
      name: role.name,
      description: "Saved again.",
      permissions: ["plan:view"],
    });
    const stored = await test.connection
      .select({ permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id));
    expect(stored).toEqual([{ permission: "plan:view" }]);
  });

  it("refuses a name another role has", async () => {
    const role = await newRole([]);
    const response = await change(role.id, {
      name: "product manager",
      description: "",
      permissions: [],
    });
    expect(response.statusCode).toBe(409);
  });

  it("answers that there is no such role", async () => {
    const payload = {
      name: "Fictional",
      description: "",
      permissions: [],
      updatedAt: new Date().toISOString(),
    };
    expect(
      (await send("PUT", `/api/roles/${randomUUID()}`, payload)).statusCode,
    ).toBe(404);
    expect(
      (await send("PUT", "/api/roles/not-an-identifier", payload)).statusCode,
    ).toBe(400);
  });
});

describe("changing a role someone else has changed", () => {
  it("is refused, keeping their change, once the role has changed since it was read", async () => {
    const role = await newRole(["plan:view"]);
    await change(role.id, {
      name: role.name,
      description: role.description,
      permissions: ["plan:view", "people:view"],
    });
    const stale = await send("PUT", `/api/roles/${role.id}`, {
      name: role.name,
      description: role.description,
      permissions: [],
      updatedAt: role.updatedAt,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({
      error:
        "Someone else changed this role after it was opened; close it and open it again",
    });
    expect((await roleNamed(role.name)).permissions).toEqual([
      "plan:view",
      "people:view",
    ]);
  });
});

describe("a role's description", () => {
  it("is kept as one paragraph, with line breaks as spaces", async () => {
    const response = await send("POST", "/api/roles", {
      name: "Fictional Paragraph Role",
      description: "Sees the plan.\n\nNothing more.",
      permissions: [],
    });
    expect(response.json<{ role: RoleSummary }>().role.description).toBe(
      "Sees the plan. Nothing more.",
    );
  });

  it("of a starting role is stored emptied with a change to what it grants, and comes back with its template", async () => {
    const { name, description, permissions } = startingRoles["feature-lead"];
    const role = await roleNamed(name);
    const changed = await change(role.id, {
      name,
      description: "",
      permissions: [...permissions, "people:edit"],
    });
    expect(changed.json<{ role: RoleSummary }>().role.description).toBe("");
    expect((await roleNamed(name)).description).toBe("");
    const restored = await change(role.id, {
      name,
      description,
      permissions,
    });
    const back = restored.json<{ role: RoleSummary }>().role;
    expect(back.description).toBe(description);
    expect([...back.permissions].sort()).toEqual([...permissions].sort());
  });
});

describe("keeping Fathom manageable", () => {
  it.each(["administration:edit"] as const)(
    "refuses withdrawing %s when no other active account would hold it",
    async (permission) => {
      const administrator = await roleNamed("Administrator");
      const response = await change(administrator.id, {
        name: administrator.name,
        description: administrator.description,
        permissions: administrator.permissions.filter(
          (other) => other !== permission,
        ),
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: "Some active account must keep Edit Administration",
      });
      expect((await roleNamed("Administrator")).permissions).toEqual(
        administrator.permissions,
      );
    },
  );

  it("allows it while another role gives an active account Edit Administration", async () => {
    const keeper = await newRole(["administration:edit"]);
    const holder = await test.signedIn([]);
    await give(holder.id, keeper.id);
    const administrator = await roleNamed("Administrator");
    try {
      const response = await change(administrator.id, {
        name: administrator.name,
        description: administrator.description,
        permissions: ["administration:view"],
      });
      expect(response.statusCode).toBe(200);
    } finally {
      await change(
        administrator.id,
        {
          name: administrator.name,
          description: administrator.description,
          permissions: administrator.permissions,
        },
        holder.cookie,
      );
    }
    expect((await roleNamed("Administrator")).permissions).toEqual(
      administrator.permissions,
    );
  });
});

describe("a change to a role and a deactivation at once", () => {
  it("wait for each other, so together they cannot leave nobody with Edit Administration", async () => {
    // The administrator's own account, and another holding a role of its own with Edit Administration.
    const keeper = await newRole(["administration:edit"]);
    const holder = await test.signedIn([]);
    await give(holder.id, keeper.id);
    const administrator = await roleNamed("Administrator");
    // Everyone else with Edit Administration is deactivated, so the holder is the only other one left.
    await test.connection
      .update(users)
      .set({ deactivatedAt: new Date() })
      .where(
        and(
          notInArray(users.id, [editorId, holder.id]),
          inArray(
            users.id,
            test.connection
              .select({ id: userRoles.userId })
              .from(userRoles)
              .innerJoin(
                rolePermissions,
                eq(rolePermissions.roleId, userRoles.roleId),
              )
              .where(eq(rolePermissions.permission, "administration:edit")),
          ),
        ),
      );
    // Deactivating the holder, holding the lock until the change to Administrator is waiting for it.
    let release = () => undefined as unknown;
    const held = new Promise((resolve) => {
      release = resolve as () => unknown;
    });
    let locked = () => undefined as unknown;
    const isLocked = new Promise((resolve) => {
      locked = resolve as () => unknown;
    });
    const deactivating = test.connection.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended('fathom.administrators', 0))`,
      );
      await transaction
        .update(users)
        .set({ deactivatedAt: new Date() })
        .where(eq(users.id, holder.id));
      locked();
      await held;
    });
    await isLocked;
    const withdrawing = change(administrator.id, {
      name: administrator.name,
      description: administrator.description,
      permissions: ["administration:view"],
    });
    await vi.waitFor(
      async () => {
        const waiting = await test.connection.execute<{ total: string }>(
          sql`SELECT count(*) AS total FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND wait_event = 'advisory' AND datname = current_database()`,
        );
        expect(Number(waiting.rows[0]?.total)).toBeGreaterThan(0);
      },
      { timeout: 10_000 },
    );
    release();
    await deactivating;
    expect((await withdrawing).statusCode).toBe(409);
    expect((await roleNamed("Administrator")).permissions).toEqual(
      administrator.permissions,
    );
  });
});

describe("what a change to a role would do", () => {
  it("lists each active account holding the role, with what they could do before and after", async () => {
    const role = await newRole(["plan:view"]);
    const first = await test.signedIn([]);
    const second = await test.signedIn("team-member");
    const gone = await test.signedIn([]);
    for (const holder of [first, second, gone]) {
      await give(holder.id, role.id);
    }
    await test.connection
      .update(users)
      .set({ deactivatedAt: new Date() })
      .where(eq(users.id, gone.id));
    const response = await send("POST", `/api/roles/${role.id}/effects`, {
      permissions: ["people:edit"],
    });
    expect(response.statusCode).toBe(200);
    const { effects } = response.json<{
      effects: { account: { id: string }; before: string[]; after: string[] }[];
    }>();
    expect(
      effects.filter((effect) =>
        [first.id, second.id, gone.id].includes(effect.account.id),
      ),
    ).toEqual(
      [first, second].map((holder): unknown =>
        expect.objectContaining({
          account: expect.objectContaining({ id: holder.id }) as unknown,
          before: ["plan:view"],
          after: ["people:view", "people:edit"],
        }),
      ),
    );
    // Nothing is saved.
    expect((await roleNamed(role.name)).permissions).toEqual(["plan:view"]);
  });

  it("lists nobody when the change grants what the role already does", async () => {
    const role = await newRole(["plan:edit"]);
    const holder = await test.signedIn([]);
    await give(holder.id, role.id);
    const response = await send("POST", `/api/roles/${role.id}/effects`, {
      permissions: ["plan:view", "plan:edit"],
    });
    expect(response.json()).toEqual({ effects: [] });
  });

  it("lists nobody for a role nobody holds, and answers that there is no such role", async () => {
    const role = await newRole([]);
    expect(
      (
        await send("POST", `/api/roles/${role.id}/effects`, {
          permissions: ["plan:view"],
        })
      ).json(),
    ).toEqual({ effects: [] });
    expect(
      (
        await send("POST", `/api/roles/${randomUUID()}/effects`, {
          permissions: [],
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe("listing roles", () => {
  it("leaves out stored permissions the server does not know", async () => {
    const role = await newRole([]);
    await test.connection
      .insert(rolePermissions)
      .values({ roleId: role.id, permission: "retired:permission" });
    expect((await roleNamed(role.name)).permissions).toEqual([]);
  });
});
