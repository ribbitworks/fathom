// SPDX-License-Identifier: Apache-2.0

// Shared setup for the draft integration tests: a test app with an editor and an approver, and
// helpers that draft, approve, reject and undo people's changes and read them live and as drafts
// through the routes.

import { drafts, people } from "@fathom/db";
import {
  type ChangeHistory,
  type Choice,
  type Field,
  type List,
  type Person,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { expect } from "vitest";
import {
  type Method,
  sender,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

// For the tests that open pull requests also edit, until they take it from test-app.ts.
export { unique };

export let test: TestApp;
export let editor: { id: string; cookie: string };
export let approver: { id: string; cookie: string };

export async function startDraftTests(): Promise<void> {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  // Sees every tier, as the Engineering Director does.
  approver = await test.signedIn("engineering-director");
}

export async function closeDraftTests(): Promise<void> {
  await test.close();
}

export const send = sender(() => test);

// Sends a change as the editor, expecting it to be saved, and returns its change set.
export async function saved(method: Method, url: string, payload?: object) {
  const response = await send(editor.cookie, method, url, payload);
  expect(response.statusCode, response.body).toBeLessThan(300);
  return response.json<{ changeSetId: string | null }>().changeSetId;
}

export async function columnWith(labels: string[], visibility = "general") {
  const list = (
    await send(editor.cookie, "POST", "/api/lists", {
      name: unique("Fictional List"),
      visibility,
    })
  ).json<{ list: List }>().list;
  const choices = (
    await send(editor.cookie, "POST", `/api/lists/${list.id}/choices`, {
      choices: labels.map((label) => ({ label })),
    })
  ).json<{ choices: Choice[] }>().choices;
  await test.approveLists();
  const field = (
    await send(editor.cookie, "POST", "/api/people/columns", {
      name: unique("Fictional Column"),
      listId: list.id,
      multiple: true,
    })
  ).json<{ field: Field }>().field;
  await test.approveLists();
  return { list, choices, field };
}

export async function draftPerson(person: object = {}) {
  const response = await send(editor.cookie, "POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("E"),
        positionId: testPosition,
        ...person,
      },
    ],
  });
  expect(response.statusCode, response.body).toBe(201);
  const { ids, changeSetId } = response.json<{
    ids: string[];
    changeSetId: string;
  }>();
  return { id: String(ids[0]), changeSetId };
}

export async function approve(ids: string[], cookie = approver.cookie) {
  return send(cookie, "POST", "/api/drafts/approval", { people: ids });
}

// Approves the drafts of the columns given alone, so other drafts a test makes stay waiting.
export async function approveColumns(...ids: string[]) {
  const response = await send(approver.cookie, "POST", "/api/drafts/approval", {
    columns: ids,
  });
  expect(response.statusCode, response.body).toBe(200);
}

export async function reject(
  ids: string[],
  reason: string,
  cookie = approver.cookie,
) {
  return send(cookie, "POST", "/api/drafts/rejection", {
    people: ids,
    reason,
  });
}

export async function livePerson(person: object = {}) {
  const drafted = await draftPerson(person);
  expect((await approve([drafted.id])).statusCode).toBe(200);
  return drafted;
}

export async function seen(
  cookie: string,
  id: string,
): Promise<Person | undefined> {
  const response = await send(cookie, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response
    .json<{ people: Person[] }>()
    .people.find((person) => person.id === id);
}

export async function live(id: string) {
  const [row] = await test.connection
    .select()
    .from(people)
    .where(eq(people.id, id));
  return row;
}

export async function draftRow(id: string) {
  const [row] = await test.connection
    .select()
    .from(drafts)
    .where(eq(drafts.recordId, id));
  return row;
}

export async function entry(cookie: string, changeSetId: string | null) {
  const response = await send(cookie, "GET", "/api/changes");
  return response
    .json<ChangeHistory>()
    .entries.find(({ id }) => id === changeSetId);
}

export async function undo(changeSetId: string | null, cookie = editor.cookie) {
  return send(cookie, "POST", `/api/undo/${String(changeSetId)}`);
}
