// SPDX-License-Identifier: Apache-2.0

// Tests for unpublished drafts, against a PostgreSQL server of their own: each user's changes to
// drafts of people, lists, choices, columns, and orders are theirs alone until they publish them,
// all at once, or discard them; others see the records held as published, marked with who holds
// them, and cannot change, approve, or reject them; values that must be unique stay taken while
// unpublished; the change history shows unpublished changes only to their maker, who alone can undo
// them; and publishing checks again that every draft still fits the data.

import { drafts, fields, listItems, lists, people, users } from "@fathom/db";
import type {
  ChangeHistory,
  Choice,
  Field,
  List,
  Person,
  Unpublished,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Method,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

interface User {
  id: string;
  cookie: string;
  name: string;
}

interface PeopleRead {
  people: Person[];
  fields: Field[];
  order: string[];
}

let test: TestApp;
let alice: User;
let bob: User;
let approver: User;
let reader: User;
let siteList: List;
let north: Choice;
let south: Choice;
let siteColumn: Field;

async function user(roles: Parameters<TestApp["signedIn"]>[0]): Promise<User> {
  const signed = await test.signedIn(roles);
  const [found] = await test.connection
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, signed.id));
  return { ...signed, name: String(found?.name) };
}

const send = (who: User, method: Method, url: string, payload?: object) =>
  test.request(who.cookie, method, url, payload);

// Sends a change, expecting it to be saved, and returns what it answers.
async function saved<Body = { changeSetId: string | null }>(
  who: User,
  method: Method,
  url: string,
  payload?: object,
): Promise<Body> {
  const response = await send(who, method, url, payload);
  expect(response.statusCode, response.body).toBeLessThan(300);
  return response.json<Body>();
}

const changeSetOf = async (
  who: User,
  method: Method,
  url: string,
  payload?: object,
) => String((await saved(who, method, url, payload)).changeSetId);

async function refused(
  who: User,
  method: Method,
  url: string,
  payload: object | undefined,
  error: string,
) {
  const response = await send(who, method, url, payload);
  expect(response.statusCode, response.body).toBe(409);
  expect(response.json()).toEqual({ error });
}

const held = (holder: User) =>
  `${holder.name} is changing this; it can be changed once they publish or discard their changes`;
const heldDecision = (holder: User) =>
  `${holder.name} is changing one of these drafts; it can be decided once they publish or discard their changes`;

const readPeople = async (who: User) =>
  (await send(who, "GET", "/api/people")).json<PeopleRead>();
const personOf = async (who: User, id: string) =>
  (await readPeople(who)).people.find((person) => person.id === id);
const readLists = async (who: User) =>
  (await send(who, "GET", "/api/lists")).json<{ lists: List[] }>().lists;
const listOf = async (who: User, id: string) =>
  (await readLists(who)).find((list) => list.id === id);
const unpublished = async (who: User) =>
  (await send(who, "GET", "/api/unpublished")).json<Unpublished>().changes;
const publish = async (who: User) =>
  (await saved<{ total: number }>(who, "POST", "/api/unpublished/publish"))
    .total;
const discard = async (who: User) =>
  (await saved<{ total: number }>(who, "POST", "/api/unpublished/discard"))
    .total;
const history = async (who: User) =>
  (await send(who, "GET", "/api/changes")).json<ChangeHistory>().entries;
const undo = (who: User, changeSetId: string) =>
  send(who, "POST", `/api/undo/${changeSetId}`);
const decide = (asking: "approval" | "rejection", body: object) =>
  send(approver, "POST", `/api/drafts/${asking}`, body);

