// SPDX-License-Identifier: Apache-2.0

// Tests for the lists of choices for people's details against a migrated PostgreSQL server: which
// roles may read and change them; adding, renaming, and removing choices; the refusals for
// duplicates and invalid requests; their natural order; and the change history that records every
// change and says who created and last changed each choice.

import {
  changes,
  changeSets,
  createDatabase,
  createPool,
  type Database,
  listItems,
  runMigrations,
} from "@fathom/db";
import {
  type ListItem,
  type Lists,
  type Role,
  roleSchema,
} from "@fathom/shared";
import {
  createTestCertificate,
  startTestDatabase,
  type TestCertificate,
  type TestDatabase,
} from "@fathom/test-utils";
import { asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import { type App, buildApp } from "./app.ts";
import { createAccount } from "./data/accounts.ts";
import { type Auth, createAuth } from "./data/auth.ts";
import { recordChanges } from "./data/changes.ts";
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

beforeAll(async () => {
  certificate = createTestCertificate();
  database = await startTestDatabase();
  await runMigrations(database.migrator);
  pool = createPool(database.app, () => undefined);
  connection = createDatabase(pool);
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

// Signs in a new account holding the given roles, from a fictional address of its own, so sign-in
// limits never interfere, and returns its identifier, name, and session cookie.
async function signedIn(roles: Role[]) {
  accountCount += 1;
  const name = `Fictional Editor ${String(accountCount)}`;
  const email = `editor${String(accountCount)}@example.test`;
  const id = await createAccount(auth, connection, {
    name,
    email,
    password,
    roles,
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    remoteAddress: `192.0.2.${String(accountCount % 250)}`,
    headers: { origin: publicUrl },
    payload: { email, password },
  });
  const cookie = [response.headers["set-cookie"]]
    .flat()
    .find((value) => value?.includes("session_token="));
  return { id, name, cookie: cookie?.split(";")[0] ?? "" };
}

function request(
  cookie: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
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

let labelCount = 0;

// A label no other test uses, so tests sharing the database do not collide.
function uniqueLabel(prefix = "Fictional Choice"): string {
  labelCount += 1;
  return `${prefix} ${String(labelCount)}`;
}

async function readList(cookie: string, name: string): Promise<ListItem[]> {
  const response = await request(cookie, "GET", "/api/lists");
  expect(response.statusCode).toBe(200);
  return (
    response.json<{ lists: Lists }>().lists.find((list) => list.name === name)
      ?.items ?? []
  );
}

async function addItem(
  cookie: string,
  list: string,
  label: string,
  description?: string,
) {
  const response = await request(cookie, "POST", `/api/lists/${list}/items`, {
    label,
    ...(description === undefined ? {} : { description }),
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ item: ListItem }>().item;
}

// The changes recorded for a choice, oldest first, with who made them.
async function historyOf(id: string) {
  return connection
    .select({
      action: changes.action,
      field: changes.field,
      tier: changes.tier,
      oldValue: changes.oldValue,
      newValue: changes.newValue,
      madeBy: changeSets.madeBy,
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(eq(changes.recordId, id))
    .orderBy(asc(changes.id));
}

describe("who may read and change the lists", () => {
  // The access control pattern: every role on its own, allowed exactly when it grants the permission.
  it.each(roleSchema.options)(
    "a %s may read the lists only if the role lets them see planning configuration",
    async (role) => {
      const { cookie } = await signedIn([role]);
      const response = await request(cookie, "GET", "/api/lists");
      if (rolesGranting("configuration:view").includes(role)) {
        expect(response.statusCode).toBe(200);
      } else {
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({ error: "Forbidden" });
      }
    },
  );

  const changeRequests = [
    ["POST", "/api/lists/sites/items", { label: "Fictional Site" }],
    [
      "PUT",
      `/api/lists/sites/items/${randomUUID()}`,
      { label: "Fictional Site" },
    ],
    ["DELETE", `/api/lists/sites/items/${randomUUID()}`, undefined],
  ] as const;
  const refusedRoles = roleSchema.options.filter(
    (role) => !rolesGranting("configuration:edit").includes(role),
  );

  it.each(
    changeRequests.flatMap((change) =>
      refusedRoles.map((role) => [role, ...change] as const),
    ),
  )("refuses a %s %s %s", async (role, method, url, payload) => {
    const { cookie } = await signedIn([role, "viewer"]);
    const response = await request(cookie, method, url, payload);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Forbidden" });
  });

  it.each(rolesGranting("configuration:edit"))(
    "lets a %s add, rename, and remove choices",
    async (role) => {
      const { cookie } = await signedIn([role, "viewer"]);
      const added = await addItem(cookie, "sites", uniqueLabel());
      const renamed = await request(
        cookie,
        "PUT",
        `/api/lists/sites/items/${added.id}`,
        { label: uniqueLabel() },
      );
      expect(renamed.statusCode).toBe(200);
      const removed = await request(
        cookie,
        "DELETE",
        `/api/lists/sites/items/${added.id}`,
      );
      expect(removed.statusCode).toBe(204);
    },
  );

  it.each([
    ["GET", "/api/lists"] as const,
    ...changeRequests.map(([method, url]) => [method, url] as const),
  ])("refuses a signed-out %s %s", async (method, url) => {
    const response = await app.inject({
      method,
      url,
      headers: { origin: publicUrl },
      payload: { not: "what it expects" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("the lists", () => {
  it("names every list, in a fixed order", async () => {
    const { cookie } = await signedIn(["viewer"]);
    const response = await request(cookie, "GET", "/api/lists");
    expect(
      response.json<{ lists: Lists }>().lists.map(({ name }) => name),
    ).toEqual(["sites", "positions", "levels", "team-roles"]);
  });

  it("orders choices naturally, ignoring letter case, so 10 follows 9", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const prefix = uniqueLabel("Fictional Level");
    for (const label of [`${prefix} P10`, `${prefix} p2`, `${prefix} P9`]) {
      await addItem(cookie, "levels", label);
    }
    expect(
      (await readList(cookie, "levels"))
        .map(({ label }) => label)
        .filter((label) => label.startsWith(prefix)),
    ).toEqual([`${prefix} p2`, `${prefix} P9`, `${prefix} P10`]);
  });
});

describe("adding choices", () => {
  it("adds a choice, trimmed, saying who created it and when", async () => {
    const { cookie, id, name } = await signedIn([
      "workforce-administrator",
      "viewer",
    ]);
    const label = uniqueLabel();
    const before = Date.now();
    const added = await addItem(cookie, "positions", `  ${label}  `);
    expect(added.label).toBe(label);
    expect(added.created.by).toEqual({ id, name });
    expect(Date.parse(added.created.at)).toBeGreaterThanOrEqual(before - 1000);
    expect(added.changed).toEqual(added.created);
    expect(await readList(cookie, "positions")).toContainEqual(added);
  });

  it("records the new choice in the change history", async () => {
    const { cookie, id } = await signedIn([
      "workforce-administrator",
      "viewer",
    ]);
    const label = uniqueLabel();
    const added = await addItem(cookie, "sites", label, "A fictional site");
    expect(await historyOf(added.id)).toEqual([
      {
        action: "created",
        field: "label",
        tier: "general",
        oldValue: null,
        newValue: label,
        madeBy: id,
      },
      {
        action: "created",
        field: "description",
        tier: "general",
        oldValue: null,
        newValue: "A fictional site",
        madeBy: id,
      },
    ]);
  });

  it("refuses a choice already in the list, ignoring letter case, but allows it in another list", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const label = uniqueLabel();
    await addItem(cookie, "sites", label);
    const duplicate = await request(cookie, "POST", "/api/lists/sites/items", {
      label: label.toUpperCase(),
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({
      error: "This list already has that choice",
    });
    await addItem(cookie, "positions", label);
  });

  it.each([
    ["an empty label", ""],
    ["a label of only spaces", "   "],
    ["a label over 100 characters", "x".repeat(101)],
  ])("refuses %s", async (_case, label) => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const response = await request(cookie, "POST", "/api/lists/sites/items", {
      label,
    });
    expect(response.statusCode).toBe(400);
  });

  it("accepts a label of 100 characters", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const label = `${uniqueLabel()} `.padEnd(100, "x");
    expect((await addItem(cookie, "sites", label)).label).toBe(label);
  });

  it("adds a choice without a description, as an empty one", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    expect((await addItem(cookie, "sites", uniqueLabel())).description).toBe(
      "",
    );
  });

  it("trims the description, and accepts one of 500 characters", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    expect(
      (await addItem(cookie, "sites", uniqueLabel(), "  A fictional site  "))
        .description,
    ).toBe("A fictional site");
    const longest = "x".repeat(500);
    expect(
      (await addItem(cookie, "sites", uniqueLabel(), longest)).description,
    ).toBe(longest);
  });

  it("refuses a description over 500 characters", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const response = await request(cookie, "POST", "/api/lists/sites/items", {
      label: uniqueLabel(),
      description: "x".repeat(501),
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses a list Fathom does not have", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const response = await request(
      cookie,
      "POST",
      "/api/lists/fictional-list/items",
      { label: uniqueLabel() },
    );
    expect(response.statusCode).toBe(400);
  });

  it("treats a label that tries SQL injection as plain text", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const label = `${uniqueLabel()}'); DROP TABLE list_items; --`;
    expect((await addItem(cookie, "sites", label)).label).toBe(label);
    expect(await readList(cookie, "sites")).toContainEqual(
      expect.objectContaining({ label }),
    );
  });
});

describe("editing choices", () => {
  it("renames a choice, saying who last changed it, and records the old and new labels", async () => {
    const creator = await signedIn(["workforce-administrator", "viewer"]);
    const editor = await signedIn(["workforce-administrator", "viewer"]);
    const added = await addItem(creator.cookie, "team-roles", uniqueLabel());
    const label = uniqueLabel();
    const response = await request(
      editor.cookie,
      "PUT",
      `/api/lists/team-roles/items/${added.id}`,
      { label },
    );
    expect(response.statusCode).toBe(200);
    const renamed = response.json<{ item: ListItem }>().item;
    expect(renamed).toMatchObject({ id: added.id, label });
    expect(renamed.created).toEqual(added.created);
    expect(renamed.changed.by).toEqual({ id: editor.id, name: editor.name });
    expect((await historyOf(added.id)).slice(2)).toEqual([
      {
        action: "changed",
        field: "label",
        tier: "general",
        oldValue: added.label,
        newValue: label,
        madeBy: editor.id,
      },
    ]);
  });

  it("changes only the description, recording just that", async () => {
    const { cookie, id } = await signedIn([
      "workforce-administrator",
      "viewer",
    ]);
    const added = await addItem(cookie, "sites", uniqueLabel());
    const response = await request(
      cookie,
      "PUT",
      `/api/lists/sites/items/${added.id}`,
      { label: added.label, description: "A fictional harbour office" },
    );
    expect(response.json<{ item: ListItem }>().item).toMatchObject({
      label: added.label,
      description: "A fictional harbour office",
    });
    expect((await historyOf(added.id)).slice(2)).toEqual([
      {
        action: "changed",
        field: "description",
        tier: "general",
        oldValue: "",
        newValue: "A fictional harbour office",
        madeBy: id,
      },
    ]);
  });

  it("records nothing when nothing changes", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const added = await addItem(
      cookie,
      "sites",
      uniqueLabel(),
      "A fictional site",
    );
    const response = await request(
      cookie,
      "PUT",
      `/api/lists/sites/items/${added.id}`,
      { label: added.label, description: added.description },
    );
    expect(response.json<{ item: ListItem }>().item).toEqual(added);
    expect(await historyOf(added.id)).toHaveLength(2);
  });

  it("replaces the whole choice, so an edit without a description clears it", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const added = await addItem(
      cookie,
      "sites",
      uniqueLabel(),
      "A fictional site",
    );
    const response = await request(
      cookie,
      "PUT",
      `/api/lists/sites/items/${added.id}`,
      { label: added.label },
    );
    expect(response.json<{ item: ListItem }>().item.description).toBe("");
  });

  it("allows a change of letter case only", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const added = await addItem(cookie, "sites", uniqueLabel());
    const response = await request(
      cookie,
      "PUT",
      `/api/lists/sites/items/${added.id}`,
      { label: added.label.toUpperCase() },
    );
    expect(response.json<{ item: ListItem }>().item.label).toBe(
      added.label.toUpperCase(),
    );
  });

  it("refuses a label another choice in the list has", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const first = await addItem(cookie, "sites", uniqueLabel());
    const second = await addItem(cookie, "sites", uniqueLabel());
    const response = await request(
      cookie,
      "PUT",
      `/api/lists/sites/items/${second.id}`,
      { label: first.label },
    );
    expect(response.statusCode).toBe(409);
  });

  it("refuses a choice that does not exist, or is in another list", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const added = await addItem(cookie, "sites", uniqueLabel());
    for (const url of [
      `/api/lists/sites/items/${randomUUID()}`,
      `/api/lists/positions/items/${added.id}`,
    ]) {
      const response = await request(cookie, "PUT", url, {
        label: uniqueLabel(),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "There is no such choice" });
    }
  });

  it("refuses an identifier that is not one Fathom makes", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const response = await request(
      cookie,
      "PUT",
      "/api/lists/sites/items/not-an-identifier",
      { label: uniqueLabel() },
    );
    expect(response.statusCode).toBe(400);
  });
});

describe("removing choices", () => {
  it("removes a choice, keeping its history", async () => {
    const { cookie, id } = await signedIn([
      "workforce-administrator",
      "viewer",
    ]);
    const added = await addItem(cookie, "sites", uniqueLabel());
    const response = await request(
      cookie,
      "DELETE",
      `/api/lists/sites/items/${added.id}`,
    );
    expect(response.statusCode).toBe(204);
    expect(await readList(cookie, "sites")).not.toContainEqual(added);
    expect((await historyOf(added.id)).slice(2)).toEqual([
      {
        action: "deleted",
        field: "label",
        tier: "general",
        oldValue: added.label,
        newValue: null,
        madeBy: id,
      },
      {
        action: "deleted",
        field: "description",
        tier: "general",
        oldValue: "",
        newValue: null,
        madeBy: id,
      },
    ]);
  });

  it("refuses a choice that does not exist, or is in another list", async () => {
    const { cookie } = await signedIn(["workforce-administrator", "viewer"]);
    const added = await addItem(cookie, "sites", uniqueLabel());
    for (const url of [
      `/api/lists/sites/items/${randomUUID()}`,
      `/api/lists/levels/items/${added.id}`,
    ]) {
      const response = await request(cookie, "DELETE", url);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "There is no such choice" });
    }
  });
});

describe("who created and changed choices", () => {
  it("names Fathom itself for choices added by setup or seed scripts", async () => {
    const { cookie } = await signedIn(["viewer"]);
    const id = randomUUID();
    const label = uniqueLabel();
    await connection.transaction(async (transaction) => {
      await transaction.insert(listItems).values({ id, list: "sites", label });
      await recordChanges(transaction, null, [
        {
          recordType: "list-item",
          recordId: id,
          action: "created",
          field: "label",
          tier: "general",
          oldValue: null,
          newValue: label,
        },
      ]);
    });
    const item = (await readList(cookie, "sites")).find(
      (found) => found.id === id,
    );
    expect(item?.created.by).toBeNull();
  });

  // Lists hold only General data, but the change history is shared by every kind of record, so later
  // changes to fields in other tiers are recorded here to show which ones each role's stamps count.
  it.each([
    [["viewer"], "general"],
    [["viewer", "people-manager"], "restricted"],
    [["viewer", "leadership"], "confidential"],
  ] as const)(
    "counts for a %j only changes to fields in tiers they may see, up to %s",
    async (roles, latestSeen) => {
      const creator = await signedIn(["workforce-administrator", "viewer"]);
      const added = await addItem(creator.cookie, "sites", uniqueLabel());
      const restrictedEditor = await signedIn(["viewer"]);
      const confidentialEditor = await signedIn(["viewer"]);
      for (const [editor, tier] of [
        [restrictedEditor, "restricted"],
        [confidentialEditor, "confidential"],
      ] as const) {
        await connection.transaction(async (transaction) => {
          await recordChanges(transaction, editor.id, [
            {
              recordType: "list-item",
              recordId: added.id,
              action: "changed",
              field: `fictional-${tier}-field`,
              tier,
              oldValue: null,
              newValue: "Fictional",
            },
          ]);
        });
      }
      const editors = {
        general: creator,
        restricted: restrictedEditor,
        confidential: confidentialEditor,
      };
      const { cookie } = await signedIn([...roles]);
      const item = (await readList(cookie, "sites")).find(
        (found) => found.id === added.id,
      );
      expect(item?.created.by?.id).toBe(creator.id);
      // eslint-disable-next-line security/detect-object-injection -- one of the three tiers above
      expect(item?.changed.by?.id).toBe(editors[latestSeen].id);
    },
  );

  it("names whoever saved last, even when their save began first", async () => {
    const creator = await signedIn(["workforce-administrator", "viewer"]);
    const slowEditor = await signedIn(["viewer"]);
    const quickEditor = await signedIn(["viewer"]);
    const added = await addItem(creator.cookie, "sites", uniqueLabel());
    const changeBy = (
      transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
      madeBy: string,
    ) =>
      recordChanges(transaction, madeBy, [
        {
          recordType: "list-item",
          recordId: added.id,
          action: "changed",
          field: "label",
          tier: "general",
          oldValue: null,
          newValue: "Fictional",
        },
      ]);
    const released: (() => void)[] = [];
    const waiting = new Promise<void>((resolve) => {
      released.push(resolve);
    });
    // The slow save's transaction begins, then waits while the quick one is saved.
    const slow = connection.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1`);
      await waiting;
      await changeBy(transaction, slowEditor.id);
    });
    await connection.transaction((transaction) =>
      changeBy(transaction, quickEditor.id),
    );
    for (const release of released) release();
    await slow;
    const item = (await readList(creator.cookie, "sites")).find(
      (found) => found.id === added.id,
    );
    expect(item?.changed.by?.id).toBe(slowEditor.id);
    expect(Date.parse(item?.changed.at ?? "")).toBeGreaterThanOrEqual(
      Date.parse(item?.created.at ?? ""),
    );
  });

  it("fails rather than invent a history for a choice added without one", async () => {
    const { cookie } = await signedIn(["viewer"]);
    const id = randomUUID();
    await connection
      .insert(listItems)
      .values({ id, list: "sites", label: uniqueLabel() });
    try {
      const response = await request(cookie, "GET", "/api/lists");
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "Internal Server Error" });
    } finally {
      await connection.delete(listItems).where(eq(listItems.id, id));
    }
  });
});
