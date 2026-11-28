// SPDX-License-Identifier: Apache-2.0

// Integration tests for unpublished drafts of lists, choices and People's columns, against a
// PostgreSQL server of their own, including a list that a column only drafted draws on.

import { type Choice, type Field, type List } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unique } from "./test-app.ts";
import {
  test,
  alice,
  bob,
  approver,
  send,
  saved,
  refused,
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
  it("hold nothing of the list, its choices, or its order, and hide lists only drafted", async () => {
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
      choices: [{ id: first.id, label: "First" }, { id: second.id }],
    });
    for (const property of ["draft", "orderDraft", "heldBy", "orderHeldBy"]) {
      expect(theirs).not.toHaveProperty(property);
    }
    expect(theirs?.choices[0]).not.toHaveProperty("heldBy");
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

    // Others change the same list, choice, and order, unpublished, as theirs alone.
    const base = `/api/lists/${list.id}`;
    await saved(bob, "PUT", base, { name: unique("Fictional Bob's List") });
    await saved(bob, "PUT", `${base}/choices/${first.id}`, {
      label: "Fictional Bob's First",
    });
    await saved(bob, "PUT", `${base}/choices/${second.id}/position`, {
      after: null,
    });
    expect(
      (await send(bob, "PUT", `/api/lists/${hidden.id}`, { name: "Fictional" }))
        .statusCode,
    ).toBe(404);
    expect((await decide("approval", { lists: [hidden.id] })).statusCode).toBe(
      404,
    );

    expect(await publish(alice)).toBe(4);
    expect(await listOf(approver, hidden.id)).toBeDefined();
    expect(await listOf(approver, list.id)).toMatchObject({ name: renamed });

    // The published drafts are decided while others are still changing them.
    for (const [asking, asked] of [
      ["rejection", { lists: [list.id] }],
      ["approval", { choices: [first.id] }],
      ["approval", { orders: [list.id] }],
    ] as const) {
      const response = await decide(asking, {
        ...asked,
        reason: "Fictional reason",
      });
      expect(response.statusCode, response.body).toBe(200);
    }
    expect(
      (await send(alice, "DELETE", `${base}/draft/rejection`)).statusCode,
    ).toBe(200);
    expect(await discard(bob)).toBe(3);
  });

  it("delete a list whose choices only someone else is changing, unpublished", async () => {
    const { list, choices } = await liveList(["Only"]);
    await saved(
      bob,
      "PUT",
      `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`,
      {
        label: "Fictional Only",
      },
    );
    await saved(alice, "DELETE", `/api/lists/${list.id}`);
    expect(await discard(alice)).toBe(1);
    expect(await discard(bob)).toBe(1);
  });

  it("approve deleting a list while someone else changes its choices or their order, unpublished", async () => {
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
      expect(response.statusCode, response.body).toBe(200);
      await discard(bob);
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
  it("hold nothing of the column, and hide columns only drafted", async () => {
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
    const theirColumn = theirs.fields.find(({ id }) => id === column.id);
    expect(theirColumn).toMatchObject({ name: column.name });
    expect(theirColumn).not.toHaveProperty("heldBy");
    expect(theirs.fields.some(({ id }) => id === hidden.id)).toBe(false);
    expect(await unpublished(alice)).toEqual([
      { subject: `the column ${hidden.name}`, action: "created" },
      { subject: `the column ${renamed}`, action: "changed" },
    ]);
    await saved(bob, "PUT", `/api/people/columns/${column.id}`, {
      name: unique("Fictional Bob's"),
      listId: list.id,
    });

    expect(await publish(alice)).toBe(2);
    const response = await decide("approval", { columns: [column.id] });
    expect(response.statusCode, response.body).toBe(200);
    expect(await discard(bob)).toBe(1);
    await test.approveLists();
  });
});

describe("a list a column only drafted draws on", () => {
  it("cannot be removed or retired, counting and naming only the user's own unpublished columns", async () => {
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
    const hidden = unique("Fictional Hidden Column");
    await saved(bob, "POST", "/api/people/columns", {
      name: hidden,
      listId: list.id,
    });
    // Alice's renaming is counted once, by her name for it, and Bob's added column counts only for
    // him.
    await refused(
      alice,
      "DELETE",
      `/api/lists/${list.id}`,
      undefined,
      `This list cannot be deleted while a column draws on it: ${renamed}`,
    );
    await refused(
      bob,
      "DELETE",
      `/api/lists/${list.id}`,
      undefined,
      `This list cannot be deleted while columns draw on it: ${hidden}, ${live.name}`,
    );
    const others = ["Fictional Other Hidden", "Fictional Third Hidden"].map(
      unique,
    );
    for (const name of others) {
      await saved(alice, "POST", "/api/people/columns", {
        name,
        listId: list.id,
      });
    }
    await refused(
      alice,
      "PUT",
      `/api/lists/${list.id}/retired`,
      { retired: true },
      `This list cannot be retired while columns draw on it: ${String(others[0])}, ${renamed}, ${String(others[1])}`,
    );
    await discard(alice);
    await discard(bob);
  });

  it("cannot be removed while the user's own unpublished change moves a live column onto it, named as it is", async () => {
    const { list } = await liveList(["Fictional Band"]);
    const { list: other } = await liveList(["Fictional Tier"]);
    const column = (
      await saved<{ field: Field }>(alice, "POST", "/api/people/columns", {
        name: unique("Fictional Moved Column"),
        listId: other.id,
      })
    ).field;
    await publish(alice);
    await test.approveLists();
    await saved(alice, "PUT", `/api/people/columns/${column.id}`, {
      name: column.name,
      listId: list.id,
    });

    await refused(
      alice,
      "DELETE",
      `/api/lists/${list.id}`,
      undefined,
      `This list cannot be deleted while a column draws on it: ${column.name}`,
    );
    // The list it moves off is free for her.
    await saved(alice, "DELETE", `/api/lists/${other.id}`);
    await discard(alice);
  });
});

describe("publishing a list's removal", () => {
  it("is refused once someone else's choice drafts for it are published, naming the list", async () => {
    // Given Bob's private removal of a live list, and Alice's new choice for it published since
    const { list } = await liveList(["Fictional Kept"]);
    await saved(bob, "DELETE", `/api/lists/${list.id}`);
    await saved(alice, "POST", `/api/lists/${list.id}/choices`, {
      choices: [{ label: "Fictional Added" }],
    });
    await publish(alice);

    await refused(
      bob,
      "POST",
      "/api/unpublished/publish",
      undefined,
      `The list ${list.name}: This list's choices have drafts; approve or discard them before deleting the list`,
    );
    await discard(alice);
    await discard(bob);
  });
});
