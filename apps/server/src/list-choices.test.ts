// SPDX-License-Identifier: Apache-2.0

// Tests for a list's choices against a migrated PostgreSQL server: adding them one at a time or
// several at once, and editing, ordering, retiring, restoring, and removing them; the refusals for
// duplicates, limits, and invalid requests; and the change history that records every change.

import { changes } from "@fathom/db";
import type { Choice } from "@fathom/shared";
import { inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Method, startTestApp, type TestApp } from "./test-app.ts";
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
  historyOf,
  readList,
  createList,
  addChoices,
  labelsOf,
} = listHelpers(() => test);

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
    const sets = await test.connection
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
