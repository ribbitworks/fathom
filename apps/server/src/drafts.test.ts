// SPDX-License-Identifier: Apache-2.0

// Tests for drafts of people, against a PostgreSQL server of their own, since drafts are shared by
// everyone: how each role sees drafts that add, change, and remove people, with their live values;
// discarding, approving, and rejecting them, one or several at once, and who may; what the live
// people and the change history hold afterwards; undoing changes to drafts, but never an approval
// or rejection; Employee IDs taken in drafts; and the columns and choices drafts keep in use.

import { drafts, fields, people, recordChanges, users } from "@fathom/db";
import type {
  ChangeHistory,
  Choice,
  Field,
  List,
  Permission,
  Person,
  Role,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Method,
  startTestApp,
  type TestApp,
  testPosition,
} from "./test-app.ts";

let test: TestApp;
let editor: { id: string; cookie: string };
let approver: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  // Sees every tier, as the Engineering Director does.
  approver = await test.signedIn("engineering-director");
});

afterAll(async () => {
  await test.close();
});

let count = 0;
function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

async function send(
  cookie: string,
  method: Method,
  url: string,
  payload?: object,
) {
  return test.request(cookie, method, url, payload);
}

// Sends a change as the editor, expecting it to be saved, and returns its change set.
async function saved(method: Method, url: string, payload?: object) {
  const response = await send(editor.cookie, method, url, payload);
  expect(response.statusCode, response.body).toBeLessThan(300);
  return response.json<{ changeSetId: string | null }>().changeSetId;
}

async function columnWith(labels: string[], visibility = "general") {
  const list = (
    await send(editor.cookie, "POST", "/api/lists", {
      name: unique("Fictional List"),
      visibility,
    })
  ).json<{ list: List }>().list;
  const choices = (
    await send(editor.cookie, "POST", `/api/lists/${list.id}/choices`, {
      choices: labels.map((label) => ({ label })),
    })
  ).json<{ choices: Choice[] }>().choices;
  await test.approveLists();
  const field = (
    await send(editor.cookie, "POST", "/api/people/columns", {
      name: unique("Fictional Column"),
      listId: list.id,
      multiple: true,
    })
  ).json<{ field: Field }>().field;
  await test.approveLists();
  return { list, choices, field };
}

async function draftPerson(person: object = {}) {
  const response = await send(editor.cookie, "POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("E"),
        positionId: testPosition,
        ...person,
      },
    ],
  });
  expect(response.statusCode, response.body).toBe(201);
  const { ids, changeSetId } = response.json<{
    ids: string[];
    changeSetId: string;
  }>();
  return { id: String(ids[0]), changeSetId };
}

async function approve(ids: string[], cookie = approver.cookie) {
  return send(cookie, "POST", "/api/drafts/approval", { people: ids });
}

// Approves the drafts of the columns given alone, so other drafts a test makes stay waiting.
async function approveColumns(...ids: string[]) {
  const response = await send(approver.cookie, "POST", "/api/drafts/approval", {
    columns: ids,
  });
  expect(response.statusCode, response.body).toBe(200);
}

async function reject(ids: string[], reason: string, cookie = approver.cookie) {
  return send(cookie, "POST", "/api/drafts/rejection", {
    people: ids,
    reason,
  });
}

async function livePerson(person: object = {}) {
  const drafted = await draftPerson(person);
  expect((await approve([drafted.id])).statusCode).toBe(200);
  return drafted;
}

