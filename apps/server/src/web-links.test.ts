// SPDX-License-Identifier: Apache-2.0

// Tests for web link columns on the People table, against a migrated PostgreSQL server: adding and
// changing them, with a visibility of their own; the links people are given, checked and kept as
// Fathom keeps them; drafting, approving, and undoing them; how the change history shows them; and
// who sees them.

import { fields, fieldValues, recordChanges, valueField } from "@fathom/db";
import {
  addressProblem,
  type ChangeHistory,
  type Field,
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

const proposal = {
  address: "https://proposals.example.test/P-1",
  text: "P-1 proposal",
};

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

// A web link column, approved so it is live.
async function linkColumn(
  cookie: string,
  settings: { visibility?: string; required?: boolean } = {},
): Promise<Field> {
  const response = await send(cookie, "POST", "/api/people/columns", {
    name: unique("Fictional Link"),
    type: "link",
    visibility: settings.visibility ?? "general",
    required: settings.required ?? false,
  });
  expect(response.statusCode, response.body).toBe(201);
  await test.approveLists();
  return response.json<{ field: Field }>().field;
}

async function addPerson(cookie: string, links: object = {}) {
  const response = await send(cookie, "POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("E"),
        positionId: testPosition,
        links,
      },
    ],
  });
  return response;
}

async function addedId(cookie: string, links: object = {}) {
  const response = await addPerson(cookie, links);
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

async function linkRows(fieldId: string) {
  return test.connection
    .select({
      choiceId: fieldValues.choiceId,
      address: fieldValues.linkAddress,
      text: fieldValues.linkText,
    })
    .from(fieldValues)
    .where(eq(fieldValues.fieldId, fieldId));
}

describe("adding web link columns", () => {
  it("adds one with a visibility of its own, and no list", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie, { visibility: "personal" });
    expect(field).toMatchObject({
      type: "link",
      listId: null,
      visibility: "personal",
      multiple: false,
    });
  });

  it.each([
    [{ visibility: undefined }, "Choose a visibility"],
    [{ listId: missingRecord }, "has no list"],
    [{ multiple: true }, "holds one link"],
  ])("refuses a web link column with %j", async (settings, message) => {
    const { cookie } = await editor();
    const response = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Fictional Link"),
      type: "link",
      visibility: "general",
      ...settings,
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain(message);
  });

  it("refuses changing a column's type", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const response = await send(
      cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      {
        name: field.name,
        type: "choice",
        listId: missingRecord,
      },
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "A column's type cannot change",
    });
  });

  it("moves a web link column to another class, even while people have links", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    await approve([await addedId(cookie, { [field.id]: proposal })]);
    const response = await send(
      cookie,
      "PUT",
      `/api/columns/${field.id}/class`,
      {
        dataClass: "confidential",
      },
    );
    expect(response.statusCode, response.body).toBe(200);
    const column = (await readPeople(cookie)).fields.find(
      ({ id }) => id === field.id,
    );
    expect(column?.visibility).toBe("confidential");
  });
});

