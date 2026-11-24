// SPDX-License-Identifier: Apache-2.0

// Tests for lists of choices against a migrated PostgreSQL server: which roles may read and change
// them; creating, editing, retiring, restoring, and deleting lists; the refusals for duplicates,
// limits, and invalid requests; and the change history that records every change.

import { lists as listTable } from "@fathom/db";
import { type List, roleSchema } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  type Method,
  publicUrl,
  startTestApp,
  type TestApp,
} from "./test-app.ts";
import { editorRole, listHelpers } from "./test-lists.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

const {
  signedIn,
  request,
  uniqueName,
  historyOf,
  readLists,
  readList,
  createList,
  addChoices,
} = listHelpers(() => test);

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
    const response = await test.app.inject({
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
      keyNumber: created.keyNumber,
      name,
      description: "",
      visibility: "general",
      retired: false,
      builtIn: null,
      usedBy: [],
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
      await test.connection
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
    await test.connection
      .update(listTable)
      .set({ visibility: "fictional-tier" })
      .where(eq(listTable.id, created.id));
    expect((await readList(cookie, created.id))?.visibility).toBe("general");
  });
});
