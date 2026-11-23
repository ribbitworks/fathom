// SPDX-License-Identifier: Apache-2.0

// Shared setup for the people integration tests: a test app with a fixed clock, and helpers that
// add people, lists and columns, approve and undo changes, and read people and the access history
// through the routes.

import { accessHistory } from "@fathom/db";
import {
  type Choice,
  type Field,
  type List,
  type Person,
} from "@fathom/shared";
import { and, desc, eq, ne } from "drizzle-orm";
import { expect, vi } from "vitest";
import {
  type Method,
  startTestApp,
  type TestApp,
  testPosition,
} from "./test-app.ts";

// How long a test waits for something to happen, so a busy computer does not fail it.
export const waitLimit = { timeout: 10_000 };

// The server takes today's date from the clock, so the tests fix it, to give the same days on every
// run.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

export let test: TestApp;

export async function startPeopleTests(): Promise<void> {
  test = await startTestApp();
}

export async function closePeopleTests(): Promise<void> {
  await test.close();
  vi.useRealTimers();
}

let count = 0;

// A name or Employee ID no other test uses, so tests sharing the database do not collide.
export function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

export async function editor() {
  return test.signedIn("workforce-administrator");
}

export async function send(
  cookie: string,
  method: Method,
  url: string,
  payload?: object,
) {
  return test.request(cookie, method, url, payload);
}

// A list with the given choices, and the choices in order.
export async function listWith(
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
export async function approveColumns(...ids: string[]) {
  const approver = await test.signedIn("engineering-director");
  const response = await send(approver.cookie, "POST", "/api/drafts/approval", {
    columns: ids,
  });
  expect(response.statusCode, response.body).toBe(200);
}

export async function addColumn(
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
export async function columnWith(
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

export function personRequest(person: NewPerson = {}) {
  return {
    preferredName: person.preferredName ?? unique("Fictional Person"),
    employeeId: person.employeeId ?? unique("E"),
    positionId: testPosition,
    ...person,
  };
}

export async function addPeople(cookie: string, people: NewPerson[]) {
  const response = await send(cookie, "POST", "/api/people", {
    people: people.map(personRequest),
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ ids: string[]; changeSetId: string }>();
}

export async function addPerson(cookie: string, person: NewPerson = {}) {
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
export async function addLivePerson(cookie: string, person: NewPerson = {}) {
  const added = await addPerson(cookie, person);
  await approve([added.id]);
  return added;
}

export async function readPeople(cookie: string) {
  const response = await send(cookie, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response.json<{
    people: Person[];
    fields: Field[];
    order: string[];
  }>();
}

export async function readPerson(
  cookie: string,
  id: string,
): Promise<Person | undefined> {
  return (await readPeople(cookie)).people.find((person) => person.id === id);
}

export async function undo(cookie: string, changeSetId: string) {
  return send(cookie, "POST", `/api/undo/${changeSetId}`);
}

// The latest access history entries for an account, newest first.
export async function accessOf(actorId: string) {
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
