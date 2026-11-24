// SPDX-License-Identifier: Apache-2.0

// Tests for the weights of feature sizes, against a PostgreSQL server of their own: each size's
// choice carries one and other lists' choices none, kept when edited, saved on approving, recorded
// in the change history, and put back by Undo.

import { listItems, lists } from "@fathom/db";
import type { ChangeEntry, Choice, List } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  type Method,
  startTestApp,
  type TestApp,
  unique,
} from "./test-app.ts";

let test: TestApp;
let editor: { id: string; cookie: string };
let approver: { id: string; cookie: string };
let sizes: string;

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
  const [list] = await test.connection
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.builtIn, "feature-sizes"));
  sizes = String(list?.id);
});

afterAll(async () => {
  await test.close();
});

const send = (method: Method, url: string, body?: object, who = editor) =>
  test.request(who.cookie, method, url, body);

async function readList(id: string): Promise<List> {
  const response = await send("GET", "/api/lists");
  return response
    .json<{ lists: List[] }>()
    .lists.find((list) => list.id === id) as List;
}

const addTo = (listId: string, choices: object[]) =>
  send("POST", `/api/lists/${listId}/choices`, { choices });

const choiceUrl = (id: string) => `/api/lists/${sizes}/choices/${id}`;

const approve = (body: object) =>
  send("POST", "/api/drafts/approval", body, approver);

const undo = (changeSetId: string) => send("POST", `/api/undo/${changeSetId}`);

const changeSetOf = (response: Awaited<ReturnType<typeof send>>) =>
  response.json<{ changeSetId: string }>().changeSetId;

const liveWeight = async (id: string) => {
  const [row] = await test.connection
    .select({ weight: listItems.weight })
    .from(listItems)
    .where(eq(listItems.id, id));
  return row?.weight;
};

describe("the weights of feature sizes", () => {
  it("gives each size its weight, and other lists' choices none", async () => {
    const list = await readList(sizes);
    expect(list.choices.map(({ label, weight }) => [label, weight])).toEqual([
      ["XS", 0.5],
      ["S", 1],
      ["M", 2],
      ["L", 3],
      ["XL", 4],
    ]);
    const created = await send("POST", "/api/lists", {
      name: unique("Fictional Sites"),
    });
    const other = created.json<{ list: List }>().list;
    const added = await addTo(other.id, [{ label: "North" }]);
    expect(added.statusCode).toBe(201);
    const [north] = added.json<{ choices: Choice[] }>().choices;
    expect(north).not.toHaveProperty("weight");
  });

  it("needs a weight Fathom keeps for each size added, and refuses one in any other list", async () => {
    const without = await addTo(sizes, [{ label: unique("Fictional XXL") }]);
    expect(without.statusCode).toBe(400);
    expect(errorOf(without)).toBe("Give the size a weight");
    for (const weight of [0, 10000, 1.234]) {
      const refused = await addTo(sizes, [
        { label: unique("Fictional XXL"), weight },
      ]);
      expect(refused.statusCode).toBe(400);
    }
    const created = await send("POST", "/api/lists", {
      name: unique("Fictional Levels"),
    });
    const other = created.json<{ list: List }>().list;
    const weighed = await addTo(other.id, [{ label: "Senior", weight: 2 }]);
    expect(weighed.statusCode).toBe(400);
    expect(errorOf(weighed)).toBe("Only feature sizes have weights");
    const added = await addTo(other.id, [{ label: "Junior" }]);
    const junior = String(added.json<{ choices: Choice[] }>().choices[0]?.id);
    const reweighed = await send(
      "PUT",
      `/api/lists/${other.id}/choices/${junior}`,
      { label: "Junior", weight: 2 },
    );
    expect(reweighed.statusCode).toBe(400);
    expect(errorOf(reweighed)).toBe("Only feature sizes have weights");
  });

  it("keeps a size's weight when an edit leaves it out, changes it when given, and approving saves it", async () => {
    const label = unique("Fictional XXL");
    const added = await addTo(sizes, [{ label, weight: 6 }]);
    expect(added.statusCode).toBe(201);
    const id = String(added.json<{ choices: Choice[] }>().choices[0]?.id);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
    expect(await liveWeight(id)).toBe(6);
    const renamed = await send("PUT", choiceUrl(id), { label: `${label} Now` });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<{ choice: Choice }>().choice.weight).toBe(6);
    const reweighed = await send("PUT", choiceUrl(id), {
      label: `${label} Now`,
      weight: 5.5,
    });
    expect(reweighed.statusCode).toBe(200);
    const choice = reweighed.json<{ choice: Choice }>().choice;
    expect(choice.weight).toBe(5.5);
    expect(choice.draft?.changed).toEqual(["label", "weight"]);
    expect(choice.draft?.live).toEqual({ label, weight: 6 });
    const cleared = await send("PUT", choiceUrl(id), { label, weight: null });
    expect(cleared.statusCode).toBe(400);
    const approved = await approve({ choices: [id] });
    expect(approved.statusCode).toBe(200);
    expect(await liveWeight(id)).toBe(5.5);
    const entry = (await send("GET", "/api/changes"))
      .json<{ entries: ChangeEntry[] }>()
      .entries.find(({ id: one }) => one === changeSetOf(approved));
    expect(entry?.records[0]?.fields).toContainEqual({
      field: "weight",
      oldValue: "6",
      newValue: "5.5",
    });
    expect((await send("DELETE", choiceUrl(id))).statusCode).toBe(200);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
  });

  it("takes back a size's drafted weight, and its drafted removal, with Undo", async () => {
    const label = unique("Fictional XXXL");
    const added = await addTo(sizes, [{ label, weight: 7 }]);
    const id = String(added.json<{ choices: Choice[] }>().choices[0]?.id);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
    const reweighed = await send("PUT", choiceUrl(id), { label, weight: 9 });
    expect((await undo(changeSetOf(reweighed))).statusCode).toBe(200);
    const kept = (await readList(sizes)).choices.find(
      (choice) => choice.id === id,
    );
    expect(kept?.weight).toBe(7);
    expect(kept).not.toHaveProperty("draft");
    const removed = await send("DELETE", choiceUrl(id));
    expect((await undo(changeSetOf(removed))).statusCode).toBe(200);
    expect(
      (await readList(sizes)).choices.find((choice) => choice.id === id),
    ).toEqual(expect.objectContaining({ weight: 7 }));
    expect(await liveWeight(id)).toBe(7);
  });
});
