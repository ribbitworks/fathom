// SPDX-License-Identifier: Apache-2.0

// Integration tests for a private change's own fields: which fields are its maker's and the values
// they started from, reading and publishing them over a published draft changed meanwhile, a draft
// wanted gone, a record its maker adds, and the values that must be unique each maker sees.

import { drafts, privateChanges, valueField } from "@fathom/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPosition, unique } from "./test-app.ts";
import {
  alice,
  bob,
  closeUnpublishedTests,
  discard,
  draftPeople,
  livePeople,
  north,
  personOf,
  publish,
  saved,
  siteColumn,
  startUnpublishedTests,
  test,
  type User,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

const siteField = () => valueField(siteColumn.id);

const privateRowOf = async (userId: string, id: string) =>
  (
    await test.connection
      .select()
      .from(privateChanges)
      .where(
        and(eq(privateChanges.recordId, id), eq(privateChanges.userId, userId)),
      )
  )[0];

const publishedOf = async (id: string) =>
  (
    await test.connection
      .select({ fields: drafts.fields })
      .from(drafts)
      .where(and(eq(drafts.recordType, "person"), eq(drafts.recordId, id)))
  )[0]?.fields;

describe("a private change's own fields", () => {
  it("are those its maker changed, each with the value it started from", async () => {
    const [person = ""] = await livePeople(1);
    const named = unique("Fictional Named");
    await saved(alice, "PATCH", `/api/people/${person}`, {
      preferredName: named,
    });
    await publish(alice);

    await saved(bob, "PATCH", `/api/people/${person}`, {
      values: { [siteColumn.id]: [north.id] },
    });
    await saved(bob, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Renamed"),
    });

    const row = await privateRowOf(bob.id, person);
    expect(Object.keys(row?.startedFrom ?? {}).sort()).toEqual(
      ["preferredName", siteField()].sort(),
    );
    expect(row?.startedFrom.preferredName).toBe(named);
    await discard(bob);
  });

  it("stand over the published draft as it is now, leaving its other fields as they are", async () => {
    const [person = ""] = await livePeople(1);
    await saved(alice, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional First"),
    });
    await publish(alice);
    await saved(bob, "PATCH", `/api/people/${person}`, {
      values: { [siteColumn.id]: [north.id] },
    });
    // As another maker's change to the published draft would leave it, once records aren't held.
    const later = unique("Fictional Later");
    await test.connection
      .update(drafts)
      .set({ fields: { preferredName: later } })
      .where(and(eq(drafts.recordType, "person"), eq(drafts.recordId, person)));

    expect(await personOf(bob, person)).toMatchObject({
      preferredName: later,
      values: { [siteColumn.id]: [north.id] },
    });
    expect(await publish(bob)).toBe(1);
    expect(await publishedOf(person)).toEqual({
      preferredName: later,
      [siteField()]: [north.id],
    });
  });

  it("take a published draft with a cleared field away whole, once its maker wants none", async () => {
    const [person = ""] = await livePeople(1);
    await saved(alice, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Cleared"),
    });
    await publish(alice);
    // A published draft that clears a field, as a cleared team name or manager leaves one.
    const published = await publishedOf(person);
    await test.connection
      .update(drafts)
      .set({ fields: { ...published, teamName: null } })
      .where(and(eq(drafts.recordType, "person"), eq(drafts.recordId, person)));

    await saved(bob, "DELETE", `/api/people/${person}/draft`);

    expect((await personOf(bob, person))?.draft).toBeUndefined();
    expect(await publish(bob)).toBe(1);
    expect(await publishedOf(person)).toBeUndefined();
  });

  it("are all of a record its maker adds, which no published draft stands under", async () => {
    const added = unique("Fictional Added");
    const [id = ""] = await draftPeople(alice, [added]);

    expect((await privateRowOf(alice.id, id))?.startedFrom).toEqual({});
    expect(await personOf(alice, id)).toMatchObject({ preferredName: added });
  });
});

describe("an Employee ID in a published draft", () => {
  const taken = "Someone already has that ID";
  const addingWith = (who: User, employeeId: string) =>
    test.request(who.cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Other"),
          employeeId,
          positionId: testPosition,
        },
      ],
    });

  it("stays taken for a user whose private change to the person leaves the ID as published", async () => {
    // Given one user's private change to a person's Site, and another's published new Employee ID
    const [person = ""] = await livePeople(1);
    await saved(bob, "PATCH", `/api/people/${person}`, {
      values: { [siteColumn.id]: [north.id] },
    });
    const employeeId = unique("E-Published");
    await saved(alice, "PATCH", `/api/people/${person}`, { employeeId });
    await publish(alice);

    // When the first user gives that ID to someone else
    const response = await addingWith(bob, employeeId);

    // Then it is refused
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(taken);
    expect(await discard(bob)).toBe(1);
  });

  it("is free for a user whose own private change gives the person another, and for nobody else", async () => {
    // Given a published new Employee ID, and one user's private change giving the person another
    const [person = ""] = await livePeople(1);
    const employeeId = unique("E-Published");
    await saved(alice, "PATCH", `/api/people/${person}`, { employeeId });
    await publish(alice);
    await saved(bob, "PATCH", `/api/people/${person}`, {
      employeeId: unique("E-Private"),
    });

    // When each user gives the published ID to someone else
    const theirs = await addingWith(bob, employeeId);
    const others = await addingWith(alice, employeeId);

    // Then only the user who changed it privately may
    expect(theirs.statusCode, theirs.body).toBe(201);
    expect(others.statusCode, others.body).toBe(409);
    expect(others.json<{ error: string }>().error).toBe(taken);
    expect(await discard(bob)).toBe(2);
  });
});
