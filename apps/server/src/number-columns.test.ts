// SPDX-License-Identifier: Apache-2.0

// Tests for number columns on the People table, against a migrated PostgreSQL server: adding them,
// the numbers people and planned hires are given and refused, drafting, approving and removing
// them, how the change history shows them, and who sees them.

import { fieldValues } from "@fathom/db";
import { type ChangeHistory, type Field, type Person } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  generalReader,
  sender,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

const editor = () => test.signedIn("workforce-administrator");

const send = sender(() => test);

async function numberColumn(
  cookie: string,
  settings: { visibility?: string; required?: boolean } = {},
): Promise<Field> {
  const response = await send(cookie, "POST", "/api/people/columns", {
    name: unique("Fictional Score"),
    type: "number",
    visibility: settings.visibility ?? "general",
    required: settings.required ?? false,
    onPlannedHires: true,
  });
  expect(response.statusCode, response.body).toBe(201);
  await test.approveLists();
  return response.json<{ field: Field }>().field;
}

const addPerson = (cookie: string, numbers: object = {}) =>
  send(cookie, "POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("N"),
        positionId: testPosition,
        numbers,
      },
    ],
  });

async function addedId(cookie: string, numbers: object = {}) {
  const response = await addPerson(cookie, numbers);
  expect(response.statusCode, response.body).toBe(201);
  return String(response.json<{ ids: string[] }>().ids[0]);
}

async function approve(body: object) {
  const { cookie } = await test.signedIn("engineering-director");
  const response = await send(cookie, "POST", "/api/drafts/approval", body);
  expect(response.statusCode, response.body).toBe(200);
}

async function readPerson(cookie: string, id: string) {
  const response = await send(cookie, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response
    .json<{ people: Person[] }>()
    .people.find((person) => person.id === id);
}

const numberRows = (fieldId: string) =>
  test.connection
    .select({ number: fieldValues.number })
    .from(fieldValues)
    .where(eq(fieldValues.fieldId, fieldId));

// First, while there is no one, so a column can be required from the start.
describe("a required number column", () => {
  it("counts 0 as filled in, and no number as not", async () => {
    const { cookie } = await editor();
    const required = await numberColumn(cookie, { required: true });
    const refused = await addPerson(cookie);
    expect(refused.json()).toEqual({
      error: `${required.name} must be filled in`,
    });
    const id = await addedId(cookie, { [required.id]: 0 });
    await approve({ people: [id] });
    // Deleted, so the tests after this one need not fill it in.
    const gone = await send(
      cookie,
      "DELETE",
      `/api/people/columns/${required.id}`,
    );
    expect(gone.statusCode, gone.body).toBe(200);
    await test.approveLists();
  });
});

describe("adding number columns", () => {
  it("adds one with a visibility of its own, and no list", async () => {
    const { cookie } = await editor();
    const field = await numberColumn(cookie, { visibility: "personal" });
    expect(field).toMatchObject({
      type: "number",
      listId: null,
      visibility: "personal",
    });
  });

  it("refuses one with a list", async () => {
    const { cookie } = await editor();
    const response = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Fictional Score"),
      type: "number",
      visibility: "general",
      listId: "00000000-0000-4000-8000-000000000001",
    });
    expect(response.statusCode).toBe(400);
  });
});

