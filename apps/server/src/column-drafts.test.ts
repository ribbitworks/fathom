// SPDX-License-Identifier: Apache-2.0

// Tests for drafts of the People table's columns and of their order, against a PostgreSQL server of
// their own: drafting columns added, changed, removed, and moved; the refusals that keep drafts
// fitting the people; approving them, with the columns an order uses, and rejecting them only
// together with the drafts that use them; discarding and sending again; undoing edits to them; and
// reading them in place.

import { columnOrders, drafts, fields, fieldValues, lists } from "@fathom/db";
import {
  type Choice,
  type Field,
  fieldRequestSchema,
  type List,
  type Permission,
  type Person,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "./access.ts";
import { recordChanges } from "./data/changes.ts";
import { createDataAccess } from "./data/index.ts";
import { ConflictError, ForbiddenError } from "./errors.ts";
import { startTestApp, type TestApp } from "./test-app.ts";

let test: TestApp;
let editor: { id: string; cookie: string };
let approver: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn(["workforce-administrator", "viewer"]);
  approver = await test.signedIn(["approver", "leadership"]);
});

afterAll(async () => {
  await test.close();
});

let names = 0;
const unique = (prefix: string) => {
  names += 1;
  return `${prefix} ${String(names)}`;
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
const send = (method: Method, url: string, body?: object) =>
  test.request(editor.cookie, method, url, body);

const decide = (
  asking: "approval" | "rejection",
  body: object,
  cookie = approver.cookie,
) => test.request(cookie, "POST", `/api/drafts/${asking}`, body);

interface PeopleRead {
  people: Person[];
  fields: Field[];
  order: string[];
  orderDraft?: { live: string[]; uses?: string[]; state: string };
}

async function readPeople(cookie = editor.cookie): Promise<PeopleRead> {
  const response = await test.request(cookie, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response.json<PeopleRead>();
}

// A live list with live choices.
async function liveList(labels: string[], visibility = "general") {
  const list = (
    await send("POST", "/api/lists", {
      name: unique("Fictional List"),
      visibility,
    })
  ).json<{ list: List }>().list;
  const choices = (
    await send("POST", `/api/lists/${list.id}/choices`, {
      choices: labels.map((label) => ({ label })),
    })
  ).json<{ choices: Choice[] }>().choices;
  await test.approveLists();
  return { list, choices };
}

async function draftColumn(listId: string, settings: object = {}) {
  const response = await send("POST", "/api/people/columns", {
    name: unique("Fictional Column"),
    listId,
    ...settings,
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ field: Field; changeSetId: string }>();
}

async function liveColumn(listId: string, settings: object = {}) {
  const made = await draftColumn(listId, settings);
  expect(
    (await decide("approval", { columns: [made.field.id] })).statusCode,
  ).toBe(200);
  return made.field;
}

async function livePerson(values: Record<string, string[]> = {}) {
  const response = await send("POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("E"),
        values,
      },
    ],
  });
  expect(response.statusCode, response.body).toBe(201);
  const [id = ""] = response.json<{ ids: string[] }>().ids;
  expect((await decide("approval", { people: [id] })).statusCode).toBe(200);
  return id;
}

const liveField = async (id: string) =>
  (await test.connection.select().from(fields).where(eq(fields.id, id))).at(0);

const liveOrder = async () =>
  (
    await test.connection
      .select({ keys: columnOrders.keys })
      .from(columnOrders)
      .where(eq(columnOrders.tableName, "people"))
  ).at(0)?.keys ?? [];

const changeSet = (response: Awaited<ReturnType<typeof send>>) =>
  response.json<{ changeSetId: string }>().changeSetId;

