// SPDX-License-Identifier: Apache-2.0

// Shared setup for the change history's tests: a test app with an administrator's account, and
// helpers that read the history, search it, and make and approve the changes it records.

import { type ChangeHistory, type Field, type List } from "@fathom/shared";
import { expect } from "vitest";
import {
  changeEntry,
  startTestApp,
  type TestApp,
  testPosition,
} from "./test-app.ts";

export let test: TestApp;
export let admin: { id: string; cookie: string };

export async function startChangeTests(): Promise<void> {
  test = await startTestApp();
  admin = await test.signedIn("workforce-administrator");
}

export async function closeChangeTests(): Promise<void> {
  await test.close();
}

export const history = async (cookie: string, before?: string) => {
  const response = await test.request(
    cookie,
    "GET",
    `/api/changes${before === undefined ? "" : `?before=${before}`}`,
  );
  expect(response.statusCode).toBe(200);
  return response.json<ChangeHistory>();
};

export const search = async (cookie: string, text: string) => {
  const response = await test.request(
    cookie,
    "GET",
    `/api/changes?search=${encodeURIComponent(text)}`,
  );
  expect(response.statusCode).toBe(200);
  return response.json<ChangeHistory>();
};

// The entry for a change set, or undefined when the reader does not see it.
export const entryFor = (cookie: string, changeSetId: string | null) =>
  changeEntry(test, cookie, changeSetId);

export async function send(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: object,
) {
  const response = await test.request(admin.cookie, method, url, payload);
  expect(response.statusCode).toBeLessThan(300);
  return response.json<
    { changeSetId: string | null } & Record<string, unknown>
  >();
}

// A list with two choices, a People column drawing on it, and a person with the first choice.
export async function makePersonWithColumn(
  name: string,
  visibility = "general",
) {
  const { list } = (await send("POST", "/api/lists", {
    name: `${name} sites`,
    visibility,
  })) as unknown as { list: List };
  const { choices } = (await send("POST", `/api/lists/${list.id}/choices`, {
    choices: [{ label: `${name} North` }, { label: `${name} South` }],
  })) as unknown as { choices: { id: string }[] };
  const [north, south] = choices as [{ id: string }, { id: string }];
  await test.approveLists();
  const { field } = (await send("POST", "/api/people/columns", {
    name: `${name} site`,
    listId: list.id,
  })) as unknown as { field: Field };
  await test.approveLists();
  const { ids } = (await send("POST", "/api/people", {
    people: [
      {
        preferredName: `${name} Person`,
        employeeId: `E-${name}`,
        positionId: testPosition,
        values: { [field.id]: [north.id] },
      },
    ],
  })) as unknown as { ids: string[] };
  return { list, north, south, field, personId: ids[0] as string };
}

// Approves a person's draft, as an Approver who sees every tier.
export async function approve(personId: string) {
  const { cookie } = await test.signedIn("engineering-director");
  const response = await test.request(cookie, "POST", "/api/drafts/approval", {
    people: [personId],
  });
  expect(response.statusCode).toBe(200);
  return response.json<{ changeSetId: string }>().changeSetId;
}
