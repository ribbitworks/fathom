// SPDX-License-Identifier: Apache-2.0

// Tests for the change history, against a PostgreSQL server of its own: each change set saved, put
// in terms of names rather than identifiers, newest first and older ones on request, holding only
// the changes each reader's roles let them see, with Restricted and Confidential changes recorded in
// the access history. Resource Planners stand for readers who see people's General details only.

import { accessHistory, recordChanges } from "@fathom/db";
import type {
  ChangeEntry,
  ChangeHistory,
  Field,
  List,
  Role,
} from "@fathom/shared";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "./test-app.ts";

let test: TestApp;
let admin: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  admin = await test.signedIn(["workforce-administrator"]);
});

afterAll(async () => {
  await test.close();
});

const history = async (cookie: string, before?: string) => {
  const response = await test.request(
    cookie,
    "GET",
    `/api/changes${before === undefined ? "" : `?before=${before}`}`,
  );
  expect(response.statusCode).toBe(200);
  return response.json<ChangeHistory>();
};

const search = async (cookie: string, text: string) => {
  const response = await test.request(
    cookie,
    "GET",
    `/api/changes?search=${encodeURIComponent(text)}`,
  );
  expect(response.statusCode).toBe(200);
  return response.json<ChangeHistory>();
};

// The entry for a change set, or undefined when the reader does not see it.
const entryFor = async (cookie: string, changeSetId: string | null) =>
  (await history(cookie)).entries.find(
    (entry: ChangeEntry) => entry.id === changeSetId,
  );

async function send(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: object,
) {
  const response = await test.request(admin.cookie, method, url, payload);
  expect(response.statusCode).toBeLessThan(300);
  return response.json<
    { changeSetId: string | null } & Record<string, unknown>
  >();
}

// A list with two choices, a People column drawing on it, and a person with the first choice.
async function makePersonWithColumn(name: string, visibility = "general") {
  const { list } = (await send("POST", "/api/lists", {
    name: `${name} sites`,
    visibility,
  })) as unknown as { list: List };
  const { choices } = (await send("POST", `/api/lists/${list.id}/choices`, {
    choices: [{ label: `${name} North` }, { label: `${name} South` }],
  })) as unknown as { choices: { id: string }[] };
  const [north, south] = choices as [{ id: string }, { id: string }];
  const { field } = (await send("POST", "/api/people/columns", {
    name: `${name} site`,
    listId: list.id,
  })) as unknown as { field: Field };
  const { ids } = (await send("POST", "/api/people", {
    people: [
      {
        preferredName: `${name} Person`,
        employeeId: `E-${name}`,
        values: { [field.id]: [north.id] },
      },
    ],
  })) as unknown as { ids: string[] };
  return { list, north, south, field, personId: ids[0] as string };
}

// Approves a person's draft, as an Approver who sees every tier.
async function approve(personId: string) {
  const { cookie } = await test.signedIn(["approver", "leadership"]);
  const response = await test.request(
    cookie,
    "POST",
    "/api/people/drafts/approval",
    { people: [personId] },
  );
  expect(response.statusCode).toBe(200);
  return response.json<{ changeSetId: string }>().changeSetId;
}