describe("drafting columns", () => {
  it("drafts adding a column, shown in place at the end, and makes it live once approved", async () => {
    const { list } = await liveList(["A"]);
    const { field } = await draftColumn(list.id);
    expect(await liveField(field.id)).toBeUndefined();
    const read = await readPeople();
    expect(read.fields.find(({ id }) => id === field.id)).toMatchObject({
      draft: { action: "created", state: "waiting" },
    });
    expect(read.order.at(-1)).toBe(field.id);
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      200,
    );
    expect(await liveField(field.id)).toMatchObject({ name: field.name });
    expect((await liveOrder()).at(-1)).toBe(field.id);
  });

  it("drafts changing and removing a column, which change the live column only once approved", async () => {
    const { list, choices } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    const renamed = unique("Fictional Renamed");
    const changed = await send("PUT", `/api/people/columns/${field.id}`, {
      name: renamed,
      listId: list.id,
      multiple: true,
    });
    expect(changed.statusCode).toBe(200);
    expect((await liveField(field.id))?.name).toBe(field.name);
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).toMatchObject({
      name: renamed,
      draft: {
        action: "changed",
        changed: ["name", "multiple"],
        live: { name: field.name, multiple: false },
      },
    });
    await decide("approval", { columns: [field.id] });
    expect(await liveField(field.id)).toMatchObject({
      name: renamed,
      multiple: true,
    });

    const person = await livePerson({ [field.id]: [String(choices[0]?.id)] });
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}`)).statusCode,
    ).toBe(200);
    expect(
      (
        await send("PUT", `/api/people/columns/${field.id}`, {
          name: renamed,
          listId: list.id,
        })
      ).statusCode,
    ).toBe(409);
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      200,
    );
    expect(await liveField(field.id)).toBeUndefined();
    expect(
      await test.connection
        .select()
        .from(fieldValues)
        .where(eq(fieldValues.personId, person)),
    ).toEqual([]);
  });

  it("takes a column's name while a draft has it, and keeps a live name taken until its rename is approved", async () => {
    const { list } = await liveList(["A"]);
    const name = unique("Fictional Taken");
    await draftColumn(list.id, { name });
    const again = await send("POST", "/api/people/columns", {
      name: name.toUpperCase(),
      listId: list.id,
    });
    expect(again.statusCode).toBe(409);
    const field = await liveColumn(list.id);
    await send("PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Other"),
      listId: list.id,
    });
    expect(
      (
        await send("POST", "/api/people/columns", {
          name: field.name,
          listId: list.id,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await send("PUT", `/api/people/columns/${field.id}`, {
          name,
          listId: list.id,
        })
      ).statusCode,
    ).toBe(409);
  });

  it("refuses lists that are missing or retired, requiring a column while people exist, and settings values do not fit", async () => {
    const { list, choices } = await liveList(["A", "B"]);
    expect(
      (
        await send("POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          listId: randomUUID(),
        })
      ).statusCode,
    ).toBe(400);
    const retired = await liveList(["C"]);
    await send("PUT", `/api/lists/${retired.list.id}/retired`, {
      retired: true,
    });
    await test.approveLists();
    expect(
      (
        await send("POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          listId: retired.list.id,
        })
      ).statusCode,
    ).toBe(400);
    await livePerson();
    expect(
      (
        await send("POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          listId: list.id,
          required: true,
        })
      ).statusCode,
    ).toBe(409);
    const field = await liveColumn(list.id, { multiple: true });
    await livePerson({ [field.id]: choices.map(({ id }) => id) });
    expect(
      (
        await send("PUT", `/api/people/columns/${field.id}`, {
          name: field.name,
          listId: list.id,
          multiple: false,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await send("PUT", `/api/people/columns/${randomUUID()}`, {
          name: unique("Fictional Column"),
          listId: list.id,
        })
      ).statusCode,
    ).toBe(404);
  });

  it("refuses removing a column that drafts of people change, and lets only those who may change its values remove it", async () => {
    const { list, choices } = await liveList(["A"], "restricted");
    const field = await liveColumn(list.id);
    const drafted = await send("POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("E"),
          values: { [field.id]: [String(choices[0]?.id)] },
        },
      ],
    });
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}`)).statusCode,
    ).toBe(409);
    const [personId = ""] = drafted.json<{ ids: string[] }>().ids;
    await send("DELETE", `/api/people/${personId}/draft`);
    // An actor who may change configuration but not people, as no role grants today.
    const configurationOnly: Actor = {
      user: { id: editor.id, name: "Fictional Editor", email: "" },
      roles: ["workforce-administrator"],
      permissions: ["configuration:edit", "configuration:view"],
    };
    await expect(
      createDataAccess(test.connection).people.deleteField(
        configurationOnly,
        field.id,
      ),
    ).rejects.toThrow(/your roles do not let you change/);
  });

  // An actor who may change configuration and see people, but not Restricted details, as no role
  // grants today. It is the editor's own user, so it sees the editor's unpublished drafts.
  const generalOnly = (): Actor => ({
    user: { id: editor.id, name: "Fictional Editor", email: "" },
    roles: ["workforce-administrator"],
    permissions: ["configuration:edit", "configuration:view", "people:view"],
  });
  const choice = (listId: string, name = unique("Fictional Column")) =>
    fieldRequestSchema.parse({ name, listId });
  const draftCount = async () =>
    (await test.connection.select({ id: drafts.recordId }).from(drafts)).length;

  it("lets only someone who sees a column's visibility give it or change it", async () => {
    const people = createDataAccess(test.connection).people;
    const restricted = (await liveList(["A"], "restricted")).list;
    const general = (await liveList(["B"])).list;
    const before = await draftCount();
    const refusals = [
      choice(restricted.id),
      fieldRequestSchema.parse({
        name: unique("Fictional Column"),
        type: "link",
        visibility: "restricted",
      }),
    ];
    for (const request of refusals) {
      await expect(
        people.createField(generalOnly(), request),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await draftCount()).toBe(before);

    // A list only drafted to be added, and a General list drafted to become Restricted.
    const draftedOnly = (
      await send("POST", "/api/lists", {
        name: unique("Fictional List"),
        visibility: "restricted",
      })
    ).json<{ list: List }>().list;
    const raised = (await liveList(["C"])).list;
    await send("PUT", `/api/lists/${raised.id}`, {
      name: raised.name,
      visibility: "restricted",
    });
    for (const list of [draftedOnly, raised]) {
      await expect(
        people.createField(generalOnly(), choice(list.id)),
      ).rejects.toThrow(/whose details your roles let you see/);
    }
    await send("DELETE", `/api/lists/${draftedOnly.id}/draft`);
    await send("DELETE", `/api/lists/${raised.id}/draft`);

    const { result } = await people.createField(
      generalOnly(),
      choice(general.id),
    );
    await expect(
      people.updateField(
        generalOnly(),
        result.id,
        choice(restricted.id, result.name),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await send("DELETE", `/api/people/columns/${result.id}/draft`);

    // Drafted to a General list, a Restricted column still holds Restricted values while live.
    const hidden = await liveColumn(restricted.id);
    await send("PUT", `/api/people/columns/${hidden.id}`, {
      name: hidden.name,
      listId: general.id,
    });
    await expect(
      people.updateField(
        generalOnly(),
        hidden.id,
        choice(general.id, hidden.name),
      ),
    ).rejects.toThrow(/your roles do not let you see/);
    await send("DELETE", `/api/people/columns/${hidden.id}/draft`);
  });

  it("lets only someone who sees a list's visibility give it or change it", async () => {
    const lists = createDataAccess(test.connection).lists;
    const before = await draftCount();
    await expect(
      lists.create(generalOnly(), {
        name: unique("Fictional List"),
        description: "",
        visibility: "restricted",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await draftCount()).toBe(before);

    const general = (await liveList(["A"])).list;
    await expect(
      lists.update(generalOnly(), general.id, {
        name: general.name,
        description: "",
        visibility: "restricted",
      }),
    ).rejects.toThrow(/a visibility your roles let you see/);
    const restricted = (await liveList(["B"], "restricted")).list;
    await expect(
      lists.update(generalOnly(), restricted.id, {
        name: restricted.name,
        description: "",
        visibility: "general",
      }),
    ).rejects.toThrow(/your roles do not let you see/);
    expect(await draftCount()).toBe(before);

    const renamed = unique("Fictional List");
    const { result } = await lists.update(generalOnly(), general.id, {
      name: renamed,
      description: "",
      visibility: "general",
    });
    expect(result.name).toBe(renamed);
    await send("DELETE", `/api/lists/${general.id}/draft`);
  });

  it("needs an Approver who sees the values a removal deletes", async () => {
    const { list, choices } = await liveList(["A"], "restricted");
    const field = await liveColumn(list.id);
    await livePerson({ [field.id]: [String(choices[0]?.id)] });
    await send("DELETE", `/api/people/columns/${field.id}`);
    const listsOnly = await test.signedIn(["approver"]);
    expect(
      (await decide("approval", { columns: [field.id] }, listsOnly.cookie))
        .statusCode,
    ).toBe(403);
    await send("DELETE", `/api/people/columns/${field.id}/draft`);
  });

  it("checks again on approval that the list is offered and the settings fit", async () => {
    const { list, choices } = await liveList(["A", "B"]);
    const { field } = await draftColumn(list.id);
    // Drafting refuses to retire a list a column draft draws on, so the list is retired another way,
    // as a change made before columns had drafts could have.
    await test.connection
      .update(lists)
      .set({ retired: true })
      .where(eq(lists.id, list.id));
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      409,
    );
    await send("DELETE", `/api/people/columns/${field.id}/draft`);

    const other = await liveList(["C", "D"]);
    const several = await liveColumn(other.list.id, { multiple: true });
    await send("PUT", `/api/people/columns/${several.id}`, {
      name: several.name,
      listId: other.list.id,
      multiple: false,
    });
    await livePerson({
      [several.id]: other.choices.map(({ id }) => id),
    });
    expect(
      (await decide("approval", { columns: [several.id] })).statusCode,
    ).toBe(409);
    await send("DELETE", `/api/people/columns/${several.id}/draft`);
    expect(choices).toHaveLength(2);
  });
});

describe("drafting the order of the columns", () => {
  it("drafts a new order, approves it, and approves the columns it places with it", async () => {
    const { list } = await liveList(["A"]);
    const first = await liveColumn(list.id);
    expect(
      (
        await send("PUT", `/api/people/columns/${first.id}/position`, {
          after: null,
        })
      ).statusCode,
    ).toBe(200);
    const read = await readPeople();
    expect(read.order[0]).toBe(first.id);
    expect(read.orderDraft).toMatchObject({ state: "waiting", uses: [] });
    expect((await decide("approval", { columnOrder: true })).statusCode).toBe(
      200,
    );
    expect((await liveOrder())[0]).toBe(first.id);

    const { field: added } = await draftColumn(list.id);
    await send("PUT", `/api/people/columns/${added.id}/position`, {
      after: null,
    });
    expect((await readPeople()).orderDraft?.uses).toEqual([added.id]);
    expect(
      (await decide("rejection", { columns: [added.id], reason: "Not yet" }))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await decide("rejection", {
          columns: [added.id],
          columnOrder: true,
          reason: "Not yet",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await decide("rejection", {
          columns: [added.id],
          columnOrder: true,
          reason: "Not yet",
        })
      ).statusCode,
    ).toBe(200);
    // Rejected drafts are back with their makers, so are approved only once sent again.
    expect((await decide("approval", { columnOrder: true })).statusCode).toBe(
      409,
    );
    await send("DELETE", `/api/people/columns/${added.id}/draft/rejection`);
    expect((await decide("approval", { columnOrder: true })).statusCode).toBe(
      409,
    );
    await send("DELETE", "/api/people/columns/order/draft/rejection");
    expect((await decide("approval", { columnOrder: true })).statusCode).toBe(
      200,
    );
    expect(await liveField(added.id)).toBeDefined();
    expect((await liveOrder())[0]).toBe(added.id);
  });

  it("refuses moves that make no sense, and records nothing for a move to where a column is", async () => {
    const { list } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    const at = (key: string, after: string | null) =>
      send("PUT", `/api/people/columns/${key}/position`, { after });
    expect((await at(field.id, field.id)).statusCode).toBe(400);
    expect((await at("unknown", null)).statusCode).toBe(404);
    expect((await at(field.id, "unknown")).statusCode).toBe(400);
    const order = (await readPeople()).order;
    const before = order[order.indexOf(field.id) - 1] ?? null;
    expect((await at(field.id, before)).json()).toEqual({ changeSetId: null });
  });

  it("drops a draft of the order once the column it placed is discarded", async () => {
    const { list } = await liveList(["A"]);
    const { field } = await draftColumn(list.id);
    await send("PUT", `/api/people/columns/${field.id}/position`, {
      after: null,
    });
    expect((await readPeople()).orderDraft).toBeDefined();
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}`)).statusCode,
    ).toBe(200);
    expect(await readPeople()).not.toHaveProperty("orderDraft");
  });
});

describe("discarding and sending drafts of columns again", () => {
  it("sends a rejected draft again, discards it, and refuses drafts that do not exist", async () => {
    const { list } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    await send("PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Renamed"),
      listId: list.id,
    });
    const notRejected = await send(
      "DELETE",
      `/api/people/columns/${field.id}/draft/rejection`,
    );
    expect(notRejected.statusCode).toBe(409);
    await decide("rejection", { columns: [field.id], reason: "Keep it" });
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}/draft/rejection`))
        .statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}/draft`))
        .statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}/draft`))
        .statusCode,
    ).toBe(404);
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      404,
    );
    expect((await decide("approval", { columnOrder: true })).statusCode).toBe(
      404,
    );

    await send("PUT", `/api/people/columns/${field.id}/position`, {
      after: null,
    });
    await decide("rejection", { columnOrder: true, reason: "Keep it" });
    expect(
      (await send("DELETE", "/api/people/columns/order/draft/rejection"))
        .statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", "/api/people/columns/order/draft")).statusCode,
    ).toBe(200);
    expect(await readPeople()).not.toHaveProperty("orderDraft");
  });
});

