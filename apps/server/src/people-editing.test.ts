// SPDX-License-Identifier: Apache-2.0

// Integration tests for changing people, against a migrated PostgreSQL server: adding, changing
// and deleting them, their positions and IDs, and the refusals for duplicates and missing or
// unoffered values.

import { fieldValues, listItems, lists, plannedHires } from "@fathom/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPosition, otherTestPosition } from "./test-app.ts";
import {
  test,
  unique,
  editor,
  send,
  listWith,
  columnWith,
  personRequest,
  addPeople,
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

describe("adding people", () => {
  it("adds several people at once, with their values in the list's order, recording each field's tier", async () => {
    const { cookie, id: editorId } = await editor();
    const { field, choices } = await columnWith(
      cookie,
      ["First", "Second", "Third"],
      { multiple: true, visibility: "personal" },
    );
    const [first, , third] = choices.map(({ id }) => id);
    const { ids, changeSetId } = await addPeople(cookie, [
      {
        startDate: "2024-03-01",
        values: { [field.id]: [String(third), String(first)] },
      },
      {},
    ]);
    expect(ids).toHaveLength(2);
    expect(changeSetId).toEqual(expect.any(String));
    const person = await readPerson(cookie, String(ids[0]));
    expect(person?.values).toEqual({ [field.id]: [first, third] });
    const history = await test.historyOf(String(ids[0]));
    expect(
      history.map(({ action, field: name, tier }) => [action, name, tier]),
    ).toEqual([
      ["created", "preferredName", "general"],
      ["created", "employeeId", "general"],
      ["created", "positionId", "general"],
      ["created", "startDate", "personal"],
      ["created", `value:${field.id}`, "personal"],
    ]);
    const access = await accessOf(editorId);
    expect(
      access.filter(({ action }) => action === "personal-changed"),
    ).toEqual([{ action: "personal-changed", subjectId: ids[0] }]);
  });

  it("refuses an Employee ID already used, ignoring letter case, saving none of the people sent with it", async () => {
    const { cookie } = await editor();
    const employeeId = unique("Duplicate");
    await addPerson(cookie, { employeeId });
    const name = unique("Not Saved");
    const response = await send(cookie, "POST", "/api/people", {
      people: [
        personRequest({ preferredName: name }),
        personRequest({ employeeId: employeeId.toLowerCase() }),
      ],
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "Someone already has that ID",
    });
    expect(
      (await readPeople(cookie)).people.some(
        ({ preferredName }) => preferredName === name,
      ),
    ).toBe(false);
  });

  it.each([
    [{ preferredName: " " }],
    [{ employeeId: "" }],
    [{ employeeId: "x".repeat(41) }],
    [{ startDate: "31/10/2026" }],
  ])("refuses details that are missing or not valid: %j", async (details) => {
    const { cookie } = await editor();
    const response = await send(cookie, "POST", "/api/people", {
      people: [{ ...personRequest(), ...details }],
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses an end date before the start date", async () => {
    const { cookie } = await editor();
    const response = await send(cookie, "POST", "/api/people", {
      people: [
        personRequest({ startDate: "2026-05-02", endDate: "2026-05-01" }),
      ],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "The end date cannot be before the start date",
    });
  });

  it("refuses values that do not fit their column", async () => {
    const { cookie } = await editor();
    const { field, choices, list } = await columnWith(cookie, ["A", "B"]);
    const other = await listWith(cookie, ["Elsewhere"]);
    const retired = choices[1];
    await send(
      cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(retired?.id)}/retired`,
      { retired: true },
    );
    await test.approveLists();
    const attempts: [Record<string, string[]>, string][] = [
      [{ [randomUUID()]: [] }, "There is no such column"],
      [
        { [field.id]: [String(other.choices[0]?.id)] },
        `Choose ${field.name} from the column's list`,
      ],
      [
        { [field.id]: [randomUUID()] },
        `Choose ${field.name} from the column's list`,
      ],
      [
        { [field.id]: [String(retired?.id)] },
        `Choose a ${field.name} that is offered`,
      ],
    ];
    for (const [values, error] of attempts) {
      const response = await send(cookie, "POST", "/api/people", {
        people: [personRequest({ values })],
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error });
    }
    // Choices that are not identifiers, or the same choice twice, are refused before they are read.
    for (const values of [
      { [field.id]: ["not-a-choice"] },
      { "not-a-column": [String(choices[0]?.id)] },
      { [field.id]: [String(choices[0]?.id), String(choices[0]?.id)] },
    ]) {
      const response = await send(cookie, "POST", "/api/people", {
        people: [personRequest({ values })],
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it("refuses several choices for a column that takes one", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A", "B"]);
    const response = await send(cookie, "POST", "/api/people", {
      people: [
        personRequest({ values: { [field.id]: choices.map(({ id }) => id) } }),
      ],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: `${field.name} takes one choice`,
    });
  });

  it("refuses new values from a retired list", async () => {
    const { cookie } = await editor();
    const { list, field, choices } = await columnWith(cookie, ["A"]);
    await test.connection.execute(
      // Lists a column draws on cannot be retired through Fathom; this one was retired before.
      `UPDATE fathom.lists SET retired = true WHERE id = '${list.id}'`,
    );
    const response = await send(cookie, "POST", "/api/people", {
      people: [
        personRequest({ values: { [field.id]: [String(choices[0]?.id)] } }),
      ],
    });
    expect(response.statusCode).toBe(400);
    await test.connection.execute(
      `UPDATE fathom.lists SET retired = false WHERE id = '${list.id}'`,
    );
  });
});

describe("changing and deleting people", () => {
  it("changes some details, replacing a column's choices, and keeps a retired choice a person already has", async () => {
    const { cookie } = await editor();
    const { field, choices, list } = await columnWith(cookie, ["A", "B"], {
      multiple: true,
    });
    const [a, b] = choices.map(({ id }) => id);
    const { id } = await addPerson(cookie, {
      values: { [field.id]: [String(a)] },
    });
    await send(
      cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(a)}/retired`,
      { retired: true },
    );
    await test.approveLists();
    const response = await send(cookie, "PATCH", `/api/people/${id}`, {
      preferredName: "Fictional Renamed",
      employeeId: unique("Changed"),
      positionId: testPosition,
      startDate: "2025-01-01",
      endDate: "2026-01-01",
      values: { [field.id]: [String(b), String(a)] },
    });
    expect(response.statusCode).toBe(200);
    expect(await readPerson(cookie, id)).toMatchObject({
      preferredName: "Fictional Renamed",
      startDate: "2025-01-01",
      endDate: "2026-01-01",
      values: { [field.id]: [a, b] },
    });
    expect(
      (await test.historyOf(id)).slice(-5).map(({ field: name }) => name),
    ).toEqual([
      "preferredName",
      "employeeId",
      "startDate",
      "endDate",
      `value:${field.id}`,
    ]);
  });

  it("records nothing when nothing changes, and clears a column with no choices", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A"]);
    const { id } = await addPerson(cookie, {
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const same = await send(cookie, "PATCH", `/api/people/${id}`, {});
    expect(same.json()).toEqual({ changeSetId: null });
    await send(cookie, "PATCH", `/api/people/${id}`, {
      values: { [field.id]: [] },
    });
    expect((await readPerson(cookie, id))?.values).toEqual({});
  });

  it("refuses a change that leaves a required column empty, and a person who does not exist", async () => {
    const { cookie } = await editor();
    const { field, choices } = await columnWith(cookie, ["A"]);
    const { id } = await addPerson(cookie, {
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    // Everyone in this test's database must have a value before the column can be required.
    await test.connection.execute(
      `UPDATE fathom.fields SET required = true WHERE id = '${field.id}'`,
    );
    const cleared = await send(cookie, "PATCH", `/api/people/${id}`, {
      values: { [field.id]: [] },
    });
    expect(cleared.statusCode).toBe(400);
    expect(cleared.json()).toEqual({
      error: `${field.name} must be filled in`,
    });
    await test.connection.execute(
      `UPDATE fathom.fields SET required = false WHERE id = '${field.id}'`,
    );
    for (const method of ["PATCH", "DELETE"] as const) {
      const missing = await send(
        cookie,
        method,
        `/api/people/${randomUUID()}`,
        {},
      );
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: "There is no such person" });
    }
  });

  it("deletes a person with their values, recording everything they held", async () => {
    const { cookie, id: editorId } = await editor();
    const { field, choices } = await columnWith(cookie, ["A"]);
    const { id } = await addPerson(cookie, {
      endDate: "2030-01-01",
      values: { [field.id]: [String(choices[0]?.id)] },
    });
    const response = await send(cookie, "DELETE", `/api/people/${id}`);
    expect(response.statusCode).toBe(200);
    expect(await readPerson(cookie, id)).toBeUndefined();
    const left = await test.connection
      .select()
      .from(fieldValues)
      .where(eq(fieldValues.personId, id));
    expect(left).toHaveLength(0);
    expect(
      (await test.historyOf(id))
        .filter(({ action }) => action === "deleted")
        .map(({ field: name }) => name),
    ).toEqual([
      "preferredName",
      "employeeId",
      "positionId",
      "endDate",
      `value:${field.id}`,
    ]);
    expect(
      (await accessOf(editorId)).find(
        ({ action }) => action === "personal-changed",
      ),
    ).toEqual({
      action: "personal-changed",
      subjectId: id,
    });
  });
});

describe("positions and IDs", () => {
  it("gives a person a position from the Positions list, and changes it", async () => {
    const { cookie } = await editor();
    const { id } = await addLivePerson(cookie);
    expect((await readPerson(cookie, id))?.positionId).toBe(testPosition);
    const changed = await send(cookie, "PATCH", `/api/people/${id}`, {
      positionId: otherTestPosition,
    });
    expect(changed.statusCode).toBe(200);
    expect(await readPerson(cookie, id)).toMatchObject({
      positionId: otherTestPosition,
      draft: {
        changed: ["positionId"],
        live: { positionId: testPosition },
      },
    });
  });

  it("refuses a position from another list, one that is not a choice, or one retired", async () => {
    const { cookie } = await editor();
    const [positions] = await test.connection
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.builtIn, "positions"));
    const [retired] = await test.connection
      .insert(listItems)
      .values({
        listId: String(positions?.id),
        label: unique("Fictional Retired Position"),
        retired: true,
      })
      .returning({ id: listItems.id });
    const [state] = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(eq(lists.builtIn, "hiring-states"));
    for (const positionId of [
      String(state?.id),
      randomUUID(),
      String(retired?.id),
    ]) {
      const response = await send(cookie, "POST", "/api/people", {
        people: [personRequest({ positionId })],
      });
      expect(response.statusCode).toBe(400);
    }
    const { id } = await addPerson(cookie);
    expect(
      (
        await send(cookie, "PATCH", `/api/people/${id}`, {
          positionId: String(retired?.id),
        })
      ).statusCode,
    ).toBe(400);
  });

  it("refuses an Employee ID that looks like a temporary ID, or that a planned hire's requisition already is", async () => {
    const { cookie } = await editor();
    const tbd = await send(cookie, "POST", "/api/people", {
      people: [personRequest({ employeeId: "tbd-4" })],
    });
    expect(tbd.statusCode).toBe(400);
    const requisition = unique("Fictional-REQ");
    const [open] = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(eq(lists.builtIn, "hiring-states"));
    await test.connection.insert(plannedHires).values({
      requisition,
      positionId: testPosition,
      stateId: String(open?.id),
    });
    const added = await send(cookie, "POST", "/api/people", {
      people: [personRequest({ employeeId: requisition.toLowerCase() })],
    });
    expect(added.statusCode).toBe(409);
    const { id } = await addPerson(cookie);
    const changed = await send(cookie, "PATCH", `/api/people/${id}`, {
      employeeId: requisition,
    });
    expect(changed.statusCode).toBe(409);
  });
});
