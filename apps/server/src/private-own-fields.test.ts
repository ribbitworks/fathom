// SPDX-License-Identifier: Apache-2.0

// Integration tests for a private change's own fields: which fields are its maker's and the values
// they started from, reading and publishing them over a published draft changed meanwhile, a draft
// wanted gone, and a record its maker adds.

import { drafts, privateChanges, valueField } from "@fathom/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unique } from "./test-app.ts";
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

    await saved(alice, "DELETE", `/api/people/${person}/draft`);

    expect((await personOf(alice, person))?.draft).toBeUndefined();
    expect(await publish(alice)).toBe(1);
    expect(await publishedOf(person)).toBeUndefined();
  });

  it("are all of a record its maker adds, which no published draft stands under", async () => {
    const added = unique("Fictional Added");
    const [id = ""] = await draftPeople(alice, [added]);

    expect((await privateRowOf(alice.id, id))?.startedFrom).toEqual({});
    expect(await personOf(alice, id)).toMatchObject({ preferredName: added });
  });
});