describe("undoing edits to drafts of columns", () => {
  it("puts back a column's draft, its order, and a removal, and takes out a draft adding it", async () => {
    const { list } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    const renamed = await send("PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Renamed"),
      listId: list.id,
    });
    expect(
      (await send("POST", `/api/undo/${changeSet(renamed)}`)).statusCode,
    ).toBe(200);
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).not.toHaveProperty("draft");

    const moved = await send(
      "PUT",
      `/api/people/columns/${field.id}/position`,
      { after: null },
    );
    await send("POST", `/api/undo/${changeSet(moved)}`);
    expect(await readPeople()).not.toHaveProperty("orderDraft");

    const removed = await send("DELETE", `/api/people/columns/${field.id}`);
    await send("POST", `/api/undo/${changeSet(removed)}`);
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).not.toHaveProperty("draft");

    const { field: added, changeSetId } = await draftColumn(list.id);
    await send("POST", `/api/undo/${changeSetId}`);
    expect(
      (await readPeople()).fields.find(({ id }) => id === added.id),
    ).toBeUndefined();

    const discarded = await draftColumn(list.id);
    const thrown = await send(
      "DELETE",
      `/api/people/columns/${discarded.field.id}`,
    );
    await draftColumn(list.id, { name: discarded.field.name });
    expect(
      (await send("POST", `/api/undo/${changeSet(thrown)}`)).statusCode,
    ).toBe(409);
  });
});

