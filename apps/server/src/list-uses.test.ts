// SPDX-License-Identifier: Apache-2.0

// Tests for the columns the lists say use them, against a PostgreSQL server of their own: the live
// columns added to People and Features that draw on a list, and who is sent them.

import type { List, ProjectPlan } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, type TestApp, unique } from "./test-app.ts";

let test: TestApp;
let editor: { id: string; cookie: string };
let list: List;
let onPeople: string;
let onFeatures: string;

async function readLists(cookie: string): Promise<List[]> {
  const response = await test.request(cookie, "GET", "/api/lists");
  expect(response.statusCode).toBe(200);
  return response.json<{ lists: List[] }>().lists;
}

async function addColumn(table: "people" | "features", listId?: string) {
  const name = unique("Fictional Column");
  const response = await test.request(
    editor.cookie,
    "POST",
    `/api/${table}/columns`,
    {
      name,
      ...(listId === undefined
        ? { type: "link", visibility: "general" }
        : { listId }),
    },
  );
  expect(response.statusCode, response.body).toBe(201);
  return name;
}

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("engineering-director");
  // Given a live list with a live column drawing on it on each of People and Features, beside a
  // live column that draws on no list
  const created = await test.request(editor.cookie, "POST", "/api/lists", {
    name: unique("Fictional List"),
  });
  list = created.json<{ list: List }>().list;
  onPeople = await addColumn("people", list.id);
  onFeatures = await addColumn("features", list.id);
  await addColumn("people");
  await test.approveLists();
});

afterAll(async () => {
  await test.close();
});

describe("the columns that use a list", () => {
  it("names the live columns added to People and Features that draw on a list, by page", async () => {
    const lists = await readLists(editor.cookie);
    expect(lists.find(({ id }) => id === list.id)?.usedBy).toEqual([
      { page: "Features", column: onFeatures },
      { page: "People", column: onPeople },
    ]);
  });

  it("leaves out a column only drafted to be added", async () => {
    // Given a column drafted to be added that draws on the list
    await addColumn("people", list.id);

    // When the lists are read
    const lists = await readLists(editor.cookie);

    // Then only the live columns are named
    expect(lists.find(({ id }) => id === list.id)?.usedBy).toEqual([
      { page: "Features", column: onFeatures },
      { page: "People", column: onPeople },
    ]);
  });
});

describe("who is sent the columns that use a list", () => {
  it("sends them to no reader of lists who doesn't open Lists", async () => {
    const reader = await test.signedIn(["people:view"]);
    const lists = await readLists(reader.cookie);
    expect(lists.find(({ id }) => id === list.id)).toBeDefined();
    expect(lists.filter((one) => one.usedBy !== undefined)).toEqual([]);
  });

  it("sends them with no list a Features column draws on", async () => {
    const reader = await test.signedIn(["configuration:view", "features:view"]);
    const response = await test.request(reader.cookie, "GET", "/api/projects");
    expect(response.statusCode).toBe(200);
    const { lists } = response.json<ProjectPlan>().featureColumns;
    expect(lists.find(({ id }) => id === list.id)).toBeDefined();
    expect(lists.filter((one) => one.usedBy !== undefined)).toEqual([]);
  });
});
