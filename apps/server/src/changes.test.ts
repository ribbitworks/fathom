// SPDX-License-Identifier: Apache-2.0

// Tests for the change history, against a PostgreSQL server of its own: each change set saved, put
// in terms of names rather than identifiers, holding only the changes each reader's roles let them
// see, with Personal and Confidential changes recorded in the access history.

import { accessHistory, recordChanges } from "@fathom/db";
import { type Field, type List, type Role, roleSchema } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import { generalReader, testPosition } from "./test-app.ts";
import {
  admin,
  approve,
  closeChangeTests,
  entryFor,
  history,
  makePersonWithColumn,
  search,
  send,
  startChangeTests,
  test,
} from "./test-changes.ts";

beforeAll(startChangeTests);
afterAll(closeChangeTests);

describe("the change history", () => {
  it.each(
    roleSchema.options.filter(
      (role) => !rolesGranting("plan:view").includes(role),
    ),
  )("is refused to a %s, whose role does not let them see it", async (role) => {
    const { cookie } = await test.signedIn(role);
    expect((await test.request(cookie, "GET", "/api/changes")).statusCode).toBe(
      403,
    );
  });

  it("names who changed what, and the records and values involved, newest first", async () => {
    const made = await makePersonWithColumn("Alpha");
    const changed = await send("PATCH", `/api/people/${made.personId}`, {
      preferredName: "Alpha Renamed",
      values: { [made.field.id]: [made.south.id] },
    });
    const renamed = await send("PUT", `/api/lists/${made.list.id}`, {
      name: "Alpha places",
    });
    const moved = await send(
      "PUT",
      `/api/lists/${made.list.id}/choices/${made.south.id}/position`,
      { after: null },
    );
    const retired = await send(
      "PUT",
      `/api/lists/${made.list.id}/choices/${made.north.id}/retired`,
      { retired: true },
    );

    const { entries } = await history(admin.cookie);
    const ids = entries.map(({ id }) => id);
    expect(ids.indexOf(String(retired.changeSetId))).toBeLessThan(
      ids.indexOf(String(changed.changeSetId)),
    );
    const named = (changeSetId: string | null) =>
      entries.find((entry) => entry.id === changeSetId);
    expect(named(changed.changeSetId)).toEqual({
      id: changed.changeSetId,
      kind: "edit",
      madeAt: expect.any(String) as string,
      madeBy: "Fictional User 1",
      madeAs: "Workforce Administrator",
      records: [
        {
          kind: "person",
          action: "changed",
          name: "Alpha Renamed",
          list: null,
          draft: true,
          fields: [
            {
              field: "preferredName",
              oldValue: "Alpha Person",
              newValue: "Alpha Renamed",
            },
            {
              field: "value",
              column: "Alpha site",
              oldValue: ["Alpha North"],
              newValue: ["Alpha South"],
            },
          ],
        },
      ],
    });
    expect(named(renamed.changeSetId)?.records).toEqual([
      {
        kind: "list",
        action: "changed",
        name: "Alpha places",
        list: null,
        draft: true,
        fields: [
          { field: "name", oldValue: "Alpha sites", newValue: "Alpha places" },
        ],
      },
    ]);
    expect(named(moved.changeSetId)?.records).toEqual([
      {
        kind: "choice-order",
        action: "changed",
        name: "Alpha places",
        list: null,
        draft: true,
        fields: [
          {
            field: "order",
            oldValue: ["Alpha North", "Alpha South"],
            newValue: ["Alpha South", "Alpha North"],
          },
        ],
      },
    ]);
    expect(named(retired.changeSetId)?.records[0]?.fields).toEqual([
      { field: "retired", oldValue: false, newValue: true },
    ]);
  });

  it("keeps the names of records deleted since, and names the list a column draws on", async () => {
    const made = await makePersonWithColumn("Beta");
    const choice = await send("POST", `/api/lists/${made.list.id}/choices`, {
      choices: [{ label: "Beta East" }],
    });
    const east = (choice.choices as { id: string }[])[0] as { id: string };
    const deleted = await send(
      "DELETE",
      `/api/lists/${made.list.id}/choices/${east.id}`,
    );
    // An added or deleted record is named alone, without its values.
    expect(
      (await entryFor(admin.cookie, deleted.changeSetId))?.records,
    ).toEqual([
      {
        kind: "list-item",
        action: "deleted",
        name: "Beta East",
        list: "Beta sites",
        draft: true,
        fields: [],
      },
    ]);
    const { list } = (await send("POST", "/api/lists", {
      name: "Beta other",
    })) as unknown as { list: List };
    await test.approveLists();
    const { field } = (await send("POST", "/api/people/columns", {
      name: "Beta other column",
      listId: made.list.id,
    })) as unknown as { field: Field };
    const relinked = await send("PUT", `/api/people/columns/${field.id}`, {
      name: "Beta other column",
      listId: list.id,
    });
    expect(
      (await entryFor(admin.cookie, relinked.changeSetId))?.records,
    ).toEqual([
      {
        kind: "field",
        action: "changed",
        name: "Beta other column",
        list: null,
        draft: true,
        fields: [
          { field: "listId", oldValue: "Beta sites", newValue: "Beta other" },
        ],
      },
    ]);
  });

  it("shows each role only the changes it may see", async () => {
    const general = await makePersonWithColumn("Theta");
    const confidential = await makePersonWithColumn("Iota", "confidential");
    const name = await send("PATCH", `/api/people/${general.personId}`, {
      preferredName: "Theta Renamed",
    });
    const date = await send("PATCH", `/api/people/${general.personId}`, {
      endDate: "2031-05-06",
    });
    const choice = await send("PATCH", `/api/people/${confidential.personId}`, {
      values: { [confidential.field.id]: [confidential.south.id] },
    });
    const list = await send("PUT", `/api/lists/${general.list.id}`, {
      name: "Theta places",
    });
    const sets = [name, date, choice, list];
    // Whether each role sees the General, Personal, and Confidential changes, and the configuration.
    const expected: [Role, boolean[]][] = [
      ["product-manager", [true, false, false, true]],
      ["feature-lead", [true, false, false, false]],
      ["project-manager", [true, true, true, true]],
      ["engineering-manager", [true, true, true, true]],
      ["engineering-director", [true, true, true, true]],
      ["workforce-administrator", [true, true, true, true]],
      ["executive", [true, true, true, true]],
    ];
    for (const [role, sees] of expected) {
      const { cookie } = await test.signedIn(role);
      const ids = (await history(cookie)).entries.map(({ id }) => id);
      expect(
        sets.map(({ changeSetId }) => ids.includes(String(changeSetId))),
        role,
      ).toEqual(sees);
    }
  });

  it("shows someone added before they start, or who has left, only to readers who see Personal details", async () => {
    // Given someone added to start in the future, someone who has started, and someone who has left
    const added = await send("POST", "/api/people", {
      people: [
        {
          preferredName: "Kappa Starter",
          employeeId: "KAPPA-1",
          positionId: testPosition,
          startDate: "2099-01-04",
        },
        {
          preferredName: "Kappa Current",
          employeeId: "KAPPA-2",
          positionId: testPosition,
          startDate: "2020-01-06",
        },
        {
          preferredName: "Kappa Former",
          employeeId: "KAPPA-3",
          positionId: testPosition,
          startDate: "2020-01-06",
          endDate: "2021-01-08",
        },
      ],
    });
    const named = async (role: Role) => {
      const entry = await entryFor(
        (await test.signedIn(role)).cookie,
        added.changeSetId,
      );
      return (entry?.records ?? []).map(({ name }) => name);
    };

    // Then only readers who see Personal details see the future starter and the former colleague
    expect(await named("workforce-administrator")).toEqual([
      "Kappa Starter",
      "Kappa Current",
      "Kappa Former",
    ]);
    expect(await named("feature-lead")).toEqual(["Kappa Current"]);
  });

  it("finds no one who has not started for readers who do not see Personal details, even someone never added", async () => {
    // Given a future starter, and another drafted and then discarded before ever being added
    await send("POST", "/api/people", {
      people: [
        {
          preferredName: "Lambda Starter",
          employeeId: "LAMBDA-1",
          positionId: testPosition,
          startDate: "2099-02-01",
        },
      ],
    });
    const drafted = await send("POST", "/api/people", {
      people: [
        {
          preferredName: "Lambda Discarded",
          employeeId: "LAMBDA-2",
          positionId: testPosition,
          startDate: "2099-03-01",
        },
      ],
    });
    const [discardedId] = drafted.ids as string[];
    await send("DELETE", `/api/people/${String(discardedId)}/draft`);
    const generalViewer = (await test.signedIn(generalReader)).cookie;

    // Then neither is found by a reader who does not see Personal details
    expect((await search(generalViewer, "Lambda")).entries).toEqual([]);
    expect(
      (await search(admin.cookie, "Lambda")).entries.length,
    ).toBeGreaterThan(0);
  });

  it("finds no one who had left for readers who do not see Personal details, even once their draft is discarded", async () => {
    // Given someone drafted to be added who had already left, then discarded
    const drafted = await send("POST", "/api/people", {
      people: [
        {
          preferredName: "Mu Former",
          employeeId: "MU-1",
          positionId: testPosition,
          startDate: "2019-01-07",
          endDate: "2020-01-06",
        },
      ],
    });
    const [discardedId] = drafted.ids as string[];
    await send("DELETE", `/api/people/${String(discardedId)}/draft`);
    const generalViewer = (await test.signedIn(generalReader)).cookie;

    // Then they are not found by a reader who does not see Personal details
    expect((await search(generalViewer, "Mu Former")).entries).toEqual([]);
    expect(
      (await search(admin.cookie, "Mu Former")).entries.length,
    ).toBeGreaterThan(0);
  });

  it("keeps hiding choices once their column is deleted, by their lists' visibility now", async () => {
    const made = await makePersonWithColumn("Kappa");
    const chosen = await send("PATCH", `/api/people/${made.personId}`, {
      values: { [made.field.id]: [made.south.id] },
    });
    await send("PUT", `/api/lists/${made.list.id}/class`, {
      dataClass: "confidential",
    });
    await approve(made.personId);
    await send("DELETE", `/api/people/columns/${made.field.id}`);
    const generalViewer = await test.signedIn(generalReader);
    expect(
      await entryFor(generalViewer.cookie, chosen.changeSetId),
    ).toBeUndefined();
    const leader = await test.signedIn("executive");
    expect(
      (await entryFor(leader.cookie, chosen.changeSetId))?.records[0]?.fields,
    ).toEqual([
      {
        field: "value",
        column: "Kappa site",
        oldValue: ["Kappa North"],
        newValue: ["Kappa South"],
      },
    ]);
  });

  it("holds only the changes each reader's roles let them see", async () => {
    const made = await makePersonWithColumn("Gamma", "personal");
    const general = await send("PATCH", `/api/people/${made.personId}`, {
      preferredName: "Gamma Renamed",
    });
    const dates = await send("PATCH", `/api/people/${made.personId}`, {
      endDate: "2030-01-31",
    });
    const both = await send("PATCH", `/api/people/${made.personId}`, {
      employeeId: "E-Gamma-2",
      values: { [made.field.id]: [made.south.id] },
    });
    const generalViewer = await test.signedIn(generalReader);
    const manager = await test.signedIn("engineering-manager");
    const project = await test.signedIn("product-manager");

    expect(
      await entryFor(generalViewer.cookie, general.changeSetId),
    ).toBeDefined();
    // Only Personal changes: the change set is left out altogether.
    expect(
      await entryFor(generalViewer.cookie, dates.changeSetId),
    ).toBeUndefined();
    expect(
      (await entryFor(generalViewer.cookie, both.changeSetId))?.records[0]
        ?.fields,
    ).toEqual([
      { field: "employeeId", oldValue: "E-Gamma", newValue: "E-Gamma-2" },
    ]);
    // Lists and columns are configuration, seen only by those who may open its pages.
    expect(
      (await history(generalViewer.cookie)).entries.flatMap(({ records }) =>
        records.map(({ kind }) => kind),
      ),
    ).not.toContain("list");

    expect(
      (await entryFor(manager.cookie, dates.changeSetId))?.records[0]?.fields,
    ).toEqual([{ field: "endDate", oldValue: null, newValue: "2030-01-31" }]);
    expect(
      (await entryFor(manager.cookie, both.changeSetId))?.records[0]?.fields,
    ).toHaveLength(2);

    // Product Managers see people's General details, since the org chart became part of People.
    expect(await entryFor(project.cookie, general.changeSetId)).toBeDefined();
    expect(await entryFor(project.cookie, dates.changeSetId)).toBeUndefined();
    const administrator = await test.signedIn("administrator");
    expect(
      (await test.request(administrator.cookie, "GET", "/api/changes"))
        .statusCode,
    ).toBe(403);
  });

  it("hides choices in a column whose list has become more sensitive since", async () => {
    const made = await makePersonWithColumn("Delta");
    const chosen = await send("PATCH", `/api/people/${made.personId}`, {
      values: { [made.field.id]: [made.south.id] },
    });
    const generalViewer = await test.signedIn(generalReader);
    expect(
      await entryFor(generalViewer.cookie, chosen.changeSetId),
    ).toBeDefined();
    await send("PUT", `/api/lists/${made.list.id}/class`, {
      dataClass: "confidential",
    });
    expect(
      await entryFor(generalViewer.cookie, chosen.changeSetId),
    ).toBeUndefined();
    const leader = await test.signedIn("executive");
    expect(await entryFor(leader.cookie, chosen.changeSetId)).toBeDefined();
  });

  it("leaves out what it cannot name, such as changes recorded by another version of Fathom", async () => {
    const [unknownList, unknownChoice, unknownColumn, choiceId] = [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ];
    const changeSetId = await test.connection.transaction((transaction) =>
      recordChanges(transaction, null, [
        {
          recordType: "list-item",
          recordId: choiceId,
          action: "changed",
          field: "order",
          tier: "general",
          oldValue: unknownChoice,
          newValue: null,
        },
        {
          recordType: "person",
          recordId: randomUUID(),
          action: "changed",
          field: `value:${unknownColumn}`,
          tier: "general",
          // The second choice's list is named, but the history holds nothing else about it.
          oldValue: [unknownChoice, choiceId],
          newValue: null,
        },
      ]),
    );
    await test.connection.transaction((transaction) =>
      recordChanges(transaction, null, [
        {
          recordType: "list-item",
          recordId: choiceId,
          action: "changed",
          field: "listId",
          tier: "general",
          oldValue: null,
          newValue: unknownList,
        },
      ]),
    );
    expect((await entryFor(admin.cookie, changeSetId))?.records).toEqual([
      {
        kind: "list-item",
        action: "changed",
        name: null,
        list: null,
        draft: false,
        fields: [{ field: "order", oldValue: null, newValue: null }],
      },
      {
        kind: "person",
        action: "changed",
        name: null,
        list: null,
        draft: false,
        fields: [{ field: "value", oldValue: [], newValue: null }],
      },
    ]);
  });

  it("records in the access history that a reader saw Personal changes, and only then", async () => {
    const made = await makePersonWithColumn("Epsilon");
    await send("PATCH", `/api/people/${made.personId}`, {
      startDate: "2020-02-03",
    });
    const viewed = (actorId: string) =>
      test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, actorId),
            eq(accessHistory.action, "personal-viewed"),
          ),
        );
    const generalViewer = await test.signedIn(generalReader);
    await history(generalViewer.cookie);
    expect(await viewed(generalViewer.id)).toHaveLength(0);
    const manager = await test.signedIn("engineering-manager");
    await history(manager.cookie);
    await history(manager.cookie);
    expect(await viewed(manager.id)).toHaveLength(1);
    const leader = await test.signedIn("executive");
    await history(leader.cookie);
    expect(await viewed(leader.id)).toHaveLength(1);
  });
});