async function seen(cookie: string, id: string): Promise<Person | undefined> {
  const response = await send(cookie, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response
    .json<{ people: Person[] }>()
    .people.find((person) => person.id === id);
}

async function live(id: string) {
  const [row] = await test.connection
    .select()
    .from(people)
    .where(eq(people.id, id));
  return row;
}

async function draftRow(id: string) {
  const [row] = await test.connection
    .select()
    .from(drafts)
    .where(eq(drafts.recordId, id));
  return row;
}

async function entry(cookie: string, changeSetId: string | null) {
  const response = await send(cookie, "GET", "/api/changes");
  return response
    .json<ChangeHistory>()
    .entries.find(({ id }) => id === changeSetId);
}

async function undo(changeSetId: string | null, cookie = editor.cookie) {
  return send(cookie, "POST", `/api/undo/${String(changeSetId)}`);
}

describe("drafts as people see them", () => {
  it("shows a drafted person, a change, and a removal in place, with the live values", async () => {
    const { choices, field } = await columnWith(["North", "South"]);
    const [north = "", south = ""] = choices.map(({ id }) => id);
    const added = await draftPerson({ values: { [field.id]: [north] } });
    const changed = await livePerson({
      preferredName: "Fictional Before",
      values: { [field.id]: [north] },
    });
    await saved("PATCH", `/api/people/${changed.id}`, {
      preferredName: "Fictional After",
      values: { [field.id]: [south] },
    });
    const removed = await livePerson();
    await saved("DELETE", `/api/people/${removed.id}`);

    const planner = await test.signedIn("resource-planner");
    expect((await seen(planner.cookie, added.id))?.draft).toMatchObject({
      action: "created",
      changed: ["preferredName", "employeeId", "positionId", field.id],
      live: { values: {} },
      state: "waiting",
      madeBy: "Fictional User 1",
    });
    expect(await seen(planner.cookie, changed.id)).toMatchObject({
      preferredName: "Fictional After",
      values: { [field.id]: [south] },
      draft: {
        action: "changed",
        changed: ["preferredName", field.id],
        live: {
          preferredName: "Fictional Before",
          values: { [field.id]: [north] },
        },
      },
    });
    // A removal shows the person as they are.
    const gone = await seen(planner.cookie, removed.id);
    expect(gone?.draft?.action).toBe("deleted");
    expect(gone?.preferredName).toBe((await live(removed.id))?.preferredName);
    // Nothing reached the live people.
    expect(await live(added.id)).toBeUndefined();
    expect((await live(changed.id))?.preferredName).toBe("Fictional Before");
  });

  it("hides drafts, and reasons, that change only what a reader may not see", async () => {
    const restricted = await columnWith(["Secret"], "restricted");
    const person = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${person.id}`, {
      endDate: "2031-01-01",
    });
    const planner = await test.signedIn("resource-planner");
    const manager = await test.signedIn("engineering-manager");
    expect((await seen(planner.cookie, person.id))?.draft).toBeUndefined();
    expect((await seen(manager.cookie, person.id))?.draft).toMatchObject({
      changed: ["endDate"],
      live: { endDate: null },
    });
    // A rejection's reason is as sensitive as the draft.
    const other = await livePerson();
    await saved("PATCH", `/api/people/${other.id}`, {
      preferredName: unique("Fictional Renamed"),
      values: { [restricted.field.id]: [String(restricted.choices[0]?.id)] },
    });
    expect((await reject([other.id], "Fictional reason")).statusCode).toBe(200);
    expect((await seen(planner.cookie, other.id))?.draft).toMatchObject({
      state: "rejected",
      changed: ["preferredName"],
    });
    expect(
      (await seen(planner.cookie, other.id))?.draft?.reason,
    ).toBeUndefined();
    expect((await seen(manager.cookie, other.id))?.draft?.reason).toBe(
      "Fictional reason",
    );
  });

  it("lists people by name, and those with the same name in a fixed order, with each draft's columns in order", async () => {
    const first = await columnWith(["A"]);
    const second = await columnWith(["B"]);
    const values = {
      [first.field.id]: [String(first.choices[0]?.id)],
      [second.field.id]: [String(second.choices[0]?.id)],
    };
    const name = unique("Fictional Twin");
    const twins = [
      await draftPerson({ preferredName: name, values }),
      await draftPerson({
        preferredName: name,
        values,
        employeeId: unique("E"),
        positionId: testPosition,
      }),
    ];
    const response = await send(editor.cookie, "GET", "/api/people");
    const listed = response
      .json<{ people: Person[] }>()
      .people.filter(({ preferredName }) => preferredName === name);
    expect(listed.map(({ id }) => id)).toEqual(
      twins.map(({ id }) => id).sort(),
    );
    // Details a draft adding someone leaves empty are not among what it changes.
    expect(listed[0]?.draft?.changed.slice(3)).toEqual(
      [first.field.id, second.field.id].sort(),
    );
    // A column with nothing chosen is left out.
    const empty = await draftPerson({ values: { [first.field.id]: [] } });
    expect((await draftRow(empty.id))?.fields).not.toHaveProperty(
      `value:${first.field.id}`,
    );
  });

  it("shows readers without Restricted details everyone who has started, as live dates say while a draft waits", async () => {
    const starting = await draftPerson({ startDate: "2099-01-01" });
    const future = await livePerson({ startDate: "2099-02-01" });
    const leaving = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${leaving.id}`, {
      endDate: "2021-01-01",
    });
    const planner = await test.signedIn("resource-planner");
    expect(await seen(planner.cookie, starting.id)).toBeUndefined();
    expect(await seen(planner.cookie, future.id)).toBeUndefined();
    // A draft changing only Restricted dates shows no draft before it is approved.
    const left = await seen(planner.cookie, leaving.id);
    expect(left).toBeDefined();
    expect(left?.draft).toBeUndefined();
    const former = await livePerson({
      startDate: "2010-01-01",
      endDate: "2011-01-01",
    });
    await saved("PATCH", `/api/people/${former.id}`, { endDate: null });
    const formerSeen = await seen(planner.cookie, former.id);
    expect(formerSeen?.draft).toBeUndefined();
    expect(formerSeen).not.toHaveProperty("endDate");
    expect(await seen(editor.cookie, starting.id)).toBeDefined();
    await approve([leaving.id]);
    expect(await seen(planner.cookie, leaving.id)).toBeDefined();
  });

  it("names Fathom as who made a draft the history does not hold", async () => {
    const id = randomUUID();
    await test.connection.insert(drafts).values({
      recordType: "person",
      recordId: id,
      action: "created",
      fields: {
        preferredName: "Fictional Unrecorded",
        employeeId: unique("E"),
        positionId: testPosition,
      },
    });
    expect((await seen(editor.cookie, id))?.draft).toMatchObject({
      madeBy: null,
      madeAt: null,
    });
    await saved("DELETE", `/api/people/${id}/draft`);
  });
});

