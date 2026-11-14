// SPDX-License-Identifier: Apache-2.0

// Tests for people and the columns on the People table, against a migrated PostgreSQL server: which
// roles may read and change them; who is listed and which details each user receives; adding,
// changing, and deleting people; adding, changing, ordering, and deleting columns; the refusals for
// duplicates, missing and unoffered values, and settings the data does not fit; lists and choices in
// use; and the change and access history every change records.

import {
  accessHistory,
  fieldValues,
  listItems,
  lists,
  people,
  plannedHires,
  recordChanges,
} from "@fathom/db";
import {
  type Choice,
  dayIn,
  defaultTimeZone,
  type Field,
  type List,
  type Person,
  roleSchema,
} from "@fathom/shared";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rolesGranting } from "./access.ts";
import { hiresHave, peopleHave } from "./data/fields.ts";
import {
  generalReader,
  type Method,
  startTestApp,
  type TestApp,
  testPosition,
  otherTestPosition,
} from "./test-app.ts";

// How long a test waits for something to happen, so a busy computer does not fail it.
const waitLimit = { timeout: 10_000 };

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

// A list with the given choices, and the choices in order.
async function listWith(
  cookie: string,
  labels: string[],
  visibility = "general",
): Promise<{ list: List; choices: Choice[] }> {
  const created = await send(cookie, "POST", "/api/lists", {
    name: unique("Fictional List"),
    visibility,
  });
  expect(created.statusCode).toBe(201);
  const list = created.json<{ list: List }>().list;
  const added = await send(cookie, "POST", `/api/lists/${list.id}/choices`, {
    choices: labels.map((label) => ({ label })),
  });
  expect(added.statusCode).toBe(201);
  await test.approveLists();
  return { list, choices: added.json<{ choices: Choice[] }>().choices };
}

// Approves the drafts of the columns given alone, so other drafts a test makes stay waiting.
async function approveColumns(...ids: string[]) {
  const approver = await test.signedIn("engineering-director");
  const response = await send(approver.cookie, "POST", "/api/drafts/approval", {
    columns: ids,
  });
  expect(response.statusCode, response.body).toBe(200);
}

async function addColumn(
  cookie: string,
  listId: string,
  settings: { multiple?: boolean; required?: boolean; name?: string } = {},
): Promise<{ field: Field; changeSetId: string }> {
  const response = await send(cookie, "POST", "/api/people/columns", {
    name: settings.name ?? unique("Fictional Column"),
    listId,
    multiple: settings.multiple ?? false,
    required: settings.required ?? false,
  });
  expect(response.statusCode).toBe(201);
  await test.approveLists();
  return response.json();
}

// A column drawing on a new list, with that list's choices.
async function columnWith(
  cookie: string,
  labels: string[],
  options: { multiple?: boolean; visibility?: string } = {},
) {
  const { list, choices } = await listWith(cookie, labels, options.visibility);
  const { field } = await addColumn(cookie, list.id, options);
  return { list, choices, field };
}

interface NewPerson {
  preferredName?: string;
  employeeId?: string;
  positionId?: string;
  startDate?: string | null;
  endDate?: string | null;
  values?: Record<string, string[]>;
}

function personRequest(person: NewPerson = {}) {
  return {
    preferredName: person.preferredName ?? unique("Fictional Person"),
    employeeId: person.employeeId ?? unique("E"),
    positionId: testPosition,
    ...person,
  };
}

async function addPeople(cookie: string, people: NewPerson[]) {
  const response = await send(cookie, "POST", "/api/people", {
    people: people.map(personRequest),
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ ids: string[]; changeSetId: string }>();
}

async function addPerson(cookie: string, person: NewPerson = {}) {
  const { ids, changeSetId } = await addPeople(cookie, [person]);
  return { id: String(ids[0]), changeSetId };
}

// Approves the drafts of the people given, as an Approver who sees every tier.
async function approve(ids: readonly string[]) {
  const { cookie } = await test.signedIn("engineering-director");
  const response = await send(cookie, "POST", "/api/drafts/approval", {
    people: ids,
  });
  expect(response.statusCode).toBe(200);
  return response.json<{ changeSetId: string }>().changeSetId;
}

// A person drafted and then approved, so they are live.
async function addLivePerson(cookie: string, person: NewPerson = {}) {
  const added = await addPerson(cookie, person);
  await approve([added.id]);
  return added;
}

async function readPeople(cookie: string) {
  const response = await send(cookie, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response.json<{
    people: Person[];
    fields: Field[];
    order: string[];
  }>();
}

async function readPerson(
  cookie: string,
  id: string,
): Promise<Person | undefined> {
  return (await readPeople(cookie)).people.find((person) => person.id === id);
}

async function undo(cookie: string, changeSetId: string) {
  return send(cookie, "POST", `/api/undo/${changeSetId}`);
}

// The latest access history entries for an account, newest first.
async function accessOf(actorId: string) {
  return test.connection
    .select({
      action: accessHistory.action,
      subjectId: accessHistory.subjectId,
    })
    .from(accessHistory)
    .where(
      and(
        eq(accessHistory.actorId, actorId),
        ne(accessHistory.action, "signed-in"),
      ),
    )
    .orderBy(desc(accessHistory.id));
}

describe("who may read and change people", () => {
  it.each(roleSchema.options)(
    "a %s may read people only if the role lets them see people",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const response = await send(cookie, "GET", "/api/people");
      expect(response.statusCode).toBe(
        rolesGranting("people:view").includes(role) ? 200 : 403,
      );
    },
  );

  const person = `/api/people/${randomUUID()}`;
  const column = `/api/people/columns/${randomUUID()}`;
  const peopleChanges: [Method, string, object | undefined][] = [
    ["POST", "/api/people", { people: [personRequest()] }],
    ["PATCH", person, { preferredName: "Fictional" }],
    ["DELETE", person, undefined],
    ["DELETE", `${person}/draft`, undefined],
    ["DELETE", `${person}/draft/rejection`, undefined],
  ];
  const columnChanges: [Method, string, object | undefined][] = [
    [
      "POST",
      "/api/people/columns",
      { name: "Fictional", listId: randomUUID() },
    ],
    ["PUT", column, { name: "Fictional", listId: randomUUID() }],
    ["DELETE", column, undefined],
  ];
  const refused = (permission: "people:edit" | "configuration:edit") =>
    roleSchema.options.filter(
      (role) => !rolesGranting(permission).includes(role),
    );

  it.each([
    ...peopleChanges.flatMap((change) =>
      refused("people:edit").map((role) => [role, ...change] as const),
    ),
    ...columnChanges.flatMap((change) =>
      refused("configuration:edit").map((role) => [role, ...change] as const),
    ),
  ])("refuses a %s %s %s", async (role, method, url, payload) => {
    const { cookie } = await test.signedIn(role);
    const response = await send(cookie, method, url, payload);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Forbidden" });
  });

  // Approving and rejecting people's drafts need people:approve, which each other role is tried
  // without.
  const decisions: [Method, string, object, string][] = [
    [
      "POST",
      "/api/drafts/approval",
      { people: [randomUUID()] },
      "This role can't approve drafts of people",
    ],
    [
      "POST",
      "/api/drafts/rejection",
      { people: [randomUUID()], reason: "Fictional" },
      "This role can't reject drafts of people",
    ],
  ];
  it.each(
    decisions.flatMap((decision) =>
      roleSchema.options
        .filter((role) => !rolesGranting("people:approve").includes(role))
        .map((role) => [role, ...decision] as const),
    ),
  )("refuses a %s %s %s", async (role, method, url, payload, error) => {
    const { cookie } = await test.signedIn(role);
    const response = await send(cookie, method, url, payload);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error });
  });

  // Saved views need only seeing people, so each role is tried on its own.
  const view = `/api/views/people/${randomUUID()}`;
  const viewChanges: [Method, string, object | undefined][] = [
    [
      "POST",
      "/api/views/people",
      { name: "Fictional", scope: "personal", definition: {} },
    ],
    ["PUT", view, { name: "Fictional" }],
    ["DELETE", view, undefined],
  ];
  it.each(
    viewChanges.flatMap((change) =>
      roleSchema.options
        .filter((role) => !rolesGranting("people:view").includes(role))
        .map((role) => [role, ...change] as const),
    ),
  )("refuses a %s %s %s", async (role, method, url, payload) => {
    const { cookie } = await test.signedIn(role);
    const response = await send(cookie, method, url, payload);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Forbidden" });
  });
});