describe("people's links", () => {
  it("are kept as Fathom keeps them, in typed columns once approved", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const id = await addedId(cookie, {
      [field.id]: { address: "HTTP://Wiki/Proposals", text: " Proposals " },
    });
    const kept = { address: "http://wiki/Proposals", text: "Proposals" };
    expect((await readPerson(cookie, id))?.links).toEqual({
      [field.id]: kept,
    });
    await approve([id]);
    expect(await linkRows(field.id)).toEqual([
      { choiceId: null, address: kept.address, text: kept.text },
    ]);
    expect((await readPerson(cookie, id))?.links).toEqual({
      [field.id]: kept,
    });
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "file://files.example.test/Proposals",
    "https://user:secret@proposals.example.test/",
  ])("refuses the address %j", async (address) => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const response = await addPerson(cookie, {
      [field.id]: { address, text: "" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain(addressProblem);
  });

  it("refuses choices in a web link column", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const response = await send(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("E"),
          positionId: testPosition,
          values: { [field.id]: [] },
        },
      ],
    });
    expect(response.json()).toEqual({ error: "There is no such column" });
  });

  it("refuses a link in a choice column", async () => {
    const { cookie } = await editor();
    const list = await send(cookie, "POST", "/api/lists", {
      name: unique("Fictional List"),
    });
    await test.approveLists();
    const column = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Fictional Choice"),
      listId: list.json<{ list: { id: string } }>().list.id,
    });
    await test.approveLists();
    const response = await addPerson(cookie, {
      [column.json<{ field: Field }>().field.id]: proposal,
    });
    expect(response.json()).toEqual({ error: "There is no such column" });
  });

  it("refuses an address that is too long once kept, as when https:// is added to it", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const response = await addPerson(cookie, {
      [field.id]: { address: `example.test/${"x".repeat(1987)}`, text: "" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("The address is too long");
  });

  it("keeps a link as long as Fathom allows, recognising it once approved", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const long = {
      address: `https://example.test/${"x".repeat(1979)}`,
      text: "",
    };
    expect(long.address).toHaveLength(2000);
    const id = await addedId(cookie, { [field.id]: long });
    await approve([id]);
    expect((await readPerson(cookie, id))?.links).toEqual({
      [field.id]: long,
    });
  });

  it("cannot become required while someone has no link", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    await approve([await addedId(cookie)]);
    const response = await send(
      cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      { name: field.name, type: "link", visibility: "general", required: true },
    );
    expect(response.statusCode).toBe(409);
    expect(
      response
        .json<{ error: string }>()
        .error.endsWith(`no ${field.name}, so it cannot be required yet`),
    ).toBe(true);
  });

  it("are changed and removed by drafts, showing the live link beside", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const id = await addedId(cookie, { [field.id]: proposal });
    await approve([id]);
    const changed = { address: "https://example.test/", text: "" };
    const update = await send(cookie, "PATCH", `/api/people/${id}`, {
      links: { [field.id]: changed },
    });
    expect(update.statusCode, update.body).toBe(200);
    const drafted = await readPerson(cookie, id);
    expect(drafted?.links).toEqual({ [field.id]: changed });
    expect(drafted?.draft).toMatchObject({
      changed: [field.id],
      live: { values: {}, links: { [field.id]: proposal } },
    });
    await send(cookie, "PATCH", `/api/people/${id}`, {
      links: { [field.id]: null },
    });
    expect((await readPerson(cookie, id))?.links).toEqual({});
    await approve([id]);
    expect(await linkRows(field.id)).toEqual([]);
  });

  it("records nothing when a link is saved unchanged", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const id = await addedId(cookie, { [field.id]: proposal });
    await approve([id]);
    const response = await send(cookie, "PATCH", `/api/people/${id}`, {
      links: { [field.id]: proposal },
    });
    expect(response.json()).toEqual({ changeSetId: null });
  });

  it("come back when removing one is undone", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const id = await addedId(cookie, { [field.id]: proposal });
    await approve([id]);
    const removed = await send(cookie, "PATCH", `/api/people/${id}`, {
      links: { [field.id]: null },
    });
    const { changeSetId } = removed.json<{ changeSetId: string }>();
    const undone = await send(cookie, "POST", `/api/undo/${changeSetId}`);
    expect(undone.statusCode, undone.body).toBe(200);
    const person = await readPerson(cookie, id);
    expect(person?.links).toEqual({ [field.id]: proposal });
    expect(person?.draft).toBeUndefined();
  });

  it("are shown in the change history by their text and address", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const id = await addedId(cookie, { [field.id]: proposal });
    await approve([id]);
    await send(cookie, "PATCH", `/api/people/${id}`, {
      links: { [field.id]: { address: proposal.address, text: "" } },
    });
    const history = (
      await send(cookie, "GET", "/api/changes")
    ).json<ChangeHistory>();
    const [latest] = history.entries;
    expect(latest?.records[0]?.fields).toEqual([
      {
        field: "value",
        column: field.name,
        oldValue: `P-1 proposal (${proposal.address})`,
        newValue: proposal.address,
      },
    ]);
  });
});