describe("changing drafts", () => {
  it("keeps one draft per person, which further changes by anyone update", async () => {
    const person = await livePerson({ preferredName: "Fictional One" });
    await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: "Fictional Two",
    });
    const other = await test.signedIn("workforce-administrator");
    await send(other.cookie, "PATCH", `/api/people/${person.id}`, {
      preferredName: "Fictional Three",
    });
    expect(await draftRow(person.id)).toMatchObject({
      action: "changed",
      fields: { preferredName: "Fictional Three" },
    });
    expect((await seen(editor.cookie, person.id))?.draft?.madeBy).toMatch(
      /^Fictional User \d+$/,
    );
    expect((await seen(editor.cookie, person.id))?.draft?.madeBy).not.toBe(
      "Fictional User 1",
    );
    // Changed back to the live value, the draft is gone.
    await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: "Fictional One",
    });
    expect(await draftRow(person.id)).toBeUndefined();
    expect(
      await saved("PATCH", `/api/people/${person.id}`, {
        preferredName: "Fictional One",
      }),
    ).toBeNull();
  });

  it("refuses to change a person drafted to be removed, and removes them only once", async () => {
    const person = await livePerson();
    const removed = await saved("DELETE", `/api/people/${person.id}`);
    expect(removed).not.toBeNull();
    expect(await saved("DELETE", `/api/people/${person.id}`)).toBeNull();
    const change = await send(
      editor.cookie,
      "PATCH",
      `/api/people/${person.id}`,
      {
        preferredName: "Fictional",
      },
    );
    expect(change.statusCode).toBe(409);
    expect(change.json()).toEqual({
      error:
        "This person's draft removes them; discard the draft to change them",
    });
    for (const [method, url] of [
      ["PATCH", `/api/people/${randomUUID()}`],
      ["DELETE", `/api/people/${randomUUID()}`],
      ["DELETE", `/api/people/${randomUUID()}/draft`],
    ] as [Method, string][]) {
      const response = await send(editor.cookie, method, url, {});
      expect(response.statusCode).toBe(404);
    }
  });

  it("discards drafts that add, change, and remove people, recording each", async () => {
    const added = await draftPerson();
    const removedAdded = await saved("DELETE", `/api/people/${added.id}`);
    expect(await draftRow(added.id)).toBeUndefined();
    expect((await entry(editor.cookie, removedAdded))?.kind).toBe("discard");

    const changed = await livePerson();
    await saved("PATCH", `/api/people/${changed.id}`, {
      endDate: "2030-01-01",
    });
    const discarded = await saved("DELETE", `/api/people/${changed.id}/draft`);
    expect(await draftRow(changed.id)).toBeUndefined();
    expect(await entry(editor.cookie, discarded)).toMatchObject({
      kind: "discard",
      records: [
        {
          action: "changed",
          draft: true,
          fields: [
            { field: "endDate", oldValue: "2030-01-01", newValue: null },
          ],
        },
      ],
    });

    const removed = await livePerson();
    await saved("DELETE", `/api/people/${removed.id}`);
    expect(
      (
        await entry(
          editor.cookie,
          await saved("DELETE", `/api/people/${removed.id}/draft`),
        )
      )?.records[0]?.action,
    ).toBe("created");
    const another = await draftPerson();
    expect(
      (
        await entry(
          editor.cookie,
          await saved("DELETE", `/api/people/${another.id}/draft`),
        )
      )?.records[0]?.action,
    ).toBe("deleted");
    const none = await send(
      editor.cookie,
      "DELETE",
      `/api/people/${removed.id}/draft`,
    );
    expect(none.json()).toEqual({ error: "This person has no draft" });
  });

  it("refuses an Employee ID someone has, live or in a draft, or that two people asked for share", async () => {
    const employeeId = unique("E-Taken");
    const holder = await livePerson({ employeeId });
    await saved("PATCH", `/api/people/${holder.id}`, {
      employeeId: unique("E-New"),
    });
    const drafted = await draftPerson();
    const draftedId = (await draftRow(drafted.id))?.fields.employeeId as string;
    for (const people of [
      [
        {
          preferredName: "Fictional",
          employeeId: employeeId.toLowerCase(),
          positionId: testPosition,
        },
      ],
      [
        {
          preferredName: "Fictional",
          employeeId: draftedId,
          positionId: testPosition,
        },
      ],
      [
        {
          preferredName: "Fictional",
          employeeId: "E-Twin",
          positionId: testPosition,
        },
        {
          preferredName: "Fictional",
          employeeId: "e-twin",
          positionId: testPosition,
        },
      ],
    ]) {
      const response = await send(editor.cookie, "POST", "/api/people", {
        people,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: "Someone already has that ID",
      });
    }
    // A person may keep, or go back to, their own.
    expect(
      await saved("PATCH", `/api/people/${holder.id}`, { employeeId }),
    ).not.toBeNull();
  });
});