describe("signed-out requests", () => {
  it.each([
    ["GET", "/api/people"],
    ["GET", "/api/org-chart"],
    ["POST", "/api/people"],
    ["PATCH", `/api/people/${randomUUID()}`],
    ["DELETE", `/api/people/${randomUUID()}`],
    ["DELETE", `/api/people/${randomUUID()}/draft`],
    ["DELETE", `/api/people/${randomUUID()}/draft/rejection`],
    ["POST", "/api/drafts/approval"],
    ["POST", "/api/drafts/rejection"],
    ["POST", "/api/people/columns"],
    ["PUT", `/api/people/columns/${randomUUID()}`],
    ["DELETE", `/api/people/columns/${randomUUID()}`],
    ["POST", "/api/views/people"],
    ["PUT", `/api/views/people/${randomUUID()}`],
    ["DELETE", `/api/views/people/${randomUUID()}`],
    ["POST", `/api/undo/${randomUUID()}`],
  ] as [Method, string][])(
    "refuses %s %s without a session",
    async (method, url) => {
      const response = await test.app.inject({
        method,
        url,
        headers: { origin: "https://fathom.example.test" },
        ...(method === "GET" ? {} : { payload: {} }),
      });
      expect(response.statusCode).toBe(401);
    },
  );
});

describe("who sees Confidential values", () => {
  let fieldId = "";
  let personId = "";

  beforeAll(async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["Secret"], {
      visibility: "confidential",
    });
    fieldId = field.id;
    personId = (
      await addPerson(cookie, {
        values: { [field.id]: [String(choices[0]?.id)] },
      })
    ).id;
  });

  it.each(rolesGranting("people:view"))(
    "a %s, a role that sees people, sees a Confidential column's values only if the role lets them see Confidential data",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const read = await readPeople(cookie);
      const sees = rolesGranting("confidential:view").includes(role);
      expect(read.fields.some(({ id }) => id === fieldId)).toBe(sees);
      const person = read.people.find(({ id }) => id === personId);
      expect(Object.keys(person?.values ?? {}).includes(fieldId)).toBe(sees);
    },
  );
});

describe("who is listed and what each user sees", () => {
  // Today in Fathom's time zone, which decides who is current.
  const today = () => dayIn(defaultTimeZone);

  it("shows users who cannot see Personal details only people current today, without dates or Personal values", async () => {
    const { cookie } = await editor();
    const general = await columnWith(cookie, ["Fictional General"]);
    const personalColumn = await columnWith(cookie, ["Fictional Personal"], {
      visibility: "personal",
    });
    const values = {
      [general.field.id]: [String(general.choices[0]?.id)],
      [personalColumn.field.id]: [String(personalColumn.choices[0]?.id)],
    };
    const { ids } = await addPeople(cookie, [
      { startDate: "2020-01-01", values },
      { startDate: null, values },
      { startDate: "2020-01-01", endDate: today() },
      { startDate: "2020-01-01", endDate: "2021-01-01" },
      { startDate: "2999-01-01" },
    ]);
    const viewer = await test.signedIn(generalReader);
    const seen = await readPeople(viewer.cookie);
    const listed = seen.people.filter((person) => ids.includes(person.id));
    expect(listed.map((person) => ids.indexOf(person.id)).sort()).toEqual([
      0, 1, 2,
    ]);
    expect(listed[0]).not.toHaveProperty("startDate");
    expect(listed.find(({ id }) => id === ids[2])).not.toHaveProperty(
      "endDate",
    );
    expect(listed.find(({ id }) => id === ids[0])?.values).toEqual({
      [general.field.id]: values[general.field.id],
    });
    expect(seen.fields.map(({ id }) => id)).toContain(general.field.id);
    expect(seen.fields.map(({ id }) => id)).not.toContain(
      personalColumn.field.id,
    );
    expect(await accessOf(viewer.id)).toEqual([]);

    const manager = await test.signedIn("engineering-manager");
    const all = await readPeople(manager.cookie);
    const managed = all.people.filter((person) => ids.includes(person.id));
    expect(managed).toHaveLength(5);
    expect(managed.find(({ id }) => id === ids[0])).toMatchObject({
      startDate: "2020-01-01",
      endDate: null,
      values,
    });
    expect(await accessOf(manager.id)).toEqual([
      { action: "personal-viewed", subjectId: null },
    ]);
  });

  it("records a view when the only Personal details are in a column, and not when there is no one", async () => {
    const leadership = await test.signedIn("executive");
    const { cookie } = await editor();
    await columnWith(cookie, ["Fictional Confidential"], {
      visibility: "confidential",
    });
    await addPerson(cookie);
    const read = await readPeople(leadership.cookie);
    expect(read.people.length).toBeGreaterThan(0);
    expect(await accessOf(leadership.id)).toHaveLength(1);
  });

  it("orders people by preferred name, ignoring letter case", async () => {
    const { cookie } = await editor();
    const prefix = unique("Ordered");
    const { ids } = await addPeople(cookie, [
      { preferredName: `${prefix} b` },
      { preferredName: `${prefix} A` },
    ]);
    const names = (await readPeople(cookie)).people
      .filter(({ id }) => ids.includes(id))
      .map(({ preferredName }) => preferredName);
    expect(names).toEqual([`${prefix} A`, `${prefix} b`]);
  });
});