describe("reading columns", () => {
  it("leaves out a column whose values the reader may not see, with its draft", async () => {
    const { list } = await liveList(["A"], "confidential");
    const { field } = await draftColumn(list.id);
    const reader = await test.signedIn(["resource-planner"]);
    expect(
      (await readPeople(reader.cookie)).fields.some(
        ({ id }) => id === field.id,
      ),
    ).toBe(false);
    await send("DELETE", `/api/people/columns/${field.id}`);
  });
});

describe("rejected drafts of columns", () => {
  it("are waiting again once changed, discarded, or moved, and show their reasons meanwhile", async () => {
    const { list } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    await send("PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Renamed"),
      listId: list.id,
    });
    await decide("rejection", { columns: [field.id], reason: "First" });
    await decide("rejection", { columns: [field.id], reason: "Second" });
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).toMatchObject({ draft: { state: "rejected", reason: "Second" } });
    await send("PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Renamed"),
      listId: list.id,
    });
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).toMatchObject({ draft: { state: "waiting" } });
    await decide("rejection", { columns: [field.id], reason: "Third" });
    await send("DELETE", `/api/people/columns/${field.id}/draft`);

    await send("PUT", `/api/people/columns/${field.id}/position`, {
      after: null,
    });
    await decide("rejection", { columnOrder: true, reason: "Keep the order" });
    expect((await readPeople()).orderDraft).toMatchObject({
      state: "rejected",
      reason: "Keep the order",
    });
    await send("PUT", `/api/people/columns/${field.id}/position`, {
      after: "preferredName",
    });
    expect((await readPeople()).orderDraft).toMatchObject({ state: "waiting" });
    await decide("rejection", { columnOrder: true, reason: "Keep the order" });
    // Undoing sending it again puts the rejection back.
    const resent = await send(
      "DELETE",
      "/api/people/columns/order/draft/rejection",
    );
    await send("POST", `/api/undo/${changeSet(resent)}`);
    expect((await readPeople()).orderDraft).toMatchObject({
      state: "rejected",
      reason: "Keep the order",
    });
    await send("DELETE", "/api/people/columns/order/draft");
    expect(await readPeople()).not.toHaveProperty("orderDraft");
  });
});