describe("approving and rejecting", () => {
  it("applies drafts that add, change, and remove people to the live people, in one change set", async () => {
    const { choices, field } = await columnWith(["North", "South"]);
    const [north = "", south = ""] = choices.map(({ id }) => id);
    const added = await draftPerson({
      startDate: "2022-02-02",
      values: { [field.id]: [north] },
    });
    const changed = await livePerson({ values: { [field.id]: [north] } });
    await saved("PATCH", `/api/people/${changed.id}`, {
      preferredName: "Fictional Approved",
      values: { [field.id]: [south] },
    });
    const cleared = await livePerson({ values: { [field.id]: [north] } });
    await saved("PATCH", `/api/people/${cleared.id}`, {
      values: { [field.id]: [] },
    });
    const removed = await livePerson();
    await saved("DELETE", `/api/people/${removed.id}`);

    const ids = [added.id, changed.id, cleared.id, removed.id];
    const response = await approve(ids);
    expect(response.statusCode).toBe(200);
    const { changeSetId } = response.json<{ changeSetId: string }>();
    expect((await live(added.id))?.startDate).toBe("2022-02-02");
    expect((await live(changed.id))?.preferredName).toBe("Fictional Approved");
    expect(await live(removed.id)).toBeUndefined();
    expect(await seen(editor.cookie, changed.id)).toMatchObject({
      values: { [field.id]: [south] },
    });
    expect((await seen(editor.cookie, cleared.id))?.values).toEqual({});
    for (const id of ids) expect(await draftRow(id)).toBeUndefined();
    const approved = await entry(editor.cookie, changeSetId);
    expect(approved?.kind).toBe("approval");
    expect(approved?.madeBy).toBe("Fictional User 2");
    expect(
      approved?.records.map(({ action, draft }) => [action, draft]),
    ).toEqual([
      ["created", false],
      ["changed", false],
      ["changed", false],
      ["deleted", false],
    ]);
    // Approving cannot be undone, even by the Approver.
    const undone = await undo(changeSetId, approver.cookie);
    expect(undone.statusCode).toBe(409);
  });

  it("lets only Approvers who see every value in the drafts approve or reject them", async () => {
    const person = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${person.id}`, { endDate: "2032-01-01" });
    // Refused without approving or seeing people, and, to those not shown the draft, answered as no
    // draft at all, so asking reveals nothing.
    const roles: [Role | Permission[], number][] = [
      ["workforce-administrator", 403],
      ["project-manager", 404],
      [["drafts:approve", "people:view"], 404],
    ];
    for (const [held, status] of roles) {
      const { cookie } = await test.signedIn(held);
      expect(
        (await approve([person.id], cookie)).statusCode,
        String(held),
      ).toBe(status);
      expect(
        (await reject([person.id], "Fictional", cookie)).statusCode,
        String(held),
      ).toBe(status);
    }
    // A draft shown only in part is refused.
    const partly = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${partly.id}`, {
      preferredName: unique("Fictional"),
      endDate: "2032-01-01",
    });
    const planner = await test.signedIn(["drafts:approve", "people:view"]);
    const refused = await approve([partly.id], planner.cookie);
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toEqual({
      error:
        "One of these drafts holds details your role does not let you see, so an Approver who sees them must decide it",
    });
    // A former employee's draft of General details is decided by one who sees only those who have
    // started, but a future starter's is not.
    const former = await livePerson({
      startDate: "2010-01-01",
      endDate: "2011-01-01",
    });
    await saved("PATCH", `/api/people/${former.id}`, {
      preferredName: unique("Fictional"),
    });
    expect((await approve([former.id], planner.cookie)).statusCode).toBe(200);
    const starter = await livePerson({ startDate: "2099-01-01" });
    await saved("PATCH", `/api/people/${starter.id}`, {
      preferredName: unique("Fictional"),
    });
    expect((await approve([starter.id], planner.cookie)).statusCode).toBe(404);
    expect((await approve([starter.id])).statusCode).toBe(200);
    // Someone only drafted to be added is current as their draft says.
    const added = await draftPerson();
    expect((await approve([added.id], planner.cookie)).statusCode).toBe(200);
    expect((await approve([partly.id])).statusCode).toBe(200);
    const manager = await test.signedIn([
      "drafts:approve",
      "people:view",
      "restricted:view",
    ]);
    expect((await approve([person.id], manager.cookie)).statusCode).toBe(200);
  });

  describe("drafts the approver changed", () => {
    const maker = [
      "drafts:approve",
      "people:edit",
      "restricted:edit",
      "confidential:edit",
      "configuration:edit",
    ] as const;
    const refusal = {
      error: "Drafts changed by the approver need another approver",
    };

    async function draftedBy(cookie: string): Promise<string> {
      const response = await send(cookie, "POST", "/api/people", {
        people: [
          {
            preferredName: unique("Fictional Own"),
            employeeId: unique("E"),
            positionId: testPosition,
          },
        ],
      });
      expect(response.statusCode, response.body).toBe(201);
      return response.json<{ ids: string[] }>().ids[0] ?? "";
    }

    const needsOther = async (cookie: string, id: string) =>
      (await send(cookie, "GET", "/api/people"))
        .json<{
          people: { id: string; draft?: { needsOtherApprover?: boolean } }[];
        }>()
        .people.find((one) => one.id === id)?.draft?.needsOtherApprover;

    it("are not approved by the approver, who may still reject them", async () => {
      const own = await test.signedIn([...maker]);
      const id = await draftedBy(own.cookie);
      expect(await needsOther(own.cookie, id)).toBe(true);
      expect(await needsOther(approver.cookie, id)).toBeUndefined();
      const refused = await approve([id], own.cookie);
      expect(refused.statusCode).toBe(403);
      expect(refused.json()).toEqual(refusal);
      expect(await draftRow(id)).toBeDefined();
      expect(
        (await reject([id], "Fictional reason", own.cookie)).statusCode,
      ).toBe(200);
    });

    it("count as the approver's when they changed someone else's draft", async () => {
      const own = await test.signedIn([...maker]);
      const person = await livePerson();
      await saved("PATCH", `/api/people/${person.id}`, {
        preferredName: unique("Fictional"),
      });
      const changed = await send(
        own.cookie,
        "PATCH",
        `/api/people/${person.id}`,
        {
          preferredName: unique("Fictional"),
        },
      );
      expect(changed.statusCode, changed.body).toBe(200);
      expect((await approve([person.id], own.cookie)).json()).toEqual(refusal);
      expect((await approve([person.id])).statusCode).toBe(200);
    });

    it("are the approver's only until approved, so a later draft by others is theirs to approve", async () => {
      const own = await test.signedIn([...maker]);
      const id = await draftedBy(own.cookie);
      expect((await approve([id])).statusCode).toBe(200);
      await saved("PATCH", `/api/people/${id}`, {
        preferredName: unique("Fictional"),
      });
      expect(await needsOther(own.cookie, id)).toBeUndefined();
      expect((await approve([id], own.cookie)).statusCode).toBe(200);
    });

    it("include drafts of other kinds, and those an approval takes with the drafts chosen", async () => {
      const own = await test.signedIn([...maker]);
      const list = (
        await send(own.cookie, "POST", "/api/lists", {
          name: unique("Fictional List"),
          visibility: "general",
        })
      ).json<{ list: List }>().list;
      const refused = await send(own.cookie, "POST", "/api/drafts/approval", {
        lists: [list.id],
      });
      expect(refused.json()).toEqual(refusal);
      const field = (
        await send(editor.cookie, "POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          listId: list.id,
          multiple: true,
        })
      ).json<{ field: Field }>().field;
      // Approving the column approves the new list it draws on, which this approver drafted.
      const taken = await send(own.cookie, "POST", "/api/drafts/approval", {
        columns: [field.id],
      });
      expect(taken.json()).toEqual(refusal);
      expect(
        (
          await send(approver.cookie, "POST", "/api/drafts/approval", {
            columns: [field.id],
          })
        ).statusCode,
      ).toBe(200);
    });

    it("stop counting once discarded, but not once rejected or resubmitted", async () => {
      const own = await test.signedIn([...maker]);
      const discarded = await livePerson();
      await send(own.cookie, "PATCH", `/api/people/${discarded.id}`, {
        preferredName: unique("Fictional"),
      });
      const gone = await send(
        own.cookie,
        "DELETE",
        `/api/people/${discarded.id}/draft`,
      );
      expect(gone.statusCode, gone.body).toBe(200);
      await saved("PATCH", `/api/people/${discarded.id}`, {
        preferredName: unique("Fictional"),
      });
      expect((await approve([discarded.id], own.cookie)).statusCode).toBe(200);

      const rejected = await livePerson();
      await send(own.cookie, "PATCH", `/api/people/${rejected.id}`, {
        preferredName: unique("Fictional"),
      });
      expect(
        (await reject([rejected.id], "Fictional reason", own.cookie))
          .statusCode,
      ).toBe(200);
      const resent = await send(
        own.cookie,
        "DELETE",
        `/api/people/${rejected.id}/draft/rejection`,
      );
      expect(resent.statusCode, resent.body).toBe(200);
      expect((await approve([rejected.id], own.cookie)).json()).toEqual(
        refusal,
      );
    });

    it("do not block deciding other drafts that touch the same people", async () => {
      const own = await test.signedIn([...maker]);
      const { choices, field } = await columnWith(["North"]);
      const person = await livePerson({
        values: { [field.id]: [choices[0]?.id ?? ""] },
      });
      await send(own.cookie, "PATCH", `/api/people/${person.id}`, {
        preferredName: unique("Fictional"),
      });
      const removal = await send(
        editor.cookie,
        "DELETE",
        `/api/people/columns/${field.id}`,
      );
      expect(removal.statusCode, removal.body).toBe(200);
      const decided = await send(own.cookie, "POST", "/api/drafts/approval", {
        columns: [field.id],
      });
      expect(decided.statusCode, decided.body).toBe(200);
      expect(await draftRow(person.id)).toBeDefined();
    });

    it("are approved by an approver whose role lets them approve their own", async () => {
      const own = await test.signedIn([...maker, "drafts:approve-own"]);
      const id = await draftedBy(own.cookie);
      expect(await needsOther(own.cookie, id)).toBeUndefined();
      expect((await approve([id], own.cookie)).statusCode).toBe(200);
    });
  });

  it("refuses drafts that are gone, rejected, or no longer fit", async () => {
    const missing = await approve([randomUUID()]);
    expect(missing.statusCode).toBe(404);
    expect((await reject([randomUUID()], "Fictional")).statusCode).toBe(404);

    const person = await draftPerson();
    expect((await reject([person.id], "Fictional reason")).statusCode).toBe(
      200,
    );
    // A rejected draft is back with its makers, so is approved only once sent again.
    const rejected = await approve([person.id]);
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toEqual({
      error:
        "One of these drafts, or one it depends on, was rejected; it can be approved once that draft is resubmitted",
    });
    await send(
      editor.cookie,
      "DELETE",
      `/api/people/${person.id}/draft/rejection`,
    );
    expect((await approve([person.id])).statusCode).toBe(200);
    expect(await draftRow(person.id)).toBeUndefined();
    expect(await live(person.id)).toBeDefined();

    // Drafts written by another version of Fathom, which the database or columns refuse.
    const employeeId = unique("E-Clash");
    await livePerson({ employeeId });
    const clash = randomUUID();
    const stray = randomUUID();
    const { field } = await columnWith(["A"]);
    const elsewhere = await columnWith(["B"]);
    await test.connection.insert(drafts).values([
      {
        recordType: "person",
        recordId: clash,
        action: "created",
        fields: {
          preferredName: "Fictional Clash",
          employeeId,
          positionId: testPosition,
        },
      },
      {
        recordType: "person",
        recordId: stray,
        action: "created",
        fields: {
          preferredName: "Fictional Stray",
          employeeId: unique("E"),
          positionId: testPosition,
          [`value:${field.id}`]: [String(elsewhere.choices[0]?.id)],
        },
      },
    ]);
    const clashed = await approve([clash]);
    expect(clashed.statusCode).toBe(409);
    expect(clashed.json()).toEqual({
      error:
        "A draft no longer fits the data as it is; refresh, change it, then approve it",
    });
    const strayed = await approve([stray]);
    expect(strayed.json()).toEqual({
      error:
        "The draft of Fictional Stray no longer fits the columns; change it, then approve it",
    });
    await saved("DELETE", `/api/people/${clash}/draft`);
    await saved("DELETE", `/api/people/${stray}/draft`);
  });

  it("keeps rejected drafts with their reason, until they are changed again", async () => {
    const first = await livePerson();
    const second = await draftPerson();
    await saved("PATCH", `/api/people/${first.id}`, {
      preferredName: unique("Fictional Renamed"),
    });
    const response = await reject([first.id, second.id], "Fictional reason");
    expect(response.statusCode).toBe(200);
    const { changeSetId } = response.json<{ changeSetId: string }>();
    expect(await draftRow(first.id)).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
    const rejection = await entry(editor.cookie, changeSetId);
    expect(rejection).toMatchObject({
      kind: "rejection",
      records: [
        {
          draft: true,
          fields: [
            {
              field: "rejected",
              oldValue: null,
              newValue: "Fictional reason",
            },
          ],
        },
        { draft: true },
      ],
    });
    expect((await undo(changeSetId, approver.cookie)).statusCode).toBe(409);
    // Rejecting again for the same reason changes nothing; for another, the reason changes.
    expect(
      (await reject([first.id], "Fictional reason")).json<{
        changeSetId: string | null;
      }>().changeSetId,
    ).toBeNull();
    await reject([first.id], "Another fictional reason");
    // Changing a rejected draft makes it wait again once published; undoing the change before
    // then leaves it rejected, as it was.
    const unpublished = { publish: false };
    const changed = await test.request(
      editor.cookie,
      "PATCH",
      `/api/people/${first.id}`,
      { preferredName: unique("Fictional Again") },
      unpublished,
    );
    expect(await draftRow(first.id)).toMatchObject({
      state: "rejected",
      reason: "Another fictional reason",
    });
    expect(
      (
        await test.request(
          editor.cookie,
          "POST",
          `/api/undo/${changed.json<{ changeSetId: string }>().changeSetId}`,
          undefined,
          unpublished,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await send(editor.cookie, "GET", "/api/unpublished")).json<{
        changes: unknown[];
      }>().changes,
    ).toEqual([]);
    // Removing one waits again once published.
    await saved("DELETE", `/api/people/${first.id}`);
    expect((await draftRow(first.id))?.state).toBe("waiting");
    await saved("DELETE", `/api/people/${second.id}/draft`);
    expect(await draftRow(second.id)).toBeUndefined();
  });

  it("sends a rejected draft for approval again unchanged, which can be undone", async () => {
    const person = await livePerson();
    const name = unique("Fictional Resent");
    await saved("PATCH", `/api/people/${person.id}`, { preferredName: name });
    const waiting = await send(
      editor.cookie,
      "DELETE",
      `/api/people/${person.id}/draft/rejection`,
    );
    expect(waiting.statusCode).toBe(409);
    expect(waiting.json()).toEqual({
      error: "Only a rejected draft can be resubmitted",
    });
    await reject([person.id], "Fictional reason");
    const resent = await saved(
      "DELETE",
      `/api/people/${person.id}/draft/rejection`,
    );
    expect(await draftRow(person.id)).toMatchObject({
      state: "waiting",
      reason: null,
      fields: { preferredName: name },
    });
    expect(await entry(editor.cookie, resent)).toMatchObject({
      kind: "resubmission",
      records: [{ draft: true, fields: [] }],
    });
    expect((await undo(resent)).statusCode).toBe(200);
    expect(await draftRow(person.id)).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
    const unknown = await send(
      editor.cookie,
      "DELETE",
      `/api/people/${randomUUID()}/draft/rejection`,
    );
    expect(unknown.statusCode).toBe(404);
    await saved("DELETE", `/api/people/${person.id}/draft`);
  });

  it("refuses a reason that is empty or too long", async () => {
    const person = await draftPerson();
    for (const reason of [" ", "x".repeat(501)]) {
      expect((await reject([person.id], reason)).statusCode).toBe(400);
    }
  });
});

