// SPDX-License-Identifier: Apache-2.0

// Tests for saved views of the People table, against a PostgreSQL server of their own: saving,
// renaming, updating, and deleting them; who may change them; keeping a view on columns a reader may
// not see from that reader; and undoing each change.

import type { Choice, Field, List, SavedView } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "./test-app.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

interface Saved {
  view: SavedView;
  changeSetId: string | null;
}

const viewsOf = async (cookie: string) =>
  (await test.request(cookie, "GET", "/api/people")).json<{
    views: SavedView[];
  }>().views;

const save = (cookie: string, name: string, definition: unknown) =>
  test.request(cookie, "POST", "/api/people/views", { name, definition });

const undo = (cookie: string, changeSetId: string | null) =>
  test.request(cookie, "POST", `/api/undo/${String(changeSetId)}`, {});

describe("saved views", () => {
  it("are saved, renamed, updated, and deleted, with names unique regardless of case, and each change undone", async () => {
    const { cookie } = await test.signedIn(["viewer"]);
    const made = await save(cookie, "  By name  ", {
      search: "fictional",
      sort: ["-preferredName"],
      filters: { employeeId: { contains: "E" } },
    });
    expect(made.statusCode).toBe(201);
    const { view, changeSetId } = made.json<Saved>();
    expect(view).toEqual({
      id: view.id,
      name: "By name",
      definition: {
        search: "fictional",
        sort: ["-preferredName"],
        filters: { employeeId: { contains: "E" } },
      },
      canChange: true,
    });
    expect(await viewsOf(cookie)).toContainEqual(view);
    expect((await save(cookie, "BY NAME", {})).json()).toEqual({
      error: "There is already a view with that name",
    });

    const renamed = await test.request(
      cookie,
      "PUT",
      `/api/people/views/${view.id}`,
      { name: "Names", definition: { sort: ["employeeId"] } },
    );
    expect(renamed.statusCode).toBe(200);
    const changed = renamed.json<Saved>();
    expect(changed.view).toMatchObject({
      name: "Names",
      definition: { sort: ["employeeId"] },
    });
    const same = await test.request(
      cookie,
      "PUT",
      `/api/people/views/${view.id}`,
      { name: "Names" },
    );
    expect(same.json<Saved>().changeSetId).toBeNull();

    expect((await undo(cookie, changed.changeSetId)).statusCode).toBe(200);
    expect(
      (await viewsOf(cookie)).find((other) => other.id === view.id)?.name,
    ).toBe("By name");

    const deleted = await test.request(
      cookie,
      "DELETE",
      `/api/people/views/${view.id}`,
    );
    expect(deleted.statusCode).toBe(200);
    expect((await viewsOf(cookie)).some((other) => other.id === view.id)).toBe(
      false,
    );
    const { changeSetId: deletion } = deleted.json<{
      changeSetId: string | null;
    }>();
    expect((await undo(cookie, deletion)).statusCode).toBe(200);
    expect(await viewsOf(cookie)).toContainEqual(view);

    expect((await test.historyOf(view.id)).map(({ action }) => action)).toEqual(
      expect.arrayContaining(["created", "changed", "deleted"]),
    );
    expect(changeSetId).not.toBeNull();
  });

  it("may be changed only by their maker or by someone who may change planning configuration", async () => {
    const maker = await test.signedIn(["viewer"]);
    const other = await test.signedIn(["viewer"]);
    const administrator = await test.signedIn([
      "viewer",
      "workforce-administrator",
    ]);
    const { view } = (
      await save(maker.cookie, "Shared", { search: "a" })
    ).json<Saved>();
    const theirs = (await viewsOf(other.cookie)).find(
      ({ id }) => id === view.id,
    );
    expect(theirs?.canChange).toBe(false);

    const refused = await test.request(
      other.cookie,
      "PUT",
      `/api/people/views/${view.id}`,
      { name: "Mine now" },
    );
    expect(refused.statusCode).toBe(403);
    expect(
      (
        await test.request(
          other.cookie,
          "DELETE",
          `/api/people/views/${view.id}`,
        )
      ).statusCode,
    ).toBe(403);

    const renamed = await test.request(
      administrator.cookie,
      "PUT",
      `/api/people/views/${view.id}`,
      { name: "Shared by all" },
    );
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<Saved>().view.canChange).toBe(true);

    // Undoing needs the same right, so one who has since lost it cannot undo.
    const { changeSetId } = renamed.json<Saved>();
    const accounts = await test.signedIn(["administrator"]);
    expect(
      (
        await test.request(
          accounts.cookie,
          "PUT",
          `/api/accounts/${administrator.id}/roles`,
          { roles: ["viewer"] },
        )
      ).statusCode,
    ).toBe(200);
    expect((await undo(administrator.cookie, changeSetId)).json()).toEqual({
      error:
        "Only the person who saved a view, or someone who may change planning configuration, can change it",
    });
    expect((await save(accounts.cookie, "No", {})).statusCode).toBe(403);
    expect(
      (
        await test.request(
          maker.cookie,
          "PUT",
          "/api/people/views/00000000-0000-4000-8000-000000000000",
          { name: "Gone" },
        )
      ).statusCode,
    ).toBe(404);
  });

  it("are kept from readers who may not see a column they use, who cannot save such a view either", async () => {
    const manager = await test.signedIn(["viewer", "people-manager"]);
    const viewer = await test.signedIn(["viewer"]);
    const { view, changeSetId } = (
      await save(manager.cookie, "Leaving soon", {
        filters: { endDate: { from: "2026-11-01" } },
      })
    ).json<Saved>();
    expect(
      (await test.historyOf(view.id)).every(
        ({ tier }) => tier === "restricted",
      ),
    ).toBe(true);
    expect(
      (await viewsOf(viewer.cookie)).some(({ id }) => id === view.id),
    ).toBe(false);
    expect(
      (
        await test.request(
          viewer.cookie,
          "DELETE",
          `/api/people/views/${view.id}`,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (await save(viewer.cookie, "Mine", { sort: ["startDate"] })).json(),
    ).toEqual({ error: "Choose only columns you can see" });
    expect(
      (await save(viewer.cookie, "Unknown", { sort: ["nothing"] })).statusCode,
    ).toBe(400);
    // Its maker sees it without editing Restricted details, and so may undo saving it, but not once
    // they no longer see them.
    expect((await undo(manager.cookie, changeSetId)).statusCode).toBe(200);
    const starting = (
      await save(manager.cookie, "Starting soon", {
        filters: { startDate: { from: "2026-11-01" } },
      })
    ).json<Saved>();
    const accounts = await test.signedIn(["administrator"]);
    await test.request(
      accounts.cookie,
      "PUT",
      `/api/accounts/${manager.id}/roles`,
      { roles: ["viewer"] },
    );
    expect((await undo(manager.cookie, starting.changeSetId)).statusCode).toBe(
      403,
    );
  });

  it("ignore columns deleted since they were saved", async () => {
    const { cookie } = await test.signedIn([
      "viewer",
      "workforce-administrator",
    ]);
    const list = (
      await test.request(cookie, "POST", "/api/lists", {
        name: "Fictional Levels",
        visibility: "confidential",
      })
    ).json<{ list: List }>().list;
    const [choice] = (
      await test.request(cookie, "POST", `/api/lists/${list.id}/choices`, {
        choices: [{ label: "Fictional Level" }],
      })
    ).json<{ choices: Choice[] }>().choices;
    const field = (
      await test.request(cookie, "POST", "/api/people/columns", {
        name: "Level",
        listId: list.id,
      })
    ).json<{ field: Field }>().field;
    const { view } = (
      await save(cookie, "Levels", {
        filters: { [field.id]: { any: [String(choice?.id)] } },
        sort: [field.id],
      })
    ).json<Saved>();
    expect(
      (await test.historyOf(view.id)).every(
        ({ tier }) => tier === "confidential",
      ),
    ).toBe(true);
    expect(
      (await test.request(cookie, "DELETE", `/api/people/columns/${field.id}`))
        .statusCode,
    ).toBe(200);
    // Readers are sent the view without the deleted column, which is not shown to them.
    const viewer = await test.signedIn(["viewer"]);
    expect(
      (await viewsOf(viewer.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual({});
    // Its deleted column cannot be saved into it again.
    expect(
      (
        await test.request(cookie, "PUT", `/api/people/views/${view.id}`, {
          definition: view.definition,
        })
      ).statusCode,
    ).toBe(400);
  });

  it("are undone only by those who still see the columns they use, as sensitive as they are now", async () => {
    const administrator = await test.signedIn([
      "viewer",
      "workforce-administrator",
    ]);
    const list = (
      await test.request(administrator.cookie, "POST", "/api/lists", {
        name: "Fictional Teams",
      })
    ).json<{ list: List }>().list;
    const field = (
      await test.request(administrator.cookie, "POST", "/api/people/columns", {
        name: "Team",
        listId: list.id,
      })
    ).json<{ field: Field }>().field;
    const viewer = await test.signedIn(["viewer"]);
    const { view, changeSetId } = (
      await save(viewer.cookie, "By team", { sort: [field.id] })
    ).json<Saved>();
    expect(
      (
        await test.request(
          administrator.cookie,
          "PUT",
          `/api/lists/${list.id}`,
          {
            name: "Fictional Teams",
            visibility: "restricted",
          },
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await viewsOf(viewer.cookie)).some(({ id }) => id === view.id),
    ).toBe(false);
    expect((await undo(viewer.cookie, changeSetId)).statusCode).toBe(403);
  });

  it("refuses names and views that do not fit", async () => {
    const { cookie } = await test.signedIn(["viewer"]);
    const refusals = [
      await save(cookie, "   ", {}),
      await save(cookie, "n".repeat(81), {}),
      await save(cookie, "Not a view", "name"),
      await save(cookie, "Bad filter", {
        filters: { employeeId: { from: "2026-02-30" } },
      }),
      await save(cookie, "Bad sort", { sort: ["a b"] }),
      await test.request(cookie, "PUT", "/api/people/views/not-a-view", {
        name: "Fictional",
      }),
    ];
    expect(refusals.map(({ statusCode }) => statusCode)).toEqual([
      400, 400, 400, 400, 400, 400,
    ]);
  });
});
