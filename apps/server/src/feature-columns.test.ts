// SPDX-License-Identifier: Apache-2.0

// Tests for the columns added to Features, against a PostgreSQL server of their own: who may change
// them, that they are drafts approved like People's, and that features hold values in them, as
// drafts approved with the feature.

import {
  changes,
  drafts,
  fields,
  fieldValues,
  listItems,
  lists,
} from "@fathom/db";
import type { Feature, Field, ProjectPlan } from "@fathom/shared";
import { featuresListGeneral, startingRoles } from "@fathom/shared";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { draftedValues } from "./data/drafted-values.ts";
import { errorOf, startTestApp, type TestApp, unique } from "./test-app.ts";

let test: TestApp;
let editor: { id: string; cookie: string };
let columnApprover: { id: string; cookie: string };
let planner: { id: string; cookie: string };
let planApprover: { id: string; cookie: string };
let viewer: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  // Edits features and configuration, so makes the lists its columns draw on.
  editor = await test.signedIn([
    ...startingRoles["workforce-administrator"].permissions,
    "features:edit",
  ]);
  columnApprover = await test.signedIn("engineering-director");
  planner = await test.signedIn("product-manager");
  planApprover = await test.signedIn("project-manager");
  viewer = await test.signedIn(["plan:view", "features:view"]);
});

afterAll(async () => {
  await test.close();
});

type FieldBody = Record<string, unknown>;

const addColumn = (body: FieldBody, cookie = editor.cookie) =>
  test.request(cookie, "POST", "/api/features/columns", {
    name: unique("Fictional Column"),
    ...body,
  });

async function addList(visibility = "general") {
  const listId = randomUUID();
  await test.connection
    .insert(lists)
    .values({ id: listId, name: unique("Fictional List"), visibility });
  const choices = [randomUUID(), randomUUID()];
  await test.connection.insert(listItems).values(
    choices.map((id, position) => ({
      id,
      listId,
      label: unique("Fictional Choice"),
      position,
    })),
  );
  return { listId, choices };
}

async function approveColumn(id: string) {
  const response = await test.request(
    columnApprover.cookie,
    "POST",
    "/api/drafts/approval",
    { columns: [id] },
  );
  expect(response.statusCode).toBe(200);
}

async function liveColumn(body: FieldBody = {}) {
  const { listId, choices } = await addList();
  const response = await addColumn({ listId, ...body });
  expect(response.statusCode).toBe(201);
  const { field } = response.json<{ field: Field }>();
  await approveColumn(field.id);
  return { field, choices, listId };
}

async function addLive(body: FieldBody) {
  const { field } = (await addColumn(body)).json<{ field: Field }>();
  await approveColumn(field.id);
  return field;
}

const features = async (cookie = planner.cookie) =>
  (await test.request(cookie, "GET", "/api/projects")).json<ProjectPlan>()
    .features;

const shown = async (id: string, cookie?: string) =>
  (await features(cookie)).find((feature) => feature.id === id) as Feature;

async function draftFeature(body: FieldBody = {}) {
  const name = unique("Fictional Feature");
  const response = await test.request(planner.cookie, "POST", "/api/features", {
    name,
    ...body,
  });
  expect(response.statusCode).toBe(201);
  return response
    .json<{ plan: ProjectPlan }>()
    .plan.features.find((feature) => feature.name === name) as Feature;
}

const approveFeature = (id: string) =>
  test.request(planApprover.cookie, "POST", "/api/drafts/approval", {
    records: [{ type: "feature", id }],
  });

async function liveFeature(body: FieldBody = {}) {
  const feature = await draftFeature(body);
  expect((await approveFeature(feature.id)).statusCode).toBe(200);
  return feature;
}

const change = (feature: Feature, body: FieldBody) =>
  test.request(planner.cookie, "PUT", `/api/features/${feature.id}`, {
    name: feature.name,
    ...body,
  });

const columns = async (cookie = planner.cookie) =>
  (await test.request(cookie, "GET", "/api/projects")).json<ProjectPlan>()
    .featureColumns;

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

