// SPDX-License-Identifier: Apache-2.0

// Integration tests for undoing changes to People's columns and their drafts, against a PostgreSQL
// server of their own, including changes saved before columns had drafts.

import { fields, lists } from "@fathom/db";
import { defaultClasses, type List, type Permission } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordChanges } from "./data/changes.ts";
import { createDataAccess } from "./data/index.ts";
import { ConflictError } from "./errors.ts";
import { testPosition, unique } from "./test-app.ts";
import {
  test,
  editorActor,
  send,
  decide,
  readPeople,
  liveList,
  draftColumn,
  liveColumn,
  livePerson,
  liveField,
  changeSet,
  startColumnDraftTests,
  closeColumnDraftTests,
} from "./test-column-drafts.ts";

beforeAll(startColumnDraftTests);

afterAll(closeColumnDraftTests);

describe("undoing edits to drafts of columns", () => {
  it("puts back a column's draft and a removal, and takes out a draft adding it", async () => {
    const { list } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    const renamed = await send("PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Renamed"),
      listId: list.id,
    });
    expect(
      (await send("POST", `/api/undo/${changeSet(renamed)}`)).statusCode,
    ).toBe(200);
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).not.toHaveProperty("draft");

    const removed = await send("DELETE", `/api/people/columns/${field.id}`);
    await send("POST", `/api/undo/${changeSet(removed)}`);
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).not.toHaveProperty("draft");

    const { field: added, changeSetId } = await draftColumn(list.id);
    await send("POST", `/api/undo/${changeSetId}`);
    expect(
      (await readPeople()).fields.find(({ id }) => id === added.id),
    ).toBeUndefined();

    const discarded = await draftColumn(list.id);
    const thrown = await send(
      "DELETE",
      `/api/people/columns/${discarded.field.id}`,
    );
    await draftColumn(list.id, { name: discarded.field.name });
    expect(
      (await send("POST", `/api/undo/${changeSet(thrown)}`)).statusCode,
    ).toBe(409);
  });
});

describe("undoing changes to columns saved before columns had drafts", () => {
  it("puts back the list a column drew on only while that list is live and not retired", async () => {
    const { list: first } = await liveList(["A"]);
    const { list: second } = await liveList(["B"]);
    const field = await liveColumn(first.id);
    await test.connection
      .update(fields)
      .set({ listId: second.id })
      .where(eq(fields.id, field.id));
    const changed = await test.connection.transaction((transaction) =>
      recordChanges(transaction, editorActor(), [
        {
          recordType: "field",
          recordId: field.id,
          action: "changed",
          field: "listId",
          tier: "general",
          oldValue: first.id,
          newValue: second.id,
        },
      ]),
    );
    const setRetired = (retired: boolean) =>
      test.connection
        .update(lists)
        .set({ retired })
        .where(eq(lists.id, first.id));
    await setRetired(true);
    expect(
      (await send("POST", `/api/undo/${String(changed)}`)).statusCode,
    ).toBe(400);
    expect((await liveField(field.id))?.listId).toBe(second.id);
    await setRetired(false);
    expect(
      (await send("POST", `/api/undo/${String(changed)}`)).statusCode,
    ).toBe(200);
    expect((await liveField(field.id))?.listId).toBe(first.id);
    const gone = await test.connection.transaction((transaction) =>
      recordChanges(transaction, editorActor(), [
        {
          recordType: "field",
          recordId: field.id,
          action: "changed",
          field: "listId",
          tier: "general",
          oldValue: randomUUID(),
          newValue: first.id,
        },
      ]),
    );
    expect((await send("POST", `/api/undo/${String(gone)}`)).statusCode).toBe(
      400,
    );
  });

  it("puts back a column's settings, and takes out a column added, unless values or drafts hold it", async () => {
    const { list, choices } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    const other = await liveColumn(list.id);
    const renamed = unique("Fictional Renamed");
    const otherRenamed = unique("Fictional Other Renamed");
    await test.connection
      .update(fields)
      .set({ name: renamed })
      .where(eq(fields.id, field.id));
    await test.connection
      .update(fields)
      .set({ name: otherRenamed })
      .where(eq(fields.id, other.id));
    const changed = await test.connection.transaction((transaction) =>
      recordChanges(transaction, editorActor(), [
        {
          recordType: "field",
          recordId: field.id,
          action: "changed",
          field: "name",
          tier: "general",
          oldValue: field.name,
          newValue: renamed,
        },
        {
          recordType: "field",
          recordId: other.id,
          action: "changed",
          field: "name",
          tier: "general",
          oldValue: other.name,
          newValue: otherRenamed,
        },
      ]),
    );
    expect(
      (await send("POST", `/api/undo/${String(changed)}`)).statusCode,
    ).toBe(200);
    expect((await liveField(field.id))?.name).toBe(field.name);
    expect((await liveField(other.id))?.name).toBe(other.name);

    const addLegacy = async () => {
      const id = randomUUID();
      const row = {
        id,
        tableName: "people",
        name: unique("Fictional Legacy"),
        listId: list.id,
        multiple: false,
        required: false,
      };
      await test.connection.insert(fields).values(row);
      const changeSetId = await test.connection.transaction((transaction) =>
        recordChanges(
          transaction,
          editorActor(),
          (
            ["tableName", "name", "listId", "multiple", "required"] as const
          ).map((name) => ({
            recordType: "field" as const,
            recordId: id,
            action: "created" as const,
            field: name,
            tier: "general" as const,
            oldValue: null,
            newValue: new Map(Object.entries(row)).get(name),
          })),
        ),
      );
      return { id, changeSetId: String(changeSetId) };
    };
    const plain = await addLegacy();
    expect(
      (await send("POST", `/api/undo/${plain.changeSetId}`)).statusCode,
    ).toBe(200);
    expect(await liveField(plain.id)).toBeUndefined();

    const valued = await addLegacy();
    await livePerson({ [valued.id]: [String(choices[0]?.id)] });
    expect(
      (await send("POST", `/api/undo/${valued.changeSetId}`)).statusCode,
    ).toBe(409);

    const drafted = await addLegacy();
    await send("POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("E"),
          positionId: testPosition,
          values: { [drafted.id]: [String(choices[0]?.id)] },
        },
      ],
    });
    expect(
      (await send("POST", `/api/undo/${drafted.changeSetId}`)).statusCode,
    ).toBe(409);
  });
});

