// SPDX-License-Identifier: Apache-2.0

// Integration tests for drafts and live people, against a PostgreSQL server of their own: undoing
// changes to drafts, the columns and choices drafts use, drafts and changes saved at the same
// moment, and people saved live.

import { drafts, fields, recordChanges } from "@fathom/db";
import { type Choice, type Field, type List } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  test,
  editor,
  unique,
  send,
  saved,
  columnWith,
  draftPerson,
  approve,
  approveColumns,
  livePerson,
  seen,
  live,
  draftRow,
  undo,
  startDraftTests,
  closeDraftTests,
} from "./test-drafts.ts";

beforeAll(startDraftTests);

afterAll(closeDraftTests);

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
      recordChanges(transaction, { userId: editor.id, roleId: null }, [
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
      recordChanges(transaction, { userId: editor.id, roleId: null }, [
        {
          recordType: "person",
          recordId: person.id,
          action: "changed",
          field: "startDate",
          tier: "personal",
          oldValue: "2019-01-01",
          newValue: "2020-01-01",
        },
        {
          recordType: "person",
          recordId: person.id,
          action: "changed",
          field: "endDate",
          tier: "personal",
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
      recordChanges(transaction, { userId: editor.id, roleId: null }, [
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
