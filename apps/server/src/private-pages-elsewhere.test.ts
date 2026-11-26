// SPDX-License-Identifier: Apache-2.0

// Tests that a private page's columns stay out of reach of the paths every other table's columns
// share, against a PostgreSQL server of their own: moving a column's class, a list's refusals, and
// the People and plan tables' columns.

import { fields } from "@fathom/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, startTestApp, type TestApp, unique } from "./test-app.ts";
import { listHelpers } from "./test-lists.ts";
import { storedPage } from "./test-private-pages.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

const lists = listHelpers(() => test);

// A page of a fictional Feature Lead's whose second column is named as given.
async function pageWith(name: string, listId?: string) {
  const maker = await test.signedIn("feature-lead");
  const { ids } = await storedPage(test.connection, maker.id, [
    { name: "Number", type: "number" },
    listId === undefined
      ? { name, type: "number" }
      : { name, type: "choice", listId },
  ]);
  return String(ids.get(name));
}

describe("a private page's columns elsewhere", () => {
  it("are not there for moving a column's class, even for one who classifies data", async () => {
    const columnId = await pageWith(unique("Fictional Salary"));
    const classifier = await test.signedIn("engineering-director");
    const response = await test.request(
      classifier.cookie,
      "PUT",
      `/api/columns/${columnId}/class`,
      { dataClass: "confidential" },
    );
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toBe("There is no such column");
    const [column] = await test.connection
      .select({ visibility: fields.visibility })
      .from(fields)
      .where(eq(fields.id, columnId));
    expect(column?.visibility).toBe("general");
  });

  it("keep a list from being retired or deleted, without being named", async () => {
    // Given a live list one private column draws on
    const editor = await test.signedIn("workforce-administrator");
    const list = await lists.createList(editor.cookie);
    await lists.addChoices(editor.cookie, list.id, ["Calm"]);
    await test.approveLists();
    const hidden = unique("Fictional Mood");
    await pageWith(hidden, list.id);

    // Then retiring and deleting it are refused, naming no column
    const retired = await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${list.id}/retired`,
      { retired: true },
    );
    expect(retired.statusCode).toBe(409);
    expect(errorOf(retired)).toBe(
      "This list cannot be retired while a column draws on it: a column on a private page",
    );

    // And once another private column draws on it, both are counted
    await pageWith(unique("Fictional Mood"), list.id);
    const deleted = await test.request(
      editor.cookie,
      "DELETE",
      `/api/lists/${list.id}`,
    );
    expect(deleted.statusCode).toBe(409);
    expect(errorOf(deleted)).toBe(
      "This list cannot be deleted while columns draw on it: columns on private pages",
    );
    expect(errorOf(deleted)).not.toContain(hidden);
  });

  it("are not among People's or the plan's columns", async () => {
    const hidden = unique("Fictional Private Column");
    await pageWith(hidden);
    const reader = await test.signedIn("engineering-director");
    for (const url of ["/api/people/columns", "/api/projects"]) {
      const response = await test.request(reader.cookie, "GET", url);
      expect(response.statusCode, url).toBe(200);
      expect(response.body, url).not.toContain(hidden);
    }
  });
});