describe("undoing changes to drafts", () => {
  it("undoes drafting, changing, removing, and discarding, in the drafts alone", async () => {
    const added = await draftPerson();
    expect((await undo(added.changeSetId)).statusCode).toBe(200);
    expect(await draftRow(added.id)).toBeUndefined();

    const person = await livePerson({ preferredName: "Fictional Kept" });
    const changed = await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: "Fictional Changed",
      startDate: "2021-01-01",
    });
    await undo(changed);
    expect(await draftRow(person.id)).toBeUndefined();

    const removed = await saved("DELETE", `/api/people/${person.id}`);
    await undo(removed);
    expect(await draftRow(person.id)).toBeUndefined();

    await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: "Fictional Discarded",
    });
    const discarded = await saved("DELETE", `/api/people/${person.id}/draft`);
    await undo(discarded);
    expect((await draftRow(person.id))?.fields).toEqual({
      preferredName: "Fictional Discarded",
    });
    // A drafted person discarded comes back as a draft.
    const another = await draftPerson({ preferredName: "Fictional Back" });
    const gone = await saved("DELETE", `/api/people/${another.id}`);
    await undo(gone);
    expect((await draftRow(another.id))?.fields).toMatchObject({
      preferredName: "Fictional Back",
      startDate: null,
    });
    expect((await live(person.id))?.preferredName).toBe("Fictional Kept");
  });

  it("refuses to undo over an approval, an Employee ID taken since, or values that no longer fit", async () => {
    const person = await livePerson();
    const changed = await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: unique("Fictional"),
    });
    await approve([person.id]);
    expect((await undo(changed)).statusCode).toBe(409);

    const employeeId = unique("E-Reused");
    const first = await draftPerson({ employeeId });
    const discarded = await saved("DELETE", `/api/people/${first.id}`);
    await draftPerson({ employeeId });
    expect((await undo(discarded)).statusCode).toBe(409);

    // The column a discarded draft had a value in is deleted since.
    const { field, choices } = await columnWith(["A"]);
    const valued = await draftPerson({
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const thrown = await saved("DELETE", `/api/people/${valued.id}`);
    await saved("DELETE", `/api/people/columns/${field.id}`);
    await approveColumns(field.id);
    expect((await undo(thrown)).statusCode).toBe(409);

    // A change to a draft whose person has since been drafted to be removed.
    const later = await livePerson();
    const edited = await saved("PATCH", `/api/people/${later.id}`, {
      preferredName: unique("Fictional"),
    });
    await test.connection
      .update(drafts)
      .set({ action: "deleted", fields: {} })
      .where(eq(drafts.recordId, later.id));
    expect((await undo(edited)).statusCode).toBe(409);
  });
});

