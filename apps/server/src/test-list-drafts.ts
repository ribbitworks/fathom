// SPDX-License-Identifier: Apache-2.0

// Shared setup for the list draft integration tests: a test app with an editor and an approver, and
// helpers that draft, decide, move and undo lists, choices and their orders, and add the columns
// and people that use them, through the routes.

import { listItems } from "@fathom/db";
import type { Choice, List } from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import { expect } from "vitest";
import {
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

export let test: TestApp;
export let editor: { id: string; cookie: string };
export let approver: { id: string; cookie: string };

export async function startListDraftTests(): Promise<void> {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn([
    "configuration:approve",
    "people:approve",
    "people:edit",
    "personal:edit",
    "confidential:edit",
    "configuration:edit",
  ]);
}

export async function closeListDraftTests(): Promise<void> {
  await test.close();
}

export async function readList(id: string): Promise<List | undefined> {
  const response = await test.request(editor.cookie, "GET", "/api/lists");
  return response
    .json<{ lists: List[] }>()
    .lists.find((list) => list.id === id);
}

export async function draftList(
  name = unique("Fictional List"),
): Promise<List> {
  const response = await test.request(editor.cookie, "POST", "/api/lists", {
    name,
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ list: List }>().list;
}

export async function draftChoices(listId: string, labels: string[]) {
  const response = await test.request(
    editor.cookie,
    "POST",
    `/api/lists/${listId}/choices`,
    { choices: labels.map((label) => ({ label })) },
  );
  expect(response.statusCode).toBe(201);
  return response.json<{ choices: Choice[] }>().choices;
}

export const decide = (
  asking: "approval" | "rejection",
  body: object,
  cookie = approver.cookie,
) => test.request(cookie, "POST", `/api/drafts/${asking}`, body);

// A live list with live choices, approved together.
export async function liveList(labels: string[]) {
  const list = await draftList();
  const choices = await draftChoices(list.id, labels);
  const approved = await decide("approval", {
    choices: choices.map(({ id }) => id),
  });
  expect(approved.statusCode).toBe(200);
  return { list, choices };
}

export const liveChoices = (listId: string) =>
  test.connection
    .select({ label: listItems.label, position: listItems.position })
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position));

export const send = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: object,
) => test.request(editor.cookie, method, url, body);

export function changeSetOf(
  response: Awaited<ReturnType<typeof send>>,
): string {
  expect(response.statusCode).toBeLessThan(300);
  return response.json<{ changeSetId: string }>().changeSetId;
}

export const undo = (changeSetId: string) =>
  send("POST", `/api/undo/${changeSetId}`);

export const move = (listId: string, choiceId: string, after: string | null) =>
  send("PUT", `/api/lists/${listId}/choices/${choiceId}/position`, { after });

export async function columnOn(listId: string) {
  const response = await send("POST", "/api/people/columns", {
    name: unique("Fictional Column"),
    listId,
  });
  expect(response.statusCode).toBe(201);
  const field = response.json<{ field: { id: string } }>().field;
  // Only the column, so the drafts of lists these tests make stay waiting.
  expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
    200,
  );
  return field;
}

export async function personWith(fieldId: string, choiceId: string) {
  const response = await send("POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("E"),
        positionId: testPosition,
        values: { [fieldId]: [choiceId] },
      },
    ],
  });
  expect(response.statusCode).toBe(201);
}
