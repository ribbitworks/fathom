// SPDX-License-Identifier: Apache-2.0

// Tests for saved views of the People table, against a PostgreSQL server of their own: saving,
// renaming, updating, and deleting them; who may change them; keeping a view on columns a reader may
// not see from that reader; and undoing each change. Resource Planners stand for readers who see
// people's General details and no more.

import {
  builtInColumnNames,
  type Choice,
  type Field,
  type List,
  roleSchema,
  type SavedView,
} from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findStartingRole } from "./data/roles.ts";
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
    const { cookie } = await test.signedIn("resource-planner");
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
    const maker = await test.signedIn("resource-planner");
    const other = await test.signedIn("resource-planner");
    const administrator = await test.signedIn("workforce-administrator");
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
    const accounts = await test.signedIn("administrator");
    expect(
      (
        await test.request(
          accounts.cookie,
          "PATCH",
          `/api/accounts/${administrator.id}`,
          {
            roleId: await findStartingRole(test.connection, "resource-planner"),
          },
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
    const manager = await test.signedIn("engineering-manager");
    const viewer = await test.signedIn("resource-planner");
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
    const accounts = await test.signedIn("administrator");
    await test.request(
      accounts.cookie,
      "PATCH",
      `/api/accounts/${manager.id}`,
      { roleId: await findStartingRole(test.connection, "resource-planner") },
    );
    expect((await undo(manager.cookie, starting.changeSetId)).statusCode).toBe(
      403,
    );
  });

  it("keep their columns' widths, sending each reader only those of columns they may see", async () => {
    const manager = await test.signedIn("engineering-manager");
    const viewer = await test.signedIn("resource-planner");
    const widths = { preferredName: 240, startDate: 120, gone: 300 };
    const { view } = (
      await save(manager.cookie, "Wide names", { widths })
    ).json<Saved>();
    expect(view.definition).toEqual({ widths });
    expect(
      (await viewsOf(viewer.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual({ widths: { preferredName: 240, gone: 300 } });
  });

  it("keep the widths of columns a reader may not see when that reader updates them", async () => {
    const maker = await test.signedIn("engineering-manager");
    const { view } = (
      await save(maker.cookie, "Wide start", {
        widths: { preferredName: 240, startDate: 120 },
      })
    ).json<Saved>();
    const accounts = await test.signedIn("administrator");
    await test.request(accounts.cookie, "PATCH", `/api/accounts/${maker.id}`, {
      roleId: await findStartingRole(test.connection, "resource-planner"),
    });
    expect(
      (
        await test.request(
          maker.cookie,
          "PUT",
          `/api/people/views/${view.id}`,
          {
            definition: { widths: { preferredName: 300 } },
          },
        )
      ).statusCode,
    ).toBe(200);
    const other = await test.signedIn("engineering-manager");
    expect(
      (await viewsOf(other.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual({ widths: { preferredName: 300, startDate: 120 } });
  });

  it("keep what they show and the columns they break down by, and are kept from readers who may not see those columns", async () => {
    const manager = await test.signedIn("engineering-manager");
    const viewer = await test.signedIn("resource-planner");
    const general = (
      await save(viewer.cookie, "Metrics open", {
        show: "drafts",
        breakdown: [],
        frozen: 0,
      })
    ).json<Saved>().view;
    expect(general.definition).toEqual({
      show: "drafts",
      breakdown: [],
      frozen: 0,
    });
    expect(
      (await viewsOf(viewer.cookie)).find(({ id }) => id === general.id)
        ?.definition,
    ).toEqual({ show: "drafts", breakdown: [], frozen: 0 });

    const { view } = (
      await save(manager.cookie, "By start", {
        breakdown: ["startDate", "employeeId"],
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
      (await save(viewer.cookie, "Mine", { breakdown: ["endDate"] })).json(),
    ).toEqual({ error: "Choose only columns you can see" });
    expect(
      (await save(viewer.cookie, "Unknown", { breakdown: ["nothing"] }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await save(viewer.cookie, "Repeated", {
          breakdown: ["employeeId", "employeeId"],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await save(viewer.cookie, "By draft", { breakdown: ["draft"] })).json(),
    ).toEqual({ error: "Choose only columns you can see" });
    expect(
      (
        await save(viewer.cookie, "Three", {
          breakdown: ["employeeId", "preferredName", "draft"],
        })
      ).statusCode,
    ).toBe(400);
  });

  it("may filter on drafts, which every reader may see, since each is sent only the drafts they may see", async () => {
    const viewer = await test.signedIn("resource-planner");
    const { view } = (
      await save(viewer.cookie, "Drafts waiting", {
        filters: { draft: { any: ["waiting"], empty: true } },
      })
    ).json<Saved>();
    expect(view.definition).toEqual({
      filters: { draft: { any: ["waiting"], empty: true } },
    });
    expect(
      (await test.historyOf(view.id)).every(({ tier }) => tier === "general"),
    ).toBe(true);
    // Every role that sees people sees the view, however little it sees of them.
    let readers = 0;
    for (const role of roleSchema.options) {
      const { cookie } = await test.signedIn(role);
      const answer = await test.request(cookie, "GET", "/api/people");
      if (answer.statusCode !== 200) continue;
      readers += 1;
      expect(
        answer
          .json<{ views: SavedView[] }>()
          .views.find(({ id }) => id === view.id)?.definition,
        role,
      ).toEqual(view.definition);
    }
    expect(readers).toBeGreaterThan(1);
    // Drafts are filtered on, but not sorted on.
    expect(
      (await save(viewer.cookie, "By draft", { sort: ["-draft"] })).json(),
    ).toEqual({ error: "Choose only columns you can see" });
  });

  it("ignore columns deleted since they were saved", async () => {
    const { cookie } = await test.signedIn("workforce-administrator");
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
    await test.approveLists();
    const field = (
      await test.request(cookie, "POST", "/api/people/columns", {
        name: "Level",
        listId: list.id,
      })
    ).json<{ field: Field }>().field;
    await test.approveLists();
    const { view } = (
      await save(cookie, "Levels", {
        filters: { [field.id]: { any: [String(choice?.id)] } },
        sort: [field.id],
        breakdown: [field.id],
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
    await test.approveLists();
    // Readers are sent the view without the deleted column, which is not shown to them, though its
    // metrics still show.
    const viewer = await test.signedIn("resource-planner");
    expect(
      (await viewsOf(viewer.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual({ breakdown: [] });
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
    const administrator = await test.signedIn("workforce-administrator");
    const list = (
      await test.request(administrator.cookie, "POST", "/api/lists", {
        name: "Fictional Teams",
      })
    ).json<{ list: List }>().list;
    await test.approveLists();
    const field = (
      await test.request(administrator.cookie, "POST", "/api/people/columns", {
        name: "Team",
        listId: list.id,
      })
    ).json<{ field: Field }>().field;
    await test.approveLists();
    const viewer = await test.signedIn("resource-planner");
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
    await test.approveLists();
    expect(
      (await viewsOf(viewer.cookie)).some(({ id }) => id === view.id),
    ).toBe(false);
    expect((await undo(viewer.cookie, changeSetId)).statusCode).toBe(403);
  });

  it("refuses names and views that do not fit", async () => {
    const { cookie } = await test.signedIn("resource-planner");
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

describe("built-in columns in saved views", () => {
  it("are each kept in a saved view and read back", async () => {
    const { cookie } = await test.signedIn("workforce-administrator");
    const definition = {
      filters: Object.fromEntries(
        [...builtInColumnNames.keys()].map((key) => [key, { empty: true }]),
      ),
    };
    const { view } = (
      await save(cookie, "Every built-in column", definition)
    ).json<Saved>();
    expect(view.definition).toEqual(definition);
    expect(
      (await viewsOf(cookie)).find(({ id }) => id === view.id)?.definition,
    ).toEqual(definition);
  });

  it("on State and Expected are saved and read back by readers who see only General details", async () => {
    const administrator = await test.signedIn("workforce-administrator");
    const states = (
      await test.request(administrator.cookie, "GET", "/api/lists")
    )
      .json<{ lists: List[] }>()
      .lists.find(({ builtIn }) => builtIn === "hiring-states")
      ?.choices.filter(
        ({ meaning }) => meaning === "proposed" || meaning === "open",
      );
    const hiringPlan = {
      filters: { stateId: { any: (states ?? []).map(({ id }) => id) } },
      sort: ["expected"],
    };
    expect(hiringPlan.filters.stateId.any).not.toHaveLength(0);
    const viewer = await test.signedIn("resource-planner");
    const { view } = (
      await save(viewer.cookie, "Hiring plan", hiringPlan)
    ).json<Saved>();
    expect(await viewsOf(viewer.cookie)).toContainEqual({
      ...view,
      definition: hiringPlan,
    });
  });

  it("on managers and teams are saved by readers who see only General details", async () => {
    const viewer = await test.signedIn("resource-planner");
    const response = await save(viewer.cookie, "By manager", {
      filters: { isManager: { empty: true } },
      sort: ["managerId", "teamName"],
      breakdown: ["team"],
    });
    expect(response.statusCode).toBe(201);
  });

  it("on Manager since are kept from readers who do not see Restricted details", async () => {
    const administrator = await test.signedIn("workforce-administrator");
    const { view } = (
      await save(administrator.cookie, "Manager since", {
        sort: ["managerFrom"],
      })
    ).json<Saved>();
    const viewer = await test.signedIn("resource-planner");
    expect(
      (await viewsOf(viewer.cookie)).some(({ id }) => id === view.id),
    ).toBe(false);
  });

  it("on Manager since are refused to readers who do not see Restricted details", async () => {
    const viewer = await test.signedIn("resource-planner");
    expect(
      (await save(viewer.cookie, "Since", { sort: ["managerFrom"] })).json(),
    ).toEqual({ error: "Choose only columns you can see" });
  });
});