describe("columns and choices that drafts use", () => {
  it("refuses to delete them, or change a column's settings the drafts do not fit", async () => {
    const { list, choices, field } = await columnWith(["A", "B"]);
    const [a = "", b = ""] = choices.map(({ id }) => id);
    const person = await draftPerson({ values: { [field.id]: [a, b] } });
    const deleteColumn = await send(
      editor.cookie,
      "DELETE",
      `/api/people/columns/${field.id}`,
    );
    expect(deleteColumn.statusCode).toBe(409);
    expect(deleteColumn.json<{ error: string }>().error).toMatch(
      /^Drafts change /,
    );
    const deleteChoice = await send(
      editor.cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${a}`,
    );
    expect(deleteChoice.json()).toEqual({
      error:
        "This choice cannot be removed while it is in use; retire it instead",
    });
    const other = (
      await send(editor.cookie, "POST", "/api/lists", {
        name: unique("Fictional List"),
      })
    ).json<{ list: List }>().list;
    await test.approveLists();
    for (const [settings, error] of [
      [{ multiple: false }, /^Drafts have several choices for /],
      [
        { multiple: true, listId: other.id },
        /^Drafts have values from the list of /,
      ],
    ] as [object, RegExp][]) {
      const response = await send(
        editor.cookie,
        "PUT",
        `/api/people/columns/${field.id}`,
        { name: field.name, listId: list.id, ...settings },
      );
      expect(response.statusCode).toBe(409);
      expect(response.json<{ error: string }>().error).toMatch(error);
    }
    await saved("DELETE", `/api/people/${person.id}/draft`);
    // A draft that clears the column keeps it too.
    const live = await livePerson({ values: { [field.id]: [a] } });
    await saved("PATCH", `/api/people/${live.id}`, {
      values: { [field.id]: [] },
    });
    expect(
      (await send(editor.cookie, "DELETE", `/api/people/columns/${field.id}`))
        .statusCode,
    ).toBe(409);
    await saved("DELETE", `/api/people/${live.id}/draft`);
  });

  it("refuses to undo adding a column or choice a draft now uses", async () => {
    const list = (
      await send(editor.cookie, "POST", "/api/lists", {
        name: unique("Fictional List"),
      })
    ).json<{ list: List }>().list;
    const addedChoice = await send(
      editor.cookie,
      "POST",
      `/api/lists/${list.id}/choices`,
      { choices: [{ label: "A" }] },
    );
    const { choices, changeSetId: choiceSet } = addedChoice.json<{
      choices: Choice[];
      changeSetId: string;
    }>();
    await test.approveLists();
    const addedColumn = await send(
      editor.cookie,
      "POST",
      "/api/people/columns",
      {
        name: unique("Fictional Column"),
        listId: list.id,
      },
    );
    const { field, changeSetId: columnSet } = addedColumn.json<{
      field: Field;
      changeSetId: string;
    }>();
    await approveColumns(field.id);
    const person = await draftPerson({
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    expect((await undo(columnSet)).statusCode).toBe(409);
    expect((await undo(choiceSet)).statusCode).toBe(409);
    await saved("DELETE", `/api/people/${person.id}/draft`);
  });
});

describe("drafts and changes saved at the same moment", () => {
  it("saves drafts and undoes changes to the choices they use at once, without deadlocking", async () => {
    const { list, field, choices } = await columnWith(["A", "B"]);
    const [a = ""] = choices.map(({ id }) => id);
    const person = await livePerson();
    for (let round = 0; round < 5; round += 1) {
      const renamed = await saved("PUT", `/api/lists/${list.id}/choices/${a}`, {
        label: `A ${String(round)}`,
        description: "",
      });
      const [undone, drafted] = await Promise.all([
        undo(renamed),
        send(editor.cookie, "PATCH", `/api/people/${person.id}`, {
          values: { [field.id]: round % 2 === 0 ? [a] : [] },
        }),
      ]);
      expect(undone.statusCode, undone.body).toBe(200);
      expect(drafted.statusCode, drafted.body).toBe(200);
    }
  });
});

describe("drafts of people no longer live", () => {
  it("leaves out a change to someone removed another way, refuses changing it, and discards it", async () => {
    const person = await livePerson();
    await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: unique("Fictional"),
    });
    // Removed without a draft, as removing the seed data does.
    await test.connection.delete(people).where(eq(people.id, person.id));
    expect(await seen(editor.cookie, person.id)).toBeUndefined();
    const change = await send(
      editor.cookie,
      "PATCH",
      `/api/people/${person.id}`,
      { preferredName: "Fictional" },
    );
    expect(change.statusCode).toBe(404);
    expect(await saved("DELETE", `/api/people/${person.id}`)).toBeNull();
    await saved("DELETE", `/api/people/${person.id}/draft`);
    expect(await draftRow(person.id)).toBeUndefined();
  });
});

describe("who last changed a draft", () => {
  it("is who made the latest change the reader may see", async () => {
    const person = await livePerson({ startDate: "2020-01-01" });
    await saved("PATCH", `/api/people/${person.id}`, {
      preferredName: unique("Fictional"),
    });
    const other = await test.signedIn("workforce-administrator");
    await send(other.cookie, "PATCH", `/api/people/${person.id}`, {
      endDate: "2033-01-01",
    });
    const planner = await test.signedIn("resource-planner");
    expect((await seen(planner.cookie, person.id))?.draft?.madeBy).toBe(
      "Fictional User 1",
    );
    const manager = await test.signedIn("engineering-manager");
    const [otherUser] = await test.connection
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, other.id));
    expect((await seen(manager.cookie, person.id))?.draft?.madeBy).toBe(
      otherUser?.name,
    );
  });
});

describe("live people", () => {
  it("puts back their values when a column's deletion is undone, and keeps choices they have", async () => {
    const { list, field, choices } = await columnWith(["A"]);
    const [a = ""] = choices.map(({ id }) => id);
    const person = await livePerson({ values: { [field.id]: [a] } });
    const inUse = await send(
      editor.cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${a}`,
    );
    expect(inUse.statusCode).toBe(409);
    const deleted = await saved("DELETE", `/api/people/columns/${field.id}`);
    expect((await undo(deleted)).statusCode).toBe(200);
    expect((await seen(editor.cookie, person.id))?.values).toEqual({
      [field.id]: [a],
    });
  });

  it("refuses to undo a live change, recorded by another version of Fathom, that no longer fits", async () => {
    const { field, choices } = await columnWith(["A", "B"]);
    await saved("PUT", `/api/people/columns/${field.id}`, {
      name: field.name,
      listId: field.listId,
      multiple: false,
    });
    await approveColumns(field.id);
    const person = await livePerson();
    const changeSetId = await test.connection.transaction((transaction) =>
      recordChanges(transaction, editor.id, [
        {
          recordType: "person",
          recordId: person.id,
          action: "changed",
          field: `value:${field.id}`,
          tier: "general",
          oldValue: choices.map(({ id }) => id),
          newValue: null,
        },
      ]),
    );
    expect((await undo(changeSetId)).statusCode).toBe(409);
  });

  it("puts back details and values recorded by another version of Fathom, and refuses those that no longer fit", async () => {
    const { field, choices } = await columnWith(["A"]);
    const [a = ""] = choices.map(({ id }) => id);
    const person = await livePerson({
      startDate: "2020-01-01",
      values: { [field.id]: [a] },
    });
    const changeSetId = await test.connection.transaction((transaction) =>
      recordChanges(transaction, editor.id, [
        {
          recordType: "person",
          recordId: person.id,
          action: "changed",
          field: "startDate",
          tier: "restricted",
          oldValue: "2019-01-01",
          newValue: "2020-01-01",
        },
        {
          recordType: "person",
          recordId: person.id,
          action: "changed",
          field: "endDate",
          tier: "restricted",
          oldValue: null,
          newValue: null,
        },
      ]),
    );
    expect((await undo(changeSetId)).statusCode).toBe(200);
    expect(await live(person.id)).toMatchObject({
      startDate: "2019-01-01",
      endDate: null,
    });
    // Made required directly, since drafts other tests leave would refuse it.
    await test.connection
      .update(fields)
      .set({ required: true })
      .where(eq(fields.id, field.id));
    const cleared = await test.connection.transaction((transaction) =>
      recordChanges(transaction, editor.id, [
        {
          recordType: "person",
          recordId: person.id,
          action: "changed",
          field: `value:${field.id}`,
          tier: "general",
          oldValue: null,
          newValue: [a],
        },
      ]),
    );
    expect((await undo(cleared)).statusCode).toBe(409);
    await test.connection
      .update(fields)
      .set({ required: false })
      .where(eq(fields.id, field.id));
  });

  it("refuses to undo a list's deletion once its name is taken", async () => {
    const name = unique("Fictional Taken List");
    const list = (
      await send(editor.cookie, "POST", "/api/lists", { name })
    ).json<{ list: List }>().list;
    const deleted = await saved("DELETE", `/api/lists/${list.id}`);
    await saved("POST", "/api/lists", { name });
    expect((await undo(deleted)).statusCode).toBe(409);
  });

  it("drafts clearing a date a live person has", async () => {
    const person = await livePerson({ endDate: "2030-01-01" });
    await saved("PATCH", `/api/people/${person.id}`, { endDate: null });
    expect((await draftRow(person.id))?.fields).toEqual({ endDate: null });
    await approve([person.id]);
    expect((await live(person.id))?.endDate).toBeNull();
  });
});

describe("drafts and the history of who changed what", () => {
  it("records draft changes with the change set that made them", async () => {
    const changeSetId = await test.connection.transaction((transaction) =>
      recordChanges(transaction, null, [
        {
          recordType: "person",
          recordId: randomUUID(),
          action: "created",
          field: "preferredName",
          tier: "general",
          oldValue: null,
          newValue: "Fictional Drafted",
          draft: true,
        },
      ]),
    );
    expect(await entry(editor.cookie, changeSetId)).toMatchObject({
      kind: "edit",
      madeBy: null,
      records: [{ draft: true, name: "Fictional Drafted" }],
    });
  });
});
