// SPDX-License-Identifier: Apache-2.0

// Tests for drafts that use other drafts of another kind, against a PostgreSQL server of their own:
// people and planned hires given values in columns, and choices, drafted to be added, read with the tier of their
// column, and kept from losing what they use by discarding or undoing; approving a draft with those
// it uses, and rejecting a draft only with those that use it.

import {
  drafts,
  fields,
  fieldValues,
  listItems,
  lists,
  people,
  plannedHires,
} from "@fathom/db";
import type { Choice, Field, List, Person } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listTier, type ListsState } from "./data/lists.ts";
import {
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

let test: TestApp;
let editor: { id: string; cookie: string };
let approver: { id: string; cookie: string };
let planner: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
  planner = await test.signedIn("resource-planner");
});

afterAll(async () => {
  await test.close();
});

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
const send = (
  method: Method,
  url: string,
  body?: object,
  cookie = editor.cookie,
) => test.request(cookie, method, url, body);

async function readPeople(cookie = editor.cookie): Promise<Person[]> {
  const response = await test.request(cookie, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response.json<{ people: Person[] }>().people;
}

// A list drafted to be added, with choices drafted to be added, and a column drawing on it.
async function addedColumn(visibility = "general") {
  const list = (
    await send("POST", "/api/lists", {
      name: unique("Fictional List"),
      visibility,
    })
  ).json<{ list: List }>().list;
  const choices = (
    await send("POST", `/api/lists/${list.id}/choices`, {
      choices: [{ label: "Alpha" }, { label: "Beta" }],
    })
  ).json<{ choices: Choice[] }>().choices;
  const response = await send("POST", "/api/people/columns", {
    name: unique("Fictional Column"),
    listId: list.id,
  });
  expect(response.statusCode, response.body).toBe(201);
  const { field, changeSetId } = response.json<{
    field: Field;
    changeSetId: string;
  }>();
  return { list, choices, field, changeSetId };
}

async function personWith(values: Record<string, string[]>) {
  const response = await send("POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("U"),
        positionId: testPosition,
        values,
      },
    ],
  });
  expect(response.statusCode, response.body).toBe(201);
  const [id = ""] = response.json<{ ids: string[] }>().ids;
  return id;
}

const choiceIds = (choices: readonly Choice[]) => choices.map(({ id }) => id);

describe("people given what is only drafted to be added", () => {
  it("drafts a person with a choice drafted to be added, in a column drafted to be added", async () => {
    const { choices, field } = await addedColumn();
    const [alpha] = choiceIds(choices);
    const id = await personWith({ [field.id]: [String(alpha)] });
    const person = (await readPeople()).find((one) => one.id === id);
    expect(person?.values).toEqual({ [field.id]: [alpha] });
    expect(person?.draft).toMatchObject({ action: "created" });
  });

  it("gives a live person a choice drafted to be added to a live list", async () => {
    const { list, field } = await addedColumn();
    await test.approveLists();
    const id = await personWith({});
    const [gamma] = (
      await send("POST", `/api/lists/${list.id}/choices`, {
        choices: [{ label: "Gamma" }],
      })
    ).json<{ choices: Choice[] }>().choices;
    const changed = await send("PATCH", `/api/people/${id}`, {
      values: { [field.id]: [String(gamma?.id)] },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect((await readPeople()).find((one) => one.id === id)?.values).toEqual({
      [field.id]: [gamma?.id],
    });
  });

  it("refuses a choice only someone else is drafting, unpublished", async () => {
    const { list, field } = await addedColumn();
    await test.approveLists();
    const other = await test.signedIn("workforce-administrator");
    const [secret] = (
      await test.request(
        other.cookie,
        "POST",
        `/api/lists/${list.id}/choices`,
        { choices: [{ label: "Unpublished" }] },
        { publish: false },
      )
    ).json<{ choices: Choice[] }>().choices;
    const response = await send("POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("U"),
          positionId: testPosition,
          values: { [field.id]: [String(secret?.id)] },
        },
      ],
    });
    expect(response.statusCode).toBe(400);
  });

  it("hides values in a column drafted to be added from those who may not see its list's tier", async () => {
    const { choices, field } = await addedColumn("confidential");
    const id = await personWith({ [field.id]: choiceIds(choices).slice(0, 1) });
    const seen = (await readPeople(planner.cookie)).find(
      (one) => one.id === id,
    );
    expect(seen).toBeDefined();
    expect(seen?.values).toEqual({});
    expect(JSON.stringify(seen)).not.toContain(field.id);
    expect(
      (await readPeople(approver.cookie)).find((one) => one.id === id)?.values,
    ).toEqual({ [field.id]: choiceIds(choices).slice(0, 1) });
    const history = await test.historyOf(id);
    expect(history).toContainEqual(
      expect.objectContaining({
        field: `value:${field.id}`,
        tier: "confidential",
      }),
    );
  });
});

