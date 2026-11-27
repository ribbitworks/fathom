// SPDX-License-Identifier: Apache-2.0

// Tests for checkbox columns, against a migrated PostgreSQL server: adding them to People and
// Features, the boxes people, planned hires and features have ticked, drafting and approving them,
// how the change history shows them, and who sees them.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, startTestApp, type TestApp, unique } from "./test-app.ts";
import {
  addedColumnTests,
  type ColumnKind,
  describeClassedColumn,
  describeColumnValues,
} from "./test-added-columns.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

const checkbox: ColumnKind = {
  type: "flag",
  map: "flags",
  name: "Fictional First Aider",
  value: true,
  changed: null,
  inHistory: true,
  changedInHistory: false,
  noneInHistory: false,
  stored: { column: "flag", value: true },
};

const {
  send,
  editor,
  column: checkboxColumn,
  addedId,
  approve,
  historyFields,
} = addedColumnTests(() => test, checkbox);

describe("adding checkbox columns", () => {
  it("adds one with a class of its own, and no list", async () => {
    const { cookie } = await editor();
    const field = await checkboxColumn(cookie, { visibility: "personal" });
    expect(field).toMatchObject({
      type: "flag",
      listId: null,
      visibility: "personal",
      required: false,
    });
  });

  it("refuses one that must be filled in", async () => {
    const { cookie } = await editor();
    const response = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Fictional First Aider"),
      type: "flag",
      visibility: "general",
      required: true,
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toContain("A checkbox column can't be required");
  });
});

describe("people's boxes", () => {
  it("record nothing when an unticked box is unticked", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await checkboxColumn(cookie);
    const id = await addedId(cookie);
    await approve({ people: [id] });
    const saved = await send(cookie, "PATCH", `/api/people/${id}`, {
      flags: { [fieldId]: null },
    });
    expect(saved.json()).toEqual({ changeSetId: null });
  });

  it("are recorded in the change history as ticked", async () => {
    const { cookie } = await editor();
    const field = await checkboxColumn(cookie);
    const id = await addedId(cookie);
    await approve({ people: [id] });
    await send(cookie, "PATCH", `/api/people/${id}`, {
      flags: { [field.id]: true },
    });
    await approve({ people: [id] });
    expect(await historyFields(cookie)).toContainEqual({
      field: "value",
      column: field.name,
      oldValue: false,
      newValue: true,
    });
  });
});

describeColumnValues(() => test, checkbox);
describeClassedColumn(() => test, checkbox, "confidential");
