// SPDX-License-Identifier: Apache-2.0

// Tests for the values features hold in the columns added to Features, against a PostgreSQL server
// of their own: drafts approved with the feature, kept as their column changes, and required ones.

import { changes, drafts, fields, fieldValues, listItems } from "@fathom/db";
import type { Field } from "@fathom/shared";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  addLive,
  shown,
  draftFeature,
  approveFeature,
  liveFeature,
  change,
} from "./test-feature-columns.ts";

beforeAll(startFeatureColumnTests);

afterAll(closeFeatureColumnTests);

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
        records: [
          {
            name: unique("Fictional Feature"),
            values: { [field.id]: [others.at(0)] },
          },
        ],
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
        records: [
          {
            name: unique("Fictional Feature"),
            values: { [randomUUID()]: [randomUUID()] },
          },
        ],
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
      { records: [{ name: unique("Fictional Feature") }] },
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