describe("the change history", () => {
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
    const column = await send(
      "PUT",
      `/api/people/columns/${made.field.id}/position`,
      { after: null },
    );

    const { entries } = await history(admin.cookie);
    const ids = entries.map(({ id }) => id);
    expect(ids.indexOf(String(column.changeSetId))).toBeLessThan(
      ids.indexOf(String(changed.changeSetId)),
    );
    const named = (changeSetId: string | null) =>
      entries.find((entry) => entry.id === changeSetId);
    expect(named(changed.changeSetId)).toEqual({
      id: changed.changeSetId,
      kind: "edit",
      madeAt: expect.any(String) as string,
      madeBy: "Fictional User 1",
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
        draft: false,
        fields: [
          { field: "name", oldValue: "Alpha sites", newValue: "Alpha places" },
        ],
      },
    ]);
    expect(named(moved.changeSetId)?.records).toEqual([
      {
        kind: "list-item",
        action: "changed",
        name: "Alpha South",
        list: "Alpha places",
        draft: false,
        fields: [{ field: "order", oldValue: "Alpha North", newValue: null }],
      },
    ]);
    expect(named(retired.changeSetId)?.records[0]?.fields).toEqual([
      { field: "retired", oldValue: false, newValue: true },
    ]);
    const order = named(column.changeSetId)?.records[0];
    expect(order).toMatchObject({ kind: "column-order", action: "changed" });
    expect(order?.fields[0]?.newValue).toEqual(
      expect.arrayContaining([
        "Alpha site",
        "Name",
        "Employee ID",
        "Start",
        "End",
      ]),
    );
    expect((order?.fields[0]?.newValue as string[])[0]).toBe("Alpha site");
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
        draft: false,
        fields: [],
      },
    ]);
    const { list } = (await send("POST", "/api/lists", {
      name: "Beta other",
    })) as unknown as { list: List };
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
        draft: false,
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
    // Whether each role sees the General, Restricted, and Confidential changes, and the configuration.
    const expected: [Role, boolean[]][] = [
      ["viewer", [false, false, false, false]],
      ["project-planner", [false, false, false, false]],
      ["resource-planner", [true, false, false, false]],
      ["people-manager", [true, true, false, false]],
      ["workforce-administrator", [true, true, true, true]],
      ["leadership", [true, true, true, false]],
      ["approver", [false, false, false, false]],
    ];
    for (const [role, sees] of expected) {
      const { cookie } = await test.signedIn([role]);
      const ids = (await history(cookie)).entries.map(({ id }) => id);
      expect(
        sets.map(({ changeSetId }) => ids.includes(String(changeSetId))),
        role,
      ).toEqual(sees);
    }
  });

  it("keeps hiding choices once their column is deleted, by their lists' visibility now", async () => {
    const made = await makePersonWithColumn("Kappa");
    const chosen = await send("PATCH", `/api/people/${made.personId}`, {
      values: { [made.field.id]: [made.south.id] },
    });
    await send("PUT", `/api/lists/${made.list.id}`, {
      name: "Kappa sites",
      visibility: "confidential",
    });
    await approve(made.personId);
    await send("DELETE", `/api/people/columns/${made.field.id}`);
    const planner = await test.signedIn(["resource-planner"]);
    expect(await entryFor(planner.cookie, chosen.changeSetId)).toBeUndefined();
    const leader = await test.signedIn(["leadership"]);
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
    const made = await makePersonWithColumn("Gamma", "restricted");
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
    const planner = await test.signedIn(["resource-planner"]);
    const manager = await test.signedIn(["people-manager"]);
    const project = await test.signedIn(["project-planner"]);

    expect(await entryFor(planner.cookie, general.changeSetId)).toBeDefined();
    // Only Restricted changes: the change set is left out altogether.
    expect(await entryFor(planner.cookie, dates.changeSetId)).toBeUndefined();
    expect(
      (await entryFor(planner.cookie, both.changeSetId))?.records[0]?.fields,
    ).toEqual([
      { field: "employeeId", oldValue: "E-Gamma", newValue: "E-Gamma-2" },
    ]);
    // Lists and columns are configuration, seen only by those who may open its pages.
    expect(
      (await history(planner.cookie)).entries.flatMap(({ records }) =>
        records.map(({ kind }) => kind),
      ),
    ).not.toContain("list");

    expect(
      (await entryFor(manager.cookie, dates.changeSetId))?.records[0]?.fields,
    ).toEqual([{ field: "endDate", oldValue: null, newValue: "2030-01-31" }]);
    expect(
      (await entryFor(manager.cookie, both.changeSetId))?.records[0]?.fields,
    ).toHaveLength(2);

    expect((await history(project.cookie)).entries).toEqual([]);
    const administrator = await test.signedIn(["administrator"]);
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
    const planner = await test.signedIn(["resource-planner"]);
    expect(await entryFor(planner.cookie, chosen.changeSetId)).toBeDefined();
    await send("PUT", `/api/lists/${made.list.id}`, {
      name: "Delta sites",
      visibility: "confidential",
    });
    expect(await entryFor(planner.cookie, chosen.changeSetId)).toBeUndefined();
    const leader = await test.signedIn(["leadership"]);
    expect(await entryFor(leader.cookie, chosen.changeSetId)).toBeDefined();
  });

  it("hides changes to saved views on columns a reader may not see", async () => {
    const manager = await test.signedIn(["people-manager"]);
    const saved = await test.request(
      manager.cookie,
      "POST",
      "/api/people/views",
      {
        name: "Leaving soon",
        definition: { sort: ["endDate"] },
      },
    );
    const { changeSetId } = saved.json<{ changeSetId: string }>();
    expect(
      (await entryFor(manager.cookie, changeSetId))?.records[0],
    ).toMatchObject({ kind: "saved-view", name: "Leaving soon" });
    const planner = await test.signedIn(["resource-planner"]);
    expect(await entryFor(planner.cookie, changeSetId)).toBeUndefined();
    const { view } = saved.json<{ view: { id: string } }>();
    const renamed = await test.request(
      manager.cookie,
      "PUT",
      `/api/people/views/${view.id}`,
      { name: "Leaving", definition: { sort: ["-endDate"] } },
    );
    expect(
      (
        await entryFor(
          manager.cookie,
          renamed.json<{ changeSetId: string }>().changeSetId,
        )
      )?.records[0]?.fields,
    ).toEqual([
      { field: "name", oldValue: "Leaving soon", newValue: "Leaving" },
      // What a view filters and sorts on is not shown, only that it changed.
      { field: "definition", oldValue: null, newValue: null },
    ]);
  });

  it("hides even a rename of a view on a column whose list has become more sensitive since", async () => {
    const made = await makePersonWithColumn("Eta");
    const manager = await test.signedIn(["leadership"]);
    const saved = await test.request(
      manager.cookie,
      "POST",
      "/api/people/views",
      {
        name: "By Eta site",
        definition: { sort: [made.field.id] },
      },
    );
    const { view } = saved.json<{ view: { id: string } }>();
    const renamed = (
      await test.request(
        manager.cookie,
        "PUT",
        `/api/people/views/${view.id}`,
        {
          name: "Eta sites",
        },
      )
    ).json<{ changeSetId: string }>();
    const planner = await test.signedIn(["resource-planner"]);
    expect(await entryFor(planner.cookie, renamed.changeSetId)).toBeDefined();
    await send("PUT", `/api/lists/${made.list.id}`, {
      name: "Eta sites",
      visibility: "confidential",
    });
    expect(await entryFor(planner.cookie, renamed.changeSetId)).toBeUndefined();
    expect(await entryFor(manager.cookie, renamed.changeSetId)).toBeDefined();
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

  it("records in the access history that a reader saw Restricted changes, and only then", async () => {
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
            eq(accessHistory.action, "restricted-viewed"),
          ),
        );
    const planner = await test.signedIn(["resource-planner"]);
    await history(planner.cookie);
    expect(await viewed(planner.id)).toHaveLength(0);
    const manager = await test.signedIn(["people-manager"]);
    await history(manager.cookie);
    await history(manager.cookie);
    expect(await viewed(manager.id)).toHaveLength(1);
    const leader = await test.signedIn(["leadership"]);
    await history(leader.cookie);
    expect(await viewed(leader.id)).toHaveLength(1);
  });

  it("shows the latest change sets, then older ones on request", async () => {
    const reader = await test.signedIn(["resource-planner"]);
    const personId = randomUUID();
    // More change sets than are shown at once, made directly for speed.
    for (let index = 0; index < 205; index += 1) {
      await test.connection.transaction((transaction) =>
        recordChanges(transaction, null, [
          {
            recordType: "person",
            recordId: personId,
            action: "changed",
            field: "preferredName",
            tier: "general",
            oldValue: index === 0 ? "Zeta origin" : `Zeta ${String(index)}`,
            newValue: `Zeta ${String(index + 1)}`,
          },
        ]),
      );
    }
    const first = await history(reader.cookie);
    expect(first.entries).toHaveLength(200);
    expect(first.entries[0]).toMatchObject({
      madeBy: null,
      records: [{ name: "Zeta 205", fields: [{ newValue: "Zeta 205" }] }],
    });
    const last = first.entries.at(-1) as ChangeEntry;
    expect(first.next).toBe(last.id);
    const next = await history(reader.cookie, String(first.next));
    expect(next.entries[0]?.records[0]?.fields[0]?.newValue).toBe("Zeta 5");
    expect(next.entries.map(({ id }) => id)).not.toContain(last.id);
    expect(await history(reader.cookie, randomUUID())).toEqual({
      entries: [],
      next: null,
    });
    // A search reads on past change sets that do not match, to the oldest that does.
    const oldest = await search(reader.cookie, "ZETA ORIGIN");
    expect(oldest.entries).toHaveLength(1);
    expect(oldest.entries[0]?.records[0]?.fields[0]).toEqual({
      field: "preferredName",
      oldValue: "Zeta origin",
      newValue: "Zeta 1",
    });
    expect(oldest.next).toBeNull();
  });

  it("finds changes holding every word searched for, in who made them, names, and values", async () => {
    const made = await makePersonWithColumn("Lambda");
    const chosen = await send("PATCH", `/api/people/${made.personId}`, {
      values: { [made.field.id]: [made.south.id] },
    });
    const ids = async (text: string) =>
      (await search(admin.cookie, text)).entries.map(({ id }) => id);
    expect(await ids("lambda south")).toContain(chosen.changeSetId);
    expect(await ids("LÁMBDA   person")).toContain(chosen.changeSetId);
    expect(await ids("fictional user 1 lambda site")).toContain(
      chosen.changeSetId,
    );
    expect(await ids("lambda nowhere")).toEqual([]);
    // Names in other scripts, found by part of a name and in any letter case.
    const { ids: added } = (await send("POST", "/api/people", {
      people: [
        { preferredName: "편성현", employeeId: "E-Lambda-ko" },
        { preferredName: "Вероника Елисеева", employeeId: "E-Lambda-ru" },
      ],
    })) as unknown as { ids: string[] };
    expect(added).toHaveLength(2);
    const [entry] = (await search(admin.cookie, "성현")).entries;
    expect(entry?.records.map(({ name }) => name)).toContain("편성현");
    expect(
      (await search(admin.cookie, "ВЕРОНИКА елисеева")).entries[0]?.records.map(
        ({ name }) => name,
      ),
    ).toContain("Вероника Елисеева");
    expect(await ids("   ")).toContain(chosen.changeSetId);
  });

  it("never matches a search on what the reader may not see, and records only sensitive changes found", async () => {
    const made = await makePersonWithColumn("Omicron");
    await send("PATCH", `/api/people/${made.personId}`, {
      endDate: "2033-03-03",
    });
    await send("PATCH", `/api/people/${made.personId}`, {
      values: { [made.field.id]: [made.south.id] },
    });
    await send("PUT", `/api/lists/${made.list.id}`, {
      name: "Omicron sites",
      visibility: "restricted",
    });
    const viewed = (actorId: string) =>
      test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, actorId),
            eq(accessHistory.action, "restricted-viewed"),
          ),
        );
    const planner = await test.signedIn(["resource-planner"]);
    // The planner's searches work, finding what they may see.
    expect(
      (await search(planner.cookie, "Omicron Person")).entries.length,
    ).toBeGreaterThan(0);
    expect((await search(planner.cookie, "2033-03-03")).entries).toEqual([]);
    expect((await search(planner.cookie, "Omicron South")).entries).toEqual([]);
    expect(await viewed(planner.id)).toHaveLength(0);

    await send("POST", "/api/people", {
      people: [{ preferredName: "Omicron Other", employeeId: "E-Omicron-2" }],
    });
    const manager = await test.signedIn(["people-manager"]);
    expect(
      (await search(manager.cookie, "Omicron Other")).entries,
    ).toHaveLength(1);
    // Only General changes found: nothing sensitive was seen.
    expect(await viewed(manager.id)).toHaveLength(0);
    expect((await search(manager.cookie, "2033-03-03")).entries).toHaveLength(
      1,
    );
    expect(await viewed(manager.id)).toHaveLength(1);
  });

  it("reads on past change sets hidden since, to fill a page", async () => {
    const made = await makePersonWithColumn("Pi");
    // More change sets than a page holds, to choices in a column whose list is now Confidential.
    await test.connection.execute(sql`
      WITH made AS (
        INSERT INTO fathom.change_sets (made_by)
        SELECT NULL FROM generate_series(1, 250)
        RETURNING id
      )
      INSERT INTO fathom.changes
        (change_set_id, record_type, record_id, action, field, tier, old_value, new_value)
      SELECT id, 'person', ${made.personId}, 'changed', ${`value:${made.field.id}`}, 'general',
        ${JSON.stringify([made.north.id])}::jsonb, ${JSON.stringify([made.south.id])}::jsonb
      FROM made`);
    await send("PUT", `/api/lists/${made.list.id}`, {
      name: "Pi places",
      visibility: "confidential",
    });
    const planner = await test.signedIn(["resource-planner"]);
    const { entries } = await history(planner.cookie);
    expect(entries.length).toBeGreaterThan(0);
    // Only adding the person, whose General details the planner sees, and none of the hidden changes.
    expect(
      entries.filter(({ records }) =>
        records.some(({ name }) => name === "Pi Person"),
      ),
    ).toEqual([
      expect.objectContaining({
        records: [expect.objectContaining({ action: "created" })],
      }),
    ]);
    const leader = await test.signedIn(["leadership"]);
    expect((await history(leader.cookie)).entries[0]?.records[0]).toMatchObject(
      { name: "Pi Person" },
    );
    // Seeing Confidential changes is recorded in the access history.
    expect(
      await test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, leader.id),
            eq(accessHistory.action, "restricted-viewed"),
          ),
        ),
    ).toHaveLength(1);
  });

  // Kept last but for the refusals, since the change sets it adds fill every page after it.
  it("stops a search after reading as many change sets as one request may, to read on from there", async () => {
    const reader = await test.signedIn(["resource-planner"]);
    // Enough change sets, made in one statement for speed, that none of them match.
    await test.connection.execute(sql`
      WITH made AS (
        INSERT INTO fathom.change_sets (made_by)
        SELECT NULL FROM generate_series(1, 2100)
        RETURNING id
      )
      INSERT INTO fathom.changes
        (change_set_id, record_type, record_id, action, field, tier, old_value, new_value)
      SELECT id, 'person', gen_random_uuid()::text, 'changed', 'preferredName', 'general',
        '"Mu"', '"Mu again"'
      FROM made`);
    const first = await search(reader.cookie, "no such words anywhere");
    expect(first.entries).toEqual([]);
    expect(first.next).not.toBeNull();
    const rest = await test.request(
      reader.cookie,
      "GET",
      `/api/changes?search=no+such+words+anywhere&before=${String(first.next)}`,
    );
    expect(rest.json<ChangeHistory>().entries).toEqual([]);
  });

  it("refuses a search longer than a table's", async () => {
    const reader = await test.signedIn(["resource-planner"]);
    const response = await test.request(
      reader.cookie,
      "GET",
      `/api/changes?search=${"a".repeat(201)}`,
    );
    expect(response.statusCode).toBe(400);
  });

  it("refuses a page named by something other than a change set", async () => {
    const reader = await test.signedIn(["resource-planner"]);
    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/changes?before=not-an-id",
    );
    expect(response.statusCode).toBe(400);
  });
});