describe("undoing changes to column drafts", () => {
  // Drafts a column, discards it, changes something with the given step, and tries to undo the
  // discard, which would put the draft back.
  async function undoDiscardAfter(
    step: (list: List, name: string) => Promise<unknown>,
  ) {
    const { list } = await liveList(["A"]);
    const { field } = await draftColumn(list.id);
    const { changeSetId } = (
      await send("DELETE", `/api/people/columns/${field.id}/draft`)
    ).json<{ changeSetId: string }>();
    await step(list, field.name);
    return (await send("POST", `/api/undo/${changeSetId}`)).statusCode;
  }

  it("refuses a name taken since, and a list retired or deleted since", async () => {
    expect(
      await undoDiscardAfter((list, name) =>
        send("POST", "/api/people/columns", { name, listId: list.id }),
      ),
    ).toBe(409);
    expect(
      await undoDiscardAfter(async (list) => {
        await send("PUT", `/api/lists/${list.id}/retired`, { retired: true });
        return decide("approval", { lists: [list.id] });
      }),
    ).toBe(409);
    expect(
      await undoDiscardAfter(async (list) => {
        await send("DELETE", `/api/lists/${list.id}`);
        return decide("approval", { lists: [list.id] });
      }),
    ).toBe(409);
  });

  it("refuses to put back a removal once its maker may no longer change people", async () => {
    const remover = await test.signedIn("workforce-administrator");
    const { list } = await liveList(["A"]);
    const column = await liveColumn(list.id);
    await test.request(
      remover.cookie,
      "DELETE",
      `/api/people/columns/${column.id}`,
    );
    const { changeSetId } = (
      await test.request(
        remover.cookie,
        "DELETE",
        `/api/people/columns/${column.id}/draft`,
      )
    ).json<{ changeSetId: string }>();
    // No role changes configuration without people today, so the actor is made by hand.
    const configurationOnly = {
      user: { id: remover.id, name: "Fictional Remover", email: "" },
      roleId: null,
      dataClasses: defaultClasses,
      permissions: ["configuration:edit", "configuration:view"] as Permission[],
    };
    await expect(
      createDataAccess(test.connection).undo(configurationOnly, changeSetId),
    ).rejects.toThrow(ConflictError);
  });

  it("refuses to put back a removal of a column whose values its maker can no longer see", async () => {
    const remover = await test.signedIn("workforce-administrator");
    const { list } = await liveList(["A"], "confidential");
    const column = await liveColumn(list.id);
    await test.request(
      remover.cookie,
      "DELETE",
      `/api/people/columns/${column.id}`,
    );
    const { changeSetId } = (
      await test.request(
        remover.cookie,
        "DELETE",
        `/api/people/columns/${column.id}/draft`,
      )
    ).json<{ changeSetId: string }>();
    const withoutConfidential = {
      user: { id: remover.id, name: "Fictional Remover", email: "" },
      roleId: null,
      dataClasses: defaultClasses,
      permissions: [
        "configuration:edit",
        "configuration:view",
        "people:edit",
        "people:view",
      ] as Permission[],
    };
    await expect(
      createDataAccess(test.connection).undo(withoutConfidential, changeSetId),
    ).rejects.toThrow(ConflictError);
  });

  it("puts back a column drafted to be added once its discarding is undone", async () => {
    expect(await undoDiscardAfter(() => Promise.resolve())).toBe(200);
  });

  it("puts back a removal once its discarding is undone", async () => {
    const { list } = await liveList(["A"]);
    const column = await liveColumn(list.id);
    await send("DELETE", `/api/people/columns/${column.id}`);
    const { changeSetId } = (
      await send("DELETE", `/api/people/columns/${column.id}/draft`)
    ).json<{ changeSetId: string }>();
    expect((await send("POST", `/api/undo/${changeSetId}`)).statusCode).toBe(
      200,
    );
    expect(
      (await readPeople()).fields.find(({ id }) => id === column.id)?.draft,
    ).toMatchObject({ action: "deleted" });
  });

  it("puts back a change to a live column's draft", async () => {
    const { list } = await liveList(["A"]);
    const column = await liveColumn(list.id);
    const { changeSetId } = (
      await send("PUT", `/api/people/columns/${column.id}`, {
        name: unique("Fictional Renamed"),
        listId: list.id,
      })
    ).json<{ changeSetId: string }>();
    expect((await send("POST", `/api/undo/${changeSetId}`)).statusCode).toBe(
      200,
    );
    expect(
      (await readPeople()).fields.find(({ id }) => id === column.id),
    ).not.toHaveProperty("draft");
  });
});
