// SPDX-License-Identifier: Apache-2.0

// Tests for note columns on the People table, against a migrated PostgreSQL server: adding them,
// with a visibility of their own; the notes people are given, refused unless notes allow them and
// kept exactly as sent; drafting, approving, and undoing them; how the change history shows them;
// and who sees them.

import { fieldValues, recordChanges, valueField } from "@fathom/db";
import {
  type ChangeHistory,
  type Field,
  noteLength,
  noteProblem,
  type Person,
} from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  type Method,
  startTestApp,
  type TestApp,
  testPosition,
  missingRecord,
} from "./test-app.ts";

let test: TestApp;

beforeAll(async () => {
  test = await startTestApp();
});

afterAll(async () => {
  await test.close();
});

let count = 0;

// A name or Employee ID no other test uses, so tests sharing the database do not collide.
function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

const kind = "Kind and *careful*, with [notes](https://notes.example.test/)";
const kindWords = "Kind and careful, with notes";

async function editor() {
  return test.signedIn("workforce-administrator");
}

async function send(
  cookie: string,
  method: Method,
  url: string,
  payload?: object,
) {
  return test.request(cookie, method, url, payload);
}

// A note column, approved so it is live.
async function noteColumn(
  cookie: string,
  settings: { visibility?: string; required?: boolean } = {},
): Promise<Field> {
  const response = await send(cookie, "POST", "/api/people/columns", {
    name: unique("Fictional Notes"),
    type: "note",
    visibility: settings.visibility ?? "general",
    required: settings.required ?? false,
  });
  expect(response.statusCode, response.body).toBe(201);
  await test.approveLists();
  return response.json<{ field: Field }>().field;
}

async function addPerson(cookie: string, notes: object = {}) {
  return send(cookie, "POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("E"),
        positionId: testPosition,
        notes,
      },
    ],
  });
}

async function addedId(cookie: string, notes: object = {}) {
  const response = await addPerson(cookie, notes);
  expect(response.statusCode, response.body).toBe(201);
  return String(response.json<{ ids: string[] }>().ids[0]);
}

async function approve(ids: readonly string[]) {
  const { cookie } = await test.signedIn("engineering-director");
  const response = await send(cookie, "POST", "/api/drafts/approval", {
    people: ids,
  });
  expect(response.statusCode, response.body).toBe(200);
}

async function readPeople(cookie: string) {
  const response = await send(cookie, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response.json<{ people: Person[]; fields: Field[] }>();
}

async function readPerson(cookie: string, id: string) {
  return (await readPeople(cookie)).people.find((person) => person.id === id);
}

async function noteRows(fieldId: string) {
  return test.connection
    .select({
      choiceId: fieldValues.choiceId,
      address: fieldValues.linkAddress,
      note: fieldValues.note,
    })
    .from(fieldValues)
    .where(eq(fieldValues.fieldId, fieldId));
}

async function latestFields(cookie: string) {
  const history = (
    await send(cookie, "GET", "/api/changes")
  ).json<ChangeHistory>();
  return history.entries[0]?.records[0]?.fields;
}

// First, while there is no one, so a column can be required from the start.
describe("a required note column", () => {
  it("must hold a note, which an empty one is not", async () => {
    const { cookie } = await editor();
    const required = await noteColumn(cookie, { required: true });
    const plans = await noteColumn(cookie);
    for (const empty of [{}, { [required.id]: "" }, { [required.id]: "  " }]) {
      const response = await addPerson(cookie, empty);
      expect(response.json()).toEqual({
        error: `${required.name} must be filled in`,
      });
    }
    const id = await addedId(cookie, {
      [required.id]: kind,
      [plans.id]: kind,
    });
    await approve([id]);
    const removed = await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [required.id]: null },
    });
    expect(removed.json()).toEqual({
      error: `${required.name} must be filled in`,
    });
    // A draft giving someone a note fills the column for them.
    await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [plans.id]: "Changed plans" },
    });
    const made = await send(cookie, "PUT", `/api/people/columns/${plans.id}`, {
      name: plans.name,
      type: "note",
      visibility: "general",
      required: true,
    });
    expect(made.statusCode, made.body).toBe(200);
    // Deleted, so the tests after this one need not fill them in.
    await approve([id]);
    for (const field of [required, plans]) {
      const gone = await send(
        cookie,
        "DELETE",
        `/api/people/columns/${field.id}`,
      );
      expect(gone.statusCode, gone.body).toBe(200);
    }
    await test.approveLists();
  });
});