async function draftPeople(who: User, names: string[]): Promise<string[]> {
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
async function livePeople(total: number): Promise<string[]> {
  const ids = await draftPeople(
    alice,
    Array.from({ length: total }, () => unique("Fictional Person")),
  );
  await publish(alice);
  expect((await decide("approval", { people: ids })).statusCode).toBe(200);
  return ids;
}

// A live list with live choices, drafted, published, and approved.
async function liveList(labels: string[]): Promise<{
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

beforeAll(async () => {
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
});

afterAll(async () => {
  await test.close();
});

describe("drafts of people, until published", () => {
  it("are seen only by their maker, then by everyone once published", async () => {
    const [changed = ""] = await livePeople(1);
    const [added = ""] = await draftPeople(alice, ["Fictional Newcomer"]);
    const renamed = unique("Fictional Renamed");
    const changeSetId = await changeSetOf(
      alice,
      "PATCH",
      `/api/people/${changed}`,
      { preferredName: renamed },
    );

    expect(await personOf(alice, added)).toMatchObject({
      draft: { action: "created", unpublished: true },
    });
    expect(await personOf(alice, changed)).toMatchObject({
      preferredName: renamed,
      draft: { action: "changed", unpublished: true, editors: [alice.name] },
    });
    expect(await personOf(alice, changed)).not.toHaveProperty("heldBy");
    for (const other of [bob, approver]) {
      expect(await personOf(other, added)).toBeUndefined();
      const seen = await personOf(other, changed);
      expect(seen).not.toHaveProperty("draft");
      expect(seen).toMatchObject({ heldBy: alice.name });
      expect(seen?.preferredName).not.toBe(renamed);
    }
    expect(await unpublished(alice)).toEqual([
      { subject: renamed, action: "changed" },
      { subject: "Fictional Newcomer", action: "created" },
    ]);
    expect(await unpublished(bob)).toEqual([]);
    expect((await history(alice)).map(({ id }) => id)).toContain(changeSetId);
    expect((await history(bob)).map(({ id }) => id)).not.toContain(changeSetId);

    expect(await publish(alice)).toBe(2);
    expect(await unpublished(alice)).toEqual([]);
    const seen = await personOf(bob, changed);
    expect(seen).toMatchObject({
      preferredName: renamed,
      draft: { action: "changed", state: "waiting", editors: [alice.name] },
    });
    expect(seen?.draft).not.toHaveProperty("unpublished");
    expect(seen).not.toHaveProperty("heldBy");
    expect(await personOf(bob, added)).toMatchObject({
      draft: { action: "created" },
    });
    expect((await history(bob)).map(({ id }) => id)).toContain(changeSetId);
  });

  it("hold the record: others cannot change, discard, resubmit, approve, or reject it", async () => {
    const [person = ""] = await livePeople(1);
    await saved(alice, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Held"),
    });
    await publish(alice);
    await saved(bob, "PATCH", `/api/people/${person}`, {
      values: { [siteColumn.id]: [north.id] },
    });
    for (const [method, url, payload] of [
      ["PATCH", `/api/people/${person}`, { preferredName: "Fictional" }],
      ["DELETE", `/api/people/${person}`, undefined],
      ["DELETE", `/api/people/${person}/draft`, undefined],
      ["DELETE", `/api/people/${person}/draft/rejection`, undefined],
    ] as [Method, string, object | undefined][]) {
      await refused(alice, method, url, payload, held(bob));
    }
    for (const asking of ["approval", "rejection"] as const) {
      const response = await decide(asking, {
        people: [person],
        reason: "Fictional reason",
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: heldDecision(bob) });
    }
    expect(await discard(bob)).toBe(1);
    expect((await decide("approval", { people: [person] })).statusCode).toBe(
      200,
    );
  });

  it("let anyone change a published draft as their own, crediting both once published", async () => {
    const [person = ""] = await livePeople(1);
    await saved(alice, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Shared"),
    });
    await publish(alice);
    await saved(bob, "PATCH", `/api/people/${person}`, {
      values: { [siteColumn.id]: [south.id] },
    });
    expect((await personOf(bob, person))?.draft).toMatchObject({
      unpublished: true,
      editors: [alice.name, bob.name],
      changedBy: { preferredName: alice.name, [siteColumn.id]: bob.name },
    });
    const forAlice = await personOf(alice, person);
    expect(forAlice).toMatchObject({
      heldBy: bob.name,
      draft: { editors: [alice.name], changed: ["preferredName"] },
    });
    expect(await publish(bob)).toBe(1);
    expect((await personOf(alice, person))?.draft).toMatchObject({
      editors: [alice.name, bob.name],
    });
  });

  it("are discarded all at once, privately, and the discard can be undone", async () => {
    const [person = ""] = await livePeople(1);
    const published = unique("Fictional Published");
    await saved(alice, "PATCH", `/api/people/${person}`, {
      preferredName: published,
    });
    await publish(alice);
    const edit = await changeSetOf(bob, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Discarded"),
    });
    expect(await discard(bob)).toBe(1);
    expect(await personOf(bob, person)).toMatchObject({
      preferredName: published,
      draft: { editors: [alice.name] },
    });
    expect(await personOf(alice, person)).not.toHaveProperty("heldBy");
    const mine = await history(bob);
    const withdrawal = mine.find(
      (entry) =>
        entry.kind === "discard" &&
        entry.records.some(({ fields }) => fields[0]?.newValue === published),
    );
    expect(withdrawal).toBeDefined();
    const theirs = (await history(alice)).map(({ id }) => id);
    expect(theirs).not.toContain(edit);
    expect(theirs).not.toContain(withdrawal?.id);
    expect((await undo(bob, edit)).statusCode).toBe(409);

    // Undoing the discard puts the changes back, unpublished.
    expect((await undo(bob, String(withdrawal?.id))).statusCode).toBe(200);
    expect((await personOf(bob, person))?.draft).toMatchObject({
      unpublished: true,
    });
    expect(await discard(bob)).toBe(1);

    // Changing the draft again credits only what is published.
    await saved(bob, "PATCH", `/api/people/${person}`, {
      values: { [siteColumn.id]: [north.id] },
    });
    expect((await personOf(bob, person))?.draft).toMatchObject({
      editors: [alice.name, bob.name],
      changedBy: { preferredName: alice.name },
    });
    await publish(bob);
    const after = (await history(alice)).map(({ id }) => id);
    expect(after).not.toContain(edit);
    expect(after).not.toContain(withdrawal?.id);
  });

  it("make a rejected draft wait again only once published", async () => {
    const [person = ""] = await livePeople(1);
    await saved(alice, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Rejected"),
    });
    await publish(alice);
    await decide("rejection", { people: [person], reason: "Fictional reason" });
    await saved(bob, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Again"),
    });
    expect((await personOf(bob, person))?.draft).toMatchObject({
      state: "waiting",
      unpublished: true,
    });
    expect((await personOf(bob, person))?.draft).not.toHaveProperty("reason");
    expect(await personOf(alice, person)).toMatchObject({
      heldBy: bob.name,
      draft: { state: "rejected", reason: "Fictional reason" },
    });
    await refused(
      alice,
      "DELETE",
      `/api/people/${person}/draft/rejection`,
      undefined,
      held(bob),
    );
    await publish(bob);
    expect((await personOf(alice, person))?.draft).toMatchObject({
      state: "waiting",
    });
    expect((await personOf(alice, person))?.draft).not.toHaveProperty("reason");
  });

  it("discard a published draft once published, and changing back to it holds nothing", async () => {
    const [person = ""] = await livePeople(1);
    const original = String((await personOf(alice, person))?.preferredName);
    const name = unique("Fictional Kept");
    await saved(alice, "PATCH", `/api/people/${person}`, {
      preferredName: name,
    });
    await publish(alice);
    await saved(bob, "DELETE", `/api/people/${person}/draft`);
    expect(await personOf(bob, person)).not.toHaveProperty("draft");
    expect(await unpublished(bob)).toEqual([
      { subject: original, discarded: true },
    ]);
    expect(await personOf(alice, person)).toMatchObject({
      heldBy: bob.name,
      draft: { action: "changed" },
    });
    expect(await publish(bob)).toBe(1);
    expect(await personOf(alice, person)).not.toHaveProperty("draft");
    expect(
      await test.connection
        .select()
        .from(drafts)
        .where(eq(drafts.recordId, person)),
    ).toEqual([]);

    // A change that ends as the published draft leaves nothing to publish.
    await saved(alice, "PATCH", `/api/people/${person}`, {
      preferredName: name,
    });
    await publish(alice);
    await saved(bob, "PATCH", `/api/people/${person}`, {
      preferredName: original,
    });
    await saved(bob, "PATCH", `/api/people/${person}`, {
      preferredName: name,
    });
    expect(await unpublished(bob)).toEqual([]);
    expect(await personOf(alice, person)).not.toHaveProperty("heldBy");
  });

  it("are undone only by their maker, who gets back the draft as it was", async () => {
    const [person = ""] = await livePeople(1);
    const changeSetId = await changeSetOf(
      alice,
      "PATCH",
      `/api/people/${person}`,
      { preferredName: unique("Fictional Undone") },
    );
    expect((await undo(bob, changeSetId)).statusCode).toBe(404);
    expect((await undo(alice, changeSetId)).statusCode).toBe(200);
    expect(await unpublished(alice)).toEqual([]);
    expect(await personOf(bob, person)).not.toHaveProperty("heldBy");
  });

  it("are not undone once someone else holds the record, which says who, not that it changed", async () => {
    const [person = ""] = await livePeople(1);
    const changeSetId = await changeSetOf(
      alice,
      "PATCH",
      `/api/people/${person}`,
      { preferredName: unique("Fictional Published") },
    );
    await publish(alice);
    await saved(bob, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Held"),
    });
    const response = await undo(alice, changeSetId);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: held(bob) });
    await discard(bob);
    expect((await undo(alice, changeSetId)).statusCode).toBe(200);
    await discard(alice);
  });
});

