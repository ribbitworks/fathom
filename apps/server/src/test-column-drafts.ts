// SPDX-License-Identifier: Apache-2.0

// Shared setup for the column draft integration tests: a test app with an editor and an approver,
// and helpers that make live lists, columns and people, draft columns, decide drafts and read the
// People table through the routes.

import { columnOrders, fields } from "@fathom/db";
import {
  type Choice,
  type Field,
  type List,
  type Person,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { expect } from "vitest";
import { actorWith } from "./access.ts";
import {
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

export let test: TestApp;
export let editor: { id: string; cookie: string };
// The editor as an actor whose changes are recorded without a role, as before roles were recorded.
export const editorActor = () =>
  actorWith({ id: editor.id, name: "", email: "" }, []);
export let approver: { id: string; cookie: string };

export async function startColumnDraftTests(): Promise<void> {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
}

export async function closeColumnDraftTests(): Promise<void> {
  await test.close();
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export const send = (method: Method, url: string, body?: object) =>
  test.request(editor.cookie, method, url, body);

export const decide = (
  asking: "approval" | "rejection",
  body: object,
  cookie = approver.cookie,
) => test.request(cookie, "POST", `/api/drafts/${asking}`, body);

interface PeopleRead {
  people: Person[];
  fields: Field[];
  order: string[];
}

export async function readPeople(cookie = editor.cookie): Promise<PeopleRead> {
  const response = await test.request(cookie, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response.json<PeopleRead>();
}

// A live list with live choices.
export async function liveList(labels: string[], visibility = "general") {
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

export async function draftColumn(listId: string, settings: object = {}) {
  const response = await send("POST", "/api/people/columns", {
    name: unique("Fictional Column"),
    listId,
    ...settings,
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ field: Field; changeSetId: string }>();
}

export async function liveColumn(listId: string, settings: object = {}) {
  const made = await draftColumn(listId, settings);
  expect(
    (await decide("approval", { columns: [made.field.id] })).statusCode,
  ).toBe(200);
  return made.field;
}

export async function livePerson(values: Record<string, string[]> = {}) {
  const response = await send("POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("E"),
        positionId: testPosition,
        values,
      },
    ],
  });
  expect(response.statusCode, response.body).toBe(201);
  const [id = ""] = response.json<{ ids: string[] }>().ids;
  expect((await decide("approval", { people: [id] })).statusCode).toBe(200);
  return id;
}

export const liveField = async (id: string) =>
  (await test.connection.select().from(fields).where(eq(fields.id, id))).at(0);

export const liveOrder = async () =>
  (
    await test.connection
      .select({ keys: columnOrders.keys })
      .from(columnOrders)
      .where(eq(columnOrders.tableName, "people"))
  ).at(0)?.keys ?? [];

export const changeSet = (response: Awaited<ReturnType<typeof send>>) =>
  response.json<{ changeSetId: string }>().changeSetId;