describe("people's numbers", () => {
  it.each([
    ["zero", 0],
    ["a negative number", -7],
    ["a decimal", 1234.5],
  ])("keeps %s in its own column once approved", async (_, number) => {
    const { cookie } = await editor();
    const { id: fieldId } = await numberColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: number });
    await approve({ people: [id] });
    expect((await readPerson(cookie, id))?.numbers).toEqual({
      [fieldId]: number,
    });
    expect(await numberRows(fieldId)).toEqual([{ number }]);
  });

  it.each([
    ["text", "12"],
    ["a number too long to keep exactly", 1234567890123456],
    ["too many decimal places", 0.1234567],
  ])("refuses %s", async (_, number) => {
    const { cookie } = await editor();
    const { id: fieldId } = await numberColumn(cookie);
    const response = await addPerson(cookie, { [fieldId]: number });
    expect(response.statusCode).toBe(400);
  });

  it("refuses a number in another type of column, and a note in a number column", async () => {
    const { cookie } = await editor();
    const { id: numberField } = await numberColumn(cookie);
    const noted = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Fictional Notes"),
      type: "note",
      visibility: "general",
    });
    const noteField = noted.json<{ field: Field }>().field.id;
    await test.approveLists();
    expect((await addPerson(cookie, { [noteField]: 3 })).statusCode).toBe(400);
    const id = await addedId(cookie);
    const response = await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [numberField]: "Words" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("are changed and removed by drafts, showing the live number beside", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await numberColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: 5 });
    await approve({ people: [id] });

    await send(cookie, "PATCH", `/api/people/${id}`, {
      numbers: { [fieldId]: 8 },
    });
    const drafted = await readPerson(cookie, id);
    expect(drafted?.numbers).toEqual({ [fieldId]: 8 });
    expect(drafted?.draft?.live.numbers).toEqual({ [fieldId]: 5 });

    await send(cookie, "PATCH", `/api/people/${id}`, {
      numbers: { [fieldId]: null },
    });
    await approve({ people: [id] });
    expect((await readPerson(cookie, id))?.numbers).toEqual({});
    expect(await numberRows(fieldId)).toEqual([]);
  });

  it("show no live number for someone who had none", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await numberColumn(cookie);
    const id = await addedId(cookie);
    await approve({ people: [id] });
    await send(cookie, "PATCH", `/api/people/${id}`, {
      numbers: { [fieldId]: 2 },
    });
    expect((await readPerson(cookie, id))?.draft?.live.numbers).toEqual({});
  });

  it("records nothing when a number is saved unchanged", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await numberColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: 0 });
    await approve({ people: [id] });
    const saved = await send(cookie, "PATCH", `/api/people/${id}`, {
      numbers: { [fieldId]: 0 },
    });
    expect(saved.json()).toEqual({ changeSetId: null });
  });

  it("come back as 0 when removing one is undone", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await numberColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: 0 });
    await approve({ people: [id] });
    const removed = await send(cookie, "PATCH", `/api/people/${id}`, {
      numbers: { [fieldId]: null },
    });
    const { changeSetId } = removed.json<{ changeSetId: string }>();
    const undone = await send(cookie, "POST", `/api/undo/${changeSetId}`);
    expect(undone.statusCode, undone.body).toBe(200);
    const person = await readPerson(cookie, id);
    expect(person?.numbers).toEqual({ [fieldId]: 0 });
    expect(person?.draft).toBeUndefined();
  });

  it("are recorded as removed when their column is deleted", async () => {
    const { cookie } = await editor();
    const field = await numberColumn(cookie);
    const id = await addedId(cookie, { [field.id]: 0 });
    await approve({ people: [id] });
    const deleted = await send(
      cookie,
      "DELETE",
      `/api/people/columns/${field.id}`,
    );
    expect(deleted.statusCode, deleted.body).toBe(200);
    await test.approveLists();
    const history = (
      await send(cookie, "GET", "/api/changes")
    ).json<ChangeHistory>();
    const removed = history.entries[0]?.records.find(
      ({ kind }) => kind === "person",
    );
    expect(removed?.fields).toEqual([
      { field: "value", column: field.name, oldValue: "0", newValue: null },
    ]);
    expect(await numberRows(field.id)).toEqual([]);
  });

  it("are shown in the change history as written", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await numberColumn(cookie);
    const id = await addedId(cookie, { [fieldId]: 5 });
    await approve({ people: [id] });
    // The history names the values of changes, not of people added.
    await send(cookie, "PATCH", `/api/people/${id}`, {
      numbers: { [fieldId]: 1234.5 },
    });
    const history = (
      await send(cookie, "GET", "/api/changes")
    ).json<ChangeHistory>();
    const fields = history.entries.flatMap((entry) =>
      entry.records.flatMap((record) => record.fields),
    );
    expect(fields.map(({ newValue }) => newValue)).toContain("1234.5");
  });
});

