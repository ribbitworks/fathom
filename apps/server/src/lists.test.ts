// SPDX-License-Identifier: Apache-2.0

// Tests for lists of choices against a migrated PostgreSQL server: which roles may read and change
// them; creating, editing, retiring, restoring, and deleting lists; adding choices one at a time or
// several at once, and editing, ordering, retiring, restoring, and removing them; the refusals for
// duplicates, limits, and invalid requests; and the change history that records every change.

import {
  changes,
  changeSets,
  createDatabase,
  createPool,
  type Database,
  lists as listTable,
} from "@fathom/db";
import { type Choice, type List, type Role, roleSchema } from "@fathom/shared";
import {
  createTestCertificate,
  startTestDatabase,
  type TestCertificate,
  type TestDatabase,
} from "@fathom/test-utils";
import { asc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import { type App, buildApp } from "./app.ts";
import { createAccount } from "./data/accounts.ts";
import { findStartingRole } from "./data/roles.ts";
import { type Auth, createAuth } from "./data/auth.ts";
import { createDataAccess } from "./data/index.ts";
import { publishingAfter } from "./test-app.ts";

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
  await database.remove();
  certificate.remove();
});

let accountCount = 0;

// Signs in a new account holding a starting role, from a fictional address of its own, so sign-in
// limits never interfere, and returns its identifier and session cookie.
async function signedIn(role: Role) {
  accountCount += 1;
  const email = `editor${String(accountCount)}@example.test`;
  const id = await createAccount(auth, connection, {
    name: `Fictional Editor ${String(accountCount)}`,
    email,
    password,
    roleId: await findStartingRole(connection, role),
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
  return { id, cookie: cookie?.split(";")[0] ?? "" };
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

// Sends a request, publishing any change it makes straight after, as its maker would.
async function request(
  cookie: string,
  method: Method,
  url: string,
  payload?: object,
) {
  const headers = { cookie, origin: publicUrl };
  const response = await app.inject({
    method,
    url,
    headers,
    ...(payload === undefined ? {} : { payload }),
  });
  await publishingAfter(app, headers, method, url);
  return response;
}

let nameCount = 0;

// A name no other test uses, so tests sharing the database do not collide.
function uniqueName(prefix = "Fictional List"): string {
  nameCount += 1;
  return `${prefix} ${String(nameCount)}`;
}

async function readLists(cookie: string): Promise<List[]> {
  const response = await request(cookie, "GET", "/api/lists");
  expect(response.statusCode).toBe(200);
  return response.json<{ lists: List[] }>().lists;
}

async function readList(cookie: string, id: string): Promise<List | undefined> {
  return (await readLists(cookie)).find((list) => list.id === id);
}

async function createList(cookie: string, payload: object = {}): Promise<List> {
  const response = await request(cookie, "POST", "/api/lists", {
    name: uniqueName(),
    ...payload,
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ list: List }>().list;
}

async function addChoices(
  cookie: string,
  listId: string,
  labels: string[],
): Promise<Choice[]> {
  const response = await request(
    cookie,
    "POST",
    `/api/lists/${listId}/choices`,
    { choices: labels.map((label) => ({ label })) },
  );
  expect(response.statusCode).toBe(201);
  return response.json<{ choices: Choice[] }>().choices;
}

async function labelsOf(cookie: string, listId: string): Promise<string[]> {
  return ((await readList(cookie, listId))?.choices ?? []).map(
    ({ label }) => label,
  );
}

// The changes recorded for a record, oldest first, with who made them.
async function historyOf(id: string) {
  return connection
    .select({
      action: changes.action,
      field: changes.field,
      oldValue: changes.oldValue,
      newValue: changes.newValue,
      madeBy: changeSets.madeBy,
    })
    .from(changes)
    .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
    .where(eq(changes.recordId, id))
    .orderBy(asc(changes.id));
}

const editorRole: Role = "workforce-administrator";

describe("who may read and change lists", () => {
  // The access control pattern: every role on its own, allowed exactly when it grants the permission.
  it.each(roleSchema.options)(
    "a %s may read lists only if the role lets them see planning configuration or people",
    async (role) => {
      const { cookie } = await signedIn(role);
      const response = await request(cookie, "GET", "/api/lists");
      if (
        rolesGranting("configuration:view").includes(role) ||
        rolesGranting("people:view").includes(role)
      ) {
        expect(response.statusCode).toBe(200);
      } else {
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({ error: "Forbidden" });
      }
    },
  );

  const list = randomUUID();
  const choice = `/api/lists/${list}/choices/${randomUUID()}`;
  const changeRequests: [Method, string, object | undefined][] = [
    ["POST", "/api/lists", { name: "Fictional" }],
    ["PUT", `/api/lists/${list}`, { name: "Fictional" }],
    ["PUT", `/api/lists/${list}/retired`, { retired: true }],
    ["DELETE", `/api/lists/${list}`, undefined],
    [
      "POST",
      `/api/lists/${list}/choices`,
      { choices: [{ label: "Fictional" }] },
    ],
    ["PUT", choice, { label: "Fictional" }],
    ["PUT", `${choice}/position`, { after: null }],
    ["PUT", `${choice}/retired`, { retired: true }],
    ["DELETE", choice, undefined],
  ];
  const refusedRoles = roleSchema.options.filter(
    (role) => !rolesGranting("configuration:edit").includes(role),
  );

  it.each(
    changeRequests.flatMap((change) =>
      refusedRoles.map((role) => [role, ...change] as const),
    ),
  )("refuses a %s %s %s", async (role, method, url, payload) => {
    const { cookie } = await signedIn(role);
    const response = await request(cookie, method, url, payload);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Forbidden" });
  });

  it.each(rolesGranting("configuration:edit"))(
    "lets a %s make every change",
    async (role) => {
      const { cookie } = await signedIn(role);
      const created = await createList(cookie);
      const [first] = await addChoices(cookie, created.id, ["Fictional A"]);
      const choiceUrl = `/api/lists/${created.id}/choices/${String(first?.id)}`;
      const steps: [Method, string, object | undefined, number][] = [
        ["PUT", `/api/lists/${created.id}`, { name: uniqueName() }, 200],
        ["PUT", `/api/lists/${created.id}/retired`, { retired: true }, 200],
        ["PUT", choiceUrl, { label: "Fictional B" }, 200],
        ["PUT", `${choiceUrl}/position`, { after: null }, 200],
        ["PUT", `${choiceUrl}/retired`, { retired: true }, 200],
        ["DELETE", choiceUrl, undefined, 200],
        ["DELETE", `/api/lists/${created.id}`, undefined, 200],
      ];
      for (const [method, url, payload, status] of steps) {
        const response = await request(cookie, method, url, payload);
        expect(response.statusCode).toBe(status);
      }
    },
  );

  it.each([
    ["GET", "/api/lists"] as [Method, string],
    ...changeRequests.map(([method, url]) => [method, url] as [Method, string]),
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

describe("lists", () => {
  it("creates a list, trimmed, visible to everyone unless chosen otherwise, and records it", async () => {
    const { cookie, id } = await signedIn(editorRole);
    const name = uniqueName();
    const created = await createList(cookie, { name: `  ${name}  ` });
    expect(created).toEqual({
      id: created.id,
      name,
      description: "",
      visibility: "general",
      retired: false,
      builtIn: null,
      choices: [],
      draft: expect.objectContaining({
        action: "created",
        changed: ["name", "description", "visibility", "retired"],
        live: {},
        state: "waiting",
        madeBy: expect.any(String) as unknown,
        madeAt: expect.any(String) as unknown,
      }) as unknown,
    });
    // A draft, which reaches the live lists only once approved.
    expect(
      await connection
        .select()
        .from(listTable)
        .where(eq(listTable.id, created.id)),
    ).toEqual([]);
    expect(
      (await historyOf(created.id)).map(({ field, newValue, madeBy }) => [
        field,
        newValue,
        madeBy,
      ]),
    ).toEqual([
      ["name", name, id],
      ["description", "", id],
      ["visibility", "general", id],
      ["retired", false, id],
    ]);
  });

  it("keeps a chosen visibility and description", async () => {
    const { cookie } = await signedIn(editorRole);
    const created = await createList(cookie, {
      description: " A fictional list ",
      visibility: "confidential",
    });
    expect(created).toMatchObject({
      description: "A fictional list",
      visibility: "confidential",
    });
  });

  it("lists every list by name, ignoring letter case", async () => {
    const { cookie } = await signedIn(editorRole);
    const prefix = uniqueName("Fictional Order");
    for (const name of [`${prefix} b`, `${prefix} A`, `${prefix} C`]) {
      await createList(cookie, { name });
    }
    expect(
      (await readLists(cookie))
        .map(({ name }) => name)
        .filter((name) => name.startsWith(prefix)),
    ).toEqual([`${prefix} A`, `${prefix} b`, `${prefix} C`]);
  });

  it("refuses a name another list has, ignoring letter case", async () => {
    const { cookie } = await signedIn(editorRole);
    const first = await createList(cookie);
    const second = await createList(cookie);
    for (const [method, url] of [
      ["POST", "/api/lists"],
      ["PUT", `/api/lists/${second.id}`],
    ] as const) {
      const response = await request(cookie, method, url, {
        name: first.name.toUpperCase(),
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: "There is already a list with that name",
      });
    }
  });

  it.each([
    ["an empty name", { name: "  " }],
    ["a name over 40 characters", { name: "x".repeat(41) }],
    [
      "a description over 500 characters",
      { name: "Fictional", description: "x".repeat(501) },
    ],
    [
      "a visibility Fathom does not have",
      { name: "Fictional", visibility: "secret" },
    ],
  ])("refuses %s", async (_case, payload) => {
    const { cookie } = await signedIn(editorRole);
    const response = await request(cookie, "POST", "/api/lists", payload);
    expect(response.statusCode).toBe(400);
  });

  it("accepts a name of 40 characters", async () => {
    const { cookie } = await signedIn(editorRole);
    const name = `${uniqueName()} `.padEnd(40, "x");
    expect((await createList(cookie, { name })).name).toBe(name);
  });

  it("edits a list, recording only what changed", async () => {
    const { cookie, id } = await signedIn(editorRole);
    const created = await createList(cookie);
    const response = await request(cookie, "PUT", `/api/lists/${created.id}`, {
      name: created.name,
      description: "A fictional description",
      visibility: "personal",
    });
    expect(response.json<{ list: List }>().list).toMatchObject({
      description: "A fictional description",
      visibility: "personal",
    });
    expect(
      (await historyOf(created.id))
        .slice(4)
        .map(({ field, oldValue, newValue, madeBy }) => [
          field,
          oldValue,
          newValue,
          madeBy,
        ]),
    ).toEqual([
      ["description", "", "A fictional description", id],
      ["visibility", "general", "personal", id],
    ]);
  });

  it("records nothing when a list is saved unchanged", async () => {
    const { cookie } = await signedIn(editorRole);
    const created = await createList(cookie);
    await request(cookie, "PUT", `/api/lists/${created.id}`, {
      name: created.name,
    });
    expect(await historyOf(created.id)).toHaveLength(4);
  });

  it("retires and restores a list, recording each", async () => {
    const { cookie } = await signedIn(editorRole);
    const created = await createList(cookie);
    const url = `/api/lists/${created.id}/retired`;
    await request(cookie, "PUT", url, { retired: true });
    expect((await readList(cookie, created.id))?.retired).toBe(true);
    await request(cookie, "PUT", url, { retired: true });
    await request(cookie, "PUT", url, { retired: false });
    expect((await readList(cookie, created.id))?.retired).toBe(false);
    expect(
      (await historyOf(created.id)).slice(4).map(({ newValue }) => newValue),
    ).toEqual([true, false]);
  });

  it("discards a list only drafted to be added, with its choices, recording both", async () => {
    const { cookie, id } = await signedIn(editorRole);
    const created = await createList(cookie);
    const [choice] = await addChoices(cookie, created.id, ["Fictional"]);
    const response = await request(
      cookie,
      "DELETE",
      `/api/lists/${created.id}`,
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      changeSetId: expect.any(String) as unknown,
    });
    expect(await readList(cookie, created.id)).toBeUndefined();
    expect(
      (await historyOf(created.id))
        .slice(4)
        .map(({ action, field, madeBy }) => [action, field, madeBy]),
    ).toEqual([
      ["deleted", "name", id],
      ["deleted", "description", id],
      ["deleted", "visibility", id],
      ["deleted", "retired", id],
    ]);
    expect(
      (await historyOf(String(choice?.id)))
        .slice(4)
        .map(({ action, field }) => [action, field]),
    ).toEqual([
      ["deleted", "listId"],
      ["deleted", "label"],
      ["deleted", "description"],
      ["deleted", "retired"],
    ]);
  });

  it.each([
    ["PUT", "", { name: "Fictional" }],
    ["PUT", "/retired", { retired: true }],
    ["DELETE", "", undefined],
    ["POST", "/choices", { choices: [{ label: "Fictional" }] }],
    ["PUT", `/choices/${randomUUID()}/position`, { after: null }],
  ] as [Method, string, object | undefined][])(
    "refuses %s%s for a list that does not exist",
    async (method, path, payload) => {
      const { cookie } = await signedIn(editorRole);
      const response = await request(
        cookie,
        method,
        `/api/lists/${randomUUID()}${path}`,
        payload,
      );
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "There is no such list" });
    },
  );

  it("refuses an identifier that is not one Fathom makes", async () => {
    const { cookie } = await signedIn(editorRole);
    const response = await request(cookie, "PUT", "/api/lists/not-an-id", {
      name: "Fictional",
    });
    expect(response.statusCode).toBe(400);
  });

  it("treats a stored visibility Fathom no longer knows as General", async () => {
    const { cookie } = await signedIn(editorRole);
    const created = await createList(cookie);
    await connection
      .update(listTable)
      .set({ visibility: "fictional-tier" })
      .where(eq(listTable.id, created.id));
    expect((await readList(cookie, created.id))?.visibility).toBe("general");
  });
});

describe("adding choices", () => {
  it("adds a choice to the end, trimmed, and records it", async () => {
    const { cookie, id } = await signedIn(editorRole);
    const created = await createList(cookie);
    const response = await request(
      cookie,
      "POST",
      `/api/lists/${created.id}/choices`,
      {
        choices: [{ label: "  Kestrel Bay  ", description: " Head office. " }],
      },
    );
    const [choice] = response.json<{ choices: Choice[] }>().choices;
    expect(choice).toMatchObject({
      id: choice?.id,
      label: "Kestrel Bay",
      description: "Head office.",
      retired: false,
      draft: { action: "created", state: "waiting" },
    });
    expect(
      (await historyOf(String(choice?.id))).map(
        ({ field, newValue, madeBy }) => [field, newValue, madeBy],
      ),
    ).toEqual([
      ["listId", created.id, id],
      ["label", "Kestrel Bay", id],
      ["description", "Head office.", id],
      ["retired", false, id],
    ]);
  });

  it("adds several choices at once, in order after those already there, as one change", async () => {
    const { cookie } = await signedIn(editorRole);
    const created = await createList(cookie);
    await addChoices(cookie, created.id, ["Northmere"]);
    const added = await addChoices(cookie, created.id, [
      "Corran Quay",
      "Ashgrove",
      "Brindle Hill",
    ]);
    expect(await labelsOf(cookie, created.id)).toEqual([
      "Northmere",
      "Corran Quay",
      "Ashgrove",
      "Brindle Hill",
    ]);
    const sets = await connection
      .selectDistinct({ id: changes.changeSetId })
      .from(changes)
      .where(
        inArray(
          changes.recordId,
          added.map(({ id }) => id),
        ),
      );
    expect(sets).toHaveLength(1);
  });

  it.each([
    ["one the list already has, ignoring letter case", ["northmere"]],
    ["two with the same name", ["Ashgrove", "ASHGROVE"]],
  ])("refuses all of them when adding %s", async (_case, labels) => {
    const { cookie } = await signedIn(editorRole);
    const created = await createList(cookie);
    await addChoices(cookie, created.id, ["Northmere"]);
    const response = await request(
      cookie,
      "POST",
      `/api/lists/${created.id}/choices`,
      {
        choices: [
          { label: "Corran Quay" },
          ...labels.map((label) => ({ label })),
        ],
      },
    );
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "This list already has a choice with that name",
    });
    expect(await labelsOf(cookie, created.id)).toEqual(["Northmere"]);
  });

  it("allows a name another list has", async () => {
    const { cookie } = await signedIn(editorRole);
    const first = await createList(cookie);
    const second = await createList(cookie);
    await addChoices(cookie, first.id, ["Northmere"]);
    expect(await addChoices(cookie, second.id, ["Northmere"])).toHaveLength(1);
  });

  it.each([
    ["no choices", { choices: [] }],
    ["an empty name", { choices: [{ label: " " }] }],
    ["a name over 60 characters", { choices: [{ label: "x".repeat(61) }] }],
    [
      "a description over 500 characters",
      { choices: [{ label: "Fictional", description: "x".repeat(501) }] },
    ],
  ])("refuses %s", async (_case, payload) => {
    const { cookie } = await signedIn(editorRole);
    const created = await createList(cookie);
    const response = await request(
      cookie,
      "POST",
      `/api/lists/${created.id}/choices`,
      payload,
    );
    expect(response.statusCode).toBe(400);
  });

  it("accepts a name of 60 characters, and treats SQL as plain text", async () => {
    const { cookie } = await signedIn(editorRole);
    const created = await createList(cookie);
    const labels = ["x".repeat(60), "'); DROP TABLE list_items; --"];
    await addChoices(cookie, created.id, labels);
    expect(await labelsOf(cookie, created.id)).toEqual(labels);
  });
});

describe("changing choices", () => {
  async function listWith(labels: string[]) {
    const editor = await signedIn(editorRole);
    const created = await createList(editor.cookie);
    const choices = await addChoices(editor.cookie, created.id, labels);
    const url = (choice: Choice | undefined) =>
      `/api/lists/${created.id}/choices/${String(choice?.id)}`;
    return { ...editor, list: created, choices, url };
  }

  it("edits a choice, recording only what changed", async () => {
    const { cookie, id, choices, url } = await listWith(["Northmere"]);
    const response = await request(cookie, "PUT", url(choices[0]), {
      label: "Northmere",
      description: "A fictional site",
    });
    expect(response.json<{ choice: Choice }>().choice).toMatchObject({
      label: "Northmere",
      description: "A fictional site",
    });
    expect(
      (await historyOf(String(choices[0]?.id)))
        .slice(4)
        .map(({ field, oldValue, newValue, madeBy }) => [
          field,
          oldValue,
          newValue,
          madeBy,
        ]),
    ).toEqual([["description", "", "A fictional site", id]]);
  });

  it("records nothing when a choice is saved unchanged, and allows a change of letter case only", async () => {
    const { cookie, choices, url } = await listWith(["Northmere"]);
    await request(cookie, "PUT", url(choices[0]), { label: "Northmere" });
    expect(await historyOf(String(choices[0]?.id))).toHaveLength(4);
    const response = await request(cookie, "PUT", url(choices[0]), {
      label: "NORTHMERE",
    });
    expect(response.json<{ choice: Choice }>().choice.label).toBe("NORTHMERE");
  });

  it("refuses a name another choice in the list has", async () => {
    const { cookie, choices, url } = await listWith(["Northmere", "Ashgrove"]);
    const response = await request(cookie, "PUT", url(choices[1]), {
      label: "northmere",
    });
    expect(response.statusCode).toBe(409);
  });

  it.each([
    ["PUT", "", { label: "Fictional" }],
    ["PUT", "/position", { after: null }],
    ["PUT", "/retired", { retired: true }],
    ["DELETE", "", undefined],
  ] as [Method, string, object | undefined][])(
    "refuses %s%s for a choice that is not in the list",
    async (method, path, payload) => {
      const { cookie } = await signedIn(editorRole);
      const created = await createList(cookie);
      const other = await createList(cookie);
      const [elsewhere] = await addChoices(cookie, other.id, ["Fictional"]);
      for (const choiceId of [randomUUID(), String(elsewhere?.id)]) {
        const response = await request(
          cookie,
          method,
          `/api/lists/${created.id}/choices/${choiceId}${path}`,
          payload,
        );
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ error: "There is no such choice" });
      }
    },
  );

  it("removes a choice only drafted to be added, recording it", async () => {
    const { cookie, id, list, choices, url } = await listWith([
      "Northmere",
      "Ashgrove",
    ]);
    const response = await request(cookie, "DELETE", url(choices[1]));
    expect(response.statusCode).toBe(200);
    expect(await labelsOf(cookie, list.id)).toEqual(["Northmere"]);
    expect(
      (await historyOf(String(choices[1]?.id)))
        .slice(4)
        .map(({ action, field, madeBy }) => [action, field, madeBy]),
    ).toEqual([
      ["deleted", "listId", id],
      ["deleted", "label", id],
      ["deleted", "description", id],
      ["deleted", "retired", id],
    ]);
  });
});

describe("ordering choices", () => {
  async function threeChoices() {
    const editor = await signedIn(editorRole);
    const created = await createList(editor.cookie);
    const [first, second, third] = await addChoices(editor.cookie, created.id, [
      "A",
      "B",
      "C",
    ]);
    const move = (choice: Choice | undefined, after: string | null) =>
      request(
        editor.cookie,
        "PUT",
        `/api/lists/${created.id}/choices/${String(choice?.id)}/position`,
        { after },
      );
    const order = () => labelsOf(editor.cookie, created.id);
    return { editor, created, first, second, third, move, order };
  }

  it("moves a choice after another, recording the list's whole order before and after", async () => {
    const { editor, created, first, second, third, move, order } =
      await threeChoices();
    expect((await move(third, String(first?.id))).statusCode).toBe(200);
    expect(await order()).toEqual(["A", "C", "B"]);
    expect((await historyOf(created.id)).at(-1)).toMatchObject({
      field: "order",
      oldValue: [first?.id, second?.id, third?.id],
      newValue: [first?.id, third?.id, second?.id],
      madeBy: editor.id,
    });
  });

  it("moves a choice to the top and back", async () => {
    const { first, second, move, order } = await threeChoices();
    await move(second, null);
    expect(await order()).toEqual(["B", "A", "C"]);
    await move(second, String(first?.id));
    expect(await order()).toEqual(["A", "B", "C"]);
  });

  it("records nothing when a choice is moved to where it already is", async () => {
    const { first, second, move } = await threeChoices();
    const unmoved = await move(second, String(first?.id));
    expect(unmoved.statusCode).toBe(200);
    expect(unmoved.json()).toEqual({ changeSetId: null });
    expect(await historyOf(String(second?.id))).toHaveLength(4);
  });

  it("refuses to put a choice after itself, or after one in another list", async () => {
    const { editor, first, move } = await threeChoices();
    const other = await createList(editor.cookie);
    const [elsewhere] = await addChoices(editor.cookie, other.id, [
      "Elsewhere",
    ]);
    for (const after of [String(first?.id), String(elsewhere?.id)]) {
      expect((await move(first, after)).statusCode).toBe(400);
    }
  });
});

describe("retiring and restoring choices", () => {
  async function retiredSetUp() {
    const editor = await signedIn(editorRole);
    const created = await createList(editor.cookie);
    const [first] = await addChoices(editor.cookie, created.id, ["A", "B"]);
    const set = (payload: object) =>
      request(
        editor.cookie,
        "PUT",
        `/api/lists/${created.id}/choices/${String(first?.id)}/retired`,
        payload,
      );
    return { editor, created, first, set };
  }

  it("retires a choice, keeping it in the list, and records it", async () => {
    const { editor, created, first, set } = await retiredSetUp();
    expect((await set({ retired: true })).statusCode).toBe(200);
    const list = await readList(editor.cookie, created.id);
    expect(list?.choices.map(({ label, retired }) => [label, retired])).toEqual(
      [
        ["A", true],
        ["B", false],
      ],
    );
    expect((await historyOf(String(first?.id))).at(-1)).toMatchObject({
      field: "retired",
      oldValue: false,
      newValue: true,
      madeBy: editor.id,
    });
  });

  it("records nothing when a choice is already in the state asked for", async () => {
    const { first, set } = await retiredSetUp();
    await set({ retired: false });
    expect(await historyOf(String(first?.id))).toHaveLength(4);
  });

  it("restores a choice to its place in the list", async () => {
    const { editor, created, first, set } = await retiredSetUp();
    await set({ retired: true });
    await set({ retired: false });
    expect(await labelsOf(editor.cookie, created.id)).toEqual(["A", "B"]);
    expect(
      (await historyOf(String(first?.id))).slice(-2).map(({ field }) => field),
    ).toEqual(["retired", "retired"]);
  });
});
