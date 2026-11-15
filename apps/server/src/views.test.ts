// SPDX-License-Identifier: Apache-2.0

// Tests for saved views, against a PostgreSQL server of their own: saving, renaming, updating, and
// deleting them, on People and on every other table that keeps them; who may change them; keeping a
// view on columns a reader may not see from that reader, and sending its maker what's missing;
// personal and shared views, and who may share them; every starting role on every table; and
// undoing each change. General readers stand for readers who see people's General details and no more, and
// Workforce Administrators for those who may change planning configuration.

import {
  builtInColumnNames,
  type Choice,
  type Field,
  type List,
  type ListedView,
  type Permission,
  type Role,
  roleSchema,
  type SavedView,
  type ViewScope,
  type ViewTable,
  viewTableSchema,
} from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findStartingRole } from "./data/roles.ts";
import {
  generalReader,
  missingRecord,
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

interface Saved {
  view: SavedView;
  changeSetId: string | null;
}

const viewsOf = async (cookie: string) =>
  (await test.request(cookie, "GET", "/api/views/people")).json<SavedView[]>();

const save = (
  cookie: string,
  name: string,
  definition: unknown,
  scope: ViewScope = "personal",
) =>
  test.request(cookie, "POST", "/api/views/people", {
    name,
    scope,
    definition,
  });

const share = (cookie: string, name: string, definition: unknown) =>
  save(cookie, name, definition, "shared");

const change = (cookie: string, id: string, body: object) =>
  test.request(cookie, "PUT", `/api/views/people/${id}`, body);

const remove = (cookie: string, id: string) =>
  test.request(cookie, "DELETE", `/api/views/people/${id}`);

const demote = async (id: string) => {
  const accounts = await test.signedIn("administrator");
  const response = await test.request(
    accounts.cookie,
    "PATCH",
    `/api/accounts/${id}`,
    { roleId: await findStartingRole(test.connection, "feature-lead") },
  );
  expect(response.statusCode).toBe(200);
};

const notSharer =
  "Only someone who may share views on its table can share a view they saved, or stop sharing it";
const notSharedViewMaker =
  "Only someone who may share views on this table can save a shared view";
const sharers: readonly string[] = [
  "engineering-director",
  "workforce-administrator",
];

const undo = (cookie: string, changeSetId: string | null) =>
  test.request(cookie, "POST", `/api/undo/${String(changeSetId)}`, {});

describe("saved views", () => {
  it("are saved, renamed, updated, and deleted, with names unique regardless of case, and each change undone", async () => {
    const { cookie } = await test.signedIn(generalReader);
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
      `/api/views/people/${view.id}`,
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
      `/api/views/people/${view.id}`,
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
      `/api/views/people/${view.id}`,
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

  it("may be changed, when shared, only by their maker or by someone who may share views on its table", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const other = await test.signedIn(generalReader);
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
      `/api/views/people/${view.id}`,
      { name: "Mine now" },
    );
    expect(refused.statusCode).toBe(403);
    expect(
      (
        await test.request(
          other.cookie,
          "DELETE",
          `/api/views/people/${view.id}`,
        )
      ).statusCode,
    ).toBe(403);

    const renamed = await test.request(
      administrator.cookie,
      "PUT",
      `/api/views/people/${view.id}`,
      { name: "Shared by all" },
    );
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<Saved>().view.canChange).toBe(true);

    // Undoing needs the same right, so one who has since lost it cannot undo.
    const { changeSetId } = renamed.json<Saved>();
    await demote(administrator.id);
    expect((await undo(administrator.cookie, changeSetId)).json()).toEqual({
      error:
        "Only the person who saved a view, or someone who may share views on its table, can change it",
    });
    const accounts = await test.signedIn("administrator");
    expect((await save(accounts.cookie, "No", {})).statusCode).toBe(403);
    expect(
      (
        await test.request(
          maker.cookie,
          "PUT",
          "/api/views/people/00000000-0000-4000-8000-000000000000",
          { name: "Gone" },
        )
      ).statusCode,
    ).toBe(404);
  });

  it("are kept from readers who may not see a column they use, who cannot save such a view either", async () => {
    const manager = await test.signedIn("engineering-manager");
    const maker = await test.signedIn("workforce-administrator");
    const viewer = await test.signedIn(generalReader);
    const { view } = (
      await share(maker.cookie, "Leaving soon", {
        filters: { endDate: { from: "2026-11-01" } },
      })
    ).json<Saved>();
    expect(
      (await test.historyOf(view.id)).every(({ tier }) => tier === "personal"),
    ).toBe(true);
    expect(
      (await viewsOf(viewer.cookie)).some(({ id }) => id === view.id),
    ).toBe(false);
    expect(
      (
        await test.request(
          viewer.cookie,
          "DELETE",
          `/api/views/people/${view.id}`,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (await save(viewer.cookie, "Mine", { sort: ["startDate"] })).json(),
    ).toEqual({ error: "Choose only columns this role can see" });
    expect(
      (await save(viewer.cookie, "Unknown", { sort: ["nothing"] })).statusCode,
    ).toBe(400);
    // A maker who sees Personal details without editing them may undo saving a view on them, but
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
    const viewer = await test.signedIn(generalReader);
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

  it("keep the unit and decimal places each column is shown in, sending them to every reader", async () => {
    const sharer = await test.signedIn("workforce-administrator");
    const viewer = await test.signedIn(generalReader);
    const shown = {
      units: { effort: "person-weeks" },
      places: { effort: 1 },
    };
    const { view } = (
      await share(sharer.cookie, "In weeks", shown)
    ).json<Saved>();
    expect(view.definition).toEqual(shown);
    expect(
      (await viewsOf(viewer.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual(shown);
  });

  it("keep whether retired records show, sending it to every reader", async () => {
    const sharer = await test.signedIn("workforce-administrator");
    const viewer = await test.signedIn(generalReader);
    const { view } = (
      await share(sharer.cookie, "With retired", { retired: true })
    ).json<Saved>();
    expect(view.definition).toEqual({ retired: true });
    expect(
      (await viewsOf(viewer.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual({ retired: true });
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
          `/api/views/people/${view.id}`,
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

  it("keep the order of their columns, sending each reader only the places of columns they may see", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const viewer = await test.signedIn(generalReader);
    const order = ["startDate", "preferredName", "gone"];
    const { view } = (
      await share(maker.cookie, "Moved round", { order })
    ).json<Saved>();
    expect(view.definition).toEqual({ order });
    expect(
      (await viewsOf(viewer.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual({ order: ["preferredName", "gone"] });
  });

  it("keep the places of columns a reader may not see when that reader updates them", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const { view } = (
      await share(maker.cookie, "Start first", {
        order: ["startDate", "preferredName", "employeeId"],
      })
    ).json<Saved>();
    await demote(maker.id);
    expect(
      (
        await change(maker.cookie, view.id, {
          definition: { order: ["employeeId", "preferredName"] },
        })
      ).statusCode,
    ).toBe(200);
    const other = await test.signedIn("engineering-manager");
    expect(
      (await viewsOf(other.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual({ order: ["startDate", "employeeId", "preferredName"] });
  });

  it("take an order of columns when updated without one before", async () => {
    const { cookie } = await test.signedIn(generalReader);
    const { view } = (await save(cookie, "Plain order", {})).json<Saved>();
    const updated = await change(cookie, view.id, {
      definition: { order: ["employeeId", "preferredName"] },
    });
    expect(updated.json<Saved>().view.definition).toEqual({
      order: ["employeeId", "preferredName"],
    });
  });

  it("keep what they show and the columns they break down by, and are kept from readers who may not see those columns", async () => {
    const sharer = await test.signedIn("workforce-administrator");
    const viewer = await test.signedIn(generalReader);
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
      (await test.historyOf(view.id)).every(({ tier }) => tier === "personal"),
    ).toBe(true);
    expect(
      (await viewsOf(viewer.cookie)).some(({ id }) => id === view.id),
    ).toBe(false);
    expect(
      (await save(viewer.cookie, "Mine", { breakdown: ["endDate"] })).json(),
    ).toEqual({ error: "Choose only columns this role can see" });
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
    ).toEqual({ error: "Choose only columns this role can see" });
    expect(
      (
        await save(viewer.cookie, "Three", {
          breakdown: ["employeeId", "preferredName", "draft"],
        })
      ).statusCode,
    ).toBe(400);
  });

  it("may filter on drafts, which every reader may see, since each is sent only the drafts they may see", async () => {
    const viewer = await test.signedIn(generalReader);
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
      const answer = await test.request(cookie, "GET", "/api/views/people");
      if (answer.statusCode !== 200) continue;
      readers += 1;
      expect(
        answer.json<SavedView[]>().find(({ id }) => id === view.id)?.definition,
        role,
      ).toEqual(view.definition);
    }
    expect(readers).toBeGreaterThan(1);
    // Drafts are filtered on, but not sorted on.
    expect(
      (await save(viewer.cookie, "By draft", { sort: ["-draft"] })).json(),
    ).toEqual({ error: "Choose only columns this role can see" });
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
        grouping: "employeeId",
        thenBy: field.id,
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
    // metrics still show, and the rows are still grouped by the column that's left.
    const viewer = await test.signedIn(generalReader);
    expect(
      (await viewsOf(viewer.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual({ breakdown: [], grouping: "employeeId" });
    // Its deleted column cannot be saved into it again.
    expect(
      (
        await test.request(cookie, "PUT", `/api/views/people/${view.id}`, {
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
    const viewer = await test.signedIn(generalReader);
    const { view, changeSetId } = (
      await save(viewer.cookie, "By team", { sort: [field.id] })
    ).json<Saved>();
    expect(
      (
        await test.request(
          administrator.cookie,
          "PUT",
          `/api/lists/${list.id}/class`,
          { dataClass: "personal" },
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await viewsOf(viewer.cookie)).find(({ id }) => id === view.id),
    ).toEqual({
      id: view.id,
      name: "By team",
      missing: { columns: ["Team"], groupings: [] },
    });
    expect((await undo(viewer.cookie, changeSetId)).statusCode).toBe(403);
  });

  it("refuses names and views that do not fit", async () => {
    const { cookie } = await test.signedIn(generalReader);
    const refusals = [
      await save(cookie, "   ", {}),
      await save(cookie, "n".repeat(81), {}),
      await save(cookie, "Not a view", "name"),
      await save(cookie, "Bad filter", {
        filters: { employeeId: { from: "2026-02-30" } },
      }),
      await save(cookie, "Bad sort", { sort: ["a b"] }),
      await test.request(cookie, "PUT", "/api/views/people/not-a-view", {
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
    const maker = await test.signedIn(generalReader);
    const { view } = (
      await save(maker.cookie, "Only mine", { search: "a" })
    ).json<Saved>();
    expect(await namesSeen(maker.cookie)).toContain("Only mine");

    // Then every role that sees people neither sees nor reaches it
    let readers = 0;
    for (const role of roleSchema.options) {
      const { cookie } = await test.signedIn(role);
      const answer = await test.request(cookie, "GET", "/api/views/people");
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
      const answer = await test.request(cookie, "GET", "/api/views/people");
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
    const planner = await test.signedIn(generalReader);
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
    ).toEqual({ error: "There is already a shared view named Half" });

    const own = (await share(second.cookie, "Whole", {})).json<Saved>().view;
    expect((await save(second.cookie, "Whole", {})).statusCode).toBe(201);
    expect(
      (await change(second.cookie, own.id, { scope: "personal" })).json(),
    ).toEqual({ error: "There is already a personal view named Whole" });

    // A view renamed as it is shared is refused under its new name.
    await share(first.cookie, "Taken", {});
    const renaming = (await save(second.cookie, "Free", {})).json<Saved>().view;
    expect(
      (
        await change(second.cookie, renaming.id, {
          name: "Taken",
          scope: "shared",
        })
      ).json(),
    ).toEqual({ error: "There is already a shared view named Taken" });
  });

  it("lets a maker who may share a view share it and take it back", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const planner = await test.signedIn(generalReader);
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
    const planner = await test.signedIn(generalReader);
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
    const planner = await test.signedIn(generalReader);
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
    const viewer = await test.signedIn(generalReader);
    const { view } = (
      await save(viewer.cookie, "Hiring plan", hiringPlan)
    ).json<Saved>();
    expect(await viewsOf(viewer.cookie)).toContainEqual({
      ...view,
      definition: hiringPlan,
    });
  });

  it("on managers and teams are saved by readers who see only General details", async () => {
    const viewer = await test.signedIn(generalReader);
    const response = await save(viewer.cookie, "By manager", {
      filters: { isManager: { empty: true } },
      sort: ["managerId", "teamName"],
      breakdown: ["team"],
    });
    expect(response.statusCode).toBe(201);
  });

  it("on Manager assigned are kept from readers who do not see Personal details", async () => {
    const administrator = await test.signedIn("workforce-administrator");
    const { view } = (
      await save(administrator.cookie, "Manager assigned", {
        sort: ["managerFrom"],
      })
    ).json<Saved>();
    const viewer = await test.signedIn(generalReader);
    expect(
      (await viewsOf(viewer.cookie)).some(({ id }) => id === view.id),
    ).toBe(false);
  });

  it("on Manager assigned are refused to readers who do not see Personal details", async () => {
    const viewer = await test.signedIn(generalReader);
    expect(
      (await save(viewer.cookie, "Since", { sort: ["managerFrom"] })).json(),
    ).toEqual({ error: "Choose only columns this role can see" });
  });
});

const onTable = (table: ViewTable) => ({
  path: `/api/views/${table}`,
  list: async (cookie: string) =>
    (await test.request(cookie, "GET", `/api/views/${table}`)).json<
      ListedView[]
    >(),
  save: (
    cookie: string,
    name: string,
    definition: unknown,
    scope: ViewScope = "personal",
  ) =>
    test.request(cookie, "POST", `/api/views/${table}`, {
      name,
      scope,
      definition,
    }),
  change: (cookie: string, id: string, body: object) =>
    test.request(cookie, "PUT", `/api/views/${table}/${id}`, body),
  remove: (cookie: string, id: string) =>
    test.request(cookie, "DELETE", `/api/views/${table}/${id}`),
});

const features = onTable("features");
const assignments = onTable("feature-assignments");
const accounts = onTable("accounts");
const chart = onTable("org-chart");

const nameOf = (key: string) => String(builtInColumnNames.get(key));

// Sees feature assignments, which need Personal data, and so may group them by manager only with
// Confidential data too.
const assignmentsReader: Permission[] = ["feature-teams:view", "personal:view"];

describe("views of every table", () => {
  it("are saved, listed, renamed, updated, and deleted on a table besides People", async () => {
    const { cookie } = await test.signedIn(generalReader);
    const definition = {
      search: "fictional",
      grouping: "status",
      hidden: ["size"],
      choices: { hide: ["status"] },
    };
    const made = await features.save(cookie, unique("Board"), definition);
    expect(made.statusCode).toBe(201);
    const { view } = made.json<Saved>();
    expect(view.definition).toEqual(definition);
    expect(await features.list(cookie)).toContainEqual(view);

    const renamed = await features.change(cookie, view.id, { name: "Ours" });
    expect(renamed.statusCode).toBe(200);
    const updated = await features.change(cookie, view.id, {
      definition: { choices: { hide: ["size"] } },
    });
    expect(updated.json<Saved>().view).toMatchObject({
      name: "Ours",
      definition: { choices: { hide: ["size"] } },
    });

    expect((await features.remove(cookie, view.id)).statusCode).toBe(200);
    expect((await features.list(cookie)).some(({ id }) => id === view.id)).toBe(
      false,
    );
  });

  it("answers that a table keeping no views is no such page", async () => {
    const { cookie } = await test.signedIn("administrator");
    for (const [method, url] of [
      ["GET", "/api/views/roles"],
      ["POST", "/api/views/roles"],
      ["DELETE", `/api/views/roles/${missingRecord}`],
    ] as const) {
      const response = await test.request(cookie, method, url, {
        name: "Mine",
        scope: "personal",
        definition: {},
      });
      expect(response.statusCode, url).toBe(404);
      expect(response.json(), url).toEqual({ error: "There is no such page" });
    }
  });

  it("are kept from a role that doesn't open their page, and named only on their own table", async () => {
    const { cookie } = await test.signedIn(generalReader);
    expect((await test.request(cookie, "GET", accounts.path)).statusCode).toBe(
      403,
    );
    expect((await accounts.save(cookie, "Mine", {})).statusCode).toBe(403);

    const { view } = (await save(cookie, unique("People's"), {})).json<Saved>();
    expect(
      (await features.change(cookie, view.id, { name: "Moved" })).statusCode,
    ).toBe(404);
    expect((await features.remove(cookie, view.id)).statusCode).toBe(404);
    expect((await features.list(cookie)).some(({ id }) => id === view.id)).toBe(
      false,
    );
  });

  it("refuse choices their page doesn't offer", async () => {
    const { cookie } = await test.signedIn(generalReader);
    for (const [table, choices] of [
      ["features", { from: "2026-01-01" }],
      ["features", { mode: "timeline" }],
      ["people", { mode: "board" }],
    ] as const) {
      const response = await onTable(table).save(cookie, "Choices", {
        choices,
      });
      expect(response.json(), table).toEqual({
        error: "Choose only what this page offers",
      });
    }
  });

  it("keep the Org chart's teams, levels and team shown alone, refusing a team by Employee ID", async () => {
    const { cookie } = await test.signedIn("engineering-manager");
    const choices = {
      teams: "feature",
      levels: "all",
      team: "6a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
    };
    const response = await chart.save(cookie, unique("Chart"), { choices });
    expect(response.statusCode).toBe(201);
    const { view } = response.json<Saved>();
    expect(view.definition).toEqual({ choices });
    expect(await chart.list(cookie)).toContainEqual(view);

    expect(
      (
        await chart.save(cookie, unique("By ID"), {
          choices: { team: "E-1042" },
        })
      ).json(),
    ).toEqual({ error: "Choose only what this page offers" });
  });

  it("keep names unique within each table, allowing one name on two tables", async () => {
    const { cookie } = await test.signedIn(generalReader);
    const name = unique("Mine");
    expect((await save(cookie, name, {})).statusCode).toBe(201);
    expect((await features.save(cookie, name, {})).statusCode).toBe(201);
    expect(
      (await features.save(cookie, name.toUpperCase(), {})).json(),
    ).toEqual({ error: "There is already a view with that name" });
  });

  it("keep their grouping and send it, and are kept from readers who can't see the column grouped by", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const viewer = await test.signedIn(generalReader);
    const { view } = (
      await share(maker.cookie, unique("By end"), { grouping: "endDate" })
    ).json<Saved>();
    expect(view.definition).toEqual({ grouping: "endDate" });
    expect(await viewsOf(maker.cookie)).toContainEqual(view);
    expect(
      (await test.historyOf(view.id)).every(({ tier }) => tier === "personal"),
    ).toBe(true);
    expect(
      (await viewsOf(viewer.cookie)).some(({ id }) => id === view.id),
    ).toBe(false);
    expect(
      (await save(viewer.cookie, "By end", { grouping: "endDate" })).json(),
    ).toEqual({ error: "Choose only columns this role can see" });
    expect(
      (await save(maker.cookie, "Unknown", { grouping: "nothing" })).statusCode,
    ).toBe(400);
  });

  it("keep a second grouping and send it, and are kept from readers who can't see the column it groups by", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const viewer = await test.signedIn(generalReader);
    const definition = { grouping: "employeeId", thenBy: "endDate" };
    const { view } = (
      await share(maker.cookie, unique("Then by end"), definition)
    ).json<Saved>();
    expect(view.definition).toEqual(definition);
    expect(
      (await test.historyOf(view.id)).every(({ tier }) => tier === "personal"),
    ).toBe(true);
    expect(
      (await viewsOf(viewer.cookie)).some(({ id }) => id === view.id),
    ).toBe(false);
    expect(
      (await save(viewer.cookie, "Then by end", definition)).json(),
    ).toEqual({ error: "Choose only columns this role can see" });
    expect(
      (
        await save(maker.cookie, "Unknown", {
          grouping: "employeeId",
          thenBy: "nothing",
        })
      ).statusCode,
    ).toBe(400);
  });

  it("group Feature assignments by manager under another grouping only for readers who see the data it needs", async () => {
    const maker = await test.signedIn([
      ...assignmentsReader,
      "confidential:view",
      "configuration:edit",
    ]);
    const viewer = await test.signedIn(assignmentsReader);
    const definition = { grouping: "feature-team", thenBy: "manager" };
    const shared = (
      await assignments.save(
        maker.cookie,
        unique("Shared teams then managers"),
        definition,
        "shared",
      )
    ).json<Saved>().view;
    expect(
      (await assignments.list(viewer.cookie)).some(
        ({ id }) => id === shared.id,
      ),
    ).toBe(false);
    const { view } = (
      await assignments.save(
        maker.cookie,
        unique("Teams then managers"),
        definition,
      )
    ).json<Saved>();
    expect(
      (await test.historyOf(view.id)).every(
        ({ tier }) => tier === "confidential",
      ),
    ).toBe(true);
    expect(
      (
        await assignments.save(viewer.cookie, "Then by manager", definition)
      ).json(),
    ).toEqual({ error: "Choose only columns this role can see" });
    await test.holdOnly(maker.id, assignmentsReader);
    expect(await assignments.list(maker.cookie)).toContainEqual({
      id: view.id,
      name: view.name,
      missing: { columns: [], groupings: ["Manager"] },
    });
  });

  it("group Feature assignments by manager only for readers who see the data it needs", async () => {
    const maker = await test.signedIn([
      ...assignmentsReader,
      "confidential:view",
      "configuration:edit",
    ]);
    const viewer = await test.signedIn(assignmentsReader);
    const { view } = (
      await assignments.save(
        maker.cookie,
        unique("By manager"),
        { grouping: "manager" },
        "shared",
      )
    ).json<Saved>();
    expect(await assignments.list(maker.cookie)).toContainEqual(view);
    expect(
      (await test.historyOf(view.id)).every(
        ({ tier }) => tier === "confidential",
      ),
    ).toBe(true);
    expect(
      (await assignments.list(viewer.cookie)).some(({ id }) => id === view.id),
    ).toBe(false);
    expect(
      (
        await assignments.save(viewer.cookie, "By manager", {
          grouping: "manager",
        })
      ).json(),
    ).toEqual({ error: "Choose only columns this role can see" });
  });

  it("send each reader only the hidden columns they can see, keeping the others when that reader updates them", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const sharer = await test.signedIn([
      ...generalReader,
      "configuration:edit",
    ]);
    const { view } = (
      await share(maker.cookie, unique("Hiding"), {
        hidden: ["endDate", "employeeId"],
      })
    ).json<Saved>();
    const sent = (await viewsOf(sharer.cookie)).find(
      ({ id }) => id === view.id,
    );
    expect(sent?.definition).toEqual({ hidden: ["employeeId"] });

    await change(sharer.cookie, view.id, {
      definition: { hidden: ["preferredName"] },
    });
    expect(
      (await viewsOf(maker.cookie)).find(({ id }) => id === view.id)
        ?.definition,
    ).toEqual({ hidden: ["endDate", "preferredName"] });
  });

  it("send their maker a personal view they can no longer use by name and what's missing, to rename or delete alone", async () => {
    // Given a maker who saves views on Personal columns, and another's shared view on one
    const maker = await test.signedIn([...generalReader, "personal:view"]);
    const other = await test.signedIn("workforce-administrator");
    const filtered = (
      await save(maker.cookie, unique("Starting"), {
        filters: { startDate: { from: "2026-11-01" } },
        sort: ["endDate"],
      })
    ).json<Saved>().view;
    const grouped = (
      await save(maker.cookie, unique("Grouped"), { grouping: "endDate" })
    ).json<Saved>().view;
    const theirs = (
      await share(other.cookie, unique("Theirs"), { sort: ["endDate"] })
    ).json<Saved>().view;

    // When the maker's role no longer sees Personal data
    await test.holdOnly(maker.id, generalReader);

    // Then their own views come by name and what's missing, and the other's not at all
    const listed = await viewsOf(maker.cookie);
    expect(listed).toContainEqual({
      id: filtered.id,
      name: filtered.name,
      missing: {
        columns: [nameOf("startDate"), nameOf("endDate")],
        groupings: [],
      },
    });
    expect(listed).toContainEqual({
      id: grouped.id,
      name: grouped.name,
      missing: { columns: [], groupings: [nameOf("endDate")] },
    });
    expect(listed.some(({ id }) => id === theirs.id)).toBe(false);

    // And they may rename or delete one, but not change or share it
    for (const body of [{ definition: {} }, { scope: "shared" }]) {
      expect(
        (await change(maker.cookie, filtered.id, body)).statusCode,
        JSON.stringify(body),
      ).toBe(404);
    }
    const renamed = await change(maker.cookie, filtered.id, {
      name: "Renamed",
    });
    expect(renamed.json<{ view: ListedView }>().view).toEqual({
      id: filtered.id,
      name: "Renamed",
      missing: {
        columns: [nameOf("startDate"), nameOf("endDate")],
        groupings: [],
      },
    });
    // Its history holds the columns the role can't see, so renaming it can't be undone
    expect(
      (
        await undo(
          maker.cookie,
          renamed.json<{ changeSetId: string }>().changeSetId,
        )
      ).statusCode,
    ).toBe(403);
    expect((await remove(maker.cookie, filtered.id)).statusCode).toBe(200);
    expect((await remove(other.cookie, grouped.id)).statusCode).toBe(404);
  });

  it("keep a view on Feature teams from readers who don't see feature teams, naming it as what's missing", async () => {
    // Given a maker who sees feature teams, with a view grouped by them and one filtering them
    const maker = await test.signedIn(generalReader);
    const grouped = (
      await save(maker.cookie, unique("By feature team"), {
        grouping: "featureTeams",
      })
    ).json<Saved>().view;
    const filtered = (
      await save(maker.cookie, unique("Sorted by feature team"), {
        sort: ["featureTeams"],
      })
    ).json<Saved>().view;
    expect(await viewsOf(maker.cookie)).toContainEqual(grouped);

    // When the maker's role no longer sees feature teams
    await test.holdOnly(
      maker.id,
      generalReader.filter((permission) => permission !== "feature-teams:view"),
    );

    // Then each comes by name with Feature teams missing, and none can be saved on them
    const listed = await viewsOf(maker.cookie);
    expect(listed).toContainEqual({
      id: grouped.id,
      name: grouped.name,
      missing: { columns: [], groupings: ["Feature teams"] },
    });
    expect(listed).toContainEqual({
      id: filtered.id,
      name: filtered.name,
      missing: { columns: ["Feature teams"], groupings: [] },
    });
    expect(
      (
        await save(maker.cookie, unique("Again"), { grouping: "featureTeams" })
      ).json(),
    ).toEqual({ error: "Choose only columns this role can see" });
  });

  it("name a grouping whose data the maker no longer sees as what's missing", async () => {
    const maker = await test.signedIn([
      ...assignmentsReader,
      "confidential:view",
    ]);
    const { view } = (
      await assignments.save(maker.cookie, unique("Managers"), {
        grouping: "manager",
      })
    ).json<Saved>();
    await test.holdOnly(maker.id, assignmentsReader);
    expect(await assignments.list(maker.cookie)).toContainEqual({
      id: view.id,
      name: view.name,
      missing: { columns: [], groupings: ["Manager"] },
    });
  });

  it("are shared on Accounts by those who may edit administration, not by those who may change configuration", async () => {
    const administrator = await test.signedIn("administrator");
    expect(
      (
        await accounts.save(
          administrator.cookie,
          unique("Deactivated"),
          {},
          "shared",
        )
      ).statusCode,
    ).toBe(201);
    const configurer = await test.signedIn([
      "administration:view",
      "configuration:edit",
    ]);
    expect(
      (await accounts.save(configurer.cookie, "Ours", {}, "shared")).json(),
    ).toEqual({
      error:
        "Only someone who may share views on this table can save a shared view",
    });
    expect(
      (await accounts.save(configurer.cookie, unique("Mine"), {})).statusCode,
    ).toBe(201);
  });
});

describe("every starting role on every view table", () => {
  const everyoneButAdministrator = roleSchema.options.filter(
    (role) => role !== "administrator",
  );
  const seesConfiguration: readonly Role[] = [
    "product-manager",
    "project-manager",
    "engineering-manager",
    "engineering-director",
    "workforce-administrator",
    "executive",
  ];
  const seesAssignments: readonly Role[] = [
    "project-manager",
    "engineering-manager",
    "engineering-director",
    "workforce-administrator",
    "executive",
  ];
  const configurers: readonly Role[] = [
    "engineering-director",
    "workforce-administrator",
  ];
  // Who opens each table's page, and who of them shares its views, as the Roles page sets out.
  const expected: Record<
    ViewTable,
    { opens: readonly Role[]; shares: readonly Role[] }
  > = {
    people: { opens: everyoneButAdministrator, shares: configurers },
    features: { opens: everyoneButAdministrator, shares: configurers },
    projects: { opens: everyoneButAdministrator, shares: configurers },
    proposals: { opens: everyoneButAdministrator, shares: configurers },
    customers: { opens: everyoneButAdministrator, shares: configurers },
    milestones: { opens: everyoneButAdministrator, shares: configurers },
    "release-streams": { opens: everyoneButAdministrator, shares: configurers },
    lists: { opens: seesConfiguration, shares: configurers },
    "feature-assignments": { opens: seesAssignments, shares: configurers },
    capacity: { opens: seesAssignments, shares: configurers },
    "org-chart": { opens: everyoneButAdministrator, shares: configurers },
    accounts: {
      opens: ["engineering-director", "executive", "administrator"],
      shares: ["administrator"],
    },
  };

  it.each(
    roleSchema.options.flatMap((role) =>
      viewTableSchema.options.map((table) => [role, table] as const),
    ),
  )(
    "%s on %s reads, saves, shares, changes, and deletes only as its page and sharing allow",
    async (role, table) => {
      // Given someone in the role, and what it opens and shares
      const { cookie } = await test.signedIn(role);
      // The table is always one of the fixed tables.
      // eslint-disable-next-line security/detect-object-injection
      const { opens: openers, shares: tableSharers } = expected[table];
      const opens = openers.includes(role);
      const sharing = tableSharers.includes(role);
      const views = onTable(table);

      // When they read, save, share, change, and delete
      const read = await test.request(cookie, "GET", views.path);
      const saved = await views.save(cookie, unique("Mine"), {});
      const shared = await views.save(cookie, unique("Ours"), {}, "shared");

      // Then each is allowed only as the page and sharing allow
      expect(read.statusCode).toBe(opens ? 200 : 403);
      expect(saved.statusCode).toBe(opens ? 201 : 403);
      expect(shared.statusCode).toBe(sharing ? 201 : 403);
      if (!opens) return;
      const { view } = saved.json<Saved>();
      expect(
        (await views.change(cookie, view.id, { name: unique("Renamed") }))
          .statusCode,
      ).toBe(200);
      expect(
        (await views.change(cookie, view.id, { scope: "shared" })).statusCode,
      ).toBe(sharing ? 200 : 403);
      expect((await views.remove(cookie, view.id)).statusCode).toBe(200);
    },
  );
});