describe("values that must be unique", () => {
  it("stay taken while unpublished, as do choices and columns unpublished drafts use", async () => {
    const [person = ""] = await livePeople(1);
    const { list: unused } = await liveList([]);
    const employeeId = unique("E-Held");
    await saved(alice, "POST", "/api/people", {
      people: [
        {
          preferredName: "Fictional Taken",
          employeeId,
          positionId: testPosition,
        },
      ],
    });
    await saved(alice, "PATCH", `/api/people/${person}`, {
      values: { [siteColumn.id]: [south.id] },
    });
    await refused(
      bob,
      "POST",
      "/api/people",
      {
        people: [
          { preferredName: "Fictional", employeeId, positionId: testPosition },
        ],
      },
      "Someone already has that ID",
    );
    const listName = unique("Fictional Held List");
    await saved(alice, "POST", "/api/lists", { name: listName });
    await refused(
      bob,
      "POST",
      "/api/lists",
      { name: listName },
      "There is already a list with that name",
    );
    await saved(alice, "POST", `/api/lists/${siteList.id}/choices`, {
      choices: [{ label: "Fictional Held Choice" }],
    });
    await refused(
      bob,
      "POST",
      `/api/lists/${siteList.id}/choices`,
      { choices: [{ label: "Fictional Held Choice" }] },
      "This list already has a choice with that name",
    );
    await saved(alice, "PUT", `/api/lists/${siteList.id}/choices/${north.id}`, {
      label: "Fictional Northern",
    });
    await refused(
      bob,
      "PUT",
      `/api/lists/${siteList.id}/choices/${south.id}`,
      { label: "Fictional Northern" },
      "This list already has a choice with that name",
    );
    const columnName = unique("Fictional Held Column");
    await saved(alice, "POST", "/api/people/columns", {
      name: columnName,
      listId: siteList.id,
    });
    await refused(
      bob,
      "POST",
      "/api/people/columns",
      { name: columnName, listId: siteList.id },
      "There is already a column with that name",
    );
    await refused(
      bob,
      "DELETE",
      `/api/lists/${siteList.id}/choices/${south.id}`,
      undefined,
      "This choice cannot be removed while it is in use; retire it instead",
    );
    const deleting = await send(
      bob,
      "DELETE",
      `/api/people/columns/${siteColumn.id}`,
    );
    expect(deleting.statusCode).toBe(409);
    await refused(
      bob,
      "PUT",
      `/api/people/columns/${siteColumn.id}`,
      { name: siteColumn.name, listId: siteList.id, required: true },
      `Drafts leave ${siteColumn.name} empty, so it cannot be required yet`,
    );
    await saved(alice, "POST", "/api/people/columns", {
      name: unique("Fictional Drawing"),
      listId: unused.id,
    });
    const retiring = await send(bob, "PUT", `/api/lists/${unused.id}/retired`, {
      retired: true,
    });
    expect(retiring.statusCode).toBe(409);
    expect(await discard(alice)).toBe(7);
  });
});