describe("a feature's values", () => {
  it("holds a choice in a draft until the feature is approved", async () => {
    const { field, choices } = await liveColumn();
    const [choice] = choices as [string];
    const feature = await liveFeature({ values: { [field.id]: [choice] } });
    expect((await shown(feature.id)).values[field.id]).toEqual([choice]);
    const held = await test.connection
      .select()
      .from(fieldValues)
      .where(eq(fieldValues.featureId, feature.id));
    expect(held.map(({ choiceId }) => choiceId)).toEqual([choice]);
  });

  it("shows a changed value as the draft's, with the live one beside", async () => {
    const { field, choices } = await liveColumn();
    const [first, second] = choices as [string, string];
    const feature = await liveFeature({ values: { [field.id]: [first] } });
    await change(feature, { values: { [field.id]: [second] } });
    const drafted = await shown(feature.id);
    expect(drafted.values[field.id]).toEqual([second]);
    expect(drafted.draft?.changed).toContain(field.id);
    expect(drafted.draft?.live.values[field.id]).toEqual([first]);
    expect(Object.keys(drafted.draft?.changedBy ?? {})).toContain(field.id);
  });

  it("keeps values a change does not name", async () => {
    const { field, choices } = await liveColumn();
    const feature = await liveFeature({
      values: { [field.id]: [choices.at(0)] },
    });
    await change(feature, { description: "Fictional words" });
    expect((await shown(feature.id)).values[field.id]).toEqual([choices.at(0)]);
  });

  it("keeps a value a change leaves alone once approved", async () => {
    const { field, choices } = await liveColumn();
    const feature = await liveFeature({
      values: { [field.id]: [choices.at(0)] },
    });
    await change(feature, { description: "Fictional words" });
    expect((await approveFeature(feature.id)).statusCode).toBe(200);
    const held = await test.connection
      .select()
      .from(fieldValues)
      .where(eq(fieldValues.featureId, feature.id));
    expect(held.map(({ choiceId }) => choiceId)).toEqual([choices.at(0)]);
  });

  it("clears a value on approval", async () => {
    const { field, choices } = await liveColumn();
    const feature = await liveFeature({
      values: { [field.id]: [choices.at(0)] },
    });
    await change(feature, { values: { [field.id]: [] } });
    expect((await approveFeature(feature.id)).statusCode).toBe(200);
    const held = await test.connection
      .select()
      .from(fieldValues)
      .where(eq(fieldValues.featureId, feature.id));
    expect(held).toEqual([]);
  });

  it("holds a link and a note", async () => {
    const link = (
      await addColumn({ type: "link", visibility: "general" })
    ).json<{ field: Field }>().field;
    const note = (
      await addColumn({ type: "note", visibility: "general" })
    ).json<{ field: Field }>().field;
    await approveColumn(link.id);
    await approveColumn(note.id);
    const feature = await liveFeature({
      links: { [link.id]: { address: "https://example.com", text: "" } },
      notes: { [note.id]: "**Fictional**" },
    });
    const live = await shown(feature.id);
    expect(live.links[link.id]?.address).toContain("example.com");
    expect(live.notes?.[note.id]).toBe("**Fictional**");
  });

  it("holds a number", async () => {
    const column = await addLive({ type: "number", visibility: "general" });
    const feature = await liveFeature({ numbers: { [column.id]: 12 } });
    expect((await shown(feature.id)).numbers?.[column.id]).toBe(12);
  });

  it("shows values to those who only see the plan", async () => {
    const { field, choices } = await liveColumn();
    const feature = await liveFeature({
      values: { [field.id]: [choices.at(0)] },
    });
    expect((await shown(feature.id, viewer.cookie)).values[field.id]).toEqual([
      choices.at(0),
    ]);
  });

  it("refuses a choice from another list", async () => {
    const { field } = await liveColumn();
    const { choices: others } = await addList();
    const response = await test.request(
      planner.cookie,
      "POST",
      "/api/features",
      {
        name: unique("Fictional Feature"),
        values: { [field.id]: [others.at(0)] },
      },
    );
    expect(response.statusCode).toBe(400);
  });

  it("refuses a value in a column that is not on Features", async () => {
    const response = await test.request(
      planner.cookie,
      "POST",
      "/api/features",
      {
        name: unique("Fictional Feature"),
        values: { [randomUUID()]: [randomUUID()] },
      },
    );
    expect(response.statusCode).toBe(400);
  });

  it("refuses removing a column to those who cannot change features", async () => {
    const { field } = await liveColumn();
    const configurer = await test.signedIn("workforce-administrator");
    const removed = await test.request(
      configurer.cookie,
      "DELETE",
      `/api/features/columns/${field.id}`,
    );
    expect(removed.statusCode).toBe(403);
  });

  it("shows a link and a note changed beside their live values", async () => {
    const link = await addLive({ type: "link", visibility: "general" });
    const note = await addLive({ type: "note", visibility: "general" });
    const feature = await liveFeature({
      links: { [link.id]: { address: "https://example.com/a", text: "" } },
      notes: { [note.id]: "**First**" },
    });
    await change(feature, {
      links: { [link.id]: { address: "https://example.com/b", text: "" } },
      notes: { [note.id]: "**Second**" },
    });
    const { draft } = await shown(feature.id);
    expect(draft?.live.notes[note.id]).toBe("**First**");
    expect(draft?.live.links[link.id]).toMatchObject({
      address: expect.stringContaining("/a") as string,
    });
    await change(feature, {
      links: { [link.id]: null },
      notes: { [note.id]: null },
    });
    expect((await approveFeature(feature.id)).statusCode).toBe(200);
    const live = await shown(feature.id);
    expect(live.links[link.id]).toBeUndefined();
    expect(live.notes?.[note.id]).toBeUndefined();
  });

  it("makes no draft for an empty value in a column with none", async () => {
    const { field } = await liveColumn();
    const feature = await liveFeature();
    await change(feature, { values: { [field.id]: [] } });
    expect((await shown(feature.id)).draft).toBeUndefined();
  });

  it("keeps a retired choice a feature has, and refuses one it does not", async () => {
    const { field, choices } = await liveColumn();
    const [held, other] = choices as [string, string];
    const feature = await liveFeature({ values: { [field.id]: [held] } });
    await test.connection
      .update(listItems)
      .set({ retired: true })
      .where(inArray(listItems.id, [held, other]));
    expect(
      (
        await change(feature, {
          description: "Fictional",
          values: { [field.id]: [held] },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await change(feature, { values: { [field.id]: [other] } })).statusCode,
    ).toBe(400);
  });

  it("removes a feature's values with the feature, recorded in the history", async () => {
    const { field, choices } = await liveColumn();
    const feature = await liveFeature({
      values: { [field.id]: [choices.at(0)] },
    });
    await test.request(planner.cookie, "DELETE", `/api/features/${feature.id}`);
    expect((await approveFeature(feature.id)).statusCode).toBe(200);
    const held = await test.connection
      .select()
      .from(fieldValues)
      .where(eq(fieldValues.featureId, feature.id));
    expect(held).toEqual([]);
    const recorded = await test.connection
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.recordId, feature.id),
          eq(changes.field, `value:${field.id}`),
          eq(changes.action, "deleted"),
        ),
      );
    expect(recorded.filter(({ draft }) => !draft)).toHaveLength(1);
  });

  it("holds back removing a column while a draft gives it a value", async () => {
    const { field, choices } = await liveColumn();
    await draftFeature({ values: { [field.id]: [choices.at(0)] } });
    await test.connection.insert(drafts).values({
      recordType: "field",
      recordId: field.id,
      action: "deleted",
      fields: {},
    });
    const response = await test.request(
      columnApprover.cookie,
      "POST",
      "/api/drafts/approval",
      { columns: [field.id] },
    );
    expect(response.statusCode).toBe(409);
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

describe("changing a column features hold values in", () => {
  it("cannot take one choice while a feature has several", async () => {
    const { field, choices } = await liveColumn({ multiple: true });
    await liveFeature({ values: { [field.id]: choices } });
    const response = await test.request(
      editor.cookie,
      "PUT",
      `/api/features/columns/${field.id}`,
      { name: field.name, listId: field.listId, multiple: false },
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toContain("cannot take only one yet");
  });

  it("refuses taking one choice approved with a feature's draft giving several", async () => {
    // Given a column drafted to take one choice, and a feature drafted with both its choices
    const { field, choices } = await liveColumn({ multiple: true });
    const changed = await test.request(
      editor.cookie,
      "PUT",
      `/api/features/columns/${field.id}`,
      { name: field.name, listId: field.listId, multiple: false },
    );
    expect(changed.statusCode, changed.body).toBe(200);
    const feature = await draftFeature({ values: { [field.id]: choices } });

    // When both are approved together
    const response = await test.request(
      columnApprover.cookie,
      "POST",
      "/api/drafts/approval",
      { records: [{ type: "feature", id: feature.id }], columns: [field.id] },
    );

    // Then the column is refused, and the feature holds no values
    expect(response.statusCode, response.body).toBe(409);
    expect(errorOf(response)).toContain("cannot take only one yet");
    expect(
      await test.connection
        .select()
        .from(fieldValues)
        .where(eq(fieldValues.featureId, feature.id)),
    ).toEqual([]);
  });

  it("removes a column approved with a feature's draft giving a value in it", async () => {
    // Given a column drafted to be removed, and a feature drafted with a value in it
    const { field, choices } = await liveColumn();
    const feature = await draftFeature({
      values: { [field.id]: [choices.at(0)] },
    });
    await test.connection.insert(drafts).values({
      recordType: "field",
      recordId: field.id,
      action: "deleted",
      fields: {},
    });

    // When both are approved together
    const response = await test.request(
      columnApprover.cookie,
      "POST",
      "/api/drafts/approval",
      { records: [{ type: "feature", id: feature.id }], columns: [field.id] },
    );

    // Then the column is gone, with the feature's value
    expect(response.statusCode, response.body).toBe(200);
    expect(
      await test.connection
        .select()
        .from(fieldValues)
        .where(eq(fieldValues.featureId, feature.id)),
    ).toEqual([]);
  });

  it("removes a feature's values with the column once approved", async () => {
    const { field, choices } = await liveColumn();
    const feature = await liveFeature({
      values: { [field.id]: [choices.at(0)] },
    });
    await test.connection.insert(drafts).values({
      recordType: "field",
      recordId: field.id,
      action: "deleted",
      fields: {},
    });
    await approveColumn(field.id);
    const left = await test.connection
      .select()
      .from(fieldValues)
      .where(eq(fieldValues.featureId, feature.id));
    expect(left).toEqual([]);
  });
});

describe("a required column on Features", () => {
  it("cannot be required while features have no value in it", async () => {
    await liveFeature();
    const { listId } = await addList();
    const response = await addColumn({ listId, required: true });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toContain("cannot be required yet");
  });

  it("refuses a feature with no value in a required column", async () => {
    const { listId } = await addList();
    const id = randomUUID();
    await test.connection.insert(fields).values({
      id,
      tableName: "features",
      name: unique("Fictional Required"),
      listId,
      required: true,
    });
    const response = await test.request(
      planner.cookie,
      "POST",
      "/api/features",
      { name: unique("Fictional Feature") },
    );
    await test.connection.delete(fields).where(eq(fields.id, id));
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toContain("must be filled in");
  });

  it("says how many features have none, once no draft leaves it empty", async () => {
    await liveFeature();
    await test.connection
      .delete(drafts)
      .where(eq(drafts.recordType, "feature"));
    const { listId } = await addList();
    const response = await addColumn({ listId, required: true });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toMatch(/features? ha(s|ve) no/);
  });
});
