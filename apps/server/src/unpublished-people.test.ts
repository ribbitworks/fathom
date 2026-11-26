// SPDX-License-Identifier: Apache-2.0

// Integration tests for unpublished drafts of people, against a PostgreSQL server of their own: each
// user's changes are theirs alone until published, hold nothing for anyone else, and take no value
// that must be unique from anyone else.

import { drafts } from "@fathom/db";
import type { Field } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPosition, unique } from "./test-app.ts";
import {
  test,
  alice,
  bob,
  approver,
  siteList,
  north,
  south,
  siteColumn,
  send,
  saved,
  changeSetOf,
  refused,
  personOf,
  unpublished,
  publish,
  discard,
  history,
  undo,
  decide,
  draftPeople,
  livePeople,
  liveList,
  startUnpublishedTests,
  closeUnpublishedTests,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

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
      expect(seen).not.toHaveProperty("heldBy");
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

  it("hold nothing: others still change the record, and its draft is still approved or rejected", async () => {
    for (const asking of ["approval", "rejection"] as const) {
      // Given a published draft that one user is changing, unpublished
      const [person = ""] = await livePeople(1);
      await saved(alice, "PATCH", `/api/people/${person}`, {
        preferredName: unique("Fictional Published"),
      });
      await publish(alice);
      await saved(bob, "PATCH", `/api/people/${person}`, {
        values: { [siteColumn.id]: [north.id] },
      });

      // When another user changes it too, and the Approver decides its draft
      await saved(alice, "PATCH", `/api/people/${person}`, {
        preferredName: unique("Fictional Again"),
      });
      const response = await decide(asking, {
        people: [person],
        reason: "Fictional reason",
      });

      // Then both are kept, and the draft is decided
      expect(response.statusCode, response.body).toBe(200);
      expect(await discard(alice)).toBe(1);
      expect(await discard(bob)).toBe(1);
    }
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
      draft: { editors: [alice.name], changed: ["preferredName"] },
    });
    expect(forAlice).not.toHaveProperty("heldBy");
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
      draft: { state: "rejected", reason: "Fictional reason" },
    });
    await publish(bob);
    expect((await personOf(alice, person))?.draft).toMatchObject({
      state: "waiting",
    });
    expect((await personOf(alice, person))?.draft).not.toHaveProperty("reason");
  });

  it("discard a published draft once published, and changing back to it leaves nothing to publish", async () => {
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
  });

  it("are undone while someone else has unpublished changes to the record", async () => {
    const [person = ""] = await livePeople(1);
    const changeSetId = await changeSetOf(
      alice,
      "PATCH",
      `/api/people/${person}`,
      { preferredName: unique("Fictional Published") },
    );
    await publish(alice);
    await saved(bob, "PATCH", `/api/people/${person}`, {
      preferredName: unique("Fictional Private"),
    });
    const response = await undo(alice, changeSetId);
    expect(response.statusCode, response.body).toBe(200);
    await discard(bob);
    await discard(alice);
  });
});

describe("another user's unpublished changes", () => {
  it("take no value that must be unique, and put no list in use", async () => {
    // Given one user's unpublished changes naming a person, a list, choices and columns
    const { list: unused } = await liveList([]);
    const employeeId = unique("E-Private");
    const listName = unique("Fictional Private List");
    const columnName = unique("Fictional Private Column");
    await saved(alice, "POST", "/api/people", {
      people: [
        {
          preferredName: "Fictional Taken",
          employeeId,
          positionId: testPosition,
        },
      ],
    });
    await saved(alice, "POST", "/api/lists", { name: listName });
    await saved(alice, "POST", `/api/lists/${siteList.id}/choices`, {
      choices: [{ label: "Fictional Private Choice" }],
    });
    await saved(alice, "PUT", `/api/lists/${siteList.id}/choices/${north.id}`, {
      label: "Fictional Northern",
    });
    await saved(alice, "POST", "/api/people/columns", {
      name: columnName,
      listId: siteList.id,
    });
    await saved(alice, "POST", "/api/people/columns", {
      name: unique("Fictional Drawing"),
      listId: unused.id,
    });

    // When another user uses the same values, and retires the list
    await saved(bob, "POST", "/api/people", {
      people: [
        { preferredName: "Fictional", employeeId, positionId: testPosition },
      ],
    });
    await saved(bob, "POST", "/api/lists", { name: listName });
    await saved(bob, "POST", `/api/lists/${siteList.id}/choices`, {
      choices: [{ label: "Fictional Private Choice" }],
    });
    await saved(bob, "PUT", `/api/lists/${siteList.id}/choices/${south.id}`, {
      label: "Fictional Northern",
    });
    await saved(bob, "POST", "/api/people/columns", {
      name: columnName,
      listId: siteList.id,
    });
    await saved(bob, "PUT", `/api/lists/${unused.id}/retired`, {
      retired: true,
    });

    // Then each is saved for both
    expect(await discard(alice)).toBe(6);
    expect(await discard(bob)).toBe(6);
  });

  it("leave a choice and a column their people use free for anyone else to remove", async () => {
    // Given one user's unpublished change giving a person a choice in a column
    const {
      list,
      choices: [east],
    } = await liveList(["Fictional East"]);
    const { field: column } = await saved<{ field: Field }>(
      alice,
      "POST",
      "/api/people/columns",
      { name: unique("Fictional Wing"), listId: list.id },
    );
    await publish(alice);
    await test.approveLists();
    const [person = ""] = await livePeople(1);
    await saved(alice, "PATCH", `/api/people/${person}`, {
      values: { [column.id]: [String(east?.id)] },
    });
    const choiceUrl = `/api/lists/${list.id}/choices/${String(east?.id)}`;
    const columnUrl = `/api/people/columns/${column.id}`;

    // When that user and another remove the choice and the column
    // Then only the user whose change uses them is refused
    await refused(
      alice,
      "DELETE",
      choiceUrl,
      undefined,
      "This choice cannot be removed while it is in use; retire it instead",
    );
    expect((await send(alice, "DELETE", columnUrl)).statusCode).toBe(409);
    await saved(bob, "DELETE", choiceUrl);
    await saved(bob, "DELETE", columnUrl);
    expect(await discard(alice)).toBe(1);
    expect(await discard(bob)).toBe(2);
  });
});
