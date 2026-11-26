// SPDX-License-Identifier: Apache-2.0

// Integration tests for the columns on the People table, against a migrated PostgreSQL server:
// adding, changing, ordering and deleting them, settings the data does not fit, and lists and
// choices in use.

import { type Field } from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hiresHave, peopleHave } from "./data/fields.ts";
import { generalReader, type Method, unique } from "./test-app.ts";
import {
  test,
  editor,
  send,
  listWith,
  addColumn,
  columnWith,
  addPerson,
  addLivePerson,
  readPeople,
  readPerson,
  accessOf,
  startPeopleTests,
  closePeopleTests,
} from "./test-people.ts";

beforeAll(startPeopleTests);

afterAll(closePeopleTests);

describe("columns", () => {
  it("adds columns at the end, and changes their settings", async () => {
    const { cookie } = await editor();
    const { list } = await listWith(cookie, ["A"]);
    const first = (await addColumn(cookie, list.id)).field;
    const second = (await addColumn(cookie, list.id, { multiple: true })).field;
    const order = async () =>
      (await readPeople(cookie)).order.filter((key) =>
        [first.id, second.id].includes(key),
      );
    expect(await order()).toEqual([first.id, second.id]);
    const renamed = await send(
      cookie,
      "PUT",
      `/api/people/columns/${first.id}`,
      {
        name: "Fictional Renamed Column",
        listId: list.id,
        multiple: true,
        required: false,
      },
    );
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<{ field: Field }>().field).toMatchObject({
      name: "Fictional Renamed Column",
      multiple: true,
    });
    const same = await send(cookie, "PUT", `/api/people/columns/${first.id}`, {
      name: "Fictional Renamed Column",
      listId: list.id,
      multiple: true,
    });
    expect(same.json<{ changeSetId: null }>().changeSetId).toBeNull();
  });

  it("shows each user only the columns they see, in the table's own order", async () => {
    const { cookie } = await editor();
    const { field } = await columnWith(cookie, ["A"]);
    const order = (await readPeople(cookie)).order;
    expect(order.at(-1)).toBe(field.id);
    expect(order).toEqual(expect.arrayContaining(["startDate", "endDate"]));
    const viewer = await test.signedIn(generalReader);
    const seen = (await readPeople(viewer.cookie)).order;
    expect(seen).not.toContain("startDate");
    expect(seen).toContain("employeeId");
  });

  it("refuses a column name already used, ignoring letter case, and lists that are missing or retired", async () => {
    const { cookie } = await editor();
    const { list } = await listWith(cookie, ["A"]);
    const name = unique("Taken Column");
    await addColumn(cookie, list.id, { name });
    const taken = await send(cookie, "POST", "/api/people/columns", {
      name: name.toUpperCase(),
      listId: list.id,
    });
    expect(taken.statusCode).toBe(409);
    expect(taken.json()).toEqual({
      error: "There is already a column with that name",
    });
    const missing = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Column"),
      listId: randomUUID(),
    });
    expect(missing.json()).toEqual({ error: "There is no such list" });
    const retired = await listWith(cookie, ["A"]);
    await send(cookie, "PUT", `/api/lists/${retired.list.id}/retired`, {
      retired: true,
    });
    await test.approveLists();
    const onRetired = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Column"),
      listId: retired.list.id,
    });
    expect(onRetired.statusCode).toBe(400);
    expect(onRetired.json()).toEqual({
      error: "Choose a list that is not retired",
    });
  });

  it("refuses settings the people in Fathom do not fit", async () => {
    const { cookie } = await editor();
    const { field, choices, list } = await columnWith(cookie, ["A", "B"], {
      multiple: true,
    });
    await addLivePerson(cookie, {
      values: { [field.id]: choices.map(({ id }) => id) },
    });
    const other = await listWith(cookie, ["Elsewhere"]);
    const settings = { name: field.name, listId: list.id, multiple: true };
    const attempts: [object, RegExp][] = [
      [{ ...settings, multiple: false }, /^1 person has several choices for/],
      [{ ...settings, listId: other.list.id }, /so its list cannot change$/],
    ];
    for (const [request, error] of attempts) {
      const response = await send(
        cookie,
        "PUT",
        `/api/people/columns/${field.id}`,
        request,
      );
      expect(response.statusCode).toBe(409);
      expect(response.json<{ error: string }>().error).toMatch(error);
    }
    // Which people, live or drafted, keep a column from being required is tried in columns.test.ts,
    // with a database of its own.
    const required = await send(cookie, "POST", "/api/people/columns", {
      name: unique("Required"),
      listId: list.id,
      required: true,
    });
    expect(required.statusCode).toBe(409);
  });

  it("refuses one choice while the editor's own unpublished draft has several, but not for another editor", async () => {
    // Given one editor's unpublished draft giving a person several choices in a column
    const { cookie } = await editor();
    const other = await editor();
    const { field, choices, list } = await columnWith(cookie, ["A", "B"], {
      multiple: true,
    });
    const { id } = await addLivePerson(cookie);
    const unpublished = { publish: false };
    const given = await send(
      cookie,
      "PATCH",
      `/api/people/${id}`,
      { values: { [field.id]: choices.map((choice) => choice.id) } },
      unpublished,
    );
    expect(given.statusCode, given.body).toBe(200);
    const url = `/api/people/columns/${field.id}`;
    const single = { name: field.name, listId: list.id, multiple: false };

    // When that editor and another make the column take one choice
    const own = await send(cookie, "PUT", url, single, unpublished);
    const theirs = await send(other, "PUT", url, single, unpublished);

    // Then only the editor whose draft has several is refused
    expect(own.statusCode).toBe(409);
    expect(own.json<{ error: string }>().error).toBe(
      `Drafts have several choices for ${field.name}, so it cannot take only one yet`,
    );
    expect(theirs.statusCode, theirs.body).toBe(200);
    for (const who of [cookie, other]) {
      await send(who, "POST", "/api/unpublished/discard");
    }
  });

  it("counts people in words", () => {
    expect([1, 2].map(peopleHave)).toEqual(["1 person has", "2 people have"]);
    expect([1, 2].map(hiresHave)).toEqual([
      "1 planned hire has",
      "2 planned hires have",
    ]);
  });

  it("lets a column without values change its list, and refuses ones that do not exist", async () => {
    const { cookie } = await editor();
    const { field, list } = await columnWith(cookie, ["A"]);
    const other = await listWith(cookie, ["B"]);
    const changed = await send(
      cookie,
      "PUT",
      `/api/people/columns/${field.id}`,
      {
        name: field.name,
        listId: other.list.id,
      },
    );
    expect(changed.statusCode).toBe(200);
    const unknown = `/api/people/columns/${randomUUID()}`;
    for (const [method, url, payload] of [
      ["PUT", unknown, { name: "Fictional", listId: list.id }],
      ["DELETE", unknown, undefined],
    ] as [Method, string, object | undefined][]) {
      const response = await send(cookie, method, url, payload);
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    }
  });

  it("deletes a column with its values once approved, recording them on each person", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A"], {
      visibility: "personal",
    });
    const { id } = await addLivePerson(cookie, {
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const response = await send(
      cookie,
      "DELETE",
      `/api/people/columns/${field.id}`,
    );
    expect(response.statusCode).toBe(200);
    // A draft until approved, by an Approver who sees the values it deletes.
    expect((await readPerson(cookie, id))?.values).not.toEqual({});
    const approver = await test.signedIn("engineering-director");
    expect(
      (
        await send(approver.cookie, "POST", "/api/drafts/approval", {
          columns: [field.id],
        })
      ).statusCode,
    ).toBe(200);
    expect((await readPerson(cookie, id))?.values).toEqual({});
    expect((await test.historyOf(id)).at(-1)).toMatchObject({
      action: "changed",
      field: `value:${field.id}`,
      tier: "personal",
      oldValue: [choices[0]?.id],
      newValue: null,
    });
    expect(
      (await accessOf(approver.id)).find(
        ({ action }) => action === "personal-changed",
      ),
    ).toEqual({
      action: "personal-changed",
      subjectId: id,
    });
  });
});

