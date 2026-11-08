// SPDX-License-Identifier: Apache-2.0

// Tests for saved views of the People table, against a PostgreSQL server of their own: saving,
// renaming, updating, and deleting them; who may change them; keeping a view on columns a reader may
// not see from that reader; personal and shared views, and who may share them; and undoing each
// change. Resource Planners stand for readers who see people's General details and no more, and
// Workforce Administrators for those who may change planning configuration.

import {
  builtInColumnNames,
  type Choice,
  type Field,
  type List,
  roleSchema,
  type SavedView,
  type ViewScope,
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

const save = (
  cookie: string,
  name: string,
  definition: unknown,
  scope: ViewScope = "personal",
) =>
  test.request(cookie, "POST", "/api/people/views", {
    name,
    scope,
    definition,
  });

const share = (cookie: string, name: string, definition: unknown) =>
  save(cookie, name, definition, "shared");

const change = (cookie: string, id: string, body: object) =>
  test.request(cookie, "PUT", `/api/people/views/${id}`, body);

const remove = (cookie: string, id: string) =>
  test.request(cookie, "DELETE", `/api/people/views/${id}`);

const demote = async (id: string) => {
  const accounts = await test.signedIn("administrator");
  const response = await test.request(
    accounts.cookie,
    "PATCH",
    `/api/accounts/${id}`,
    { roleId: await findStartingRole(test.connection, "resource-planner") },
  );
  expect(response.statusCode).toBe(200);
};

const notSharer =
  "Only someone who may change planning configuration can share a view they saved, or take it back";
const notSharedViewMaker =
  "Only someone who may change planning configuration can save a shared view";
const sharers: readonly string[] = [
  "engineering-director",
  "workforce-administrator",
];

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
      scope: "personal",
      definition: {
        search: "fictional",
        sort: ["-preferredName"],
        filters: { employeeId: { contains: "E" } },
      },
      canChange: true,
      canShare: false,
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

  it("may be changed, when shared, only by their maker or by someone who may change planning configuration", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const other = await test.signedIn("resource-planner");
    const administrator = await test.signedIn("workforce-administrator");
    const { view } = (
      await share(maker.cookie, "Shared", { search: "a" })
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
    await demote(administrator.id);
    expect((await undo(administrator.cookie, changeSetId)).json()).toEqual({
      error:
        "Only the person who saved a view, or someone who may change planning configuration, can change it",
    });
    const accounts = await test.signedIn("administrator");
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
    const maker = await test.signedIn("workforce-administrator");
    const viewer = await test.signedIn("resource-planner");
    const { view } = (
      await share(maker.cookie, "Leaving soon", {
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
    // A maker who sees Restricted details without editing them may undo saving a view on them, but
    // not once they no longer see them.
    const { changeSetId } = (
      await save(manager.cookie, "Leaving later", {
        filters: { endDate: { from: "2026-11-01" } },
      })
    ).json<Saved>();
    expect((await undo(manager.cookie, changeSetId)).statusCode).toBe(200);
    const starting = (
      await save(manager.cookie, "Starting soon", {
        filters: { startDate: { from: "2026-11-01" } },
      })
    ).json<Saved>();
    await demote(manager.id);
    expect((await undo(manager.cookie, starting.changeSetId)).statusCode).toBe(
      403,
    );
  });

  it("keep their columns' widths, sending each reader only those of columns they may see", async () => {
    const sharer = await test.signedIn("workforce-administrator");
    const viewer = await test.signedIn("resource-planner");
    const widths = { preferredName: 240, startDate: 120, gone: 300 };
    const { view } = (
      await share(sharer.cookie, "Wide names", { widths })
    ).json<Saved>();
    expect(view.definition).toEqual({ widths });
    expect(
      (await viewsOf(viewer.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual({ widths: { preferredName: 240, gone: 300 } });
  });

  it("keep the widths of columns a reader may not see when that reader updates them", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const { view } = (
      await share(maker.cookie, "Wide start", {
        widths: { preferredName: 240, startDate: 120 },
      })
    ).json<Saved>();
    await demote(maker.id);
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
    const sharer = await test.signedIn("workforce-administrator");
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
      await share(sharer.cookie, "By start", {
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
    const maker = await test.signedIn("workforce-administrator");
    const { view } = (
      await share(maker.cookie, "Drafts waiting", {
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
      await share(cookie, "Levels", {
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

describe("personal and shared views", () => {
  const namesSeen = async (cookie: string) =>
    (await viewsOf(cookie)).map(({ name }) => name);

  it("keeps a personal view from everyone but its maker, whatever their role", async () => {
    // Given a personal view
    const maker = await test.signedIn("resource-planner");
    const { view } = (
      await save(maker.cookie, "Only mine", { search: "a" })
    ).json<Saved>();
    expect(await namesSeen(maker.cookie)).toContain("Only mine");

    // Then every role that sees people neither sees nor reaches it
    let readers = 0;
    for (const role of roleSchema.options) {
      const { cookie } = await test.signedIn(role);
      const answer = await test.request(cookie, "GET", "/api/people");
      if (answer.statusCode !== 200) continue;
      readers += 1;
      expect(await namesSeen(cookie), role).not.toContain("Only mine");
      expect(
        (await change(cookie, view.id, { name: "Taken" })).statusCode,
        role,
      ).toBe(404);
      expect((await remove(cookie, view.id)).statusCode, role).toBe(404);
    }
    expect(readers).toBeGreaterThan(1);
  });

  it("lets every role that may change planning configuration save, share, and take back, and refuses every other", async () => {
    let tried = 0;
    for (const role of roleSchema.options) {
      // Given someone in the role who sees people
      const { cookie } = await test.signedIn(role);
      const answer = await test.request(cookie, "GET", "/api/people");
      if (answer.statusCode !== 200) continue;
      tried += 1;
      const allowed = sharers.includes(role);
      const name = `Role view ${role}`;

      // When they save a shared view
      const saved = await share(cookie, name, {});

      // Then only those who may are allowed to
      expect(saved.statusCode, role).toBe(allowed ? 201 : 403);
      const own = (await save(cookie, `${name} own`, {})).json<Saved>().view;
      expect(own.canShare, role).toBe(allowed);
      expect(
        (await change(cookie, own.id, { scope: "shared" })).statusCode,
        role,
      ).toBe(allowed ? 200 : 403);
      if (allowed) {
        expect(
          (await change(cookie, own.id, { scope: "personal" })).statusCode,
          role,
        ).toBe(200);
      }
    }
    expect(tried).toBeGreaterThan(sharers.length);
  });

  it("lets only those who may change planning configuration save a shared view", async () => {
    const planner = await test.signedIn("resource-planner");
    const refused = await share(planner.cookie, "For everyone", {});
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toEqual({ error: notSharedViewMaker });

    const administrator = await test.signedIn("workforce-administrator");
    const { view } = (
      await share(administrator.cookie, "For everyone", {})
    ).json<Saved>();
    expect(view).toMatchObject({
      scope: "shared",
      canChange: true,
      canShare: true,
    });
    expect(
      (await viewsOf(planner.cookie)).find(({ id }) => id === view.id),
    ).toMatchObject({ scope: "shared", canChange: false, canShare: false });
  });

  it("keeps names unique among shared views and among each maker's personal views", async () => {
    const first = await test.signedIn("workforce-administrator");
    const second = await test.signedIn("workforce-administrator");
    const duplicate = { error: "There is already a view with that name" };

    expect((await save(first.cookie, "Quarter", {})).statusCode).toBe(201);
    expect((await save(second.cookie, "QUARTER", {})).statusCode).toBe(201);
    expect((await save(first.cookie, "quarter", {})).json()).toEqual(duplicate);

    expect((await share(first.cookie, "Quarter", {})).statusCode).toBe(201);
    expect((await share(second.cookie, "quarter", {})).json()).toEqual(
      duplicate,
    );

    const { view } = (await save(second.cookie, "Half", {})).json<Saved>();
    expect((await share(first.cookie, "Half", {})).statusCode).toBe(201);
    expect(
      (await change(second.cookie, view.id, { scope: "shared" })).json(),
    ).toEqual(duplicate);
  });

  it("lets a maker who may share a view share it and take it back", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const planner = await test.signedIn("resource-planner");
    const { view } = (
      await save(maker.cookie, "Passing round", {})
    ).json<Saved>();
    expect(view).toMatchObject({ scope: "personal", canShare: true });

    const shared = await change(maker.cookie, view.id, { scope: "shared" });
    expect(shared.statusCode).toBe(200);
    expect(shared.json<Saved>().view.scope).toBe("shared");
    expect(await namesSeen(planner.cookie)).toContain("Passing round");

    const taken = await change(maker.cookie, view.id, { scope: "personal" });
    expect(taken.json<Saved>().view.scope).toBe("personal");
    expect(await namesSeen(planner.cookie)).not.toContain("Passing round");
  });

  it("refuses sharing to a maker who may not, and taking back to anyone but the maker", async () => {
    const planner = await test.signedIn("resource-planner");
    const own = (await save(planner.cookie, "Staying", {})).json<Saved>().view;
    const refused = await change(planner.cookie, own.id, { scope: "shared" });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toEqual({ error: notSharer });
    // Sending the scope a view already has shares nothing, so needs no right to share.
    expect(
      (
        await change(planner.cookie, own.id, { scope: "personal" })
      ).json<Saved>().changeSetId,
    ).toBeNull();

    const maker = await test.signedIn("workforce-administrator");
    const other = await test.signedIn("workforce-administrator");
    const { view } = (
      await share(maker.cookie, "Staying shared", {})
    ).json<Saved>();
    expect(
      (await viewsOf(other.cookie)).find(({ id }) => id === view.id),
    ).toMatchObject({ canChange: true, canShare: false });
    expect(
      (await change(other.cookie, view.id, { scope: "personal" })).statusCode,
    ).toBe(403);

    await demote(maker.id);
    expect(
      (await change(maker.cookie, view.id, { scope: "personal" })).statusCode,
    ).toBe(403);
    expect(
      (await change(maker.cookie, view.id, { name: "Still mine" })).statusCode,
    ).toBe(200);
  });

  it("undoes sharing and taking back", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const planner = await test.signedIn("resource-planner");
    const { view } = (
      await save(maker.cookie, "Back and forth", {})
    ).json<Saved>();

    const shared = (
      await change(maker.cookie, view.id, { scope: "shared" })
    ).json<Saved>();
    expect((await undo(maker.cookie, shared.changeSetId)).statusCode).toBe(200);
    expect(await namesSeen(planner.cookie)).not.toContain("Back and forth");

    const again = (
      await change(maker.cookie, view.id, { scope: "shared" })
    ).json<Saved>();
    expect(await namesSeen(planner.cookie)).toContain("Back and forth");
    const taken = (
      await change(maker.cookie, view.id, { scope: "personal" })
    ).json<Saved>();
    expect(again.changeSetId).not.toBeNull();
    expect((await undo(maker.cookie, taken.changeSetId)).statusCode).toBe(200);
    expect(await namesSeen(planner.cookie)).toContain("Back and forth");
  });

  it("refuses undoing what the actor may no longer do to a view's scope", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const { view } = (await save(maker.cookie, "Was mine", {})).json<Saved>();
    const shared = (
      await change(maker.cookie, view.id, { scope: "shared" })
    ).json<Saved>();
    const gone = (await share(maker.cookie, "Was everyone's", {})).json<Saved>()
      .view;
    const deleted = (await remove(maker.cookie, gone.id)).json<{
      changeSetId: string;
    }>();

    await demote(maker.id);
    const undoShare = await undo(maker.cookie, shared.changeSetId);
    expect(undoShare.statusCode).toBe(403);
    expect(undoShare.json()).toEqual({ error: notSharer });
    const undoDelete = await undo(maker.cookie, deleted.changeSetId);
    expect(undoDelete.statusCode).toBe(403);
    expect(undoDelete.json()).toEqual({ error: notSharedViewMaker });
  });

  it("puts back a deleted shared view for someone who may still save one", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const { view } = (await share(maker.cookie, "Returning", {})).json<Saved>();
    const deleted = (await remove(maker.cookie, view.id)).json<{
      changeSetId: string;
    }>();
    expect((await undo(maker.cookie, deleted.changeSetId)).statusCode).toBe(
      200,
    );
    expect(
      (await viewsOf(maker.cookie)).find(({ id }) => id === view.id)?.scope,
    ).toBe("shared");
  });

  it("refuses undoing a change to a view its maker has since taken back", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const other = await test.signedIn("workforce-administrator");
    const { view } = (await share(maker.cookie, "Borrowed", {})).json<Saved>();
    const renamed = (
      await change(other.cookie, view.id, { name: "Borrowed again" })
    ).json<Saved>();
    await change(maker.cookie, view.id, { scope: "personal" });
    const refused = await undo(other.cookie, renamed.changeSetId);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({
      error: "This has been changed since, so it can no longer be undone",
    });
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
