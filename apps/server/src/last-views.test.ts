// SPDX-License-Identifier: Apache-2.0

// Tests for the view each account last showed on each page, against a PostgreSQL server of its
// own. Every role on every page is in views.test.ts.

import { lastViews } from "@fathom/db";
import type { LastViews, Permission } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generalReader,
  startTestApp,
  type TestApp,
  unique,
} from "./test-app.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

const pathOf = (page: string) => `/api/last-views/${page}`;

const remember = (cookie: string, page: string, body: object) =>
  test.request(cookie, "PUT", pathOf(page), body);

const lastViewsOf = async (cookie: string) =>
  (await test.request(cookie, "GET", "/api/last-views")).json<LastViews>();

const lastOf = async (cookie: string, page: keyof LastViews) =>
  // The page is always one of the fixed pages.
  // eslint-disable-next-line security/detect-object-injection
  (await lastViewsOf(cookie))[page] ?? null;

const peopleView = {
  table: "people",
  definition: { search: "fictional", sort: ["-preferredName"] },
};

describe("the last view of a page", () => {
  it("is kept for its account alone, read back, and replaced", async () => {
    // Given two accounts, one of which shows a view on People
    const { cookie } = await test.signedIn(generalReader);
    const other = await test.signedIn(generalReader);
    expect(await lastOf(cookie, "people")).toBeNull();

    // When it is kept, then another view replaces it
    expect((await remember(cookie, "people", peopleView)).statusCode).toBe(204);
    const first = await lastOf(cookie, "people");
    const replaced = {
      table: "people",
      definition: { grouping: "positionId" },
    };
    await remember(cookie, "people", replaced);

    // Then it reads back, only for its account
    expect(first).toEqual(peopleView);
    expect(await lastOf(cookie, "people")).toEqual(replaced);
    expect(await lastOf(other.cookie, "people")).toBeNull();
  });

  it("keeps the tab shown, as its table, and the page's mode", async () => {
    const { cookie } = await test.signedIn(generalReader);
    const proposals = { table: "proposals", definition: { search: "new" } };
    const board = {
      table: "features",
      definition: { choices: { hide: ["status"] } },
      mode: "board",
    };

    await remember(cookie, "projects", proposals);
    await remember(cookie, "features", board);

    expect(await lastOf(cookie, "projects")).toEqual(proposals);
    expect(await lastOf(cookie, "features")).toEqual(board);
  });

  it("keeps the saved view it started from while the account may see it", async () => {
    // Given a view of one's own, and another's personal view
    const { cookie } = await test.signedIn(generalReader);
    const other = await test.signedIn(generalReader);
    const saved = async (on: string) =>
      (
        await test.request(on, "POST", "/api/views/people", {
          name: unique("Mine"),
          scope: "personal",
          definition: {},
        })
      ).json<{ view: { id: string } }>().view.id;
    const mine = await saved(cookie);
    const theirs = await saved(other.cookie);

    // When the last view names each, then one's own is deleted
    await remember(cookie, "people", { ...peopleView, view: theirs });
    const withTheirs = await lastOf(cookie, "people");
    await remember(cookie, "people", { ...peopleView, view: mine });
    const withMine = await lastOf(cookie, "people");
    await test.request(cookie, "DELETE", `/api/views/people/${mine}`);

    // Then only one's own is kept, until it is deleted
    expect([withTheirs, withMine, await lastOf(cookie, "people")]).toEqual([
      peopleView,
      { ...peopleView, view: mine },
      peopleView,
    ]);
  });

  it.each([
    [
      "a table of another page",
      "projects",
      { table: "people", definition: {} },
      "Choose a table of this page",
    ],
    [
      "a mode the page doesn't have",
      "features",
      { table: "features", definition: {}, mode: "timeline" },
      "Choose a mode this page has",
    ],
    [
      "a mode on a page with none",
      "people",
      { table: "people", definition: {}, mode: "board" },
      "Choose a mode this page has",
    ],
    [
      "a column the role can't see",
      "people",
      { table: "people", definition: { sort: ["endDate"] } },
      "Choose only columns this role can see",
    ],
    [
      "a choice the page doesn't offer",
      "people",
      { table: "people", definition: { choices: { teams: "feature" } } },
      "Choose only what this page offers",
    ],
  ])("refuses %s", async (_, page, body, error) => {
    const { cookie } = await test.signedIn(generalReader);
    const response = await remember(cookie, page, body);
    expect([response.statusCode, response.json()]).toEqual([400, { error }]);
  });

  it("needs sign-in", async () => {
    const response = await test.app.inject("/api/last-views");
    expect(response.statusCode).toBe(401);
  });

  it("answers that a page with no Views menu is no such page", async () => {
    const { cookie } = await test.signedIn("administrator");
    const response = await test.request(
      cookie,
      "PUT",
      pathOf("roles"),
      peopleView,
    );
    expect(response.statusCode).toBe(404);
  });

  it("leaves out what the reader's role can no longer see", async () => {
    // Given a view filtered, sorted and grouped on Personal columns
    const reader: Permission[] = [...generalReader, "personal:view"];
    const { id, cookie } = await test.signedIn(reader);
    await remember(cookie, "people", {
      table: "people",
      definition: {
        search: "fictional",
        filters: {
          startDate: { from: "2026-11-01" },
          draft: { any: ["waiting"] },
        },
        sort: ["endDate", "preferredName"],
        grouping: "endDate",
        thenBy: "positionId",
        hidden: ["startDate", "employeeId"],
      },
    });

    // When the role no longer sees Personal data
    await test.holdOnly(id, generalReader);

    // Then only what it sees comes back
    expect(await lastOf(cookie, "people")).toEqual({
      table: "people",
      definition: {
        search: "fictional",
        filters: { draft: { any: ["waiting"] } },
        sort: ["preferredName"],
        hidden: ["employeeId"],
      },
    });
  });

  it("keeps a grouping by manager only while the role sees the data it needs", async () => {
    // Given a view of Feature assignments grouped by manager
    const assignmentsReader: Permission[] = [
      "feature-teams:view",
      "personal:view",
    ];
    const { id, cookie } = await test.signedIn([
      ...assignmentsReader,
      "confidential:view",
    ]);
    const byManager = {
      table: "feature-assignments",
      definition: { grouping: "manager" },
    };
    await remember(cookie, "feature-assignments", byManager);
    const kept = await lastOf(cookie, "feature-assignments");

    // When the role no longer sees what the grouping needs
    await test.holdOnly(id, assignmentsReader);

    // Then the grouping is kept until then
    expect([kept, await lastOf(cookie, "feature-assignments")]).toEqual([
      byManager,
      { table: "feature-assignments", definition: {} },
    ]);
  });

  it("sends neither a stored view it can't read nor a saved view the account no longer may apply", async () => {
    // Given stored views of an unknown page, an unknown table, a table of another page, a view it
    // can't read, choices the page doesn't offer, and another account's personal view
    const { id, cookie } = await test.signedIn(generalReader);
    const other = await test.signedIn(generalReader);
    const theirs = (
      await test.request(other.cookie, "POST", "/api/views/people", {
        name: unique("Theirs"),
        scope: "personal",
        definition: {},
      })
    ).json<{ view: { id: string } }>().view.id;
    const row = (page: string, tableName: string, definition: unknown) => ({
      userId: id,
      page,
      tableName,
      definition,
    });
    await test.connection
      .insert(lastViews)
      .values([
        row("gone", "people", {}),
        row("releases", "gone", {}),
        row("projects", "people", {}),
        row("accounts", "accounts", { sort: "unread" }),
        row("features", "features", { choices: { teams: "feature" } }),
        { ...row("people", "people", {}), savedViewId: theirs },
      ]);

    // Then only what it may show comes back
    expect(await lastViewsOf(cookie)).toEqual({
      features: { table: "features", definition: {} },
      people: { table: "people", definition: {} },
    });
  });

  it("is not sent to a role that no longer opens its page, and is sent with the others", async () => {
    // Given a last view of Feature assignments, which needs Personal data
    const reader: Permission[] = [...generalReader, "personal:view"];
    const { id, cookie } = await test.signedIn(reader);
    await remember(cookie, "feature-assignments", {
      table: "feature-assignments",
      definition: { search: "fictional" },
    });
    await remember(cookie, "people", peopleView);

    // When the role no longer opens it
    await test.holdOnly(id, generalReader);

    // Then only the last views of the pages it opens are sent
    expect(Object.keys(await lastViewsOf(cookie))).toEqual(["people"]);
  });
});
