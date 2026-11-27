// SPDX-License-Identifier: Apache-2.0

// Tests for the columns added to Features, against a PostgreSQL server of their own: who may change
// them, that they are drafts approved like People's, and that each table keeps its own.

import { drafts, lists } from "@fathom/db";
import type { Field } from "@fathom/shared";
import { featuresListGeneral } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { draftedValues } from "./data/drafted-values.ts";
import { errorOf, unique } from "./test-app.ts";
import {
  closeFeatureColumnTests,
  startFeatureColumnTests,
  test,
  editor,
  columnApprover,
  planner,
  viewer,
  addColumn,
  addList,
  approveColumn,
  liveColumn,
  draftFeature,
  columns,
} from "./test-feature-columns.ts";

beforeAll(startFeatureColumnTests);

afterAll(closeFeatureColumnTests);

// Enough that columns in any other order would not pass by chance.
const columnsToOrder = 6;

describe("who adds columns to Features", () => {
  it("lets only a role that edits features undo a change to one", async () => {
    // Given a column its maker added while editing features
    const maker = await test.signedIn([
      "plan:view",
      "features:edit",
      "people:view",
    ]);
    const added = await addColumn(
      { type: "link", visibility: "general" },
      maker.cookie,
    );
    const { changeSetId } = added.json<{ changeSetId: string }>();
    const undo = () =>
      test.request(maker.cookie, "POST", `/api/undo/${changeSetId}`);

    // When the maker changes configuration but no longer edits features
    await test.holdOnly(maker.id, ["configuration:edit", "features:view"]);

    // Then they can't undo it, until they may again
    expect((await undo()).statusCode).toBe(403);
    await test.holdOnly(maker.id, ["features:edit", "people:view"]);
    const undone = await undo();
    expect(undone.statusCode, undone.body).toBeLessThan(300);
  });

  it("takes out a column its maker added and hasn't published", async () => {
    const added = await test.request(
      planner.cookie,
      "POST",
      "/api/features/columns",
      { name: unique("Fictional Column"), type: "link", visibility: "general" },
      { publish: false },
    );
    const { field, changeSetId } = added.json<{
      field: Field;
      changeSetId: string;
    }>();

    const undone = await test.request(
      planner.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );

    expect(undone.statusCode, undone.body).toBe(200);
    expect((await columns()).fields.map(({ id }) => id)).not.toContain(
      field.id,
    );
  });

  it("is a role that edits features, such as the Product Manager, and not one that only changes configuration", async () => {
    const configurer = await test.signedIn("workforce-administrator");
    const body = { type: "link", visibility: "general" };
    const refused = await addColumn(body, configurer.cookie);
    expect(refused.statusCode).toBe(403);
    const added = await addColumn(body, planner.cookie);
    expect(added.statusCode, added.body).toBe(201);
  });
});