describe("drafts of columns written without the change history", () => {
  it("are shown without who made them", async () => {
    const { list } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    await test.connection.insert(drafts).values([
      {
        recordType: "field",
        recordId: field.id,
        action: "changed",
        fields: { name: unique("Fictional Unrecorded") },
      },
      {
        recordType: "column-order",
        recordId: "people",
        action: "changed",
        fields: { order: [field.id] },
      },
    ]);
    const read = await readPeople();
    expect(read.fields.find(({ id }) => id === field.id)?.draft).toMatchObject({
      madeBy: null,
      madeAt: null,
      editors: [],
      changedBy: { name: null },
    });
    expect(read.orderDraft).toMatchObject({ madeBy: null, editors: [] });
    await send("DELETE", `/api/people/columns/${field.id}/draft`);
    await send("DELETE", "/api/people/columns/order/draft");
  });
});

describe("more refusals", () => {
  it("keeps added columns that end the order in the order drafted out of a draft of the order", async () => {
    const { list } = await liveList(["A"]);
    const { field: x } = await draftColumn(list.id);
    const { field: y } = await draftColumn(list.id);
    await send("PUT", `/api/people/columns/${y.id}/position`, {
      after: (await readPeople()).order.at(-3) ?? null,
    });
    expect((await readPeople()).orderDraft?.uses).toEqual([y.id]);
    await send("DELETE", `/api/people/columns/${x.id}`);
    await send("DELETE", `/api/people/columns/${y.id}`);
  });

  it("refuses approving a removal while drafts of people give the column values, and lists that are missing or retired", async () => {
    const { list, choices } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    await send("DELETE", `/api/people/columns/${field.id}`);
    const drafted = await send("POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("E"),
          values: { [field.id]: [String(choices[0]?.id)] },
        },
      ],
    });
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      409,
    );
    const [personId = ""] = drafted.json<{ ids: string[] }>().ids;
    await send("DELETE", `/api/people/${personId}/draft`);
    await send("DELETE", `/api/people/columns/${field.id}/draft`);

    const other = await liveColumn(list.id);
    const retired = await liveList(["B"]);
    await send("PUT", `/api/lists/${retired.list.id}/retired`, {
      retired: true,
    });
    await decide("approval", { lists: [retired.list.id] });
    for (const listId of [randomUUID(), retired.list.id]) {
      expect(
        (
          await send("PUT", `/api/people/columns/${other.id}`, {
            name: other.name,
            listId,
          })
        ).statusCode,
      ).toBe(400);
    }
  });
});