describe("planned hires' numbers", () => {
  it("are kept when added and changed, and refused on a column not offered", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await numberColumn(cookie);
    const added = await send(cookie, "POST", "/api/planned-hires", {
      hires: [
        {
          positionId: testPosition,
          targetDate: "2099-03-15",
          numbers: { [fieldId]: 3 },
        },
      ],
    });
    expect(added.statusCode, added.body).toBe(201);
    const id = String(added.json<{ ids: string[] }>().ids[0]);
    await send(cookie, "PATCH", `/api/planned-hires/${id}`, {
      numbers: { [fieldId]: 4 },
    });
    const read = await send(cookie, "GET", "/api/planned-hires");
    const hire = read
      .json<{ hires: { id: string; numbers: Record<string, number> }[] }>()
      .hires.find((one) => one.id === id);
    expect(hire?.numbers).toEqual({ [fieldId]: 4 });

    const peopleOnly = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Fictional Score"),
      type: "number",
      visibility: "general",
      onPlannedHires: false,
    });
    await test.approveLists();
    const refused = await send(cookie, "PATCH", `/api/planned-hires/${id}`, {
      numbers: { [peopleOnly.json<{ field: Field }>().field.id]: 1 },
    });
    expect(refused.statusCode).toBe(400);
  });

  it("show their live number beside a draft", async () => {
    const { cookie } = await editor();
    const { id: fieldId } = await numberColumn(cookie);
    const added = await send(cookie, "POST", "/api/planned-hires", {
      hires: [
        {
          positionId: testPosition,
          targetDate: "2099-03-15",
          numbers: { [fieldId]: 3 },
        },
      ],
    });
    const id = String(added.json<{ ids: string[] }>().ids[0]);
    await approve({ plannedHires: [id] });
    await send(cookie, "PATCH", `/api/planned-hires/${id}`, {
      numbers: { [fieldId]: 4 },
    });
    const read = await send(cookie, "GET", "/api/planned-hires");
    const hire = read
      .json<{
        hires: {
          id: string;
          draft?: { live: { numbers: Record<string, number> } };
        }[];
      }>()
      .hires.find((one) => one.id === id);
    expect(hire?.draft?.live.numbers).toEqual({ [fieldId]: 3 });
  });
});

describe("who sees a Confidential number column", () => {
  const secretNumber = 424242;
  let fieldId = "";
  let personId = "";

  beforeAll(async () => {
    const { cookie } = await editor();
    fieldId = (await numberColumn(cookie, { visibility: "confidential" })).id;
    personId = await addedId(cookie, { [fieldId]: 9 });
    await approve({ people: [personId] });
  });

  it.each(rolesGranting("people:view"))(
    "a %s, a role that sees people, sees its numbers only if the role lets them see Confidential data",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const person = await readPerson(cookie, personId);
      const sees = rolesGranting("confidential:view").includes(role);
      expect(Object.keys(person?.numbers ?? {}).includes(fieldId)).toBe(sees);
    },
  );

  it.each(rolesGranting("plan:view"))(
    "a %s, a role that sees the change history, sees changes to its numbers only if the role lets them see Confidential data",
    async (role) => {
      const { cookie: maker } = await editor();
      await send(maker, "PATCH", `/api/people/${personId}`, {
        numbers: { [fieldId]: secretNumber },
      });
      const { cookie } = await test.signedIn(role);
      const history = (
        await send(cookie, "GET", "/api/changes")
      ).json<ChangeHistory>();
      expect(JSON.stringify(history).includes(String(secretNumber))).toBe(
        rolesGranting("confidential:view").includes(role),
      );
    },
  );

  it("is left out of a planned hire's placeholder, where a General number is not", async () => {
    const { cookie } = await editor();
    const { id: general } = await numberColumn(cookie);
    const added = await send(cookie, "POST", "/api/planned-hires", {
      hires: [
        {
          positionId: testPosition,
          targetDate: "2099-03-15",
          numbers: { [fieldId]: 9, [general]: 2 },
        },
      ],
    });
    expect(added.statusCode, added.body).toBe(201);
    const id = String(added.json<{ ids: string[] }>().ids[0]);
    await approve({ plannedHires: [id] });
    const { cookie: planner } = await test.signedIn(generalReader);
    const read = await send(planner, "GET", "/api/planned-hires");
    const placeholder = read
      .json<{ hires: { id: string; numbers: Record<string, number> }[] }>()
      .hires.find((one) => one.id === id);
    expect(placeholder?.numbers).toEqual({ [general]: 2 });
  });

  it("refuses a number from someone who may change people but not Confidential data", async () => {
    const who = await test.signedIn(["people:edit", "people:view"]);
    const response = await send(
      who.cookie,
      "PATCH",
      `/api/people/${personId}`,
      { numbers: { [fieldId]: 1 } },
    );
    expect(response.statusCode).toBe(403);
  });
});
