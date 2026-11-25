// SPDX-License-Identifier: Apache-2.0

// Tests for saved views' changes in the change history: shown only to those who open the view's
// table's page and see its columns, and a personal view's to its maker alone, shared or undone.

import { savedViews } from "@fathom/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generalReader } from "./test-app.ts";
import {
  closeChangeTests,
  entryFor,
  makePersonWithColumn,
  search,
  send,
  startChangeTests,
  test,
} from "./test-changes.ts";

beforeAll(startChangeTests);
afterAll(closeChangeTests);

describe("saved views' changes in the change history", () => {
  it("hides changes to saved views on columns a reader may not see", async () => {
    const manager = await test.signedIn("workforce-administrator");
    const saved = await test.request(
      manager.cookie,
      "POST",
      "/api/views/people",
      {
        name: "Leaving soon",
        scope: "shared",
        definition: { sort: ["endDate"] },
      },
    );
    const { changeSetId } = saved.json<{ changeSetId: string }>();
    expect(
      (await entryFor(manager.cookie, changeSetId))?.records[0],
    ).toMatchObject({ kind: "saved-view", name: "Leaving soon" });
    const generalViewer = await test.signedIn(generalReader);
    expect(await entryFor(generalViewer.cookie, changeSetId)).toBeUndefined();
    // Seeing a tier is enough; a reader need not be able to edit it.
    const reader = await test.signedIn("engineering-manager");
    expect(await entryFor(reader.cookie, changeSetId)).toBeDefined();
    const { view } = saved.json<{ view: { id: string } }>();
    const renamed = await test.request(
      manager.cookie,
      "PUT",
      `/api/views/people/${view.id}`,
      { name: "Leaving", definition: { sort: ["-endDate"] } },
    );
    expect(
      (
        await entryFor(
          manager.cookie,
          renamed.json<{ changeSetId: string }>().changeSetId,
        )
      )?.records[0]?.fields,
    ).toEqual([
      { field: "name", oldValue: "Leaving soon", newValue: "Leaving" },
      // What a view filters and sorts on is not shown, only that it changed.
      { field: "definition", oldValue: null, newValue: null },
    ]);
  });

  it("hides even a rename of a view on a column whose list has become more sensitive since", async () => {
    const made = await makePersonWithColumn("Eta");
    const manager = await test.signedIn("workforce-administrator");
    const saved = await test.request(
      manager.cookie,
      "POST",
      "/api/views/people",
      {
        name: "By Eta site",
        scope: "shared",
        definition: { sort: [made.field.id] },
      },
    );
    const { view } = saved.json<{ view: { id: string } }>();
    const renamed = (
      await test.request(
        manager.cookie,
        "PUT",
        `/api/views/people/${view.id}`,
        {
          name: "Eta sites",
        },
      )
    ).json<{ changeSetId: string }>();
    const generalViewer = await test.signedIn(generalReader);
    expect(
      await entryFor(generalViewer.cookie, renamed.changeSetId),
    ).toBeDefined();
    await send("PUT", `/api/lists/${made.list.id}/class`, {
      dataClass: "confidential",
    });
    expect(
      await entryFor(generalViewer.cookie, renamed.changeSetId),
    ).toBeUndefined();
    expect(await entryFor(manager.cookie, renamed.changeSetId)).toBeDefined();
    const reader = await test.signedIn("executive");
    expect(await entryFor(reader.cookie, renamed.changeSetId)).toBeDefined();
  });

  it("shows changes to a personal view only to its maker, even once it is deleted, and says when it is shared", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const other = await test.signedIn("workforce-administrator");
    const views = "/api/views/people";
    const made = await test.request(maker.cookie, "POST", views, {
      name: "Private plans",
      scope: "personal",
      definition: {},
    });
    const { view, changeSetId } = made.json<{
      view: { id: string };
      changeSetId: string;
    }>();
    expect(
      (await entryFor(maker.cookie, changeSetId))?.records[0],
    ).toMatchObject({ kind: "saved-view", name: "Private plans" });
    expect(await entryFor(other.cookie, changeSetId)).toBeUndefined();

    const shared = (
      await test.request(maker.cookie, "PUT", `${views}/${view.id}`, {
        scope: "shared",
      })
    ).json<{ changeSetId: string }>();
    expect(
      (await entryFor(other.cookie, shared.changeSetId))?.records[0]?.fields,
    ).toEqual([{ field: "scope", oldValue: "personal", newValue: "shared" }]);

    await test.request(maker.cookie, "PUT", `${views}/${view.id}`, {
      scope: "personal",
    });
    const deleted = (
      await test.request(maker.cookie, "DELETE", `${views}/${view.id}`)
    ).json<{ changeSetId: string }>();
    expect(await entryFor(other.cookie, shared.changeSetId)).toBeUndefined();
    expect(await entryFor(other.cookie, deleted.changeSetId)).toBeUndefined();
    expect(await entryFor(maker.cookie, deleted.changeSetId)).toBeDefined();
  });

  it("shows a view's changes on a table besides People to those who open its page, and a personal view's to its maker alone", async () => {
    // Given a shared and a personal view on Features
    const maker = await test.signedIn(["features:view", "features:edit"]);
    const featuresReader = await test.signedIn(["features:view"]);
    const peopleReader = await test.signedIn(["people:view"]);
    const views = "/api/views/features";
    const save = async (name: string, scope: string) =>
      (
        await test.request(maker.cookie, "POST", views, {
          name,
          scope,
          definition: {},
        })
      ).json<{ changeSetId: string }>().changeSetId;
    const shared = await save("Features we share", "shared");
    const personal = await save("Features of mine", "personal");

    // Then those who open Features see the shared view's changes, and only its maker the personal's
    expect(
      (await entryFor(featuresReader.cookie, shared))?.records[0],
    ).toMatchObject({ kind: "saved-view", name: "Features we share" });
    expect(await entryFor(peopleReader.cookie, shared)).toBeUndefined();
    expect(await entryFor(featuresReader.cookie, personal)).toBeUndefined();
    expect(await entryFor(maker.cookie, personal)).toBeDefined();
  });

  it("shows a deleted view's changes only to those who open its table's page", async () => {
    const maker = await test.signedIn(["features:view", "features:edit"]);
    const featuresReader = await test.signedIn(["features:view"]);
    const peopleReader = await test.signedIn(["people:view"]);
    const views = "/api/views/features";
    const { view } = (
      await test.request(maker.cookie, "POST", views, {
        name: "Deleted on Features",
        scope: "shared",
        definition: {},
      })
    ).json<{ view: { id: string } }>();
    const { changeSetId } = (
      await test.request(maker.cookie, "DELETE", `${views}/${view.id}`)
    ).json<{ changeSetId: string }>();
    expect(await entryFor(featuresReader.cookie, changeSetId)).toBeDefined();
    expect(await entryFor(peopleReader.cookie, changeSetId)).toBeUndefined();
  });

  it("shows a view's changes to nobody once its table is one Fathom doesn't know", async () => {
    // Given a view kept on a table that is no longer known
    const maker = await test.signedIn(["features:view", "features:edit"]);
    const { view, changeSetId } = (
      await test.request(maker.cookie, "POST", "/api/views/features", {
        name: "On a table gone",
        scope: "shared",
        definition: {},
      })
    ).json<{ view: { id: string }; changeSetId: string }>();
    await test.connection
      .update(savedViews)
      .set({ tableName: "gone" })
      .where(eq(savedViews.id, view.id));

    // Then not even its maker sees its changes or undoes them
    expect(await entryFor(maker.cookie, changeSetId)).toBeUndefined();
    expect(
      (await test.request(maker.cookie, "POST", `/api/undo/${changeSetId}`, {}))
        .statusCode,
    ).toBe(403);
  });

  it("keeps a view grouped by manager on Capacity's Feature teams from readers without the data it needs", async () => {
    const maker = await test.signedIn([
      "feature-teams:view",
      "personal:view",
      "confidential:view",
      "feature-teams:edit",
    ]);
    const reader = await test.signedIn(["feature-teams:view", "personal:view"]);
    const { changeSetId } = (
      await test.request(
        maker.cookie,
        "POST",
        "/api/views/feature-assignments",
        {
          name: "Assignments by manager",
          scope: "shared",
          definition: { grouping: "manager" },
        },
      )
    ).json<{ changeSetId: string }>();
    expect(await entryFor(maker.cookie, changeSetId)).toBeDefined();
    expect(await entryFor(reader.cookie, changeSetId)).toBeUndefined();
  });

  it("lets a view's change be undone only by someone who still opens its table's page", async () => {
    const maker = await test.signedIn(["features:view", "features:edit"]);
    const { changeSetId } = (
      await test.request(maker.cookie, "POST", "/api/views/features", {
        name: "Undone on Features",
        scope: "shared",
        definition: {},
      })
    ).json<{ changeSetId: string }>();
    await test.holdOnly(maker.id, ["people:view"]);
    expect(
      (await test.request(maker.cookie, "POST", `/api/undo/${changeSetId}`, {}))
        .statusCode,
    ).toBe(403);
    await test.holdOnly(maker.id, ["features:view", "features:edit"]);
    expect(
      (await test.request(maker.cookie, "POST", `/api/undo/${changeSetId}`, {}))
        .statusCode,
    ).toBe(200);
  });

  it("shows nothing of a view's private past once it is shared, nor the name it is shared under in place of an old one", async () => {
    // Given a personal view, renamed in private
    const maker = await test.signedIn("workforce-administrator");
    const other = await test.signedIn("workforce-administrator");
    const views = "/api/views/people";
    const put = async (id: string, body: object) =>
      (await test.request(maker.cookie, "PUT", `${views}/${id}`, body)).json<{
        changeSetId: string;
      }>();
    const { view, changeSetId } = (
      await test.request(maker.cookie, "POST", views, {
        name: "Secretplanalpha",
        scope: "personal",
        definition: {},
      })
    ).json<{ view: { id: string }; changeSetId: string }>();
    const renamed = await put(view.id, { name: "Secretplanbeta" });

    // When it is shared, renamed in the same request
    const shared = await put(view.id, {
      name: "Quarterly plan",
      scope: "shared",
    });

    // Then others see only the sharing, and no search finds the old names
    expect(await entryFor(other.cookie, changeSetId)).toBeUndefined();
    expect(await entryFor(other.cookie, renamed.changeSetId)).toBeUndefined();
    expect(
      (await entryFor(other.cookie, shared.changeSetId))?.records[0],
    ).toMatchObject({
      name: "Quarterly plan",
      fields: [{ field: "scope", oldValue: "personal", newValue: "shared" }],
    });
    for (const name of ["Secretplanalpha", "Secretplanbeta"]) {
      expect((await search(other.cookie, name)).entries, name).toEqual([]);
    }
    expect(
      (await entryFor(maker.cookie, renamed.changeSetId))?.records[0]?.fields,
    ).toEqual([
      {
        field: "name",
        oldValue: "Secretplanalpha",
        newValue: "Secretplanbeta",
      },
    ]);

    // And changes after sharing are seen
    const later = await put(view.id, { name: "Yearly plan" });
    expect(await entryFor(other.cookie, later.changeSetId)).toBeDefined();
  });

  it("keeps a view's changes from others again once sharing it is undone, and once a personal view's deletion is undone", async () => {
    // Given a view shared, then the sharing undone
    const maker = await test.signedIn("workforce-administrator");
    const other = await test.signedIn("workforce-administrator");
    const views = "/api/views/people";
    const { view } = (
      await test.request(maker.cookie, "POST", views, {
        name: "Undone sharing",
        scope: "personal",
        definition: {},
      })
    ).json<{ view: { id: string } }>();
    const shared = (
      await test.request(maker.cookie, "PUT", `${views}/${view.id}`, {
        scope: "shared",
      })
    ).json<{ changeSetId: string }>();
    expect(await entryFor(other.cookie, shared.changeSetId)).toBeDefined();
    const undone = (
      await test.request(
        maker.cookie,
        "POST",
        `/api/undo/${shared.changeSetId}`,
        {},
      )
    ).json<{ changeSetId: string }>();

    // Then others see neither the sharing nor its undoing
    expect(await entryFor(other.cookie, shared.changeSetId)).toBeUndefined();
    expect(await entryFor(other.cookie, undone.changeSetId)).toBeUndefined();

    // And so too when the view is deleted and put back
    const deleted = (
      await test.request(maker.cookie, "DELETE", `${views}/${view.id}`)
    ).json<{ changeSetId: string }>();
    const back = (
      await test.request(
        maker.cookie,
        "POST",
        `/api/undo/${deleted.changeSetId}`,
        {},
      )
    ).json<{ changeSetId: string }>();
    expect(await entryFor(other.cookie, deleted.changeSetId)).toBeUndefined();
    expect(await entryFor(other.cookie, back.changeSetId)).toBeUndefined();
    expect(await entryFor(maker.cookie, back.changeSetId)).toBeDefined();
  });
});
