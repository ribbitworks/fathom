// SPDX-License-Identifier: Apache-2.0

// Integration tests for unpublished drafts of people, against a PostgreSQL server of their own: each
// user's changes are theirs alone until published, others see the records held, and values that
// must be unique stay taken while unpublished.

import { drafts } from "@fathom/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Method, testPosition, unique } from "./test-app.ts";
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
  held,
  heldDecision,
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
    await saved(alice, "DELETE", `/api/people/${person}/draft`);
    expect(await personOf(alice, person)).not.toHaveProperty("draft");
    expect(await unpublished(alice)).toEqual([
      { subject: original, discarded: true },
    ]);
    expect(await personOf(bob, person)).toMatchObject({
      heldBy: alice.name,
      draft: { action: "changed" },
    });
    expect(await publish(alice)).toBe(1);
    expect(await personOf(bob, person)).not.toHaveProperty("draft");
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
