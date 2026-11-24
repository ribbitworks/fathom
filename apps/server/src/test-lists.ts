// SPDX-License-Identifier: Apache-2.0

// What the tests of lists and their choices share: signing in, sending requests, and making and
// reading lists, against the test app the getter gives once it has started.

import type { Choice, List, Role } from "@fathom/shared";
import { expect } from "vitest";
import { type Method, type TestApp, unique } from "./test-app.ts";

export const editorRole: Role = "workforce-administrator";

export function listHelpers(app: () => TestApp) {
  const signedIn = (role: Role) => app().signedIn(role);
  const request = (
    cookie: string,
    method: Method,
    url: string,
    payload?: object,
  ) => app().request(cookie, method, url, payload);
  const uniqueName = (prefix = "Fictional List") => unique(prefix);

  async function readLists(cookie: string): Promise<List[]> {
    const response = await request(cookie, "GET", "/api/lists");
    expect(response.statusCode).toBe(200);
    return response.json<{ lists: List[] }>().lists;
  }

  async function readList(
    cookie: string,
    id: string,
  ): Promise<List | undefined> {
    return (await readLists(cookie)).find((list) => list.id === id);
  }

  async function createList(
    cookie: string,
    payload: object = {},
  ): Promise<List> {
    const response = await request(cookie, "POST", "/api/lists", {
      name: uniqueName(),
      ...payload,
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ list: List }>().list;
  }

  async function addChoices(
    cookie: string,
    listId: string,
    labels: string[],
  ): Promise<Choice[]> {
    const response = await request(
      cookie,
      "POST",
      `/api/lists/${listId}/choices`,
      { choices: labels.map((label) => ({ label })) },
    );
    expect(response.statusCode).toBe(201);
    return response.json<{ choices: Choice[] }>().choices;
  }

  async function labelsOf(cookie: string, listId: string): Promise<string[]> {
    return ((await readList(cookie, listId))?.choices ?? []).map(
      ({ label }) => label,
    );
  }

  return {
    signedIn,
    request,
    uniqueName,
    historyOf: (id: string) => app().historyOf(id),
    readLists,
    readList,
    createList,
    addChoices,
    labelsOf,
  };
}