describe("who sees a Confidential web link column", () => {
  const secret = {
    address: "https://secret.example.test/reviews",
    text: "Reviews",
  };
  let fieldId = "";
  let personId = "";

  beforeAll(async () => {
    const { cookie } = await editor();
    fieldId = (await linkColumn(cookie, { visibility: "confidential" })).id;
    personId = await addedId(cookie, { [fieldId]: proposal });
    await approve([personId]);
    // The history names the values of changes, not of people added.
    const changed = await send(cookie, "PATCH", `/api/people/${personId}`, {
      links: { [fieldId]: secret },
    });
    expect(changed.statusCode).toBe(200);
  });

  it.each(rolesGranting("people:view"))(
    "a %s, a role that sees people, sees the column and its links only if the role lets them see Confidential data",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const read = await readPeople(cookie);
      const sees = rolesGranting("confidential:view").includes(role);
      expect(read.fields.some(({ id }) => id === fieldId)).toBe(sees);
      const person = read.people.find(({ id }) => id === personId);
      expect(Object.keys(person?.links ?? {}).includes(fieldId)).toBe(sees);
    },
  );

  it.each(rolesGranting("changes:view"))(
    "a %s, a role that sees the change history, sees changes to the links only if the role lets them see Confidential data",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      const history = (
        await send(cookie, "GET", "/api/changes")
      ).json<ChangeHistory>();
      const shown = JSON.stringify(history).includes(secret.address);
      expect(shown).toBe(rolesGranting("confidential:view").includes(role));
    },
  );
});

describe("a web link column's settings over time", () => {
  async function setVisibility(
    cookie: string,
    field: Field,
    visibility: string,
  ) {
    await test.approveLists();
    const response = await send(
      cookie,
      "PUT",
      `/api/columns/${field.id}/class`,
      {
        dataClass: visibility,
      },
    );
    expect(response.statusCode, response.body).toBe(200);
    return response.json<{ changeSetId: string }>().changeSetId;
  }

  it("keeps a link's history from those who may not see the column's last visibility, once the column is deleted", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const raised = {
      address: "https://raised.example.test/",
      text: "Raised",
    };
    const id = await addedId(cookie, { [field.id]: proposal });
    await approve([id]);
    await send(cookie, "PATCH", `/api/people/${id}`, {
      links: { [field.id]: raised },
    });
    await approve([id]);
    await setVisibility(cookie, field, "confidential");
    const deleted = await send(
      cookie,
      "DELETE",
      `/api/people/columns/${field.id}`,
    );
    expect(deleted.statusCode, deleted.body).toBe(200);
    await test.approveLists();
    const reads = async (roles: Parameters<TestApp["signedIn"]>[0]) => {
      const reader = await test.signedIn(roles);
      return JSON.stringify(
        (await send(reader.cookie, "GET", "/api/changes")).json(),
      ).includes(raised.address);
    };
    expect(await reads("resource-planner")).toBe(false);
    expect(await reads("executive")).toBe(true);
  });

  it("is moved back rather than undone", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const changeSetId = await setVisibility(cookie, field, "personal");
    const undone = await send(cookie, "POST", `/api/undo/${changeSetId}`);
    expect(undone.statusCode).toBe(409);
    const column = (await readPeople(cookie)).fields.find(
      ({ id }) => id === field.id,
    );
    expect(column).toMatchObject({ visibility: "personal" });
  });

  it("brings a column drafted to be deleted back when the deletion is undone", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie, { visibility: "personal" });
    const deleted = await send(
      cookie,
      "DELETE",
      `/api/people/columns/${field.id}`,
    );
    const { changeSetId } = deleted.json<{ changeSetId: string }>();
    const undone = await send(cookie, "POST", `/api/undo/${changeSetId}`);
    expect(undone.statusCode, undone.body).toBe(200);
    const column = (await readPeople(cookie)).fields.find(
      ({ id }) => id === field.id,
    );
    expect(column).toMatchObject({ type: "link", visibility: "personal" });
    expect(column?.draft).toBeUndefined();
  });

  it("cannot be lowered by a role that may not see its links", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie, { visibility: "confidential" });
    await test.approveLists();
    const mover = await test.signedIn([
      "people:view",
      "personal:view",
      "data:classify",
    ]);
    const response = await send(
      mover.cookie,
      "PUT",
      `/api/columns/${field.id}/class`,
      { dataClass: "general" },
    );
    expect(response.statusCode).toBe(403);
    const column = (await readPeople(cookie)).fields.find(
      ({ id }) => id === field.id,
    );
    expect(column?.visibility).toBe("confidential");
  });
});

