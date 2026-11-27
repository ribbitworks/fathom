// SPDX-License-Identifier: Apache-2.0

// Tests for checkbox columns, against a migrated PostgreSQL server: adding them to People and
// Features, the boxes people, planned hires and features have ticked, drafting and approving them,
// how the change history shows them, and who sees them.

import { fieldValues } from "@fathom/db";
import { eq } from "drizzle-orm";
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
  noneInHistory: false,
};

const {
  send,
  editor,
  column: checkboxColumn,
  addedId,
  approve,
  readPerson,
  historyFields,
} = addedColumnTests(() => test, checkbox);

const flagRows = (fieldId: string) =>
  test.connection
    .select({ flag: fieldValues.flag })
    .from(fieldValues)
    .where(eq(fieldValues.fieldId, fieldId));

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
  it("keep a ticked box as a row of its own once approved", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await checkboxColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: true });
    await approve({ people: [id] });
    expect((await readPerson(cookie, id))?.flags).toEqual({ [fieldId]: true });
    expect(await flagRows(fieldId)).toEqual([{ flag: true }]);
  });

  it("are unticked by a draft, showing the live box beside, and leave no row once approved", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await checkboxColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: true });
    await approve({ people: [id] });

    await send(cookie, "PATCH", `/api/people/${id}`, {
      flags: { [fieldId]: null },
    });
    const drafted = await readPerson(cookie, id);
    expect(drafted?.flags).toEqual({});
    expect(drafted?.draft?.live.flags).toEqual({ [fieldId]: true });

    await approve({ people: [id] });
    expect(await flagRows(fieldId)).toEqual([]);
  });

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

  it("are recorded in the change history as ticked, then unticked", async () => {
    const { cookie } = await editor();
    const field = await checkboxColumn(cookie);
    const id = await addedId(cookie);
    await approve({ people: [id] });
    const changed = async (flags: object) => {
      await send(cookie, "PATCH", `/api/people/${id}`, { flags });
      await approve({ people: [id] });
    };
    await changed({ [field.id]: true });
    await changed({ [field.id]: null });
    const boxes = (await historyFields(cookie)).filter(
      ({ column }) => column === field.name,
    );
    expect(boxes).toContainEqual({
      field: "value",
      column: field.name,
      oldValue: false,
      newValue: true,
    });
    expect(boxes).toContainEqual({
      field: "value",
      column: field.name,
      oldValue: true,
      newValue: false,
    });
  });
});

describeColumnValues(() => test, checkbox);
describeClassedColumn(() => test, checkbox, "confidential");
