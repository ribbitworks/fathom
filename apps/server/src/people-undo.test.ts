// SPDX-License-Identifier: Apache-2.0

// Integration tests for undoing changes to people and the People table's columns, against a
// migrated PostgreSQL server.

import { accessHistory, people, recordChanges } from "@fathom/db";
import { type Choice, type List } from "@fathom/shared";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type Method, unique } from "./test-app.ts";
import {
  waitLimit,
  test,
  editor,
  send,
  listWith,
  approveColumns,
  addColumn,
  columnWith,
  addPeople,
  addPerson,
  addLivePerson,
  readPeople,
  readPerson,
  undo,
  accessOf,
  startPeopleTests,
  closePeopleTests,
} from "./test-people.ts";

beforeAll(startPeopleTests);

afterAll(closePeopleTests);

describe("undo", () => {
  it("undoes adding people, deleting them again", async () => {
    const { cookie } = await editor();
    const { ids, changeSetId } = await addPeople(cookie, [{}, {}]);
    const response = await undo(cookie, changeSetId);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      changeSetId: expect.any(String) as unknown,
    });
    const listed = (await readPeople(cookie)).people.map(({ id }) => id);
    expect(listed.some((id) => ids.includes(id))).toBe(false);
    expect((await test.historyOf(String(ids[0]))).at(-1)).toMatchObject({
      action: "deleted",
    });
  });

  it("undoes a change to a person, putting back their details and values", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A", "B"]);
    const [a = "", b = ""] = choices.map(({ id }) => id);
    const { id } = await addPerson(cookie, {
      preferredName: "Fictional Before",
      startDate: "2024-01-01",
      values: { [field.id]: [a] },
    });
    const changed = await send(cookie, "PATCH", `/api/people/${id}`, {
      preferredName: "Fictional After",
      startDate: null,
      values: { [field.id]: [b] },
    });
    await undo(cookie, changed.json<{ changeSetId: string }>().changeSetId);
    expect(await readPerson(cookie, id)).toMatchObject({
      preferredName: "Fictional Before",
      startDate: "2024-01-01",
      values: { [field.id]: [a] },
    });
    // A column the person had no value for is emptied again.
    const other = await columnWith(cookie, ["C"]);
    const given = await send(cookie, "PATCH", `/api/people/${id}`, {
      values: { [other.field.id]: [String(other.choices[0]?.id)] },
    });
    await undo(cookie, given.json<{ changeSetId: string }>().changeSetId);
    expect((await readPerson(cookie, id))?.values).toEqual({
      [field.id]: [a],
    });
  });

  it("undoes deleting a person, bringing them back with the same identifier and values", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A"], {
      multiple: true,
    });
    const { id } = await addLivePerson(cookie, {
      endDate: "2031-01-01",
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const before = await readPerson(cookie, id);
    const deleted = await send(cookie, "DELETE", `/api/people/${id}`);
    await undo(cookie, deleted.json<{ changeSetId: string }>().changeSetId);
    expect(await readPerson(cookie, id)).toEqual(before);
  });

  it("undoes drafting changing, moving, and deleting a column, putting back its values and place", async () => {
    const { cookie } = await editor();
    const { list, choices } = await listWith(cookie, ["A"]);
    const first = await addColumn(cookie, list.id);
    const second = await addColumn(cookie, list.id);
    const ids = [first.field.id, second.field.id];
    const order = async () =>
      (await readPeople(cookie)).order.filter((key) => ids.includes(key));
    const { id: personId } = await addPerson(cookie, {
      values: { [first.field.id]: [String(choices[0]?.id)] },
    });

    const renamed = await send(
      cookie,
      "PUT",
      `/api/people/columns/${first.field.id}`,
      {
        name: unique("Renamed"),
        listId: list.id,
        multiple: true,
      },
    );
    await undo(cookie, renamed.json<{ changeSetId: string }>().changeSetId);
    expect(
      (await readPeople(cookie)).fields.find(({ id }) => id === first.field.id),
    ).toEqual(first.field);

    const deleted = await send(
      cookie,
      "DELETE",
      `/api/people/columns/${first.field.id}`,
    );
    await undo(cookie, deleted.json<{ changeSetId: string }>().changeSetId);
    expect(await order()).toEqual(ids);
    expect((await readPerson(cookie, personId))?.values).toEqual({
      [first.field.id]: [choices[0]?.id],
    });

    // Drafting a column's addition cannot be undone once it is approved.
    expect((await undo(cookie, second.changeSetId)).statusCode).toBe(409);
  });

  it("undoes list changes in one call: deleting a list brings back its choices in order", async () => {
    const { cookie } = await editor();
    const { list, choices } = await listWith(cookie, ["A", "B", "C"]);
    await send(
      cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(choices[1]?.id)}/retired`,
      { retired: true },
    );
    const before = (await send(cookie, "GET", "/api/lists"))
      .json<{ lists: List[] }>()
      .lists.find(({ id }) => id === list.id);
    const deleted = await send(cookie, "DELETE", `/api/lists/${list.id}`);
    await undo(cookie, deleted.json<{ changeSetId: string }>().changeSetId);
    const after = (await send(cookie, "GET", "/api/lists"))
      .json<{ lists: List[] }>()
      .lists.find(({ id }) => id === list.id);
    expect(after).toEqual(before);
  });

  it("undoes removing, retiring, restoring, moving, and editing choices, and editing and retiring lists", async () => {
    const { cookie } = await editor();
    const { list, choices } = await listWith(cookie, ["A", "B", "C"]);
    const url = (choice: Choice | undefined) =>
      `/api/lists/${list.id}/choices/${String(choice?.id)}`;
    const read = async () =>
      (await send(cookie, "GET", "/api/lists"))
        .json<{ lists: List[] }>()
        .lists.find(({ id }) => id === list.id);
    const original = await read();
    const changesToUndo: [Method, string, object | undefined][] = [
      ["DELETE", url(choices[1]), undefined],
      ["DELETE", url(choices[0]), undefined],
      ["PUT", `${url(choices[0])}/position`, { after: choices[2]?.id }],
      ["PUT", url(choices[2]), { label: "Fictional Changed" }],
      ["PUT", `/api/lists/${list.id}`, { name: unique("Renamed List") }],
      ["PUT", `/api/lists/${list.id}/retired`, { retired: true }],
    ];
    for (const [method, path, payload] of changesToUndo) {
      const response = await send(cookie, method, path, payload);
      const undone = await undo(
        cookie,
        response.json<{ changeSetId: string }>().changeSetId,
      );
      expect(undone.statusCode).toBe(200);
      expect(await read()).toEqual(original);
    }
    await send(cookie, "PUT", `${url(choices[0])}/retired`, { retired: true });
    const restored = await send(cookie, "PUT", `${url(choices[0])}/retired`, {
      retired: false,
    });
    await undo(cookie, restored.json<{ changeSetId: string }>().changeSetId);
    expect(
      (await read())?.choices.map(({ label, retired }) => [label, retired]),
    ).toEqual([
      ["A", true],
      ["B", false],
      ["C", false],
    ]);
  });

  it("undoes drafting a choice's removal, adding choices, and adding lists", async () => {
    const { cookie } = await editor();
    const { list, choices } = await listWith(cookie, ["A", "B", "C"]);
    const removed = await send(
      cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choices[1]?.id)}`,
    );
    await send(
      cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`,
    );
    await undo(cookie, removed.json<{ changeSetId: string }>().changeSetId);
    const labels = async () =>
      (await send(cookie, "GET", "/api/lists"))
        .json<{ lists: List[] }>()
        .lists.find(({ id }) => id === list.id)
        ?.choices.flatMap(({ label, draft }) =>
          draft?.action === "deleted" ? [] : [label],
        );
    expect(await labels()).toEqual(["B", "C"]);

    const added = await send(cookie, "POST", `/api/lists/${list.id}/choices`, {
      choices: [{ label: "D" }],
    });
    await undo(cookie, added.json<{ changeSetId: string }>().changeSetId);
    expect(await labels()).toEqual(["B", "C"]);

    const created = await send(cookie, "POST", "/api/lists", {
      name: unique("Undone List"),
    });
    await undo(cookie, created.json<{ changeSetId: string }>().changeSetId);
    const lists = (await send(cookie, "GET", "/api/lists")).json<{
      lists: List[];
    }>().lists;
    expect(
      lists.some(({ id }) => id === created.json<{ list: List }>().list.id),
    ).toBe(false);
  });

  it("refuses to undo a change made by someone else, a change set that does not exist, or one that needs a role the user no longer has", async () => {
    const { cookie, id } = await editor();
    const { changeSetId } = await addPerson(cookie);
    const other = await editor();
    const response = await undo(other.cookie, changeSetId);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "Only the person who made a change can undo it",
    });
    expect((await undo(cookie, randomUUID())).statusCode).toBe(404);
    await test.connection.execute(
      `DELETE FROM fathom.user_roles WHERE user_id = '${id}' AND role_id = (SELECT id FROM fathom.roles WHERE key = 'workforce-administrator')`,
    );
    expect((await undo(cookie, changeSetId)).statusCode).toBe(403);
  });

  it("refuses to undo what has been changed since, or undo twice", async () => {
    const { cookie } = await editor();
    const { id, changeSetId } = await addPerson(cookie);
    await send(cookie, "PATCH", `/api/people/${id}`, {
      preferredName: "Fictional Later",
    });
    const response = await undo(cookie, changeSetId);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "This has been changed since, so it can no longer be undone",
    });
    const second = await addPerson(cookie);
    expect((await undo(cookie, second.changeSetId)).statusCode).toBe(200);
    expect((await undo(cookie, second.changeSetId)).statusCode).toBe(409);
  });

  it("refuses to undo when what it would put back conflicts with the data now", async () => {
    const { cookie } = await editor();
    const employeeId = unique("Reused");
    const { id } = await addPerson(cookie, { employeeId });
    const deleted = await send(cookie, "DELETE", `/api/people/${id}`);
    await addPerson(cookie, { employeeId });
    expect(
      (await undo(cookie, deleted.json<{ changeSetId: string }>().changeSetId))
        .statusCode,
    ).toBe(409);

    // A list given a choice since it was made, and a column given values since it was added.
    const { list, choices } = await listWith(cookie, ["A"]);
    const created = await send(cookie, "POST", "/api/lists", {
      name: unique("Held List"),
    });
    const heldList = created.json<{ list: List }>().list;
    await send(cookie, "POST", `/api/lists/${heldList.id}/choices`, {
      choices: [{ label: "Fictional" }],
    });
    expect(
      (await undo(cookie, created.json<{ changeSetId: string }>().changeSetId))
        .statusCode,
    ).toBe(409);
    const column = await addColumn(cookie, list.id);
    await addPerson(cookie, {
      values: { [column.field.id]: [String(choices[0]?.id)] },
    });
    expect((await undo(cookie, column.changeSetId)).statusCode).toBe(409);

    // Undoing a restore would retire a list a column now draws on.
    const other = await listWith(cookie, ["B"]);
    await send(cookie, "PUT", `/api/lists/${other.list.id}/retired`, {
      retired: true,
    });
    const restored = await send(
      cookie,
      "PUT",
      `/api/lists/${other.list.id}/retired`,
      {
        retired: false,
      },
    );
    await addColumn(cookie, other.list.id);
    expect(
      (await undo(cookie, restored.json<{ changeSetId: string }>().changeSetId))
        .statusCode,
    ).toBe(409);

    // Undoing letting a column take several choices, after someone was given several.
    const one = await columnWith(cookie, ["C", "D"]);
    const several = await send(
      cookie,
      "PUT",
      `/api/people/columns/${one.field.id}`,
      { name: one.field.name, listId: one.list.id, multiple: true },
    );
    await test.approveLists();
    await addPerson(cookie, {
      values: { [one.field.id]: one.choices.map(({ id }) => id) },
    });
    // Approved since, so it is no longer undone.
    const refused = await undo(
      cookie,
      several.json<{ changeSetId: string }>().changeSetId,
    );
    expect(refused.statusCode).toBe(409);
  });

  it("refuses to put back values that no longer fit their column", async () => {
    const { cookie } = await editor();
    // Several choices, in a column that now takes one.
    const several = await columnWith(cookie, ["A", "B"], { multiple: true });
    const { id } = await addPerson(cookie, {
      values: { [several.field.id]: several.choices.map(({ id }) => id) },
    });
    const deleted = await send(cookie, "DELETE", `/api/people/${id}`);
    await send(cookie, "PUT", `/api/people/columns/${several.field.id}`, {
      name: several.field.name,
      listId: several.list.id,
      multiple: false,
    });
    await approveColumns(several.field.id);
    expect(
      (await undo(cookie, deleted.json<{ changeSetId: string }>().changeSetId))
        .statusCode,
    ).toBe(409);
    // A choice from a list the column no longer draws on.
    const moved = await columnWith(cookie, ["C"]);
    const other = await listWith(cookie, ["D"]);
    const person = await addPerson(cookie, {
      values: { [moved.field.id]: [String(moved.choices[0]?.id)] },
    });
    const removed = await send(cookie, "DELETE", `/api/people/${person.id}`);
    await send(cookie, "PUT", `/api/people/columns/${moved.field.id}`, {
      name: moved.field.name,
      listId: other.list.id,
    });
    await approveColumns(moved.field.id);
    expect(
      (await undo(cookie, removed.json<{ changeSetId: string }>().changeSetId))
        .statusCode,
    ).toBe(409);
  });

  it("waits for a change being saved, then refuses to undo over it, and undoes the same change only once", async () => {
    const { cookie } = await editor();
    const { id, changeSetId } = await addPerson(cookie);
    // Another change to the same person, holding its lock until the undo has started.
    let release = () => undefined as unknown;
    const held = new Promise((resolve) => {
      release = resolve as () => unknown;
    });
    let locked = () => undefined as unknown;
    const isLocked = new Promise((resolve) => {
      locked = resolve as () => unknown;
    });
    const other = test.connection.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended('fathom.drafts', 0))`,
      );
      await transaction
        .select()
        .from(people)
        .where(eq(people.id, id))
        .for("update");
      await recordChanges(transaction, null, [
        {
          recordType: "person",
          recordId: id,
          action: "changed",
          field: "preferredName",
          tier: "general",
          oldValue: "Before",
          newValue: "After",
        },
      ]);
      locked();
      await held;
    });
    await isLocked;
    const undoing = undo(cookie, changeSetId);
    // Released only once the undo is waiting for the person's lock.
    await vi.waitFor(async () => {
      const waiting = await test.connection.execute<{ total: string }>(
        sql`SELECT count(*) AS total FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()`,
      );
      expect(Number(waiting.rows[0]?.total)).toBeGreaterThan(0);
    }, waitLimit);
    release();
    await other;
    expect((await undoing).statusCode).toBe(409);

    const second = await addPerson(cookie);
    const both = await Promise.all([
      undo(cookie, second.changeSetId),
      undo(cookie, second.changeSetId),
    ]);
    expect(both.map(({ statusCode }) => statusCode).sort()).toEqual([200, 409]);
  });

  it("treats values as sensitive as their list is now, if it has become more sensitive since", async () => {
    const { cookie, id: editorId } = await editor();
    const { field, choices, list } = await columnWith(cookie, ["A", "B"]);
    const { id } = await addPerson(cookie, {
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const changed = await send(cookie, "PATCH", `/api/people/${id}`, {
      values: { [field.id]: [String(choices[1]?.id)] },
    });
    await send(cookie, "PUT", `/api/lists/${list.id}/class`, {
      dataClass: "personal",
    });
    const undone = await undo(
      cookie,
      changed.json<{ changeSetId: string }>().changeSetId,
    );
    expect(undone.statusCode).toBe(200);
    expect((await test.historyOf(id)).at(-1)).toMatchObject({
      tier: "personal",
    });
    expect(await accessOf(editorId)).toContainEqual({
      action: "personal-changed",
      subjectId: id,
    });
  });

  it("adds and undoes a thousand people with many columns at once", async () => {
    const { cookie } = await editor();
    const columns = [];
    for (let index = 0; index < 5; index += 1) {
      columns.push(await columnWith(cookie, ["A"]));
    }
    const values = Object.fromEntries(
      columns.map(({ field, choices }) => [field.id, [String(choices[0]?.id)]]),
    );
    const prefix = unique("Bulk");
    const { ids, changeSetId } = await addPeople(
      cookie,
      Array.from({ length: 1000 }, (_, index) => ({
        preferredName: `Fictional Bulk ${String(index)}`,
        employeeId: `${prefix}-${String(index)}`,
        startDate: "2020-01-01",
        endDate: "2030-01-01",
        values,
      })),
    );
    expect(ids).toHaveLength(1000);
    expect((await undo(cookie, changeSetId)).statusCode).toBe(200);
    const left = (await readPeople(cookie)).people.filter(({ id }) =>
      ids.includes(id),
    );
    expect(left).toEqual([]);
  });

  it("records undoing Personal changes in the access history", async () => {
    const { cookie, id: editorId } = await editor();
    const { id } = await addPerson(cookie);
    const changed = await send(cookie, "PATCH", `/api/people/${id}`, {
      endDate: "2032-01-01",
    });
    await undo(cookie, changed.json<{ changeSetId: string }>().changeSetId);
    const entries = await test.connection
      .select({ action: accessHistory.action })
      .from(accessHistory)
      .where(
        and(
          eq(accessHistory.actorId, editorId),
          eq(accessHistory.subjectId, id),
        ),
      );
    expect(entries).toHaveLength(2);
  });
});