describe("lists and choices in use", () => {
  it("refuses to retire or delete a list a column draws on, or remove a choice someone has", async () => {
    const { cookie } = await editor();
    const { list, field, choices } = await columnWith(cookie, ["A", "B"]);
    await addColumn(cookie, list.id, { name: unique("Second Column") });
    await addPerson(cookie, {
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    for (const [method, url, payload] of [
      ["PUT", `/api/lists/${list.id}/retired`, { retired: true }],
      ["DELETE", `/api/lists/${list.id}`, undefined],
    ] as [Method, string, object | undefined][]) {
      const response = await send(cookie, method, url, payload);
      expect(response.statusCode).toBe(409);
      expect(response.json<{ error: string }>().error).toMatch(
        /^This list cannot be (retired|deleted) while columns draw on it: /,
      );
    }
    const removed = await send(
      cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`,
    );
    expect(removed.statusCode).toBe(409);
    expect(removed.json()).toEqual({
      error:
        "This choice cannot be removed while it is in use; retire it instead",
    });
    const unused = await send(
      cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choices[1]?.id)}`,
    );
    expect(unused.statusCode).toBe(200);
  });

  it("names the one column a list is used by", async () => {
    const { cookie } = await editor();
    const { list, field } = await columnWith(cookie, ["A"]);
    const response = await send(cookie, "DELETE", `/api/lists/${list.id}`);
    expect(response.json()).toEqual({
      error: `This list cannot be deleted while a column draws on it: ${field.name}`,
    });
  });
});
