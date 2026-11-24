// SPDX-License-Identifier: Apache-2.0

// Shared setup for the unpublished draft integration tests: a test app with the users they act as,
// a live list and column, and helpers that draft, publish, discard, decide and read changes through
// the routes.

import { users } from "@fathom/db";
import {
  type ChangeHistory,
  type Choice,
  type Field,
  type List,
  type Person,
  type Unpublished,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { expect } from "vitest";
import {
  type Method,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

export interface User {
  id: string;
  cookie: string;
  name: string;
}

interface PeopleRead {
  people: Person[];
  fields: Field[];
  order: string[];
}

export let test: TestApp;
export let alice: User;
export let bob: User;
export let approver: User;
export let reader: User;
export let siteList: List;
export let north: Choice;
export let south: Choice;
export let siteColumn: Field;

export async function user(
  roles: Parameters<TestApp["signedIn"]>[0],
): Promise<User> {
  const signed = await test.signedIn(roles);
  const [found] = await test.connection
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, signed.id));
  return { ...signed, name: String(found?.name) };
}

export const send = (
  who: User,
  method: Method,
  url: string,
  payload?: object,
) => test.request(who.cookie, method, url, payload);

// Sends a change, expecting it to be saved, and returns what it answers.
export async function saved<Body = { changeSetId: string | null }>(
  who: User,
  method: Method,
  url: string,
  payload?: object,
): Promise<Body> {
  const response = await send(who, method, url, payload);
  expect(response.statusCode, response.body).toBeLessThan(300);
  return response.json<Body>();
}

export const changeSetOf = async (
  who: User,
  method: Method,
  url: string,
  payload?: object,
) => String((await saved(who, method, url, payload)).changeSetId);

export async function refused(
  who: User,
  method: Method,
  url: string,
  payload: object | undefined,
  error: string,
) {
  const response = await send(who, method, url, payload);
  expect(response.statusCode, response.body).toBe(409);
  expect(response.json<{ error: string }>().error).toBe(error);
}

export const held = (holder: User) =>
  `${holder.name} is changing this; it can be changed once they publish or discard their changes`;
export const heldDecision = (holder: User) =>
  `${holder.name} is changing one of these drafts; it can be decided once they publish or discard their changes`;

export const readPeople = async (who: User) =>
  (await send(who, "GET", "/api/people")).json<PeopleRead>();
export const personOf = async (who: User, id: string) =>
  (await readPeople(who)).people.find((person) => person.id === id);
const readLists = async (who: User) =>
  (await send(who, "GET", "/api/lists")).json<{ lists: List[] }>().lists;
export const listOf = async (who: User, id: string) =>
  (await readLists(who)).find((list) => list.id === id);
export const changesOf = async (who: User) =>
  (await send(who, "GET", "/api/unpublished")).json<Unpublished>().changes;
// The user's unpublished changes as the top bar names them.
export const unpublished = async (who: User) =>
  (await changesOf(who)).map(({ subject, action, discarded }) => ({
    subject,
    ...(action === undefined ? {} : { action }),
    ...(discarded === undefined ? {} : { discarded }),
  }));
export const publish = async (who: User, drafts?: object) =>
  (
    await saved<{ total: number }>(
      who,
      "POST",
      "/api/unpublished/publish",
      drafts === undefined ? undefined : { drafts },
    )
  ).total;
export const discard = async (who: User, drafts?: object) =>
  (
    await saved<{ total: number }>(
      who,
      "POST",
      "/api/unpublished/discard",
      drafts === undefined ? undefined : { drafts },
    )
  ).total;
export const history = async (who: User) =>
  (await send(who, "GET", "/api/changes")).json<ChangeHistory>().entries;
export const undo = (who: User, changeSetId: string) =>
  send(who, "POST", `/api/undo/${changeSetId}`);
export const decide = (asking: "approval" | "rejection", body: object) =>
  send(approver, "POST", `/api/drafts/${asking}`, body);

export async function draftPeople(
  who: User,
  names: string[],
): Promise<string[]> {
  const body = await saved<{ ids: string[] }>(who, "POST", "/api/people", {
    people: names.map((preferredName) => ({
      preferredName,
      employeeId: unique("E"),
      positionId: testPosition,
    })),
  });
  return body.ids;
}

// Live people, drafted, published, and approved.
export async function livePeople(total: number): Promise<string[]> {
  const ids = await draftPeople(
    alice,
    Array.from({ length: total }, () => unique("Fictional Person")),
  );
  await publish(alice);
  expect((await decide("approval", { people: ids })).statusCode).toBe(200);
  return ids;
}

// A live list with live choices, drafted, published, and approved.
export async function liveList(labels: string[]): Promise<{
  list: List;
  choices: Choice[];
}> {
  const list = (
    await saved<{ list: List }>(alice, "POST", "/api/lists", {
      name: unique("Fictional List"),
    })
  ).list;
  const choices =
    labels.length === 0
      ? []
      : (
          await saved<{ choices: Choice[] }>(
            alice,
            "POST",
            `/api/lists/${list.id}/choices`,
            { choices: labels.map((label) => ({ label })) },
          )
        ).choices;
  await publish(alice);
  await test.approveLists();
  return { list, choices };
}

export async function startUnpublishedTests(): Promise<void> {
  test = await startTestApp({ publishEachChange: false });
  alice = await user("workforce-administrator");
  bob = await user("workforce-administrator");
  approver = await user("engineering-director");
  reader = await user("team-member");
  const sites = await liveList(["North", "South"]);
  siteList = sites.list;
  [north, south] = sites.choices as [Choice, Choice];
  siteColumn = (
    await saved<{ field: Field }>(alice, "POST", "/api/people/columns", {
      name: unique("Fictional Site"),
      listId: siteList.id,
    })
  ).field;
  await publish(alice);
  await test.approveLists();
}

export async function closeUnpublishedTests(): Promise<void> {
  await test.close();
}
