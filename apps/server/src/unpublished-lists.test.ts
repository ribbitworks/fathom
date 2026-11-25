// SPDX-License-Identifier: Apache-2.0

// Integration tests for unpublished drafts of lists, choices and People's columns, against a
// PostgreSQL server of their own, including a list that a column only drafted draws on.

import { type Choice, type Field, type List } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Method, unique } from "./test-app.ts";
import {
  test,
  alice,
  bob,
  send,
  saved,
  refused,
  held,
  heldDecision,
  readPeople,
  listOf,
  unpublished,
  publish,
  discard,
  decide,
  liveList,
  startUnpublishedTests,
  closeUnpublishedTests,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

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
          "A list drafted to be removed has choices with drafts; approve or discard them first",
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