describe("undoing changes to columns saved before columns had drafts", () => {
  it("puts back the list a column drew on only while that list is live and not retired", async () => {
    const { list: first } = await liveList(["A"]);
    const { list: second } = await liveList(["B"]);
    const field = await liveColumn(first.id);
    await test.connection
      .update(fields)
      .set({ listId: second.id })
      .where(eq(fields.id, field.id));
    const changed = await test.connection.transaction((transaction) =>
      recordChanges(transaction, editor.id, [
        {
          recordType: "field",
          recordId: field.id,
          action: "changed",
          field: "listId",
          tier: "general",
          oldValue: first.id,
          newValue: second.id,
        },
      ]),
    );
    const setRetired = (retired: boolean) =>
      test.connection
        .update(lists)
        .set({ retired })
        .where(eq(lists.id, first.id));
    await setRetired(true);
    expect(
      (await send("POST", `/api/undo/${String(changed)}`)).statusCode,
    ).toBe(400);
    expect((await liveField(field.id))?.listId).toBe(second.id);
    await setRetired(false);
    expect(
      (await send("POST", `/api/undo/${String(changed)}`)).statusCode,
    ).toBe(200);
    expect((await liveField(field.id))?.listId).toBe(first.id);
    const gone = await test.connection.transaction((transaction) =>
      recordChanges(transaction, editor.id, [
        {
          recordType: "field",
          recordId: field.id,
          action: "changed",
          field: "listId",
          tier: "general",
          oldValue: randomUUID(),
          newValue: first.id,
        },
      ]),
    );
    expect((await send("POST", `/api/undo/${String(gone)}`)).statusCode).toBe(
      400,
    );
  });

  it("puts back a column's settings and the order, and takes out a column added, unless values or drafts hold it", async () => {
    const { list, choices } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    const before = await liveOrder();
    const renamed = unique("Fictional Renamed");
    await test.connection
      .update(fields)
      .set({ name: renamed })
      .where(eq(fields.id, field.id));
    const moved = [...before].reverse();
    await test.connection
      .update(columnOrders)
      .set({ keys: moved })
      .where(eq(columnOrders.tableName, "people"));
    const changed = await test.connection.transaction((transaction) =>
      recordChanges(transaction, editor.id, [
        {
          recordType: "field",
          recordId: field.id,
          action: "changed",
          field: "name",
          tier: "general",
          oldValue: field.name,
          newValue: renamed,
        },
        {
          recordType: "column-order",
          recordId: "people",
          action: "changed",
          field: "order",
          tier: "general",
          oldValue: before,
          newValue: moved,
        },
      ]),
    );
    expect(
      (await send("POST", `/api/undo/${String(changed)}`)).statusCode,
    ).toBe(200);
    expect((await liveField(field.id))?.name).toBe(field.name);
    expect(await liveOrder()).toEqual(before);

    const addLegacy = async () => {
      const id = randomUUID();
      const row = {
        id,
        tableName: "people",
        name: unique("Fictional Legacy"),
        listId: list.id,
        multiple: false,
        required: false,
      };
      await test.connection.insert(fields).values(row);
      const changeSetId = await test.connection.transaction((transaction) =>
        recordChanges(
          transaction,
          editor.id,
          (
            ["tableName", "name", "listId", "multiple", "required"] as const
          ).map((name) => ({
            recordType: "field" as const,
            recordId: id,
            action: "created" as const,
            field: name,
            tier: "general" as const,
            oldValue: null,
            newValue: new Map(Object.entries(row)).get(name),
          })),
        ),
      );
      return { id, changeSetId: String(changeSetId) };
    };
    const plain = await addLegacy();
    expect(
      (await send("POST", `/api/undo/${plain.changeSetId}`)).statusCode,
    ).toBe(200);
    expect(await liveField(plain.id)).toBeUndefined();

    const valued = await addLegacy();
    await livePerson({ [valued.id]: [String(choices[0]?.id)] });
    expect(
      (await send("POST", `/api/undo/${valued.changeSetId}`)).statusCode,
    ).toBe(409);

    const drafted = await addLegacy();
    await send("POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("E"),
          values: { [drafted.id]: [String(choices[0]?.id)] },
        },
      ],
    });
    expect(
      (await send("POST", `/api/undo/${drafted.changeSetId}`)).statusCode,
    ).toBe(409);
  });
});

