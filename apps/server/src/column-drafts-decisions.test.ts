// SPDX-License-Identifier: Apache-2.0

// Integration tests for deciding drafts of People's columns, against a PostgreSQL server of their
// own: discarding and sending them again, rejecting them, drafts written without the change history,
// what decides and keeps them safe, and columns drawing on lists drafted to be added.

import { drafts, lists } from "@fathom/db";
import { type List } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generalApprover, unique } from "./test-app.ts";
import {
  test,
  approver,
  send,
  decide,
  readPeople,
  liveList,
  draftColumn,
  liveColumn,
  livePerson,
  liveField,
  startColumnDraftTests,
  closeColumnDraftTests,
} from "./test-column-drafts.ts";

beforeAll(startColumnDraftTests);

afterAll(closeColumnDraftTests);

describe("discarding and sending drafts of columns again", () => {
  it.each([
    ["removal", "DELETE", () => undefined],
    [
      "rename",
      "PUT",
      (listId: string) => ({
        name: unique("Fictional Renamed"),
        listId,
      }),
    ],
  ] as const)(
    "sends a rejected %s again only for a role that still sees the column's values",
    async (_change, method, body) => {
      // Given a Personal column whose change was drafted and rejected
      const maker = await test.signedIn("workforce-administrator");
      const { list } = await liveList(["A"], "personal");
      const field = await liveColumn(list.id);
      const path = `/api/people/columns/${field.id}`;
      const drafted = await test.request(
        maker.cookie,
        method,
        path,
        body(list.id),
      );
      expect(drafted.statusCode, drafted.body).toBe(200);
      await decide("rejection", { columns: [field.id], reason: "Keep it" });
      const resubmit = () =>
        test.request(maker.cookie, "DELETE", `${path}/draft/rejection`);

      // When its maker still changes people but no longer sees Personal details, then once they do
      await test.holdOnly(maker.id, ["people:edit", "people:view"]);
      expect((await resubmit()).statusCode).toBe(403);
      await test.holdOnly(maker.id, [
        "people:edit",
        "people:view",
        "personal:view",
      ]);
      expect((await resubmit()).statusCode).toBe(200);
    },
  );

  it("sends a rejected draft again, discards it, and refuses drafts that do not exist", async () => {
    const { list } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    await send("PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Renamed"),
      listId: list.id,
    });
    const notRejected = await send(
      "DELETE",
      `/api/people/columns/${field.id}/draft/rejection`,
    );
    expect(notRejected.statusCode).toBe(409);
    await decide("rejection", { columns: [field.id], reason: "Keep it" });
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}/draft/rejection`))
        .statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}/draft`))
        .statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}/draft`))
        .statusCode,
    ).toBe(404);
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      404,
    );
  });
});

describe("rejected drafts of columns", () => {
  it("are waiting again once changed or discarded, and show their reasons meanwhile", async () => {
    const { list } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    await send("PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Renamed"),
      listId: list.id,
    });
    await decide("rejection", { columns: [field.id], reason: "First" });
    await decide("rejection", { columns: [field.id], reason: "Second" });
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).toMatchObject({ draft: { state: "rejected", reason: "Second" } });
    await send("PUT", `/api/people/columns/${field.id}`, {
      name: unique("Fictional Renamed"),
      listId: list.id,
    });
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).toMatchObject({ draft: { state: "waiting" } });
    await decide("rejection", { columns: [field.id], reason: "Third" });
    // Rejecting it again for the same reason changes nothing.
    expect(
      (await decide("rejection", { columns: [field.id], reason: "Third" }))
        .statusCode,
    ).toBe(200);
    await send("DELETE", `/api/people/columns/${field.id}/draft`);
  });
});

describe("drafts of columns written without the change history", () => {
  it("are shown without who made them", async () => {
    const { list } = await liveList(["A"]);
    const field = await liveColumn(list.id);
    await test.connection.insert(drafts).values({
      recordType: "field",
      recordId: field.id,
      action: "changed",
      fields: { name: unique("Fictional Unrecorded") },
    });
    const read = await readPeople();
    expect(read.fields.find(({ id }) => id === field.id)?.draft).toMatchObject({
      madeBy: null,
      madeAt: null,
      editors: [],
      changedBy: { name: null },
    });
    await send("DELETE", `/api/people/columns/${field.id}/draft`);
  });
});

describe("what decides and keeps column drafts safe", () => {
  it("needs an Approver who sees a list's values to decide drafts of its choices", async () => {
    const { list, choices } = await liveList(["A"], "personal");
    const [first] = choices;
    await send("PUT", `/api/lists/${list.id}/choices/${String(first?.id)}`, {
      label: unique("Fictional Renamed"),
      description: "",
    });
    const generalOnly = await test.signedIn([
      "configuration:approve",
      "people:view",
    ]);
    const asked = { choices: [String(first?.id)] };
    for (const [asking, body] of [
      ["approval", asked],
      ["rejection", { ...asked, reason: "No" }],
    ] as const) {
      const response = await decide(asking, body, generalOnly.cookie);
      expect(response.statusCode).toBe(403);
      expect(response.json<{ error: string }>().error).toBe(
        "One of these drafts is of a list whose details this role can't see, so an Approver who sees them must decide it",
      );
    }
    expect((await decide("approval", asked)).statusCode).toBe(200);
  });

  it("needs an Approver who sees people, and the column's values", async () => {
    const { list } = await liveList(["A"], "personal");
    const { field } = await draftColumn(list.id);
    const listsOnly = await test.signedIn(generalApprover);
    expect(
      (await decide("approval", { columns: [field.id] }, listsOnly.cookie))
        .statusCode,
    ).toBe(403);
    const generalOnly = await test.signedIn([
      "configuration:approve",
      "people:view",
    ]);
    expect(
      (
        await decide(
          "rejection",
          { columns: [field.id], reason: "No" },
          generalOnly.cookie,
        )
      ).statusCode,
    ).toBe(403);
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      200,
    );
  });

  it("keeps a list a column draft draws on from being deleted or retired", async () => {
    const { list } = await liveList(["A"]);
    const { field } = await draftColumn(list.id);
    const deleted = await send("DELETE", `/api/lists/${list.id}`);
    expect(deleted.statusCode).toBe(409);
    expect(deleted.json<{ error: string }>().error).toContain(field.name);
    expect(
      (await send("PUT", `/api/lists/${list.id}/retired`, { retired: true }))
        .statusCode,
    ).toBe(409);
  });

  it("refuses to undo into a column draft that drafting would refuse", async () => {
    const { list, choices } = await liveList(["A"]);
    const column = await liveColumn(list.id);
    const removed = await send("DELETE", `/api/people/columns/${column.id}`);
    expect(removed.statusCode).toBe(200);
    const discarded = await send(
      "DELETE",
      `/api/people/columns/${column.id}/draft`,
    );
    const { changeSetId } = discarded.json<{ changeSetId: string }>();
    // Meanwhile a draft gives someone a value in the column.
    const person = await livePerson();
    const given = await send("PATCH", `/api/people/${person}`, {
      values: { [column.id]: [String(choices[0]?.id)] },
    });
    expect(given.statusCode, given.body).toBe(200);
    expect((await send("POST", `/api/undo/${changeSetId}`)).statusCode).toBe(
      409,
    );

    const other = await liveList(["B"]);
    const renamed = await send("PUT", `/api/people/columns/${column.id}`, {
      name: unique("Fictional Renamed"),
      listId: other.list.id,
    });
    expect(renamed.statusCode, renamed.body).toBe(409);
  });
});

describe("columns drawing on lists drafted to be added", () => {
  async function addedList() {
    const response = await send("POST", "/api/lists", {
      name: unique("Fictional List"),
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ list: List; changeSetId: string }>();
  }

  const liveListRow = async (id: string) =>
    (await test.connection.select().from(lists).where(eq(lists.id, id))).at(0);

  it("drafts a column on a list drafted to be added, and approves the list with the column", async () => {
    const { list } = await addedList();
    const { field } = await draftColumn(list.id);
    expect(
      (await readPeople()).fields.find(({ id }) => id === field.id),
    ).toMatchObject({ listId: list.id, draft: { action: "created" } });
    const approved = await decide("approval", { columns: [field.id] });
    expect(approved.statusCode, approved.body).toBe(200);
    expect(await liveListRow(list.id)).toMatchObject({ name: list.name });
    expect(await liveField(field.id)).toMatchObject({ listId: list.id });
    expect(await test.historyOf(list.id)).toContainEqual(
      expect.objectContaining({ action: "created", madeBy: approver.id }),
    );
  });

  it("moves a column's draft onto a list drafted to be added", async () => {
    const { list: live } = await liveList(["A"]);
    const { field } = await draftColumn(live.id);
    const { list } = await addedList();
    const moved = await send("PUT", `/api/people/columns/${field.id}`, {
      name: field.name,
      listId: list.id,
    });
    expect(moved.statusCode, moved.body).toBe(200);
    expect((await decide("approval", { columns: [field.id] })).statusCode).toBe(
      200,
    );
    expect(await liveField(field.id)).toMatchObject({ listId: list.id });
  });

  it("refuses a list drafted to be removed", async () => {
    const removed = await liveList(["B"]);
    await send("DELETE", `/api/lists/${removed.list.id}`);
    expect(
      (
        await send("POST", "/api/people/columns", {
          name: unique("Fictional Column"),
          listId: removed.list.id,
        })
      ).statusCode,
    ).toBe(400);
  });

  it("rejects the list only together with the column, and approves neither while the list is rejected", async () => {
    const { list } = await addedList();
    const { field } = await draftColumn(list.id);
    const alone = await decide("rejection", {
      lists: [list.id],
      reason: "Not yet",
    });
    expect(alone.statusCode).toBe(409);
    expect(alone.json<{ error: string }>().error).toContain(
      "Reject them together",
    );
    expect(
      (
        await decide("rejection", {
          lists: [list.id],
          columns: [field.id],
          reason: "Not yet",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}/draft/rejection`))
        .statusCode,
    ).toBe(200);
    const approved = await decide("approval", { columns: [field.id] });
    expect(approved.statusCode).toBe(409);
    expect(approved.json<{ error: string }>().error).toContain("rejected");
    expect(await liveListRow(list.id)).toBeUndefined();
    expect(await liveField(field.id)).toBeUndefined();
    await send("DELETE", `/api/people/columns/${field.id}/draft`);
    await send("DELETE", `/api/lists/${list.id}/draft`);
  });

  it("keeps a list drafted to be added that a column draws on from being discarded, deleted, or undone", async () => {
    const { list, changeSetId } = await addedList();
    const { field } = await draftColumn(list.id);
    for (const [method, url] of [
      ["DELETE", `/api/lists/${list.id}/draft`],
      ["DELETE", `/api/lists/${list.id}`],
      ["POST", `/api/undo/${changeSetId}`],
    ] as const) {
      const refused = await send(method, url);
      expect(refused.statusCode, url).toBe(409);
    }
    expect(
      (await send("DELETE", `/api/people/columns/${field.id}`)).statusCode,
    ).toBe(200);
    expect(
      (await send("DELETE", `/api/lists/${list.id}/draft`)).statusCode,
    ).toBe(200);
  });
});