describe("the columns on Features", () => {
  it("drafts a column, shown only on Features until approved and after", async () => {
    const { listId } = await addList();
    const name = unique("Fictional Size");
    const response = await addColumn({ name, listId });
    expect(response.statusCode).toBe(201);
    const { field } = response.json<{ field: Field }>();
    await approveColumn(field.id);
    expect((await columns()).fields.map(({ name: one }) => one)).toContain(
      name,
    );
    const people = await test.request(
      editor.cookie,
      "GET",
      "/api/people/columns",
    );
    expect(people.body).not.toContain(name);
  });

  it("puts added columns after the built-in ones", async () => {
    const { field } = await liveColumn();
    const { order } = await columns();
    expect(order.at(0)).toBe("name");
    expect(order).toContain(field.id);
  });

  it("leaves who drafted a list out for those who only see the plan", async () => {
    const { listId } = await liveColumn();
    const reason = "Fictional reason";
    await test.connection.insert(drafts).values({
      recordType: "list",
      recordId: listId,
      action: "changed",
      fields: { name: unique("Fictional Drafted") },
      state: "rejected",
      reason,
    });
    const listOf = async (cookie: string) =>
      (await columns(cookie)).lists.find(({ id }) => id === listId);
    try {
      expect((await listOf(viewer.cookie))?.draft).toBeUndefined();
      expect(JSON.stringify(await columns(viewer.cookie))).not.toContain(
        reason,
      );
      expect((await listOf(editor.cookie))?.draft?.reason).toBe(reason);
    } finally {
      await test.connection
        .delete(drafts)
        .where(and(eq(drafts.recordType, "list"), eq(drafts.recordId, listId)));
    }
  });

  it("keeps columns in the order added once they are approved", async () => {
    const added: string[] = [];
    for (let count = 0; count < columnsToOrder; count += 1) {
      added.push((await liveColumn()).field.id);
    }
    const { order } = await columns();
    expect(order.filter((key) => added.includes(key))).toEqual(added);
  });

  it("sends those who only see the plan the General lists columns draw on", async () => {
    const { field, listId } = await liveColumn();
    const { listId: unused } = await addList();
    const { lists: sent } = await columns(viewer.cookie);
    expect(sent.map(({ id }) => id)).toContain(listId);
    expect(sent.map(({ id }) => id)).not.toContain(unused);
    await test.connection
      .update(lists)
      .set({ visibility: "personal" })
      .where(eq(lists.id, listId));
    try {
      const after = await columns(viewer.cookie);
      expect(after.fields.map(({ id }) => id)).toContain(field.id);
      expect(after.lists.map(({ id }) => id)).not.toContain(listId);
    } finally {
      await test.connection
        .update(lists)
        .set({ visibility: "general" })
        .where(eq(lists.id, listId));
    }
  });

  it("lets a name be used on People and Features alike, once on each", async () => {
    const name = unique("Fictional Shared");
    const { listId } = await addList();
    const onPeople = await test.request(
      editor.cookie,
      "POST",
      "/api/people/columns",
      { name, listId },
    );
    expect(onPeople.statusCode).toBe(201);
    expect((await addColumn({ name, listId })).statusCode).toBe(201);
    const again = await addColumn({ name, listId });
    expect(again.statusCode).toBe(409);
    expect(errorOf(again)).toBe("There is already a column with that name");
  });

  it("refuses a list that is not General", async () => {
    const { listId } = await addList("personal");
    const response = await addColumn({ listId });
    expect(response.statusCode).toBe(400);
  });

  it("is never offered on planned hires", async () => {
    const { listId } = await addList();
    const { field } = (await addColumn({ listId, onPlannedHires: true })).json<{
      field: Field;
    }>();
    expect(field.onPlannedHires).toBe(false);
  });

  it("changes a column's settings", async () => {
    const { field } = await liveColumn();
    const name = unique("Fictional Renamed");
    const response = await test.request(
      editor.cookie,
      "PUT",
      `/api/features/columns/${field.id}`,
      { name, listId: field.listId },
    );
    expect(response.statusCode).toBe(200);
  });

  it("resubmits a rejected removal only for a role that still edits features", async () => {
    // Given a live column whose removal was drafted and rejected
    const { field } = await liveColumn();
    const remover = await test.signedIn([
      "plan:view",
      "features:edit",
      "configuration:view",
      "people:view",
    ]);
    const path = `/api/features/columns/${field.id}`;
    expect(
      (await test.request(remover.cookie, "DELETE", path)).statusCode,
    ).toBe(200);
    const rejected = await test.request(
      columnApprover.cookie,
      "POST",
      "/api/drafts/rejection",
      { columns: [field.id], reason: "Fictional reason" },
    );
    expect(rejected.statusCode).toBe(200);
    const resubmit = () =>
      test.request(remover.cookie, "DELETE", `${path}/draft/rejection`);

    // When its maker no longer edits features, then once they do again
    await test.holdOnly(remover.id, [
      "features:view",
      "configuration:view",
      "people:view",
    ]);
    expect((await resubmit()).statusCode).toBe(403);
    await test.holdOnly(remover.id, [
      "features:edit",
      "configuration:view",
      "people:view",
    ]);
    expect((await resubmit()).statusCode).toBe(200);
  });

  it("refuses undoing a column's addition once its draft is gone", async () => {
    const maker = await test.signedIn([
      "plan:view",
      "features:edit",
      "configuration:view",
      "people:view",
    ]);
    const added = await addColumn(
      { type: "link", visibility: "general" },
      maker.cookie,
    );
    const { field, changeSetId } = added.json<{
      field: Field;
      changeSetId: string;
    }>();
    await test.request(
      maker.cookie,
      "DELETE",
      `/api/features/columns/${field.id}/draft`,
    );

    const undone = await test.request(
      maker.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );

    expect(undone.statusCode).toBe(409);
  });

  it("discards a column's draft, and resubmits a rejected one", async () => {
    const { listId } = await addList();
    const { field } = (await addColumn({ listId })).json<{ field: Field }>();
    const rejected = await test.request(
      columnApprover.cookie,
      "POST",
      "/api/drafts/rejection",
      { columns: [field.id], reason: "Fictional reason" },
    );
    expect(rejected.statusCode).toBe(200);
    const path = `/api/features/columns/${field.id}/draft`;
    expect(
      (await test.request(editor.cookie, "DELETE", `${path}/rejection`))
        .statusCode,
    ).toBe(200);
    expect((await test.request(editor.cookie, "DELETE", path)).statusCode).toBe(
      200,
    );
  });
});