describe("drafts of lists and choices, until published", () => {
  it("hold the list, its choices, and its order, and hide lists only drafted", async () => {
    const { list, choices } = await liveList(["First", "Second"]);
    const [first, second] = choices as [Choice, Choice];
    const renamed = unique("Fictional Renamed List");
    await saved(alice, "PUT", `/api/lists/${list.id}`, { name: renamed });
    await saved(alice, "PUT", `/api/lists/${list.id}/choices/${first.id}`, {
      label: "Fictional First",
    });
    await saved(
      alice,
      "PUT",
      `/api/lists/${list.id}/choices/${second.id}/position`,
      { after: null },
    );
    const hidden = (
      await saved<{ list: List }>(alice, "POST", "/api/lists", {
        name: unique("Fictional Hidden"),
      })
    ).list;

    const mine = await listOf(alice, list.id);
    expect(mine).toMatchObject({
      name: renamed,
      draft: { unpublished: true },
      orderDraft: { unpublished: true },
      choices: [
        { id: second.id },
        { id: first.id, draft: { unpublished: true } },
      ],
    });
    expect(mine).not.toHaveProperty("heldBy");
    const theirs = await listOf(bob, list.id);
    expect(theirs).toMatchObject({
      name: list.name,
      heldBy: alice.name,
      orderHeldBy: alice.name,
      choices: [
        { id: first.id, label: "First", heldBy: alice.name },
        { id: second.id },
      ],
    });
    expect(theirs).not.toHaveProperty("draft");
    expect(theirs).not.toHaveProperty("orderDraft");
    expect(await listOf(bob, hidden.id)).toBeUndefined();
    expect(await unpublished(alice)).toEqual([
      { subject: `the list ${hidden.name}`, action: "created" },
      { subject: `the new order for ${renamed}` },
      {
        subject: `the choice Fictional First in ${renamed}`,
        action: "changed",
      },
      { subject: `the list ${renamed}`, action: "changed" },
    ]);

    const base = `/api/lists/${list.id}`;
    for (const [method, url, payload] of [
      ["PUT", base, { name: "Fictional" }],
      ["PUT", `${base}/retired`, { retired: true }],
      ["DELETE", base, undefined],
      ["DELETE", `${base}/draft`, undefined],
      ["DELETE", `${base}/order/draft`, undefined],
      ["PUT", `${base}/choices/${first.id}`, { label: "Fictional" }],
      ["DELETE", `${base}/choices/${first.id}/draft`, undefined],
      ["PUT", `${base}/choices/${second.id}/position`, { after: null }],
    ] as [Method, string, object | undefined][]) {
      await refused(bob, method, url, payload, held(alice));
    }
    expect(
      (await send(bob, "PUT", `/api/lists/${hidden.id}`, { name: "Fictional" }))
        .statusCode,
    ).toBe(404);
    expect((await decide("approval", { lists: [hidden.id] })).statusCode).toBe(
      404,
    );

    expect(await publish(alice)).toBe(4);
    expect(await listOf(bob, hidden.id)).toBeDefined();
    expect(await listOf(bob, list.id)).toMatchObject({ name: renamed });

    // Once published, others may change the drafts, which only they decide when published.
    await saved(bob, "PUT", base, { name: unique("Fictional Bob's List") });
    await saved(bob, "PUT", `${base}/choices/${first.id}`, {
      label: "Fictional Bob's First",
    });
    await saved(bob, "PUT", `${base}/choices/${first.id}/position`, {
      after: null,
    });
    for (const asked of [
      { lists: [list.id] },
      { choices: [first.id] },
      { orders: [list.id] },
    ]) {
      for (const asking of ["approval", "rejection"] as const) {
        const response = await decide(asking, {
          ...asked,
          reason: "Fictional reason",
        });
        expect(response.statusCode).toBe(409);
        expect(response.json()).toEqual({ error: heldDecision(bob) });
      }
    }
    expect(await discard(bob)).toBe(3);
    expect(
      (
        await decide("rejection", {
          lists: [list.id],
          reason: "Fictional reason",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await send(alice, "DELETE", `${base}/draft/rejection`)).statusCode,
    ).toBe(200);
  });

  it("refuse deleting a list whose choices someone is changing", async () => {
    const { list, choices } = await liveList(["Only"]);
    await saved(
      bob,
      "PUT",
      `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`,
      {
        label: "Fictional Only",
      },
    );
    await refused(
      alice,
      "DELETE",
      `/api/lists/${list.id}`,
      undefined,
      "This list's choices have drafts; approve or discard them before deleting the list",
    );
    await discard(bob);
  });

  it("keep a list from being deleted while someone changes its choices or their order", async () => {
    for (const change of ["choice", "order"] as const) {
      const { list, choices } = await liveList(["Kept", "Other"]);
      const [kept, other] = choices as [Choice, Choice];
      // Drafted, unpublished, as the other changes are made to the list as it is.
      await saved(alice, "DELETE", `/api/lists/${list.id}`);
      if (change === "choice") {
        await saved(bob, "PUT", `/api/lists/${list.id}/choices/${kept.id}`, {
          label: "Fictional Kept",
        });
      } else {
        await saved(
          bob,
          "PUT",
          `/api/lists/${list.id}/choices/${other.id}/position`,
          { after: null },
        );
      }
      await publish(alice);
      const response = await decide("approval", { lists: [list.id] });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error:
          "A list drafted to be deleted has choices with drafts; approve or discard them first",
      });
      await discard(bob);
      expect((await decide("approval", { lists: [list.id] })).statusCode).toBe(
        200,
      );
    }
  });

  it("drop the user's own order once the added choice it placed is discarded", async () => {
    const { list } = await liveList(["Live"]);
    const [added] = (
      await saved<{ choices: Choice[] }>(
        alice,
        "POST",
        `/api/lists/${list.id}/choices`,
        { choices: [{ label: "Fictional Added" }] },
      )
    ).choices;
    await saved(
      alice,
      "PUT",
      `/api/lists/${list.id}/choices/${String(added?.id)}/position`,
      { after: null },
    );
    expect((await listOf(alice, list.id))?.orderDraft).toBeDefined();
    await saved(
      alice,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(added?.id)}`,
    );
    expect(await listOf(alice, list.id)).not.toHaveProperty("orderDraft");
    expect(await unpublished(alice)).toEqual([]);
  });
});

describe("drafts of People's columns, until published", () => {
  it("hold the column, and hide columns only drafted", async () => {
    const { list } = await liveList(["Fictional Level"]);
    const column = (
      await saved<{ field: Field }>(alice, "POST", "/api/people/columns", {
        name: unique("Fictional Column"),
        listId: list.id,
      })
    ).field;
    await publish(alice);
    await test.approveLists();
    const renamed = unique("Fictional Renamed Column");
    await saved(alice, "PUT", `/api/people/columns/${column.id}`, {
      name: renamed,
      listId: list.id,
    });
    const hidden = (
      await saved<{ field: Field }>(alice, "POST", "/api/people/columns", {
        name: unique("Fictional Hidden Column"),
        listId: list.id,
      })
    ).field;

    const mine = await readPeople(alice);
    expect(mine.fields.find(({ id }) => id === column.id)).toMatchObject({
      name: renamed,
      draft: { unpublished: true },
    });
    const theirs = await readPeople(bob);
    expect(theirs.fields.find(({ id }) => id === column.id)).toMatchObject({
      name: column.name,
      heldBy: alice.name,
    });
    expect(theirs.fields.some(({ id }) => id === hidden.id)).toBe(false);
    expect(await unpublished(alice)).toEqual([
      { subject: `the column ${hidden.name}`, action: "created" },
      { subject: `the column ${renamed}`, action: "changed" },
    ]);
    const base = `/api/people/columns/${column.id}`;
    for (const [method, url, payload] of [
      ["PUT", base, { name: "Fictional", listId: list.id }],
      ["DELETE", base, undefined],
      ["DELETE", `${base}/draft`, undefined],
    ] as [Method, string, object | undefined][]) {
      await refused(bob, method, url, payload, held(alice));
    }

    expect(await publish(alice)).toBe(2);
    await saved(bob, "PUT", base, {
      name: unique("Fictional Bob's"),
      listId: list.id,
    });
    for (const asking of ["approval", "rejection"] as const) {
      const response = await decide(asking, {
        columns: [column.id],
        reason: "Fictional reason",
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: heldDecision(bob) });
    }
    expect(await discard(bob)).toBe(1);
    await test.approveLists();
  });
});

describe("a list a column only drafted draws on", () => {
  it("cannot be removed or retired, without naming the column to anyone", async () => {
    const { list } = await liveList(["Fictional Grade"]);
    const live = (
      await saved<{ field: Field }>(alice, "POST", "/api/people/columns", {
        name: unique("Fictional Published Column"),
        listId: list.id,
      })
    ).field;
    await publish(alice);
    await test.approveLists();
    const renamed = unique("Fictional Renamed Column");
    await saved(alice, "PUT", `/api/people/columns/${live.id}`, {
      name: renamed,
      listId: list.id,
    });
    await saved(bob, "POST", "/api/people/columns", {
      name: unique("Fictional Hidden Column"),
      listId: list.id,
    });
    // Alice's renaming is not counted twice, nor named, and Bob's added column is not named.
    for (const who of [alice, bob]) {
      await refused(
        who,
        "DELETE",
        `/api/lists/${list.id}`,
        undefined,
        `This list cannot be deleted while columns draw on it: ${live.name}, a column being drafted`,
      );
    }
    await discard(bob);
    await saved(bob, "POST", "/api/people/columns", {
      name: unique("Fictional Hidden Column"),
      listId: list.id,
    });
    await saved(alice, "POST", "/api/people/columns", {
      name: unique("Fictional Other Hidden Column"),
      listId: list.id,
    });
    await refused(
      alice,
      "PUT",
      `/api/lists/${list.id}/retired`,
      { retired: true },
      `This list cannot be retired while columns draw on it: ${live.name}, columns being drafted`,
    );
    await discard(alice);
    await discard(bob);
  });
});

describe("the list of unpublished changes", () => {
  it("names records drafted to be removed as they are", async () => {
    const [person = ""] = await livePeople(1);
    const { list, choices } = await liveList(["Fictional Removed"]);
    const { list: removedList } = await liveList([]);
    const column = (
      await saved<{ field: Field }>(alice, "POST", "/api/people/columns", {
        name: unique("Fictional Removed Column"),
        listId: list.id,
      })
    ).field;
    await publish(alice);
    await test.approveLists();
    const name = String((await personOf(alice, person))?.preferredName);
    await saved(alice, "DELETE", `/api/people/${person}`);
    await saved(
      alice,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`,
    );
    await saved(alice, "DELETE", `/api/lists/${removedList.id}`);
    await saved(alice, "DELETE", `/api/people/columns/${column.id}`);
    expect(await unpublished(alice)).toEqual([
      { subject: `the column ${column.name}`, action: "deleted" },
      { subject: `the list ${removedList.name}`, action: "deleted" },
      {
        subject: `the choice Fictional Removed in ${list.name}`,
        action: "deleted",
      },
      { subject: name, action: "deleted" },
    ]);
    expect(await discard(alice)).toBe(4);
  });

  it("names a published draft the user takes back as discarded", async () => {
    const [person = ""] = await livePeople(1);
    await saved(alice, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Published"),
    });
    await publish(alice);
    await saved(alice, "DELETE", `/api/people/${person}/draft`);
    // Named as they will be once the draft is discarded: as they are live.
    const name = String((await personOf(alice, person))?.preferredName);
    expect(await unpublished(alice)).toEqual([
      { subject: name, discarded: true },
    ]);
    expect(await discard(alice)).toBe(1);
  });
});