describe("adding people", () => {
  it("adds several people at once, with their values in the list's order, recording each field's tier", async () => {
    const { cookie, id: editorId } = await editor();
    const { field, choices } = await columnWith(
      cookie,
      ["First", "Second", "Third"],
      { multiple: true, visibility: "personal" },
    );
    const [first, , third] = choices.map(({ id }) => id);
    const { ids, changeSetId } = await addPeople(cookie, [
      {
        startDate: "2024-03-01",
        values: { [field.id]: [String(third), String(first)] },
      },
      {},
    ]);
    expect(ids).toHaveLength(2);
    expect(changeSetId).toEqual(expect.any(String));
    const person = await readPerson(cookie, String(ids[0]));
    expect(person?.values).toEqual({ [field.id]: [first, third] });
    const history = await test.historyOf(String(ids[0]));
    expect(
      history.map(({ action, field: name, tier }) => [action, name, tier]),
    ).toEqual([
      ["created", "preferredName", "general"],
      ["created", "employeeId", "general"],
      ["created", "positionId", "general"],
      ["created", "startDate", "personal"],
      ["created", `value:${field.id}`, "personal"],
    ]);
    const access = await accessOf(editorId);
    expect(
      access.filter(({ action }) => action === "personal-changed"),
    ).toEqual([{ action: "personal-changed", subjectId: ids[0] }]);
  });

  it("refuses an Employee ID already used, ignoring letter case, saving none of the people sent with it", async () => {
    const { cookie } = await editor();
    const employeeId = unique("Duplicate");
    await addPerson(cookie, { employeeId });
    const name = unique("Not Saved");
    const response = await send(cookie, "POST", "/api/people", {
      people: [
        personRequest({ preferredName: name }),
        personRequest({ employeeId: employeeId.toLowerCase() }),
      ],
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "Someone already has that ID",
    });
    expect(
      (await readPeople(cookie)).people.some(
        ({ preferredName }) => preferredName === name,
      ),
    ).toBe(false);
  });

  it.each([
    [{ preferredName: " " }],
    [{ employeeId: "" }],
    [{ employeeId: "x".repeat(41) }],
    [{ startDate: "31/10/2026" }],
  ])("refuses details that are missing or not valid: %j", async (details) => {
    const { cookie } = await editor();
    const response = await send(cookie, "POST", "/api/people", {
      people: [{ ...personRequest(), ...details }],
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses an end date before the start date", async () => {
    const { cookie } = await editor();
    const response = await send(cookie, "POST", "/api/people", {
      people: [
        personRequest({ startDate: "2026-05-02", endDate: "2026-05-01" }),
      ],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "The end date cannot be before the start date",
    });
  });

  it("refuses values that do not fit their column", async () => {
    const { cookie } = await editor();
    const { field, choices, list } = await columnWith(cookie, ["A", "B"]);
    const other = await listWith(cookie, ["Elsewhere"]);
    const retired = choices[1];
    await send(
      cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(retired?.id)}/retired`,
      { retired: true },
    );
    await test.approveLists();
    const attempts: [Record<string, string[]>, string][] = [
      [{ [randomUUID()]: [] }, "There is no such column"],
      [
        { [field.id]: [String(other.choices[0]?.id)] },
        `Choose ${field.name} from the column's list`,
      ],
      [
        { [field.id]: [randomUUID()] },
        `Choose ${field.name} from the column's list`,
      ],
      [
        { [field.id]: [String(retired?.id)] },
        `Choose a ${field.name} that is offered`,
      ],
    ];
    for (const [values, error] of attempts) {
      const response = await send(cookie, "POST", "/api/people", {
        people: [personRequest({ values })],
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error });
    }
    // Choices that are not identifiers, or the same choice twice, are refused before they are read.
    for (const values of [
      { [field.id]: ["not-a-choice"] },
      { "not-a-column": [String(choices[0]?.id)] },
      { [field.id]: [String(choices[0]?.id), String(choices[0]?.id)] },
    ]) {
      const response = await send(cookie, "POST", "/api/people", {
        people: [personRequest({ values })],
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it("refuses several choices for a column that takes one", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A", "B"]);
    const response = await send(cookie, "POST", "/api/people", {
      people: [
        personRequest({ values: { [field.id]: choices.map(({ id }) => id) } }),
      ],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: `${field.name} takes one choice`,
    });
  });

  it("refuses new values from a retired list", async () => {
    const { cookie } = await editor();
    const { list, field, choices } = await columnWith(cookie, ["A"]);
    await test.connection.execute(
      // Lists a column draws on cannot be retired through Fathom; this one was retired before.
      `UPDATE fathom.lists SET retired = true WHERE id = '${list.id}'`,
    );
    const response = await send(cookie, "POST", "/api/people", {
      people: [
        personRequest({ values: { [field.id]: [String(choices[0]?.id)] } }),
      ],
    });
    expect(response.statusCode).toBe(400);
    await test.connection.execute(
      `UPDATE fathom.lists SET retired = false WHERE id = '${list.id}'`,
    );
  });
});

describe("changing and deleting people", () => {
  it("changes some details, replacing a column's choices, and keeps a retired choice a person already has", async () => {
    const { cookie } = await editor();
    const { field, choices, list } = await columnWith(cookie, ["A", "B"], {
      multiple: true,
    });
    const [a, b] = choices.map(({ id }) => id);
    const { id } = await addPerson(cookie, {
      values: { [field.id]: [String(a)] },
    });
    await send(
      cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(a)}/retired`,
      { retired: true },
    );
    await test.approveLists();
    const response = await send(cookie, "PATCH", `/api/people/${id}`, {
      preferredName: "Fictional Renamed",
      employeeId: unique("Changed"),
      positionId: testPosition,
      startDate: "2025-01-01",
      endDate: "2026-01-01",
      values: { [field.id]: [String(b), String(a)] },
    });
    expect(response.statusCode).toBe(200);
    expect(await readPerson(cookie, id)).toMatchObject({
      preferredName: "Fictional Renamed",
      startDate: "2025-01-01",
      endDate: "2026-01-01",
      values: { [field.id]: [a, b] },
    });
    expect(
      (await test.historyOf(id)).slice(-5).map(({ field: name }) => name),
    ).toEqual([
      "preferredName",
      "employeeId",
      "startDate",
      "endDate",
      `value:${field.id}`,
    ]);
  });

  it("records nothing when nothing changes, and clears a column with no choices", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A"]);
    const { id } = await addPerson(cookie, {
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const same = await send(cookie, "PATCH", `/api/people/${id}`, {});
    expect(same.json()).toEqual({ changeSetId: null });
    await send(cookie, "PATCH", `/api/people/${id}`, {
      values: { [field.id]: [] },
    });
    expect((await readPerson(cookie, id))?.values).toEqual({});
  });

  it("refuses a change that leaves a required column empty, and a person who does not exist", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A"]);
    const { id } = await addPerson(cookie, {
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    // Everyone in this test's database must have a value before the column can be required.
    await test.connection.execute(
      `UPDATE fathom.fields SET required = true WHERE id = '${field.id}'`,
    );
    const cleared = await send(cookie, "PATCH", `/api/people/${id}`, {
      values: { [field.id]: [] },
    });
    expect(cleared.statusCode).toBe(400);
    expect(cleared.json()).toEqual({
      error: `${field.name} must be filled in`,
    });
    await test.connection.execute(
      `UPDATE fathom.fields SET required = false WHERE id = '${field.id}'`,
    );
    for (const method of ["PATCH", "DELETE"] as const) {
      const missing = await send(
        cookie,
        method,
        `/api/people/${randomUUID()}`,
        {},
      );
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: "There is no such person" });
    }
  });

  it("deletes a person with their values, recording everything they held", async () => {
    const { cookie, id: editorId } = await editor();
    const { field, choices } = await columnWith(cookie, ["A"]);
    const { id } = await addPerson(cookie, {
      endDate: "2030-01-01",
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const response = await send(cookie, "DELETE", `/api/people/${id}`);
    expect(response.statusCode).toBe(200);
    expect(await readPerson(cookie, id)).toBeUndefined();
    const left = await test.connection
      .select()
      .from(fieldValues)
      .where(eq(fieldValues.personId, id));
    expect(left).toHaveLength(0);
    expect(
      (await test.historyOf(id))
        .filter(({ action }) => action === "deleted")
        .map(({ field: name }) => name),
    ).toEqual([
      "preferredName",
      "employeeId",
      "positionId",
      "endDate",
      `value:${field.id}`,
    ]);
    expect(
      (await accessOf(editorId)).find(
        ({ action }) => action === "personal-changed",
      ),
    ).toEqual({
      action: "personal-changed",
      subjectId: id,
    });
  });
});

describe("positions and IDs", () => {
  it("gives a person a position from the Positions list, and changes it", async () => {
    const { cookie } = await editor();
    const { id } = await addLivePerson(cookie);
    expect((await readPerson(cookie, id))?.positionId).toBe(testPosition);
    const changed = await send(cookie, "PATCH", `/api/people/${id}`, {
      positionId: otherTestPosition,
    });
    expect(changed.statusCode).toBe(200);
    expect(await readPerson(cookie, id)).toMatchObject({
      positionId: otherTestPosition,
      draft: {
        changed: ["positionId"],
        live: { positionId: testPosition },
      },
    });
  });

  it("refuses a position from another list, one that is not a choice, or one retired", async () => {
    const { cookie } = await editor();
    const [positions] = await test.connection
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.builtIn, "positions"));
    const [retired] = await test.connection
      .insert(listItems)
      .values({
        listId: String(positions?.id),
        label: unique("Fictional Retired Position"),
        retired: true,
      })
      .returning({ id: listItems.id });
    const [state] = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(eq(lists.builtIn, "hiring-states"));
    for (const positionId of [
      String(state?.id),
      randomUUID(),
      String(retired?.id),
    ]) {
      const response = await send(cookie, "POST", "/api/people", {
        people: [personRequest({ positionId })],
      });
      expect(response.statusCode).toBe(400);
    }
    const { id } = await addPerson(cookie);
    expect(
      (
        await send(cookie, "PATCH", `/api/people/${id}`, {
          positionId: String(retired?.id),
        })
      ).statusCode,
    ).toBe(400);
  });

  it("refuses an Employee ID that looks like a temporary ID, or that a planned hire's requisition already is", async () => {
    const { cookie } = await editor();
    const tbd = await send(cookie, "POST", "/api/people", {
      people: [personRequest({ employeeId: "tbd-4" })],
    });
    expect(tbd.statusCode).toBe(400);
    const requisition = unique("Fictional-REQ");
    const [open] = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(eq(lists.builtIn, "hiring-states"));
    await test.connection.insert(plannedHires).values({
      requisition,
      positionId: testPosition,
      stateId: String(open?.id),
    });
    const added = await send(cookie, "POST", "/api/people", {
      people: [personRequest({ employeeId: requisition.toLowerCase() })],
    });
    expect(added.statusCode).toBe(409);
    const { id } = await addPerson(cookie);
    const changed = await send(cookie, "PATCH", `/api/people/${id}`, {
      employeeId: requisition,
    });
    expect(changed.statusCode).toBe(409);
  });
});

describe("columns", () => {
  it("adds columns at the end, and changes their settings", async () => {
    const { cookie } = await editor();
    const { list } = await listWith(cookie, ["A"]);
    const first = (await addColumn(cookie, list.id)).field;
    const second = (await addColumn(cookie, list.id, { multiple: true })).field;
    const order = async () =>
      (await readPeople(cookie)).order.filter((key) =>
        [first.id, second.id].includes(key),
      );
    expect(await order()).toEqual([first.id, second.id]);
    const renamed = await send(
      cookie,
      "PUT",
      `/api/people/columns/${first.id}`,
      {
        name: "Fictional Renamed Column",
        listId: list.id,
        multiple: true,
        required: false,
      },
    );
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<{ field: Field }>().field).toMatchObject({
      name: "Fictional Renamed Column",
      multiple: true,
    });
    const same = await send(cookie, "PUT", `/api/people/columns/${first.id}`, {
      name: "Fictional Renamed Column",
      listId: list.id,
      multiple: true,
    });
    expect(same.json<{ changeSetId: null }>().changeSetId).toBeNull();
  });

  it("shows each user only the columns they see, in the table's own order", async () => {
    const { cookie } = await editor();
    const { field } = await columnWith(cookie, ["A"]);
    const order = (await readPeople(cookie)).order;
    expect(order.at(-1)).toBe(field.id);
    expect(order).toEqual(expect.arrayContaining(["startDate", "endDate"]));
    const viewer = await test.signedIn(generalReader);
    const seen = (await readPeople(viewer.cookie)).order;
    expect(seen).not.toContain("startDate");
    expect(seen).toContain("employeeId");
  });

  it("refuses a column name already used, ignoring letter case, and lists that are missing or retired", async () => {
    const { cookie } = await editor();
    const { list } = await listWith(cookie, ["A"]);
    const name = unique("Taken Column");
    await addColumn(cookie, list.id, { name });
    const taken = await send(cookie, "POST", "/api/people/columns", {
      name: name.toUpperCase(),
      listId: list.id,
    });
    expect(taken.statusCode).toBe(409);
    expect(taken.json()).toEqual({
      error: "There is already a column with that name",
    });
    const missing = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Column"),
      listId: randomUUID(),
    });
    expect(missing.json()).toEqual({ error: "There is no such list" });
    const retired = await listWith(cookie, ["A"]);
    await send(cookie, "PUT", `/api/lists/${retired.list.id}/retired`, {
      retired: true,
    });
    await test.approveLists();
    const onRetired = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Column"),
      listId: retired.list.id,
    });
    expect(onRetired.statusCode).toBe(400);
    expect(onRetired.json()).toEqual({
      error: "Choose a list that is not retired",
    });
  });

  it("refuses settings the people in Fathom do not fit", async () => {
    const { cookie } = await editor();
    const { field, choices, list } = await columnWith(cookie, ["A", "B"], {
      multiple: true,
    });
    await addLivePerson(cookie, {
      values: { [field.id]: choices.map(({ id }) => id) },
    });
    const other = await listWith(cookie, ["Elsewhere"]);
    const settings = { name: field.name, listId: list.id, multiple: true };
    const attempts: [object, RegExp][] = [
      [{ ...settings, multiple: false }, /^1 person has several choices for/],
      [{ ...settings, listId: other.list.id }, /so its list cannot change$/],
    ];
    for (const [request, error] of attempts) {
      const response = await send(
        cookie,
        "PUT",
        `/api/people/columns/${field.id}`,
        request,
      );
      expect(response.statusCode).toBe(409);
      expect(response.json<{ error: string }>().error).toMatch(error);
    }
    // Which people, live or drafted, keep a column from being required is tried in columns.test.ts,
    // with a database of its own.
    const required = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Required"),
      listId: list.id,
      required: true,
    });
    expect(required.statusCode).toBe(409);
  });

  it("counts people in words", () => {
    expect([1, 2].map(peopleHave)).toEqual(["1 person has", "2 people have"]);
    expect([1, 2].map(hiresHave)).toEqual([
      "1 planned hire has",
      "2 planned hires have",
    ]);
  });

  it("lets a column without values change its list, and refuses ones that do not exist", async () => {
    const { cookie } = await editor();
    const { field, list } = await columnWith(cookie, ["A"]);
    const other = await listWith(cookie, ["B"]);
    const changed = await send(
      cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      {
        name: field.name,
        listId: other.list.id,
      },
    );
    expect(changed.statusCode).toBe(200);
    const unknown = `/api/people/columns/${randomUUID()}`;
    for (const [method, url, payload] of [
      ["PUT", unknown, { name: "Fictional", listId: list.id }],
      ["DELETE", unknown, undefined],
    ] as [Method, string, object | undefined][]) {
      const response = await send(cookie, method, url, payload);
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    }
  });

  it("deletes a column with its values once approved, recording them on each person", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A"], {
      visibility: "personal",
    });
    const { id } = await addLivePerson(cookie, {
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const response = await send(
      cookie,
      "DELETE",
      `/api/people/columns/${field.id}`,
    );
    expect(response.statusCode).toBe(200);
    // A draft until approved, by an Approver who sees the values it deletes.
    expect((await readPerson(cookie, id))?.values).not.toEqual({});
    const approver = await test.signedIn("engineering-director");
    expect(
      (
        await send(approver.cookie, "POST", "/api/drafts/approval", {
          columns: [field.id],
        })
      ).statusCode,
    ).toBe(200);
    expect((await readPerson(cookie, id))?.values).toEqual({});
    expect((await test.historyOf(id)).at(-1)).toMatchObject({
      action: "changed",
      field: `value:${field.id}`,
      tier: "personal",
      oldValue: [choices[0]?.id],
      newValue: null,
    });
    expect(
      (await accessOf(approver.id)).find(
        ({ action }) => action === "personal-changed",
      ),
    ).toEqual({
      action: "personal-changed",
      subjectId: id,
    });
  });
});

describe("access history", () => {
  // The entries an account's history reader sees for one actor.
  async function entriesBy(reader: string, actorId: string) {
    const response = await send(reader, "GET", "/api/access-history");
    return response
      .json<{
        entries: {
          action: string;
          actor: { id: string } | null;
          subject: { id: string; name: string | null } | null;
        }[];
      }>()
      .entries.filter(
        // Reading People also reads the planned hires other tests add, which hires.test.ts covers.
        ({ actor, action }) =>
          actor?.id === actorId &&
          action !== "hiring-plan-viewed" &&
          action !== "signed-in",
      )
      .map(({ action, subject }) => [action, subject]);
  }

  it("records a view of Personal details once a day, and names whose details changed only to readers who may see people", async () => {
    const { cookie, id: editorId } = await editor();
    const name = unique("Fictional Named");
    const { id } = await addLivePerson(cookie, {
      preferredName: name,
      startDate: "2023-01-01",
    });
    await readPeople(cookie);
    await readPeople(cookie);
    const administrator = await test.signedIn("administrator");
    expect(await entriesBy(administrator.cookie, editorId)).toEqual([
      ["personal-viewed", null],
      // A person has no account, so no email address.
      ["personal-changed", { id, name: null, email: null }],
    ]);
    const seesPeople = await test.signedIn([
      "administration:view",
      "people:view",
    ]);
    expect(await entriesBy(seesPeople.cookie, editorId)).toEqual([
      ["personal-viewed", null],
      ["personal-changed", { id, name, email: null }],
    ]);
  });
});

describe("lists and choices in use", () => {
  it("refuses to retire or delete a list a column draws on, or remove a choice someone has", async () => {
    const { cookie } = await editor();
    const { list, field, choices } = await columnWith(cookie, ["A", "B"]);
    await addColumn(cookie, list.id, { name: unique("Second Column") });
    await addPerson(cookie, {
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    for (const [method, url, payload] of [
      ["PUT", `/api/lists/${list.id}/retired`, { retired: true }],
      ["DELETE", `/api/lists/${list.id}`, undefined],
    ] as [Method, string, object | undefined][]) {
      const response = await send(cookie, method, url, payload);
      expect(response.statusCode).toBe(409);
      expect(response.json<{ error: string }>().error).toMatch(
        /^This list cannot be (retired|deleted) while columns draw on it: /,
      );
    }
    const removed = await send(
      cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`,
    );
    expect(removed.statusCode).toBe(409);
    expect(removed.json()).toEqual({
      error:
        "This choice cannot be removed while it is in use; retire it instead",
    });
    const unused = await send(
      cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choices[1]?.id)}`,
    );
    expect(unused.statusCode).toBe(200);
  });

  it("names the one column a list is used by", async () => {
    const { cookie } = await editor();
    const { list, field } = await columnWith(cookie, ["A"]);
    const response = await send(cookie, "DELETE", `/api/lists/${list.id}`);
    expect(response.json()).toEqual({
      error: `This list cannot be deleted while a column draws on it: ${field.name}`,
    });
  });
});

describe("undo", () => {
  it("undoes adding people, deleting them again", async () => {
    const { cookie } = await editor();
    const { ids, changeSetId } = await addPeople(cookie, [{}, {}]);
    const response = await undo(cookie, changeSetId);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      changeSetId: expect.any(String) as unknown,
    });
    const listed = (await readPeople(cookie)).people.map(({ id }) => id);
    expect(listed.some((id) => ids.includes(id))).toBe(false);
    expect((await test.historyOf(String(ids[0]))).at(-1)).toMatchObject({
      action: "deleted",
    });
  });

  it("undoes a change to a person, putting back their details and values", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A", "B"]);
    const [a = "", b = ""] = choices.map(({ id }) => id);
    const { id } = await addPerson(cookie, {
      preferredName: "Fictional Before",
      startDate: "2024-01-01",
      values: { [field.id]: [a] },
    });
    const changed = await send(cookie, "PATCH", `/api/people/${id}`, {
      preferredName: "Fictional After",
      startDate: null,
      values: { [field.id]: [b] },
    });
    await undo(cookie, changed.json<{ changeSetId: string }>().changeSetId);
    expect(await readPerson(cookie, id)).toMatchObject({
      preferredName: "Fictional Before",
      startDate: "2024-01-01",
      values: { [field.id]: [a] },
    });
    // A column the person had no value for is emptied again.
    const other = await columnWith(cookie, ["C"]);
    const given = await send(cookie, "PATCH", `/api/people/${id}`, {
      values: { [other.field.id]: [String(other.choices[0]?.id)] },
    });
    await undo(cookie, given.json<{ changeSetId: string }>().changeSetId);
    expect((await readPerson(cookie, id))?.values).toEqual({
      [field.id]: [a],
    });
  });

  it("undoes deleting a person, bringing them back with the same identifier and values", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A"], {
      multiple: true,
    });
    const { id } = await addLivePerson(cookie, {
      endDate: "2031-01-01",
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const before = await readPerson(cookie, id);
    const deleted = await send(cookie, "DELETE", `/api/people/${id}`);
    await undo(cookie, deleted.json<{ changeSetId: string }>().changeSetId);
    expect(await readPerson(cookie, id)).toEqual(before);
  });

  it("undoes drafting changing, moving, and deleting a column, putting back its values and place", async () => {
    const { cookie } = await editor();
    const { list, choices } = await listWith(cookie, ["A"]);
    const first = await addColumn(cookie, list.id);
    const second = await addColumn(cookie, list.id);
    const ids = [first.field.id, second.field.id];
    const order = async () =>
      (await readPeople(cookie)).order.filter((key) => ids.includes(key));
    const { id: personId } = await addPerson(cookie, {
      values: { [first.field.id]: [String(choices[0]?.id)] },
    });

    const renamed = await send(
      cookie,
      "PUT",
      `/api/people/columns/${first.field.id}`,
      {
        name: unique("Renamed"),
        listId: list.id,
        multiple: true,
      },
    );
    await undo(cookie, renamed.json<{ changeSetId: string }>().changeSetId);
    expect(
      (await readPeople(cookie)).fields.find(({ id }) => id === first.field.id),
    ).toEqual(first.field);

    const deleted = await send(
      cookie,
      "DELETE",
      `/api/people/columns/${first.field.id}`,
    );
    await undo(cookie, deleted.json<{ changeSetId: string }>().changeSetId);
    expect(await order()).toEqual(ids);
    expect((await readPerson(cookie, personId))?.values).toEqual({
      [first.field.id]: [choices[0]?.id],
    });

    // Drafting a column's addition cannot be undone once it is approved.
    expect((await undo(cookie, second.changeSetId)).statusCode).toBe(409);
  });

  it("undoes list changes in one call: deleting a list brings back its choices in order", async () => {
    const { cookie } = await editor();
    const { list, choices } = await listWith(cookie, ["A", "B", "C"]);
    await send(
      cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(choices[1]?.id)}/retired`,
      { retired: true },
    );
    const before = (await send(cookie, "GET", "/api/lists"))
      .json<{ lists: List[] }>()
      .lists.find(({ id }) => id === list.id);
    const deleted = await send(cookie, "DELETE", `/api/lists/${list.id}`);
    await undo(cookie, deleted.json<{ changeSetId: string }>().changeSetId);
    const after = (await send(cookie, "GET", "/api/lists"))
      .json<{ lists: List[] }>()
      .lists.find(({ id }) => id === list.id);
    expect(after).toEqual(before);
  });

  it("undoes removing, retiring, restoring, moving, and editing choices, and editing and retiring lists", async () => {
    const { cookie } = await editor();
    const { list, choices } = await listWith(cookie, ["A", "B", "C"]);
    const url = (choice: Choice | undefined) =>
      `/api/lists/${list.id}/choices/${String(choice?.id)}`;
    const read = async () =>
      (await send(cookie, "GET", "/api/lists"))
        .json<{ lists: List[] }>()
        .lists.find(({ id }) => id === list.id);
    const original = await read();
    const changesToUndo: [Method, string, object | undefined][] = [
      ["DELETE", url(choices[1]), undefined],
      ["DELETE", url(choices[0]), undefined],
      ["PUT", `${url(choices[0])}/position`, { after: choices[2]?.id }],
      ["PUT", url(choices[2]), { label: "Fictional Changed" }],
      ["PUT", `/api/lists/${list.id}`, { name: unique("Renamed List") }],
      ["PUT", `/api/lists/${list.id}/retired`, { retired: true }],
    ];
    for (const [method, path, payload] of changesToUndo) {
      const response = await send(cookie, method, path, payload);
      const undone = await undo(
        cookie,
        response.json<{ changeSetId: string }>().changeSetId,
      );
      expect(undone.statusCode).toBe(200);
      expect(await read()).toEqual(original);
    }
    await send(cookie, "PUT", `${url(choices[0])}/retired`, { retired: true });
    const restored = await send(cookie, "PUT", `${url(choices[0])}/retired`, {
      retired: false,
    });
    await undo(cookie, restored.json<{ changeSetId: string }>().changeSetId);
    expect(
      (await read())?.choices.map(({ label, retired }) => [label, retired]),
    ).toEqual([
      ["A", true],
      ["B", false],
      ["C", false],
    ]);
  });

  it("undoes drafting a choice's removal, adding choices, and adding lists", async () => {
    const { cookie } = await editor();
    const { list, choices } = await listWith(cookie, ["A", "B", "C"]);
    const removed = await send(
      cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choices[1]?.id)}`,
    );
    await send(
      cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`,
    );
    await undo(cookie, removed.json<{ changeSetId: string }>().changeSetId);
    const labels = async () =>
      (await send(cookie, "GET", "/api/lists"))
        .json<{ lists: List[] }>()
        .lists.find(({ id }) => id === list.id)
        ?.choices.flatMap(({ label, draft }) =>
          draft?.action === "deleted" ? [] : [label],
        );
    expect(await labels()).toEqual(["B", "C"]);

    const added = await send(cookie, "POST", `/api/lists/${list.id}/choices`, {
      choices: [{ label: "D" }],
    });
    await undo(cookie, added.json<{ changeSetId: string }>().changeSetId);
    expect(await labels()).toEqual(["B", "C"]);

    const created = await send(cookie, "POST", "/api/lists", {
      name: unique("Undone List"),
    });
    await undo(cookie, created.json<{ changeSetId: string }>().changeSetId);
    const lists = (await send(cookie, "GET", "/api/lists")).json<{
      lists: List[];
    }>().lists;
    expect(
      lists.some(({ id }) => id === created.json<{ list: List }>().list.id),
    ).toBe(false);
  });

  it("refuses to undo a change made by someone else, a change set that does not exist, or one that needs a role the user no longer has", async () => {
    const { cookie, id } = await editor();
    const { changeSetId } = await addPerson(cookie);
    const other = await editor();
    const response = await undo(other.cookie, changeSetId);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "Only the person who made a change can undo it",
    });
    expect((await undo(cookie, randomUUID())).statusCode).toBe(404);
    await test.connection.execute(
      `DELETE FROM fathom.user_roles WHERE user_id = '${id}' AND role_id = (SELECT id FROM fathom.roles WHERE key = 'workforce-administrator')`,
    );
    expect((await undo(cookie, changeSetId)).statusCode).toBe(403);
  });

  it("refuses to undo what has been changed since, or undo twice", async () => {
    const { cookie } = await editor();
    const { id, changeSetId } = await addPerson(cookie);
    await send(cookie, "PATCH", `/api/people/${id}`, {
      preferredName: "Fictional Later",
    });
    const response = await undo(cookie, changeSetId);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "This has been changed since, so it can no longer be undone",
    });
    const second = await addPerson(cookie);
    expect((await undo(cookie, second.changeSetId)).statusCode).toBe(200);
    expect((await undo(cookie, second.changeSetId)).statusCode).toBe(409);
  });

  it("refuses to undo when what it would put back conflicts with the data now", async () => {
    const { cookie } = await editor();
    const employeeId = unique("Reused");
    const { id } = await addPerson(cookie, { employeeId });
    const deleted = await send(cookie, "DELETE", `/api/people/${id}`);
    await addPerson(cookie, { employeeId });
    expect(
      (await undo(cookie, deleted.json<{ changeSetId: string }>().changeSetId))
        .statusCode,
    ).toBe(409);

    // A list given a choice since it was made, and a column given values since it was added.
    const { list, choices } = await listWith(cookie, ["A"]);
    const created = await send(cookie, "POST", "/api/lists", {
      name: unique("Held List"),
    });
    const heldList = created.json<{ list: List }>().list;
    await send(cookie, "POST", `/api/lists/${heldList.id}/choices`, {
      choices: [{ label: "Fictional" }],
    });
    expect(
      (await undo(cookie, created.json<{ changeSetId: string }>().changeSetId))
        .statusCode,
    ).toBe(409);
    const column = await addColumn(cookie, list.id);
    await addPerson(cookie, {
      values: { [column.field.id]: [String(choices[0]?.id)] },
    });
    expect((await undo(cookie, column.changeSetId)).statusCode).toBe(409);

    // Undoing a restore would retire a list a column now draws on.
    const other = await listWith(cookie, ["B"]);
    await send(cookie, "PUT", `/api/lists/${other.list.id}/retired`, {
      retired: true,
    });
    const restored = await send(
      cookie,
      "PUT",
      `/api/lists/${other.list.id}/retired`,
      {
        retired: false,
      },
    );
    await addColumn(cookie, other.list.id);
    expect(
      (await undo(cookie, restored.json<{ changeSetId: string }>().changeSetId))
        .statusCode,
    ).toBe(409);

    // Undoing letting a column take several choices, after someone was given several.
    const one = await columnWith(cookie, ["C", "D"]);
    const several = await send(
      cookie,
      "PUT",
      `/api/people/columns/${one.field.id}`,
      { name: one.field.name, listId: one.list.id, multiple: true },
    );
    await test.approveLists();
    await addPerson(cookie, {
      values: { [one.field.id]: one.choices.map(({ id }) => id) },
    });
    // Approved since, so it is no longer undone.
    const refused = await undo(
      cookie,
      several.json<{ changeSetId: string }>().changeSetId,
    );
    expect(refused.statusCode).toBe(409);
  });

  it("refuses to put back values that no longer fit their column", async () => {
    const { cookie } = await editor();
    // Several choices, in a column that now takes one.
    const several = await columnWith(cookie, ["A", "B"], { multiple: true });
    const { id } = await addPerson(cookie, {
      values: { [several.field.id]: several.choices.map(({ id }) => id) },
    });
    const deleted = await send(cookie, "DELETE", `/api/people/${id}`);
    await send(cookie, "PUT", `/api/people/columns/${several.field.id}`, {
      name: several.field.name,
      listId: several.list.id,
      multiple: false,
    });
    await approveColumns(several.field.id);
    expect(
      (await undo(cookie, deleted.json<{ changeSetId: string }>().changeSetId))
        .statusCode,
    ).toBe(409);
    // A choice from a list the column no longer draws on.
    const moved = await columnWith(cookie, ["C"]);
    const other = await listWith(cookie, ["D"]);
    const person = await addPerson(cookie, {
      values: { [moved.field.id]: [String(moved.choices[0]?.id)] },
    });
    const removed = await send(cookie, "DELETE", `/api/people/${person.id}`);
    await send(cookie, "PUT", `/api/people/columns/${moved.field.id}`, {
      name: moved.field.name,
      listId: other.list.id,
    });
    await approveColumns(moved.field.id);
    expect(
      (await undo(cookie, removed.json<{ changeSetId: string }>().changeSetId))
        .statusCode,
    ).toBe(409);
  });

  it("waits for a change being saved, then refuses to undo over it, and undoes the same change only once", async () => {
    const { cookie } = await editor();
    const { id, changeSetId } = await addPerson(cookie);
    // Another change to the same person, holding its lock until the undo has started.
    let release = () => undefined as unknown;
    const held = new Promise((resolve) => {
      release = resolve as () => unknown;
    });
    let locked = () => undefined as unknown;
    const isLocked = new Promise((resolve) => {
      locked = resolve as () => unknown;
    });
    const other = test.connection.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended('fathom.drafts', 0))`,
      );
      await transaction
        .select()
        .from(people)
        .where(eq(people.id, id))
        .for("update");
      await recordChanges(transaction, null, [
        {
          recordType: "person",
          recordId: id,
          action: "changed",
          field: "preferredName",
          tier: "general",
          oldValue: "Before",
          newValue: "After",
        },
      ]);
      locked();
      await held;
    });
    await isLocked;
    const undoing = undo(cookie, changeSetId);
    // Released only once the undo is waiting for the person's lock.
    await vi.waitFor(async () => {
      const waiting = await test.connection.execute<{ total: string }>(
        sql`SELECT count(*) AS total FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()`,
      );
      expect(Number(waiting.rows[0]?.total)).toBeGreaterThan(0);
    }, waitLimit);
    release();
    await other;
    expect((await undoing).statusCode).toBe(409);

    const second = await addPerson(cookie);
    const both = await Promise.all([
      undo(cookie, second.changeSetId),
      undo(cookie, second.changeSetId),
    ]);
    expect(both.map(({ statusCode }) => statusCode).sort()).toEqual([200, 409]);
  });

  it("treats values as sensitive as their list is now, if it has become more sensitive since", async () => {
    const { cookie, id: editorId } = await editor();
    const { field, choices, list } = await columnWith(cookie, ["A", "B"]);
    const { id } = await addPerson(cookie, {
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const changed = await send(cookie, "PATCH", `/api/people/${id}`, {
      values: { [field.id]: [String(choices[1]?.id)] },
    });
    await send(cookie, "PUT", `/api/lists/${list.id}/class`, {
      dataClass: "personal",
    });
    const undone = await undo(
      cookie,
      changed.json<{ changeSetId: string }>().changeSetId,
    );
    expect(undone.statusCode).toBe(200);
    expect((await test.historyOf(id)).at(-1)).toMatchObject({
      tier: "personal",
    });
    expect(await accessOf(editorId)).toContainEqual({
      action: "personal-changed",
      subjectId: id,
    });
  });

  it("adds and undoes a thousand people with many columns at once", async () => {
    const { cookie } = await editor();
    const columns = [];
    for (let index = 0; index < 5; index += 1) {
      columns.push(await columnWith(cookie, ["A"]));
    }
    const values = Object.fromEntries(
      columns.map(({ field, choices }) => [field.id, [String(choices[0]?.id)]]),
    );
    const prefix = unique("Bulk");
    const { ids, changeSetId } = await addPeople(
      cookie,
      Array.from({ length: 1000 }, (_, index) => ({
        preferredName: `Fictional Bulk ${String(index)}`,
        employeeId: `${prefix}-${String(index)}`,
        startDate: "2020-01-01",
        endDate: "2030-01-01",
        values,
      })),
    );
    expect(ids).toHaveLength(1000);
    expect((await undo(cookie, changeSetId)).statusCode).toBe(200);
    const left = (await readPeople(cookie)).people.filter(({ id }) =>
      ids.includes(id),
    );
    expect(left).toEqual([]);
  });

  it("records undoing Personal changes in the access history", async () => {
    const { cookie, id: editorId } = await editor();
    const { id } = await addPerson(cookie);
    const changed = await send(cookie, "PATCH", `/api/people/${id}`, {
      endDate: "2032-01-01",
    });
    await undo(cookie, changed.json<{ changeSetId: string }>().changeSetId);
    const entries = await test.connection
      .select({ action: accessHistory.action })
      .from(accessHistory)
      .where(
        and(
          eq(accessHistory.actorId, editorId),
          eq(accessHistory.subjectId, id),
        ),
      );
    expect(entries).toHaveLength(2);
  });
});