describe("keeping columns on Features General", () => {
  it("refuses a link or note column that is not General", async () => {
    const response = await addColumn({
      type: "link",
      visibility: "personal",
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses raising the visibility of a list a column on Features draws on", async () => {
    const { field } = await liveColumn();
    const response = await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${String(field.listId)}`,
      { name: unique("Fictional Raised"), visibility: "personal" },
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(featuresListGeneral);
  });

  it("tells readers of the lists which ones a column on Features draws on, live or drafted", async () => {
    const { field } = await liveColumn();
    const { listId } = await addList();
    expect((await addColumn({ listId })).statusCode).toBe(201);
    const { listId: unused } = await addList();
    const { lists: read } = (
      await test.request(editor.cookie, "GET", "/api/lists")
    ).json<{ lists: { id: string; onFeatures?: boolean }[] }>();
    const onFeatures = (id: string | null) =>
      read.find((list) => list.id === id)?.onFeatures;
    expect(onFeatures(field.listId)).toBe(true);
    expect(onFeatures(listId)).toBe(true);
    expect(onFeatures(unused)).toBeUndefined();
  });

  it("refuses raising a list a column only drafted on Features draws on", async () => {
    const { listId } = await addList();
    expect((await addColumn({ listId })).statusCode).toBe(201);
    const response = await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${listId}`,
      { name: unique("Fictional Raised"), visibility: "personal" },
    );
    expect(response.statusCode).toBe(409);
  });

  it("refuses approving a column whose list has since been raised", async () => {
    const { listId } = await addList();
    const { field } = (await addColumn({ listId })).json<{ field: Field }>();
    await test.connection
      .update(lists)
      .set({ visibility: "personal" })
      .where(eq(lists.id, listId));
    const response = await test.request(
      columnApprover.cookie,
      "POST",
      "/api/drafts/approval",
      { columns: [field.id] },
    );
    expect(response.statusCode).toBe(400);
  });
});

describe("keeping each table's columns apart", () => {
  it("finds no People column through the Features routes", async () => {
    const { listId } = await addList();
    const made = await test.request(
      editor.cookie,
      "POST",
      "/api/people/columns",
      { name: unique("Fictional People"), listId },
    );
    const { field } = made.json<{ field: Field }>();
    const path = `/api/features/columns/${field.id}`;
    expect(
      (
        await test.request(editor.cookie, "PUT", path, {
          name: field.name,
          listId,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await test.request(editor.cookie, "DELETE", `${path}/draft`)).statusCode,
    ).toBe(404);
  });

  it("finds no Features column through the People routes", async () => {
    const { field } = await liveColumn();
    const response = await test.request(
      editor.cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      { name: field.name, listId: field.listId },
    );
    expect(response.statusCode).toBe(404);
  });

  it("does not let a person hold a value in a Features column only drafted", async () => {
    const { listId, choices } = await addList();
    const { field } = (await addColumn({ listId })).json<{ field: Field }>();
    const response = await test.request(editor.cookie, "POST", "/api/people", {
      preferredName: unique("Fictional Person"),
      values: { [field.id]: [choices.at(0)] },
    });
    expect(response.statusCode).toBe(400);
  });

  it("keeps drafts of one table from holding up a required column on the other", async () => {
    await draftFeature();
    const { listId } = await addList();
    const { field } = (
      await test.request(editor.cookie, "POST", "/api/people/columns", {
        name: unique("Fictional People Required"),
        listId,
      })
    ).json<{ field: Field }>();
    const inDrafts = await draftedValues(test.connection, field.id, "people");
    expect(inDrafts.every(({ adds, hire }) => hire || !adds)).toBe(true);
    expect(
      (await draftedValues(test.connection, field.id, "features")).length,
    ).toBeGreaterThan(0);
  });
});
