// SPDX-License-Identifier: Apache-2.0

// Tests for Duration columns, against a migrated PostgreSQL server: adding them with the unit a bare
// number takes, a required one refusing none, and a length not whole, too long or in no known unit
// refused; with what every type of column shares, for people, planned hires, features, activities,
// undo, the change history, and who sees a Personal or Confidential column.

import type { Field } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, ok, startTestApp, type TestApp, unique } from "./test-app.ts";
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

const duration: ColumnKind = {
  type: "duration",
  map: "durations",
  name: "Fictional Kick-off After",
  value: { amount: 2, unit: "wk" },
  changed: { amount: -1, unit: "mo" },
  inHistory: "2 wk",
  changedInHistory: "−1 mo",
  noneInHistory: null,
  stored: { column: "durationAmount", value: 2 },
  settings: { unit: "wk" },
};

const {
  send,
  editor,
  column: durationColumn,
  newPerson,
  addedId,
} = addedColumnTests(() => test, duration);

// First, while there is no one, so a column can be required from the start.
describe("a required Duration column", () => {
  it("refuses a person without a length, and a length removed", async () => {
    const { cookie } = await editor();
    const { field: required } = await ok<{ field: Field }>(
      await send(cookie, "POST", "/api/people/columns", {
        name: unique(duration.name),
        type: "duration",
        visibility: "general",
        unit: "wd",
        required: true,
      }),
      201,
    );
    await test.approveLists();
    const missing = await send(cookie, "POST", "/api/people", newPerson());
    expect(errorOf(missing)).toBe(`${required.name} must be filled in`);
    const id = await addedId(cookie, {
      [required.id]: { amount: 5, unit: "wd" },
    });
    const removed = await send(cookie, "PATCH", `/api/people/${id}`, {
      durations: { [required.id]: null },
    });
    expect(errorOf(removed)).toBe(`${required.name} must be filled in`);
    // Removed, so the people the other tests add need no length in it.
    await ok(await send(cookie, "DELETE", `/api/people/${id}/draft`));
    await ok(
      await send(cookie, "DELETE", `/api/people/columns/${required.id}`),
    );
    await test.approveLists();
  });
});

describe("adding Duration columns", () => {
  it("adds one with its unit, a class of its own and no list", async () => {
    const { cookie } = await editor();
    expect(
      await durationColumn(cookie, { visibility: "personal" }),
    ).toMatchObject({
      type: "duration",
      unit: "wk",
      listId: null,
      visibility: "personal",
      multiple: false,
    });
  });

  it("refuses one with no unit, and a unit on another type", async () => {
    const { cookie } = await editor();
    for (const [settings, refusal] of [
      [{ type: "duration" }, "Choose a unit"],
      [{ type: "number", unit: "wk" }, "Only a Duration column has a unit"],
    ] as const) {
      const refused = await send(cookie, "POST", "/api/people/columns", {
        name: unique(duration.name),
        visibility: "general",
        ...settings,
      });
      expect(refused.statusCode).toBe(400);
      expect(errorOf(refused)).toContain(refusal);
    }
  });
});

describe("a length not whole, too long, or in no known unit", () => {
  it.each([
    ["part of a unit", { amount: 1.5, unit: "mo" }],
    ["past the longest", { amount: 10000, unit: "d" }],
    ["sprints", { amount: 2, unit: "sprints" }],
  ])("is refused: %s", async (_case, length) => {
    const { cookie } = await editor();
    const { id: fieldId } = await durationColumn(cookie);
    const person = await send(
      cookie,
      "POST",
      "/api/people",
      newPerson({ [fieldId]: length }),
    );
    expect(person.statusCode).toBe(400);
  });
});

describeColumnValues(() => test, duration);
describeClassedColumn(() => test, duration, "confidential");
describeClassedColumn(() => test, duration, "personal");
