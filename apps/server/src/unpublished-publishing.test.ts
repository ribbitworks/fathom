// SPDX-License-Identifier: Apache-2.0

// Integration tests for publishing and discarding unpublished changes, against a PostgreSQL server
// of their own: all at once or those chosen, as the role in use, checking again that every draft
// still fits the data.

import { drafts, fields, listItems, lists, people } from "@fathom/db";
import { type Choice, type Field, type List } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Method, testPosition, unique } from "./test-app.ts";
import {
  type User,
  test,
  alice,
  bob,
  reader,
  siteList,
  user,
  send,
  saved,
  refused,
  readPeople,
  personOf,
  listOf,
  changesOf,
  unpublished,
  publish,
  discard,
  history,
  draftPeople,
  livePeople,
  liveList,
  startUnpublishedTests,
  closeUnpublishedTests,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

describe("publishing and discarding chosen changes", () => {
  // A list only drafted to be added, with a choice added to it and a column drawing on it.
  async function addedList() {
    const list = (
      await saved<{ list: List }>(alice, "POST", "/api/lists", {
        name: unique("Fictional Chosen List"),
      })
    ).list;
    const [choice] = (
      await saved<{ choices: Choice[] }>(
        alice,
        "POST",
        `/api/lists/${list.id}/choices`,
        { choices: [{ label: "Fictional Chosen Choice" }] },
      )
    ).choices;
    const { field } = await saved<{ field: Field }>(
      alice,
      "POST",
      "/api/people/columns",
      { name: unique("Fictional Chosen Column"), listId: list.id },
    );
    return { list, choice: choice as Choice, field };
  }

  const patternOf = async (streamId: string) =>
    String(
      (
        await saved<{ streams: { id: string; patterns: { id: string }[] }[] }>(
          alice,
          "GET",
          "/api/release-streams",
        )
      ).streams.find(({ id }) => id === streamId)?.patterns[0]?.id,
    );

  const columnOf = async (who: User, id: string) =>
    (await readPeople(who)).fields.find((field) => field.id === id);

  it("publishes the changes chosen with the changes they use, leaving the rest unpublished", async () => {
    // Given a column drawing on a list only drafted to be added, and a person, all unpublished
    const { list, field } = await addedList();
    const [person = ""] = await draftPeople(alice, ["Fictional Left Out"]);

    // And each names the changes it goes with, by key
    const linkedOf = async (key: string) =>
      (await changesOf(alice)).find((change) => change.key === key)?.linked;
    expect(await linkedOf(`field ${field.id}`)).toEqual([`list ${list.id}`]);
    expect(await linkedOf(`person ${person}`)).toEqual([]);

    // When the column alone is chosen
    const total = await publish(alice, { columns: [field.id] });

    // Then it is published with the list it uses, and the rest stay unpublished
    expect(total).toBe(2);
    expect(await listOf(bob, list.id)).toBeDefined();
    expect(await columnOf(bob, field.id)).toBeDefined();
    expect(await personOf(bob, person)).toBeUndefined();
    expect(
      (await unpublished(alice)).map(({ subject }) => subject).sort(),
    ).toEqual([
      "Fictional Left Out",
      `the choice Fictional Chosen Choice in ${list.name}`,
    ]);
    await discard(alice);
  });

  it("publishes a person with the column and choice they are given, and a schedule's cycles with it", async () => {
    // Given a person given a choice in a column, both only drafted to be added, a new order for
    // the column's list, and a schedule only drafted to be added with its cycles
    const { list, choice, field } = await addedList();
    const [second] = (
      await saved<{ choices: Choice[] }>(
        alice,
        "POST",
        `/api/lists/${list.id}/choices`,
        { choices: [{ label: "Fictional Second Choice" }] },
      )
    ).choices;
    await saved(
      alice,
      "PUT",
      `/api/lists/${list.id}/choices/${String(second?.id)}/position`,
      { after: null },
    );
    const person = (
      await saved<{ ids: string[] }>(alice, "POST", "/api/people", {
        people: [
          {
            preferredName: "Fictional Given",
            employeeId: unique("E"),
            positionId: testPosition,
            values: { [field.id]: [choice.id] },
          },
        ],
      })
    ).ids[0];
    const { stream } = await saved<{ stream: { id: string } }>(
      alice,
      "POST",
      "/api/release-streams",
      { name: unique("Fictional Chosen Stream") },
    );
    await saved(alice, "POST", `/api/release-streams/${stream.id}/patterns`, {
      startsOn: "2027-01-01",
      length: 3,
      unit: "months",
      naming: "{YY}.{N}",
    });

    // When the person and the schedule's cycles are chosen
    const total = await publish(alice, {
      people: [String(person)],
      records: [{ type: "cycle-pattern", id: await patternOf(stream.id) }],
    });

    // Then they are published with the column, choice, list and schedule they use
    expect(total).toBe(6);
    expect(
      (await unpublished(alice)).map(({ subject }) => subject).sort(),
    ).toEqual([
      `the choice Fictional Second Choice in ${list.name}`,
      `the new order for ${list.name}`,
    ]);
    await discard(alice);
  });

  it("discards the changes chosen with the changes that use them, leaving the rest unpublished", async () => {
    // Given a list only drafted to be added, a choice and a column using it, and a person
    const { list } = await addedList();
    await draftPeople(alice, ["Fictional Kept"]);

    // When the list alone is chosen
    const total = await discard(alice, { lists: [list.id] });

    // Then it goes with everything that uses it, recorded as discarded
    expect(total).toBe(3);
    expect(await listOf(alice, list.id)).toBeUndefined();
    expect(await unpublished(alice)).toEqual([
      { subject: "Fictional Kept", action: "created" },
    ]);
    const [discarded] = await history(alice);
    expect(discarded).toMatchObject({ kind: "discard", madeBy: alice.name });
    expect(discarded?.records.map(({ kind }) => kind).sort()).toEqual([
      "field",
      "list",
      "list-item",
    ]);
    expect(await publish(alice)).toBe(1);
  });

  it("takes back a change to a published draft as an edit, keeping the published draft", async () => {
    const { list } = await liveList([]);
    const published = unique("Fictional Published Name");
    await saved(alice, "PUT", `/api/lists/${list.id}`, { name: published });
    await publish(alice);
    await saved(bob, "PUT", `/api/lists/${list.id}`, {
      name: unique("Fictional Unpublished Name"),
    });

    expect(await discard(bob, { lists: [list.id] })).toBe(1);

    expect(await listOf(bob, list.id)).toMatchObject({ name: published });
    const [edit] = await history(bob);
    expect(edit).toMatchObject({ kind: "edit", madeBy: bob.name });
  });

  it("publishes changes saved together whole, so an approver who made them can't approve them, and others see who did", async () => {
    // Given an approver whose role doesn't let them approve their own, who adds two people at once
    const maker = await user([
      "people:approve",
      "people:edit",
      "people:view",
      "personal:view",
      "personal:edit",
    ]);
    const names = [unique("Fictional First"), unique("Fictional Second")];
    const [first = "", second = ""] = await draftPeople(maker, names);

    // When only the first is chosen to publish
    const total = await publish(maker, { people: [first] });

    // Then both are published, in a change set everyone sees, and its maker may not approve either
    expect(total).toBe(2);
    expect(await unpublished(maker)).toEqual([]);
    const named = (await history(bob)).flatMap(({ records }) =>
      records.map(({ name }) => name),
    );
    expect(named).toEqual(expect.arrayContaining(names));
    expect((await personOf(bob, second))?.draft).toMatchObject({
      madeBy: maker.name,
    });
    const refused = await send(maker, "POST", "/api/drafts/approval", {
      people: [first],
    });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toEqual({
      error: "Drafts changed by the approver need another approver",
    });
  });

  it("never shows others changes discarded one at a time and then all at once", async () => {
    // Given a published draft of a list the user changes, and discards that change alone
    const { list } = await liveList([]);
    const published = unique("Fictional Kept Name");
    await saved(alice, "PUT", `/api/lists/${list.id}`, { name: published });
    await publish(alice);
    const unseen = unique("Fictional Unseen Name");
    await saved(bob, "PUT", `/api/lists/${list.id}`, { name: unseen });
    expect(await discard(bob, { lists: [list.id] })).toBe(1);

    // When the rest of their changes are discarded all at once
    await draftPeople(bob, ["Fictional Then Discarded"]);
    expect(await discard(bob)).toBe(1);

    // Then no change of theirs reaches anyone else's history
    const named = (await history(alice)).flatMap(({ records }) =>
      records.map(({ name }) => name),
    );
    expect(named).not.toContain(unseen);
    expect(named).not.toContain("Fictional Then Discarded");
  });

  it("links changes saved together to each other, and never names another person's change", async () => {
    // Given two people added at once, by one user, and a choice another user adds to a live list
    const [first = "", second = ""] = await draftPeople(alice, [
      "Fictional Together",
      "Fictional Also Together",
    ]);
    await saved(bob, "POST", `/api/lists/${siteList.id}/choices`, {
      choices: [{ label: "Fictional Elsewhere" }],
    });

    // Then each of the first user's names the other, and nothing of the second user's
    const linkedOf = async (key: string) =>
      (await changesOf(alice)).find((change) => change.key === key)?.linked;
    const linked = [
      ...((await linkedOf(`person ${first}`)) ?? []),
      ...((await linkedOf(`person ${second}`)) ?? []),
    ];
    expect(linked.sort()).toEqual(
      [`person ${first}`, `person ${second}`].sort(),
    );
    expect(
      (await changesOf(alice)).every(({ key }) => !key.startsWith("list-item")),
    ).toBe(true);
    await discard(alice);
    await discard(bob);
  });

  it("lets each person publish or discard only their own changes", async () => {
    const [person = ""] = await draftPeople(alice, ["Fictional Own"]);
    const notOwn = {
      error:
        "One of these changes is no longer unpublished; refresh to see the latest",
    };
    for (const url of [
      "/api/unpublished/publish",
      "/api/unpublished/discard",
    ]) {
      const chosen = { drafts: { people: [person] } };
      const others = await send(bob, "POST", url, chosen);
      expect(others.statusCode).toBe(404);
      expect(others.json()).toEqual(notOwn);
      const unknown = await send(alice, "POST", url, {
        drafts: { people: [randomUUID()] },
      });
      expect(unknown.statusCode).toBe(404);
      expect((await send(reader, "POST", url, chosen)).statusCode).toBe(403);
      expect((await test.request("", "POST", url, chosen)).statusCode).toBe(
        401,
      );
    }
    expect(await unpublished(alice)).toHaveLength(1);
    expect(await discard(alice, { people: [person] })).toBe(1);
  });
});

describe("publishing as the role in use", () => {
  const published = (who: User) =>
    saved<{ total: number; left: number }>(
      who,
      "POST",
      "/api/unpublished/publish",
    );

  it("publishes only the changes the role may make, leaving those and the changes using them for a role that may", async () => {
    // Given, made as a Workforce Administrator, a list, its choice and a column on it, a person
    // given the choice, and another person
    const maker = await user("workforce-administrator");
    const { list } = await saved<{ list: List }>(maker, "POST", "/api/lists", {
      name: unique("Fictional Role List"),
    });
    const [choice] = (
      await saved<{ choices: Choice[] }>(
        maker,
        "POST",
        `/api/lists/${list.id}/choices`,
        { choices: [{ label: "Fictional Role Choice" }] },
      )
    ).choices;
    const { field } = await saved<{ field: Field }>(
      maker,
      "POST",
      "/api/people/columns",
      { name: unique("Fictional Role Column"), listId: list.id },
    );
    const given = unique("Fictional Given Person");
    await saved(maker, "POST", "/api/people", {
      people: [
        {
          preferredName: given,
          employeeId: unique("E"),
          positionId: testPosition,
          values: { [field.id]: [String(choice?.id)] },
        },
      ],
    });
    const [plain] = await draftPeople(maker, [unique("Fictional Plain")]);

    // When the user publishes as a role that edits people but not configuration
    await test.holdOnly(maker.id, ["people:edit"]);
    const first = await published(maker);

    // Then only the other person is published, and the rest wait for a role that may
    expect(first).toEqual({ total: 1, left: 4 });
    const [waiting] = await test.connection
      .select({ state: drafts.state })
      .from(drafts)
      .where(eq(drafts.recordId, String(plain)));
    expect(waiting?.state).toBe("waiting");
    expect((await unpublished(maker)).map(({ subject }) => subject)).toContain(
      given,
    );

    // And once acting as a role that also edits configuration, they are published
    await test.holdOnly(maker.id, ["people:edit", "configuration:edit"]);
    expect(await published(maker)).toEqual({ total: 4, left: 0 });
  });

  it.each([
    ["features", "product-manager", ["people:edit"], ["features:edit"]],
    ["people", "workforce-administrator", ["features:edit"], ["people:edit"]],
  ] as const)(
    "publishes a column on %s only as a role that sets up that table",
    async (table, makerRole, other, own) => {
      // Given a column made as a role that sets up the table
      const maker = await user(makerRole);
      await saved(maker, "POST", `/api/${table}/columns`, {
        name: unique("Fictional Role Column"),
        type: "link",
        visibility: "general",
      });

      // When publishing as a role that sets up only the other table, then as one that sets up this
      await test.holdOnly(maker.id, [...other, "people:view"]);
      expect(await published(maker)).toEqual({ total: 0, left: 1 });
      await test.holdOnly(maker.id, [...own, "people:view"]);
      expect(await published(maker)).toEqual({ total: 1, left: 0 });
    },
  );

  it("publishes nothing when the role may make none of the changes, which it still discards", async () => {
    const maker = await user("workforce-administrator");
    await draftPeople(maker, [unique("Fictional Left Person")]);
    await test.holdOnly(maker.id, ["plan:edit"]);

    expect(await published(maker)).toEqual({ total: 0, left: 1 });
    expect(await discard(maker)).toBe(1);
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
    const noLongerFits = (subject: string) =>
      `The change to ${subject} no longer fits the data; change or discard it, then publish again`;
    const clash = async (setUp: () => Promise<void>, error: string) => {
      await setUp();
      await refused(bob, "POST", "/api/unpublished/publish", undefined, error);
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
    }, noLongerFits("Fictional Clash"));

    const listName = unique("Fictional Clash List");
    await clash(async () => {
      await saved(bob, "POST", "/api/lists", { name: listName });
      await test.connection.insert(lists).values({ name: listName });
    }, `The list ${listName}: There is already a list with that name`);

    await clash(async () => {
      await saved(bob, "POST", `/api/lists/${siteList.id}/choices`, {
        choices: [{ label: "Fictional Clash" }],
      });
      await test.connection
        .insert(listItems)
        .values({ listId: siteList.id, label: "Fictional Clash" });
    }, `The choice Fictional Clash in ${siteList.name}: This list already has a choice with that name`);

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
    }, "The choice Fictional Orphan in a removed list: There is no such list");
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
    }, "The new order for a removed list: There is no such list");

    const columnName = unique("Fictional Clash Column");
    await clash(
      async () => {
        await saved(bob, "POST", "/api/people/columns", {
          name: columnName,
          listId: siteList.id,
        });
        await test.connection.insert(fields).values({
          tableName: "people",
          name: columnName,
          listId: siteList.id,
        });
      },
      noLongerFits(`the column ${columnName}`),
    );

    const loneColumn = unique("Fictional Lone Column");
    await clash(
      async () => {
        await saved(bob, "POST", "/api/people/columns", {
          name: loneColumn,
          listId: lone.id,
        });
        await test.connection.delete(lists).where(eq(lists.id, lone.id));
      },
      noLongerFits(`the column ${loneColumn}`),
    );
  });
});