describe("the change history", () => {
  it("names records as their maker's unpublished changes do only for that maker", async () => {
    const { list } = await liveList([]);
    const renamed = unique("Fictional Private Name");
    await saved(alice, "PUT", `/api/lists/${list.id}`, { name: renamed });
    const names = (entries: ChangeHistory["entries"]) =>
      entries.flatMap(({ records }) => records.map(({ name }) => name));
    expect(names(await history(alice))).toContain(renamed);
    expect(names(await history(bob))).not.toContain(renamed);
    expect(names(await history(bob))).toContain(list.name);
    await discard(alice);
  });
});

describe("publishing and discarding", () => {
  it("is refused to those who make no drafts, and does nothing with no changes", async () => {
    for (const [method, url] of [
      ["GET", "/api/unpublished"],
      ["POST", "/api/unpublished/publish"],
      ["POST", "/api/unpublished/discard"],
    ] as [Method, string][]) {
      expect((await send(reader, method, url)).statusCode).toBe(403);
    }
    expect(await publish(bob)).toBe(0);
    expect(await discard(bob)).toBe(0);
  });

  it("discards changes of every kind, putting back what everyone sees", async () => {
    const { list, choices } = await liveList(["One", "Two"]);
    const [person = ""] = await livePeople(1);
    await saved<{ field: Field }>(alice, "POST", "/api/people/columns", {
      name: unique("Fictional Discarded Column"),
      listId: list.id,
    });
    await saved(alice, "PUT", `/api/lists/${list.id}`, {
      name: unique("Fictional Discarded List"),
    });
    await saved(
      alice,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`,
    );
    await saved(
      alice,
      "PUT",
      `/api/lists/${list.id}/choices/${String(choices[1]?.id)}/position`,
      { after: null },
    );
    await saved(alice, "DELETE", `/api/people/${person}`);
    expect(await discard(alice)).toBe(5);
    expect(await listOf(bob, list.id)).toMatchObject({ name: list.name });
    expect(await personOf(alice, person)).not.toHaveProperty("draft");
    const [withdrawal] = await history(alice);
    expect(withdrawal).toMatchObject({ kind: "discard", madeBy: alice.name });
    expect(withdrawal?.records.map(({ kind }) => kind).sort()).toEqual([
      "choice-order",
      "field",
      "list",
      "list-item",
      "person",
    ]);
  });

  it("refuses publishing a change that no longer fits the data, publishing none of them", async () => {
    const { list: lone } = await liveList([]);
    const clash = async (setUp: () => Promise<void>, subject: string) => {
      await setUp();
      await refused(
        bob,
        "POST",
        "/api/unpublished/publish",
        undefined,
        `The change to ${subject} no longer fits the data as it is now; change or discard it, then publish again`,
      );
      expect(await discard(bob)).toBeGreaterThan(0);
    };
    const employeeId = unique("E-Clash");
    await clash(async () => {
      await saved(bob, "POST", "/api/people", {
        people: [
          {
            preferredName: "Fictional Clash",
            employeeId,
            positionId: testPosition,
          },
        ],
      });
      await test.connection.insert(people).values({
        preferredName: "Fictional Other",
        employeeId,
        positionId: testPosition,
      });
    }, "Fictional Clash");

    const listName = unique("Fictional Clash List");
    await clash(async () => {
      await saved(bob, "POST", "/api/lists", { name: listName });
      await test.connection.insert(lists).values({ name: listName });
    }, `the list ${listName}`);

    await clash(async () => {
      await saved(bob, "POST", `/api/lists/${siteList.id}/choices`, {
        choices: [{ label: "Fictional Clash" }],
      });
      await test.connection
        .insert(listItems)
        .values({ listId: siteList.id, label: "Fictional Clash" });
    }, `the choice Fictional Clash in ${siteList.name}`);

    // A list only drafted to be added whose draft goes, taking its choices' list and order.
    const draftedList = async () => {
      const list = (
        await saved<{ list: List }>(alice, "POST", "/api/lists", {
          name: unique("Fictional Gone"),
        })
      ).list;
      const added = (
        await saved<{ choices: Choice[] }>(
          alice,
          "POST",
          `/api/lists/${list.id}/choices`,
          { choices: [{ label: "A" }, { label: "B" }] },
        )
      ).choices;
      await publish(alice);
      return { list, added };
    };
    const gone = await draftedList();
    await clash(async () => {
      await saved(bob, "POST", `/api/lists/${gone.list.id}/choices`, {
        choices: [{ label: "Fictional Orphan" }],
      });
      await test.connection
        .delete(drafts)
        .where(eq(drafts.recordId, gone.list.id));
    }, "the choice Fictional Orphan in a removed list");
    const goneOrder = await draftedList();
    await clash(async () => {
      await saved(
        bob,
        "PUT",
        `/api/lists/${goneOrder.list.id}/choices/${String(goneOrder.added[1]?.id)}/position`,
        { after: null },
      );
      await test.connection
        .delete(drafts)
        .where(eq(drafts.recordId, goneOrder.list.id));
    }, "the new order for a removed list");

    const columnName = unique("Fictional Clash Column");
    await clash(async () => {
      await saved(bob, "POST", "/api/people/columns", {
        name: columnName,
        listId: siteList.id,
      });
      await test.connection
        .insert(fields)
        .values({ tableName: "people", name: columnName, listId: siteList.id });
    }, `the column ${columnName}`);

    const loneColumn = unique("Fictional Lone Column");
    await clash(async () => {
      await saved(bob, "POST", "/api/people/columns", {
        name: loneColumn,
        listId: lone.id,
      });
      await test.connection.delete(lists).where(eq(lists.id, lone.id));
    }, `the column ${loneColumn}`);
  });
});