describe("the tier of values in a column drafted to be added", () => {
  it("is the most sensitive for a list that is neither live nor drafted", () => {
    expect(
      listTier(
        {
          lists: new Map(),
          builtIn: new Map(),
          choices: new Map(),
          listDrafts: new Map(),
          choiceDrafts: new Map(),
          orderDrafts: new Map(),
          held: { lists: new Map(), choices: new Map(), orders: new Map() },
        } satisfies ListsState,
        "missing",
      ),
    ).toBe("confidential");
  });

  it("is not lowered by the editor's own unpublished change to the list", async () => {
    const { list, choices, field } = await addedColumn("confidential");
    const lowered = await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${list.id}`,
      { name: list.name, description: "", visibility: "general" },
      { publish: false },
    );
    expect(lowered.statusCode, lowered.body).toBe(200);
    const id = await personWith({ [field.id]: choiceIds(choices).slice(0, 1) });
    expect(await test.historyOf(id)).toContainEqual(
      expect.objectContaining({
        field: `value:${field.id}`,
        tier: "confidential",
      }),
    );
  });

  it("is not lowered by the editor's own unpublished change to which list the column uses", async () => {
    const { field } = await addedColumn();
    const secret = (
      await send("POST", "/api/lists", {
        name: unique("Fictional List"),
        visibility: "confidential",
      })
    ).json<{ list: List }>().list;
    const [secretChoice] = (
      await send("POST", `/api/lists/${secret.id}/choices`, {
        choices: [{ label: "Secret" }],
      })
    ).json<{ choices: Choice[] }>().choices;
    const unpublished = { publish: false };
    const moved = await test.request(
      editor.cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      { name: field.name, listId: secret.id },
      unpublished,
    );
    expect(moved.statusCode, moved.body).toBe(200);
    const lowered = await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${secret.id}`,
      { name: secret.name, description: "", visibility: "general" },
      unpublished,
    );
    expect(lowered.statusCode, lowered.body).toBe(200);
    const id = await personWith({ [field.id]: [String(secretChoice?.id)] });
    expect(await test.historyOf(id)).toContainEqual(
      expect.objectContaining({
        field: `value:${field.id}`,
        tier: "confidential",
      }),
    );
  });
});