describe("what decides and keeps column drafts safe", () => {
  it("needs an Approver who sees people, and the column's values", async () => {
    const { list } = await liveList(["A"], "confidential");
    const { field } = await draftColumn(list.id);
    const listsOnly = await test.signedIn(["approver"]);
    expect(
      (await decide("approval", { columns: [field.id] }, listsOnly.cookie))
        .statusCode,
    ).toBe(403);
    const generalOnly = await test.signedIn(["approver", "resource-planner"]);
    expect(
      (
        await decide(
          "rejection",
          { columns: [field.id], reason: "No" },
          generalOnly.cookie,
        )
      ).statusCode,
    ).toBe(403);
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      200,
    );
  });

  it("keeps a list a column draft draws on from being deleted or retired", async () => {
    const { list } = await liveList(["A"]);
    const { field } = await draftColumn(list.id);
    const deleted = await send("DELETE", `/api/lists/${list.id}`);
    expect(deleted.statusCode).toBe(409);
    expect(deleted.json<{ error: string }>().error).toContain(field.name);
    expect(
      (await send("PUT", `/api/lists/${list.id}/retired`, { retired: true }))
        .statusCode,
    ).toBe(409);
  });

  it("refuses to undo into a column draft that drafting would refuse", async () => {
    const { list, choices } = await liveList(["A"]);
    const column = await liveColumn(list.id);
    const removed = await send("DELETE", `/api/people/columns/${column.id}`);
    expect(removed.statusCode).toBe(200);
    const discarded = await send(
      "DELETE",
      `/api/people/columns/${column.id}/draft`,
    );
    const { changeSetId } = discarded.json<{ changeSetId: string }>();
    // Meanwhile a draft gives someone a value in the column.
    const person = await livePerson();
    const given = await send("PATCH", `/api/people/${person}`, {
      values: { [column.id]: [String(choices[0]?.id)] },
    });
    expect(given.statusCode, given.body).toBe(200);
    expect((await send("POST", `/api/undo/${changeSetId}`)).statusCode).toBe(
      409,
    );

    const other = await liveList(["B"]);
    const renamed = await send("PUT", `/api/people/columns/${column.id}`, {
      name: unique("Fictional Renamed"),
      listId: other.list.id,
    });
    expect(renamed.statusCode, renamed.body).toBe(409);
  });
});

describe("undoing changes to column drafts", () => {
  // Drafts a column, discards it, changes something with the given step, and tries to undo the
  // discard, which would put the draft back.
  async function undoDiscardAfter(
    step: (list: List, name: string) => Promise<unknown>,
  ) {
    const { list } = await liveList(["A"]);
    const { field } = await draftColumn(list.id);
    const { changeSetId } = (
      await send("DELETE", `/api/people/columns/${field.id}/draft`)
    ).json<{ changeSetId: string }>();
    await step(list, field.name);
    return (await send("POST", `/api/undo/${changeSetId}`)).statusCode;
  }

  it("refuses a name taken since, and a list retired or deleted since", async () => {
    expect(
      await undoDiscardAfter((list, name) =>
        send("POST", "/api/people/columns", { name, listId: list.id }),
      ),
    ).toBe(409);
    expect(
      await undoDiscardAfter(async (list) => {
        await send("PUT", `/api/lists/${list.id}/retired`, { retired: true });
        return decide("approval", { lists: [list.id] });
      }),
    ).toBe(409);
    expect(
      await undoDiscardAfter(async (list) => {
        await send("DELETE", `/api/lists/${list.id}`);
        return decide("approval", { lists: [list.id] });
      }),
    ).toBe(409);
  });

  it("refuses to put back a removal once its maker may no longer change people", async () => {
    const remover = await test.signedIn(["workforce-administrator", "viewer"]);
    const { list } = await liveList(["A"]);
    const column = await liveColumn(list.id);
    await test.request(
      remover.cookie,
      "DELETE",
      `/api/people/columns/${column.id}`,
    );
    const { changeSetId } = (
      await test.request(
        remover.cookie,
        "DELETE",
        `/api/people/columns/${column.id}/draft`,
      )
    ).json<{ changeSetId: string }>();
    // No role changes configuration without people today, so the actor is made by hand.
    const configurationOnly = {
      user: { id: remover.id, name: "Fictional Remover", email: "" },
      roles: [],
      permissions: ["configuration:edit", "configuration:view"] as Permission[],
    };
    await expect(
      createDataAccess(test.connection).undo(configurationOnly, changeSetId),
    ).rejects.toThrow(ConflictError);
  });

  it("refuses to put back a removal of a column whose values its maker can no longer see", async () => {
    const remover = await test.signedIn(["workforce-administrator", "viewer"]);
    const { list } = await liveList(["A"], "confidential");
    const column = await liveColumn(list.id);
    await test.request(
      remover.cookie,
      "DELETE",
      `/api/people/columns/${column.id}`,
    );
    const { changeSetId } = (
      await test.request(
        remover.cookie,
        "DELETE",
        `/api/people/columns/${column.id}/draft`,
      )
    ).json<{ changeSetId: string }>();
    const withoutConfidential = {
      user: { id: remover.id, name: "Fictional Remover", email: "" },
      roles: [],
      permissions: [
        "configuration:edit",
        "configuration:view",
        "people:edit",
        "people:view",
      ] as Permission[],
    };
    await expect(
      createDataAccess(test.connection).undo(withoutConfidential, changeSetId),
    ).rejects.toThrow(ConflictError);
  });

  it("puts back a column drafted to be added once its discarding is undone", async () => {
    expect(await undoDiscardAfter(() => Promise.resolve())).toBe(200);
  });

  it("puts back a removal once its discarding is undone", async () => {
    const { list } = await liveList(["A"]);
    const column = await liveColumn(list.id);
    await send("DELETE", `/api/people/columns/${column.id}`);
    const { changeSetId } = (
      await send("DELETE", `/api/people/columns/${column.id}/draft`)
    ).json<{ changeSetId: string }>();
    expect((await send("POST", `/api/undo/${changeSetId}`)).statusCode).toBe(
      200,
    );
    expect(
      (await readPeople()).fields.find(({ id }) => id === column.id)?.draft,
    ).toMatchObject({ action: "deleted" });
  });

  it("puts back a change to a live column's draft", async () => {
    const { list } = await liveList(["A"]);
    const column = await liveColumn(list.id);
    const { changeSetId } = (
      await send("PUT", `/api/people/columns/${column.id}`, {
        name: unique("Fictional Renamed"),
        listId: list.id,
      })
    ).json<{ changeSetId: string }>();
    expect((await send("POST", `/api/undo/${changeSetId}`)).statusCode).toBe(
      200,
    );
    expect(
      (await readPeople()).fields.find(({ id }) => id === column.id),
    ).not.toHaveProperty("draft");
  });
});

