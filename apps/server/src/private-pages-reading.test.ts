// SPDX-License-Identifier: Apache-2.0

// Tests for reading a person's own pages, against a PostgreSQL server of their own, with pages
// stored straight in the database: only their maker reads them, while their role may make private
// pages; anyone else, an Administrator included, is answered as for a page nobody made.

import { accessHistory, columnOrders } from "@fathom/db";
import type {
  ListedPrivatePage,
  Permission,
  PrivatePage,
  Role,
} from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  missingRecord,
  ok,
  startTestApp,
  type TestApp,
  type TestUser,
} from "./test-app.ts";
import {
  numberAndNote,
  type StoredColumn,
  storedPage as storePage,
} from "./test-private-pages.ts";
import { eq } from "drizzle-orm";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

const storedPage = (
  maker: TestUser,
  columns: readonly StoredColumn[],
  rows: readonly Record<string, number | string>[] = [],
  position = 0,
) => storePage(test.connection, maker.id, columns, rows, position);

// How many times the access history records the user viewing Personal details.
const personalViews = async (userId: string) =>
  (
    await test.connection
      .select({ action: accessHistory.action })
      .from(accessHistory)
      .where(eq(accessHistory.actorId, userId))
  ).filter(({ action }) => action === "personal-viewed").length;

const pageUrl = (pageId: string) => `/api/private-pages/${pageId}`;

describe("reading a page", () => {
  it("reads the maker's page, its columns in their order and its rows in the order added", async () => {
    // Given a page whose order puts Note before Number, with two rows
    const maker = await test.signedIn("feature-lead");
    const { pageId, ids, rowIds } = await storedPage(maker, numberAndNote, [
      { Number: 1, Note: "First" },
      { Number: 2 },
    ]);
    const number = String(ids.get("Number"));
    const note = String(ids.get("Note"));
    await test.connection
      .insert(columnOrders)
      .values({ tableName: `private:${pageId}`, keys: [note, number] });

    // When the maker reads it
    const page = await ok<PrivatePage>(
      await test.request(maker.cookie, "GET", pageUrl(pageId)),
    );

    // Then they see it all, in order
    expect(page).toMatchObject({
      id: pageId,
      position: 0,
      firstFieldId: number,
    });
    expect(page.columns).toEqual([
      {
        id: note,
        name: "Note",
        type: "note",
        listId: null,
        visibility: "general",
        multiple: false,
      },
      expect.objectContaining({ id: number, name: "Number" }),
    ]);
    expect(page.rows).toEqual([
      {
        id: rowIds[0],
        // Stored straight in the database, so made without its key.
        key: null,
        values: {},
        links: {},
        notes: { [note]: "First" },
        numbers: { [number]: 1 },
      },
      {
        id: rowIds[1],
        // Stored straight in the database, so made without its key.
        key: null,
        values: {},
        links: {},
        notes: {},
        numbers: { [number]: 2 },
      },
    ]);
  });

  it("lists only the actor's own pages, in their order", async () => {
    const maker = await test.signedIn("feature-lead");
    const second = await storedPage(maker, numberAndNote, [], 1);
    const first = await storedPage(maker, numberAndNote, [], 0);
    await storedPage(await test.signedIn("product-manager"), numberAndNote, []);
    const listed = await ok<ListedPrivatePage[]>(
      await test.request(maker.cookie, "GET", "/api/private-pages"),
    );
    expect(listed.map(({ id, position }) => [id, position])).toEqual([
      [first.pageId, 0],
      [second.pageId, 1],
    ]);
  });

  it("leaves out a column of a class the maker's role no longer sees, its values, and that it names the rows", async () => {
    const maker = await test.signedIn("engineering-manager");
    const { pageId, ids } = await storedPage(
      maker,
      [
        { name: "Number", type: "number", visibility: "personal" },
        { name: "Pages", type: "number" },
      ],
      [{ Number: 1 }],
    );
    await test.holdOnly(maker.id, ["private-pages:make"]);
    const page = await ok<PrivatePage>(
      await test.request(maker.cookie, "GET", pageUrl(pageId)),
    );
    expect(page.columns.map(({ id }) => id)).toEqual([ids.get("Pages")]);
    expect(page.firstFieldId).toBeNull();
    expect(page.rows[0]?.numbers).toEqual({});
  });

  it("records the maker viewing Personal details, once a day, only for a page showing a column beyond General", async () => {
    const maker = await test.signedIn("engineering-manager");
    const general = await storedPage(maker, numberAndNote, [{ Number: 1 }]);
    await ok(await test.request(maker.cookie, "GET", pageUrl(general.pageId)));
    expect(await personalViews(maker.id)).toBe(0);
    const personal = await storedPage(
      maker,
      [
        { name: "Number", type: "number" },
        { name: "Salary", type: "number", visibility: "personal" },
      ],
      [{ Number: 1, Salary: 100 }],
      1,
    );
    for (let read = 0; read < 2; read += 1) {
      await ok(
        await test.request(maker.cookie, "GET", pageUrl(personal.pageId)),
      );
    }
    expect(await personalViews(maker.id)).toBe(1);
  });
});

describe("who reads a page", () => {
  it.each<[string, Role | Permission[]]>([
    ["another maker of pages", "feature-lead"],
    ["an Administrator", "administrator"],
    ["a Team Member", "team-member"],
    [
      "a role with every class, Administration and People",
      [
        "private-pages:make",
        "administration:edit",
        "people:view",
        "personal:view",
        "confidential:view",
      ],
    ],
  ])("answers %s as for a page nobody made", async (_who, role) => {
    const maker = await test.signedIn("feature-lead");
    const { pageId } = await storedPage(maker, numberAndNote, [{ Number: 1 }]);
    const other = await test.signedIn(role);
    for (const id of [pageId, missingRecord]) {
      const response = await test.request(other.cookie, "GET", pageUrl(id));
      expect(response.statusCode).toBe(404);
      expect(errorOf(response)).toBe("There is no such page");
    }
  });

  it("answers its maker, once their role may no longer make pages, as for a page nobody made", async () => {
    const maker = await test.signedIn("feature-lead");
    const { pageId } = await storedPage(maker, numberAndNote, []);
    await test.holdOnly(maker.id, ["features:view", "people:view"]);
    const response = await test.request(maker.cookie, "GET", pageUrl(pageId));
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toBe("There is no such page");
  });

  it("refuses listing pages to a role that may not make them, and every read to anyone signed out", async () => {
    const member = await test.signedIn("team-member");
    expect(
      (await test.request(member.cookie, "GET", "/api/private-pages"))
        .statusCode,
    ).toBe(403);
    for (const url of ["/api/private-pages", pageUrl(missingRecord)]) {
      expect((await test.request("", "GET", url)).statusCode).toBe(401);
    }
  });
});