describe("a link saved unchanged into a draft", () => {
  it("records nothing, though the draft is read back from the database", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const id = await addedId(cookie, { [field.id]: proposal });
    const response = await send(cookie, "PATCH", `/api/people/${id}`, {
      links: { [field.id]: { text: proposal.text, address: proposal.address } },
    });
    expect(response.json()).toEqual({ changeSetId: null });
  });
});

describe("drafts holding links", () => {
  it("show no live link for someone who had none", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    const id = await addedId(cookie);
    await approve([id]);
    await send(cookie, "PATCH", `/api/people/${id}`, {
      links: { [field.id]: proposal },
    });
    expect((await readPerson(cookie, id))?.draft).toMatchObject({
      changed: [field.id],
      live: { values: {}, links: {} },
    });
  });

  it("let a column be renamed while a draft gives someone a link in it", async () => {
    const { cookie } = await editor();
    const field = await linkColumn(cookie);
    await addedId(cookie, { [field.id]: proposal });
    const response = await send(
      cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      { name: unique("Renamed Link"), type: "link", visibility: "general" },
    );
    expect(response.statusCode, response.body).toBe(200);
  });
});

// Changes made to the live records rather than to drafts, as Fathom made before drafts, are undone
// by putting the live records back.
describe("undoing live changes", () => {
  it("puts a live link back", async () => {
    const { id: userId, cookie } = await editor();
    const field = await linkColumn(cookie);
    const id = await addedId(cookie, { [field.id]: proposal });
    await approve([id]);
    const changed = { address: "https://changed.example.test/", text: "" };
    const changeSetId = await test.connection.transaction(
      async (transaction) => {
        await transaction
          .update(fieldValues)
          .set({ linkAddress: changed.address, linkText: changed.text })
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
            oldValue: proposal,
            newValue: changed,
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
    expect(await linkRows(field.id)).toEqual([
      { choiceId: null, address: proposal.address, text: proposal.text },
    ]);
  });

  it("refuses to put back a live column's class, which is moved back instead", async () => {
    const { id: userId, cookie } = await editor();
    const field = await linkColumn(cookie);
    const changeSetId = await test.connection.transaction(
      async (transaction) => {
        await transaction
          .update(fields)
          .set({ visibility: "personal" })
          .where(eq(fields.id, field.id));
        return recordChanges(transaction, { userId, roleId: null }, [
          {
            recordType: "field",
            recordId: field.id,
            action: "changed",
            field: "visibility",
            tier: "general",
            oldValue: "general",
            newValue: "personal",
          },
        ]);
      },
    );
    const undone = await send(
      cookie,
      "POST",
      `/api/undo/${String(changeSetId)}`,
    );
    expect(undone.statusCode).toBe(409);
    const column = (await readPeople(cookie)).fields.find(
      ({ id }) => id === field.id,
    );
    expect(column?.visibility).toBe("personal");
  });
});
