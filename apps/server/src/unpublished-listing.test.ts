// SPDX-License-Identifier: Apache-2.0

// Integration tests for listing unpublished changes, against a PostgreSQL server of their own: the
// list the top bar names, and the change history, which shows them only to their maker.

import { privateChanges, privateSetOf } from "@fathom/db";
import {
  type ChangeHistory,
  type Choice,
  type Field,
  type List,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPosition, unique } from "./test-app.ts";
import {
  test,
  alice,
  bob,
  user,
  saved,
  personOf,
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

  it("names no record of a kind the role now in use can't read", async () => {
    // Given changes of every kind kept outside the plan's records, made under a role that reads them
    const maker = await user("workforce-administrator");
    await draftPeople(maker, [unique("Fictional Hidden Person")]);
    await saved(maker, "POST", "/api/planned-hires", {
      hires: [
        {
          name: unique("Fictional Hidden Hire"),
          positionId: testPosition,
          targetDate: "2027-03-15",
        },
      ],
    });
    const team = unique("Fictional Hidden Team");
    await saved(maker, "POST", "/api/feature-teams", { name: team });
    const { list } = await saved<{ list: List }>(maker, "POST", "/api/lists", {
      name: unique("Fictional Hidden List"),
    });
    const { choices } = await saved<{ choices: Choice[] }>(
      maker,
      "POST",
      `/api/lists/${list.id}/choices`,
      {
        choices: [
          { label: "Fictional Hidden Choice" },
          { label: "Fictional Hidden Second" },
        ],
      },
    );
    await saved(
      maker,
      "PUT",
      `/api/lists/${list.id}/choices/${String(choices[1]?.id)}/position`,
      { after: null },
    );
    await saved(maker, "POST", "/api/people/columns", {
      name: unique("Fictional Hidden Column"),
      listId: list.id,
    });
    const named = (await unpublished(maker)).map(({ subject }) => subject);

    // When the user acts as a role that reads none of them
    await test.holdOnly(maker.id, ["plan:edit"]);
    const subjects = (await unpublished(maker)).map(({ subject }) => subject);

    // Then each is named only by its kind
    expect(named.join(" ")).toContain(team);
    expect(subjects.sort()).toEqual(
      [
        "a choice",
        "a choice",
        "a column",
        "a feature team",
        "a list",
        "a person",
        "a planned hire",
        "the new order for a list",
      ].sort(),
    );
    await discard(maker);
  });

  it("names a change of a kind it doesn't know only as a change, and still lists and discards the rest", async () => {
    const maker = await user("workforce-administrator");
    const name = unique("Fictional Beside Unknown");
    await draftPeople(maker, [name]);
    await test.connection.insert(privateChanges).values({
      recordType: "fictional-retired-kind",
      recordId: randomUUID(),
      userId: maker.id,
      setId: await privateSetOf(test.connection, maker.id),
      action: "created",
    });

    const subjects = (await unpublished(maker)).map(({ subject }) => subject);

    expect(subjects.sort()).toEqual(["a change", name].sort());
    expect(await discard(maker)).toBe(2);
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