describe("columns drawing on lists drafted to be added", () => {
  async function addedList() {
    const response = await send("POST", "/api/lists", {
      name: unique("Fictional List"),
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ list: List; changeSetId: string }>();
  }

  const liveListRow = async (id: string) =>
    (await test.connection.select().from(lists).where(eq(lists.id, id))).at(0);

  it("drafts a column on a list drafted to be added, and approves the list with the column", async () => {
    const { list } = await addedList();
    const { field } = await draftColumn(list.id);
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).toMatchObject({ listId: list.id, draft: { action: "created" } });
    const approved = await decide("approval", { columns: [field.id] });
    expect(approved.statusCode, approved.body).toBe(200);
    expect(await liveListRow(list.id)).toMatchObject({ name: list.name });
    expect(await liveField(field.id)).toMatchObject({ listId: list.id });
    expect(await test.historyOf(list.id)).toContainEqual(
      expect.objectContaining({ action: "created", madeBy: approver.id }),
    );
  });

  it("approves the list with a column the order of the columns places", async () => {
    const { list } = await addedList();
    const { field } = await draftColumn(list.id);
    await send("PUT", `/api/people/columns/${field.id}/position`, {
      after: null,
    });
    const approved = await decide("approval", { columnOrder: true });
    expect(approved.statusCode, approved.body).toBe(200);
    expect(await liveListRow(list.id)).toBeDefined();
    expect((await liveOrder())[0]).toBe(field.id);
  });

  it("moves a column's draft onto a list drafted to be added", async () => {
    const { list: live } = await liveList(["A"]);
    const { field } = await draftColumn(live.id);
    const { list } = await addedList();
    const moved = await send("PUT", `/api/people/columns/${field.id}`, {
      name: field.name,
      listId: list.id,
    });
    expect(moved.statusCode, moved.body).toBe(200);
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      200,
    );
    expect(await liveField(field.id)).toMatchObject({ listId: list.id });
  });

  it("refuses a list drafted to be removed", async () => {
    const removed = await liveList(["B"]);
    await send("DELETE", `/api/lists/${removed.list.id}`);
    expect(
      (
        await send("POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          listId: removed.list.id,
        })
      ).statusCode,
    ).toBe(400);
  });

  it("rejects the list only together with the column, and approves neither while the list is rejected", async () => {
    const { list } = await addedList();
    const { field } = await draftColumn(list.id);
    const alone = await decide("rejection", {
      lists: [list.id],
      reason: "Not yet",
    });
    expect(alone.statusCode).toBe(409);
    expect(alone.json<{ error: string }>().error).toContain(
      "Reject them together",
    );
    expect(
      (
        await decide("rejection", {
          lists: [list.id],
          columns: [field.id],
          reason: "Not yet",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}/draft/rejection`))
        .statusCode,
    ).toBe(200);
    const approved = await decide("approval", { columns: [field.id] });
    expect(approved.statusCode).toBe(409);
    expect(approved.json<{ error: string }>().error).toContain("rejected");
    expect(await liveListRow(list.id)).toBeUndefined();
    expect(await liveField(field.id)).toBeUndefined();
    await send("DELETE", `/api/people/columns/${field.id}/draft`);
    await send("DELETE", `/api/lists/${list.id}/draft`);
  });

  it("keeps a list drafted to be added that a column draws on from being discarded, deleted, or undone", async () => {
    const { list, changeSetId } = await addedList();
    const { field } = await draftColumn(list.id);
    for (const [method, url] of [
      ["DELETE", `/api/lists/${list.id}/draft`],
      ["DELETE", `/api/lists/${list.id}`],
      ["POST", `/api/undo/${changeSetId}`],
    ] as const) {
      const refused = await send(method, url);
      expect(refused.statusCode, url).toBe(409);
    }
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}`)).statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", `/api/lists/${list.id}/draft`)).statusCode,
    ).toBe(200);
  });
});
