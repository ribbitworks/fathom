// SPDX-License-Identifier: Apache-2.0

// Tests for the values features hold in columns added to Features, against a PostgreSQL server of
// their own: each table's columns kept apart, changing a column features hold values in, and a
// required column.

import { drafts, fields, fieldValues } from "@fathom/db";
import type { Field } from "@fathom/shared";

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
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
  addColumn,
  addList,
  approveColumn,
  liveColumn,
  draftFeature,
  liveFeature,
} from "./test-feature-columns.ts";

beforeAll(startFeatureColumnTests);

afterAll(closeFeatureColumnTests);

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
    const inDrafts = await draftedValues(
      test.connection,
      field.id,
      "people",
      undefined,
    );
    expect(inDrafts.every(({ adds, hire }) => hire || !adds)).toBe(true);
    expect(
      (await draftedValues(test.connection, field.id, "features", undefined))
        .length,
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