describe("adding note columns", () => {
  it("adds one with a visibility of its own, and no list", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie, { visibility: "restricted" });
    expect(field).toMatchObject({
      type: "note",
      listId: null,
      visibility: "restricted",
      multiple: false,
    });
  });

  it.each([
    [{ visibility: undefined }, "Choose a visibility"],
    [{ listId: missingRecord }, "has no list"],
    [{ multiple: true }, "holds one note"],
  ])("refuses a note column with %j", async (settings, message) => {
    const { cookie } = await editor();
    const response = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Fictional Notes"),
      type: "note",
      visibility: "general",
      ...settings,
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain(message);
  });

  it("refuses changing a note column into a web link column", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const response = await send(
      cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      { name: field.name, type: "link", visibility: "general" },
    );
    expect(response.json()).toEqual({
      error: "A column's type cannot change",
    });
  });
});

describe("people's notes", () => {
  it("are kept exactly as sent, in their own column once approved", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const id = await addedId(cookie, { [field.id]: kind });
    expect((await readPerson(cookie, id))?.notes).toEqual({ [field.id]: kind });
    await approve([id]);
    expect(await noteRows(field.id)).toEqual([
      { choiceId: null, address: null, note: kind },
    ]);
    expect((await readPerson(cookie, id))?.notes).toEqual({ [field.id]: kind });
  });

  it.each([
    ["a heading four levels deep", "#### A heading"],
    ["a numbered list", "1. First"],
    ["HTML", "<b>Bold</b>"],
    ["a colour not in the palette", '<span data-colour="plaid">Odd</span>'],
    ["a link that is not a web address", "[Run](javascript:alert(1))"],
    ["too many characters", "x".repeat(noteLength + 1)],
  ])("refuses a note with %s, saying why", async (_holding, note) => {
    expect(noteProblem(note)).toBeDefined();
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const response = await addPerson(cookie, { [field.id]: note });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: noteProblem(note) });
  });

  it("keeps headings and checkboxes", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const id = await addedId(cookie);
    const note = "# Plans\n\n- [ ] Open\n- [x] Done";
    const response = await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [field.id]: note },
    });
    expect(response.statusCode).toBe(200);
    expect((await readPerson(cookie, id))?.notes).toEqual({ [field.id]: note });
  });

  it("refuses a note outside what notes allow in a change too", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const id = await addedId(cookie);
    const response = await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [field.id]: "> A quote" },
    });
    expect(response.json()).toEqual({ error: "A note can't hold quotes." });
  });

  it("keeps a note as long as notes allow", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const long = "x".repeat(noteLength);
    const id = await addedId(cookie, { [field.id]: long });
    await approve([id]);
    expect((await readPerson(cookie, id))?.notes).toEqual({ [field.id]: long });
  });

  it("refuses a note in another type of column, and choices in a note column", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const link = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Fictional Link"),
      type: "link",
      visibility: "general",
    });
    await test.approveLists();
    const inLink = await addPerson(cookie, {
      [link.json<{ field: Field }>().field.id]: kind,
    });
    expect(inLink.json()).toEqual({ error: "There is no such column" });
    const choices = await send(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("E"),
          positionId: testPosition,
          values: { [field.id]: [] },
        },
      ],
    });
    expect(choices.json()).toEqual({ error: "There is no such column" });
  });

  it("are changed and removed by drafts, showing the live note beside", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const id = await addedId(cookie, { [field.id]: kind });
    await approve([id]);
    const update = await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [field.id]: "Changed" },
    });
    expect(update.statusCode, update.body).toBe(200);
    const drafted = await readPerson(cookie, id);
    expect(drafted?.notes).toEqual({ [field.id]: "Changed" });
    expect(drafted?.draft).toMatchObject({
      changed: [field.id],
      live: { values: {}, links: {}, notes: { [field.id]: kind } },
    });
    await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [field.id]: "" },
    });
    expect((await readPerson(cookie, id))?.notes).toEqual({});
    await approve([id]);
    expect(await noteRows(field.id)).toEqual([]);
  });

  it("show no live note for someone who had none", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const id = await addedId(cookie);
    await approve([id]);
    await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [field.id]: kind },
    });
    expect((await readPerson(cookie, id))?.draft).toMatchObject({
      changed: [field.id],
      live: { values: {}, links: {}, notes: {} },
    });
  });

  it("records nothing when a note is saved unchanged", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const id = await addedId(cookie, { [field.id]: kind });
    const drafted = await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [field.id]: kind },
    });
    expect(drafted.json()).toEqual({ changeSetId: null });
    await approve([id]);
    const live = await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [field.id]: kind },
    });
    expect(live.json()).toEqual({ changeSetId: null });
  });

  it("come back when removing one is undone", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const id = await addedId(cookie, { [field.id]: kind });
    await approve([id]);
    const removed = await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [field.id]: null },
    });
    const { changeSetId } = removed.json<{ changeSetId: string }>();
    const undone = await send(cookie, "POST", `/api/undo/${changeSetId}`);
    expect(undone.statusCode, undone.body).toBe(200);
    const person = await readPerson(cookie, id);
    expect(person?.notes).toEqual({ [field.id]: kind });
    expect(person?.draft).toBeUndefined();
  });

  it("are shown in the change history by their words, without formatting", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const id = await addedId(cookie, { [field.id]: kind });
    await approve([id]);
    await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [field.id]: "- _First_\n- Second" },
    });
    expect(await latestFields(cookie)).toEqual([
      {
        field: "value",
        column: field.name,
        oldValue: kindWords,
        newValue: "First\nSecond",
      },
    ]);
    await send(cookie, "PATCH", `/api/people/${id}`, {
      notes: { [field.id]: null },
    });
    expect(await latestFields(cookie)).toEqual([
      {
        field: "value",
        column: field.name,
        oldValue: "First\nSecond",
        newValue: null,
      },
    ]);
  });

  it("are recorded as removed when their column is deleted", async () => {
    const { cookie } = await editor();
    const field = await noteColumn(cookie);
    const id = await addedId(cookie, { [field.id]: kind });
    await approve([id]);
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
      ({ kind: recordKind }) => recordKind === "person",
    );
    expect(removed?.fields).toEqual([
      {
        field: "value",
        column: field.name,
        oldValue: kindWords,
        newValue: null,
      },
    ]);
    expect(await noteRows(field.id)).toEqual([]);
  });
});