describe("what people's drafts use stays while they use it", () => {
  it("refuses discarding a choice, a list, or a column people's drafts use, until they no longer do", async () => {
    const { list, choices, field } = await addedColumn();
    const [alpha, beta] = choiceIds(choices);
    const id = await personWith({ [field.id]: [String(alpha)] });
    for (const [method, url] of [
      ["DELETE", `/api/lists/${list.id}/choices/${String(alpha)}/draft`],
      ["DELETE", `/api/lists/${list.id}/choices/${String(alpha)}`],
      ["DELETE", `/api/people/columns/${field.id}/draft`],
      ["DELETE", `/api/people/columns/${field.id}`],
      ["DELETE", `/api/lists/${list.id}/draft`],
    ] as const) {
      expect((await send(method, url)).statusCode, url).toBe(409);
    }
    expect(
      (await send("DELETE", `/api/lists/${list.id}/choices/${String(beta)}`))
        .statusCode,
    ).toBe(200);
    expect((await send("DELETE", `/api/people/${id}/draft`)).statusCode).toBe(
      200,
    );
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}/draft`))
        .statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", `/api/lists/${list.id}/draft`)).statusCode,
    ).toBe(200);
  });

  it("lets an editor discard what they no longer use before publishing", async () => {
    const { list, choices, field } = await addedColumn();
    const [alpha] = choiceIds(choices);
    const id = await personWith({ [field.id]: [String(alpha)] });
    for (const url of [
      `/api/people/${id}/draft`,
      `/api/lists/${list.id}/choices/${String(alpha)}/draft`,
      `/api/people/columns/${field.id}/draft`,
      `/api/lists/${list.id}/draft`,
    ]) {
      const discarded = await test.request(
        editor.cookie,
        "DELETE",
        url,
        undefined,
        { publish: false },
      );
      expect(discarded.statusCode, url).toBe(200);
    }
  });

  it("still refuses while another editor's published draft uses it", async () => {
    const { list, choices, field } = await addedColumn();
    const [alpha] = choiceIds(choices);
    await personWith({ [field.id]: [String(alpha)] });
    const other = await test.signedIn("workforce-administrator");
    for (const url of [
      `/api/people/columns/${field.id}/draft`,
      `/api/lists/${list.id}/draft`,
    ]) {
      const refused = await test.request(
        other.cookie,
        "DELETE",
        url,
        undefined,
        { publish: false },
      );
      expect(refused.statusCode, url).toBe(409);
    }
  });

  it("refuses using a new list, column, or choice another editor is changing, unpublished", async () => {
    const { list, choices, field } = await addedColumn();
    const [alpha] = choiceIds(choices);
    const other = await test.signedIn("workforce-administrator");
    const discard = (url: string) =>
      test.request(other.cookie, "DELETE", url, undefined, { publish: false });
    await discard(`/api/lists/${list.id}/choices/${String(alpha)}/draft`);
    await discard(`/api/people/columns/${field.id}/draft`);
    const person = {
      preferredName: unique("Fictional Person"),
      employeeId: unique("U"),
      positionId: testPosition,
    };
    for (const values of [
      { [field.id]: [] },
      { [field.id]: [String(alpha)] },
    ]) {
      const refused = await send("POST", "/api/people", {
        people: [{ ...person, values }],
      });
      expect(refused.statusCode, JSON.stringify(values)).toBe(409);
    }
    const second = (
      await send("POST", "/api/lists", {
        name: unique("Fictional List"),
        visibility: "general",
      })
    ).json<{ list: List }>().list;
    expect((await discard(`/api/lists/${second.id}/draft`)).statusCode).toBe(
      200,
    );
    const column = await send("POST", "/api/people/columns", {
      name: unique("Fictional Column"),
      listId: second.id,
    });
    expect(column.statusCode).toBe(409);
  });

  it("refuses undoing the drafts adding a choice or a column people's drafts use", async () => {
    const { list, field, changeSetId } = await addedColumn();
    const added = await send("POST", `/api/lists/${list.id}/choices`, {
      choices: [{ label: "Delta" }],
    });
    const [delta] = added.json<{ choices: Choice[] }>().choices;
    await personWith({ [field.id]: [String(delta?.id)] });
    const choiceSet = added.json<{ changeSetId: string }>().changeSetId;
    for (const set of [choiceSet, changeSetId]) {
      expect((await send("POST", `/api/undo/${set}`)).statusCode).toBe(409);
    }
  });
});

const decide = (
  asking: "approval" | "rejection",
  body: object,
  cookie = approver.cookie,
) => test.request(cookie, "POST", `/api/drafts/${asking}`, body);

const isLive = async (
  table:
    | typeof lists
    | typeof listItems
    | typeof fields
    | typeof people
    | typeof plannedHires,
  id: string,
) =>
  (await test.connection.select().from(table).where(eq(table.id, id))).length >
  0;

describe("approving a draft with the drafts it uses", () => {
  it("approves a new list, a column drawing on it, and the choices people are given, with the people", async () => {
    const { list, choices, field } = await addedColumn();
    const [alpha, beta] = choiceIds(choices).map(String);
    const first = await personWith({ [field.id]: [alpha as string] });
    const second = await personWith({ [field.id]: [beta as string] });
    const approved = await decide("approval", { people: [first] });
    expect(approved.statusCode, approved.body).toBe(200);
    expect(await isLive(lists, list.id)).toBe(true);
    expect(await isLive(fields, field.id)).toBe(true);
    expect(await isLive(listItems, alpha as string)).toBe(true);
    expect(await isLive(listItems, beta as string)).toBe(false);
    expect(await isLive(people, first)).toBe(true);
    expect(
      await test.connection
        .select({ choiceId: fieldValues.choiceId })
        .from(fieldValues)
        .where(eq(fieldValues.personId, first)),
    ).toEqual([{ choiceId: alpha }]);
    expect((await decide("approval", { people: [second] })).statusCode).toBe(
      200,
    );
    expect(await isLive(listItems, beta as string)).toBe(true);
  });

  it("approves nothing when someone is changing a draft it uses", async () => {
    const { list, choices, field } = await addedColumn();
    const [alpha] = choiceIds(choices);
    const id = await personWith({ [field.id]: [String(alpha)] });
    const other = await test.signedIn("workforce-administrator");
    const change = (method: Method, url: string, body: object) =>
      test.request(other.cookie, method, url, body, { publish: false });
    for (const [url, body] of [
      [`/api/lists/${list.id}`, { name: list.name, description: "Held" }],
      [
        `/api/lists/${list.id}/choices/${String(alpha)}`,
        { label: "Alpha held", description: "" },
      ],
      [`/api/people/columns/${field.id}`, { name: unique("Held Column") }],
    ] as const) {
      const held = await change("PUT", url, {
        visibility: "general",
        listId: list.id,
        multiple: false,
        required: false,
        ...body,
      });
      expect(held.statusCode, held.body).toBe(200);
      const refused = await decide("approval", { people: [id] });
      expect(refused.statusCode, url).toBe(409);
      expect(await isLive(people, id)).toBe(false);
      await test.request(other.cookie, "POST", "/api/unpublished/discard");
    }
  });

  it("approves nothing when a draft it uses was rejected", async () => {
    const { list, choices, field } = await addedColumn();
    const id = await personWith({ [field.id]: choiceIds(choices).slice(0, 1) });
    expect(
      (
        await decide("rejection", {
          people: [id],
          lists: [list.id],
          choices: choiceIds(choices),
          columns: [field.id],
          reason: "Not this quarter",
        })
      ).statusCode,
    ).toBe(200);
    await send("DELETE", `/api/people/${id}/draft/rejection`);
    const refused = await decide("approval", { people: [id] });
    expect(refused.statusCode).toBe(409);
    expect(await isLive(lists, list.id)).toBe(false);
    expect(await isLive(people, id)).toBe(false);
  });

  it("refuses an Approver whose role does not approve the areas of the drafts a person's draft uses, approving nothing", async () => {
    const peopleApprover = await test.signedIn([
      "people:approve",
      "people:view",
      "restricted:view",
      "confidential:view",
    ]);
    const { list, choices, field } = await addedColumn();
    const id = await personWith({ [field.id]: choiceIds(choices).slice(0, 1) });
    const refused = await decide(
      "approval",
      { people: [id] },
      peopleApprover.cookie,
    );
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toEqual({
      error: "Your role doesn't let you approve drafts of configuration",
    });
    expect(await isLive(lists, list.id)).toBe(false);
    expect(await isLive(fields, field.id)).toBe(false);
    expect(await isLive(people, id)).toBe(false);
  });

  it("refuses an Approver who may not see a column a person's draft gives a value in, approving nothing", async () => {
    const generalApprover = await test.signedIn([
      "people:approve",
      "configuration:approve",
      "people:view",
    ]);
    const { list, choices, field } = await addedColumn("confidential");
    const added = await personWith({
      [field.id]: choiceIds(choices).slice(0, 1),
    });
    expect(
      (await decide("approval", { people: [added] }, generalApprover.cookie))
        .statusCode,
    ).toBe(403);
    const live = await personWith({});
    expect((await decide("approval", { people: [live] })).statusCode).toBe(200);
    await send("PATCH", `/api/people/${live}`, {
      values: { [field.id]: choiceIds(choices).slice(0, 1) },
    });
    expect(
      (await decide("approval", { people: [live] }, generalApprover.cookie))
        .statusCode,
    ).toBe(404);
    expect(await isLive(lists, list.id)).toBe(false);
    expect(await isLive(fields, field.id)).toBe(false);
  });
});

describe("rejecting a draft only with the drafts that use it", () => {
  it("records rejecting a person's draft at the tier of a column drafted to be added it gives a value in", async () => {
    const { choices, field } = await addedColumn("confidential");
    const id = await personWith({ [field.id]: choiceIds(choices).slice(0, 1) });
    const reason = "Fictional reason: not this quarter";
    expect(
      (await decide("rejection", { people: [id], reason })).statusCode,
    ).toBe(200);
    expect(await test.historyOf(id)).toContainEqual(
      expect.objectContaining({ newValue: reason, tier: "confidential" }),
    );
  });

  it("refuses an Approver whose role does not approve people rejecting a choice with the person whose draft uses it, rejecting nothing", async () => {
    const configurationApprover = await test.signedIn([
      "configuration:approve",
      "configuration:view",
      "people:view",
    ]);
    const { choices, field } = await addedColumn();
    const [alpha] = choiceIds(choices);
    const id = await personWith({ [field.id]: [String(alpha)] });
    const refused = await decide(
      "rejection",
      { people: [id], choices: [alpha], reason: "No" },
      configurationApprover.cookie,
    );
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toEqual({
      error: "Your role doesn't let you reject drafts of people",
    });
    const states = await test.connection
      .select({ state: drafts.state })
      .from(drafts)
      .where(
        and(
          eq(drafts.recordType, "list-item"),
          eq(drafts.recordId, String(alpha)),
        ),
      );
    expect(states).toEqual([{ state: "waiting" }]);
  });

  it("refuses rejecting a choice, a column, or a list a person's draft uses without that person", async () => {
    const { list, choices, field } = await addedColumn();
    const [alpha, beta] = choiceIds(choices);
    const id = await personWith({ [field.id]: [String(alpha)] });
    for (const asked of [
      { choices: [alpha] },
      { columns: [field.id] },
      { lists: [list.id], columns: [field.id], choices: [alpha, beta] },
    ]) {
      const refused = await decide("rejection", { ...asked, reason: "No" });
      expect(refused.statusCode, JSON.stringify(asked)).toBe(409);
      expect(refused.json<{ error: string }>().error).toContain(
        "Reject them together",
      );
    }
    expect(
      (await decide("rejection", { choices: [beta], reason: "No" })).statusCode,
    ).toBe(200);
    expect(
      (
        await decide("rejection", {
          people: [id],
          choices: [alpha],
          reason: "No",
        })
      ).statusCode,
    ).toBe(200);
  });
});

describe("planned hires given what is only drafted to be added", () => {
  async function hireWith(values: Record<string, string[]>) {
    const response = await send("POST", "/api/planned-hires", {
      hires: [{ positionId: testPosition, values }],
    });
    expect(response.statusCode, response.body).toBe(201);
    const [id = ""] = response.json<{ ids: string[] }>().ids;
    return id;
  }

  it("keeps a choice, a list, or a column a hire's draft uses until it no longer does", async () => {
    const { list, choices, field } = await addedColumn();
    const [alpha] = choiceIds(choices);
    const id = await hireWith({ [field.id]: [String(alpha)] });
    for (const url of [
      `/api/lists/${list.id}/choices/${String(alpha)}`,
      `/api/people/columns/${field.id}/draft`,
      `/api/lists/${list.id}/draft`,
    ]) {
      expect((await send("DELETE", url)).statusCode, url).toBe(409);
    }
    expect(
      (await send("DELETE", `/api/planned-hires/${id}/draft`)).statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}/draft`))
        .statusCode,
    ).toBe(200);
  });

  it("approves the list, column, and choice a hire's draft uses with the hire", async () => {
    const { list, choices, field } = await addedColumn();
    const [alpha] = choiceIds(choices).map(String);
    const id = await hireWith({ [field.id]: [alpha as string] });
    const approved = await decide("approval", { plannedHires: [id] });
    expect(approved.statusCode, approved.body).toBe(200);
    expect(await isLive(lists, list.id)).toBe(true);
    expect(await isLive(fields, field.id)).toBe(true);
    expect(await isLive(listItems, alpha as string)).toBe(true);
    expect(await isLive(plannedHires, id)).toBe(true);
    expect(
      await test.connection
        .select({ choiceId: fieldValues.choiceId })
        .from(fieldValues)
        .where(eq(fieldValues.plannedHireId, id)),
    ).toEqual([{ choiceId: alpha }]);
  });

  it("refuses rejecting a column a hire's draft uses without the hire", async () => {
    const { choices, field } = await addedColumn();
    const [alpha] = choiceIds(choices);
    const id = await hireWith({ [field.id]: [String(alpha)] });
    const refused = await decide("rejection", {
      columns: [field.id],
      reason: "No",
    });
    expect(refused.statusCode).toBe(409);
    expect(
      (
        await decide("rejection", {
          plannedHires: [id],
          columns: [field.id],
          choices: [alpha],
          reason: "No",
        })
      ).statusCode,
    ).toBe(200);
  });
});