describe("who sees a Confidential note column", () => {
  const secret = "Secret review";
  let fieldId = "";
  let personId = "";

  beforeAll(async () => {
    const { cookie } = await editor();
    fieldId = (await noteColumn(cookie, { visibility: "confidential" })).id;
    personId = await addedId(cookie, { [fieldId]: kind });
    await approve([personId]);
    // The history names the values of changes, not of people added.
    const changed = await send(cookie, "PATCH", `/api/people/${personId}`, {
      notes: { [fieldId]: secret },
    });
    expect(changed.statusCode).toBe(200);
  });

  it.each(rolesGranting("people:view"))(
    "a %s, a role that sees people, sees the column and its notes only if the role lets them see Confidential data",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const read = await readPeople(cookie);
      const sees = rolesGranting("confidential:view").includes(role);
      expect(read.fields.some(({ id }) => id === fieldId)).toBe(sees);
      const person = read.people.find(({ id }) => id === personId);
      expect(Object.keys(person?.notes ?? {}).includes(fieldId)).toBe(sees);
      expect(JSON.stringify(person).includes(secret)).toBe(sees);
    },
  );

  it("refuses a note from someone who may change people but not Confidential data", async () => {
    const who = await test.signedIn(["people:edit", "people:view"]);
    const response = await send(
      who.cookie,
      "PATCH",
      `/api/people/${personId}`,
      {
        notes: { [fieldId]: "Overwritten" },
      },
    );
    expect([response.statusCode, response.json()]).toEqual([
      403,
      { error: "Forbidden" },
    ]);
  });

  it.each(rolesGranting("changes:view"))(
    "a %s, a role that sees the change history, sees changes to the notes only if the role lets them see Confidential data",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const history = (
        await send(cookie, "GET", "/api/changes")
      ).json<ChangeHistory>();
      const shown = JSON.stringify(history).includes(secret);
      expect(shown).toBe(rolesGranting("confidential:view").includes(role));
    },
  );
});

// Changes made to the live records rather than to drafts, as Fathom made before drafts, are undone
// by putting the live records back.
describe("undoing live changes", () => {
  it("puts a live note back", async () => {
    const { id: userId, cookie } = await editor();
    const field = await noteColumn(cookie);
    const id = await addedId(cookie, { [field.id]: kind });
    await approve([id]);
    const changeSetId = await test.connection.transaction(
      async (transaction) => {
        await transaction
          .update(fieldValues)
          .set({ note: "Changed" })
          .where(
            and(
              eq(fieldValues.personId, id),
              eq(fieldValues.fieldId, field.id),
            ),
          );
        return recordChanges(transaction, { userId, roleId: null }, [
          {
            recordType: "person",
            recordId: id,
            action: "changed",
            field: valueField(field.id),
            tier: "general",
            oldValue: kind,
            newValue: "Changed",
          },
        ]);
      },
    );
    const undone = await send(
      cookie,
      "POST",
      `/api/undo/${String(changeSetId)}`,
    );
    expect(undone.statusCode, undone.body).toBe(200);
    expect(await noteRows(field.id)).toEqual([
      { choiceId: null, address: null, note: kind },
    ]);
  });
});
