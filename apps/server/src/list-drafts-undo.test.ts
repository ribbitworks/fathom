// SPDX-License-Identifier: Apache-2.0

// Tests for undoing changes to drafts of lists, choices, and the order of lists' choices, against a
// PostgreSQL server of their own: edits to drafts, refusals, and changes saved before lists had
// drafts.

import { listItems, lists } from "@fathom/db";
import type { List } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actorWith } from "./access.ts";
import { recordChanges } from "./data/changes.ts";
import { unique } from "./test-app.ts";
import {
  approver,
  changeSetOf,
  closeListDraftTests,
  columnOn,
  decide,
  draftChoices,
  draftList,
  editor,
  liveChoices,
  liveList,
  move,
  personWith,
  readList,
  send,
  startListDraftTests,
  test,
  undo,
} from "./test-list-drafts.ts";

beforeAll(startListDraftTests);

afterAll(closeListDraftTests);

// The editor as an actor whose changes are recorded without a role, as before roles were recorded.
const editorActor = () => actorWith({ id: editor.id, name: "", email: "" }, []);

describe("undoing edits to drafts of lists", () => {
  it("puts back a choice's draft, and takes out a list's draft that added it", async () => {
    const { list, choices } = await liveList(["A"]);
    const renamed = await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`,
      { label: "Alpha" },
    );
    const { changeSetId } = renamed.json<{ changeSetId: string }>();
    const undone = await test.request(
      editor.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    expect(undone.statusCode).toBe(200);
    expect((await readList(list.id))?.choices[0]).not.toHaveProperty("draft");

    const created = await test.request(editor.cookie, "POST", "/api/lists", {
      name: unique("Fictional Undone"),
    });
    const { list: added, changeSetId: addedIn } = created.json<{
      list: List;
      changeSetId: string;
    }>();
    await test.request(editor.cookie, "POST", `/api/undo/${addedIn}`);
    expect(await readList(added.id)).toBeUndefined();
  });

  it("puts back an order's draft", async () => {
    const { list, choices } = await liveList(["A", "B"]);
    const moved = await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(choices[1]?.id)}/position`,
      { after: null },
    );
    const { changeSetId } = moved.json<{ changeSetId: string }>();
    expect((await readList(list.id))?.orderDraft).toBeDefined();
    await test.request(editor.cookie, "POST", `/api/undo/${changeSetId}`);
    expect(await readList(list.id)).not.toHaveProperty("orderDraft");
  });

  it("refuses undoing an approval", async () => {
    const list = await draftList();
    const approved = await decide("approval", { lists: [list.id] });
    const { changeSetId } = approved.json<{ changeSetId: string }>();
    const undone = await test.request(
      approver.cookie,
      "POST",
      `/api/undo/${changeSetId}`,
    );
    expect(undone.statusCode).toBe(409);
  });
});

describe("undoing changes to drafts of lists, refused", () => {
  it("puts back a rejection undone with sending it again, and refuses an order of a list drafted to be removed", async () => {
    const { list, choices } = await liveList(["A", "B"]);
    await move(list.id, String(choices[1]?.id), null);
    await decide("rejection", { orders: [list.id], reason: "Not now" });
    const resubmitted = changeSetOf(
      await send("DELETE", `/api/lists/${list.id}/order/draft/rejection`),
    );
    expect((await undo(resubmitted)).statusCode).toBe(200);
    expect((await readList(list.id))?.orderDraft).toMatchObject({
      state: "rejected",
      reason: "Not now",
    });
    const discarded = changeSetOf(
      await send("DELETE", `/api/lists/${list.id}/order/draft`),
    );
    await send("DELETE", `/api/lists/${list.id}`);
    expect((await undo(discarded)).statusCode).toBe(409);
  });

  it("refuses putting back a choice whose list is gone, or whose name is taken since", async () => {
    const list = await draftList();
    const [x] = await draftChoices(list.id, ["X"]);
    const gone = changeSetOf(
      await send("DELETE", `/api/lists/${list.id}/choices/${String(x?.id)}`),
    );
    await send("DELETE", `/api/lists/${list.id}`);
    expect((await undo(gone)).statusCode).toBe(409);

    const other = (await liveList(["A"])).list;
    const [y] = await draftChoices(other.id, ["Y"]);
    const taken = changeSetOf(
      await send("DELETE", `/api/lists/${other.id}/choices/${String(y?.id)}`),
    );
    await draftChoices(other.id, ["Y"]);
    expect((await undo(taken)).statusCode).toBe(409);
  });

  it("refuses putting back a removal of a list a column draws on, or whose choices have drafts, or of a choice someone has", async () => {
    const used = (await liveList(["A"])).list;
    await send("DELETE", `/api/lists/${used.id}`);
    const usedDiscard = changeSetOf(
      await send("DELETE", `/api/lists/${used.id}/draft`),
    );
    await columnOn(used.id);
    expect((await undo(usedDiscard)).statusCode).toBe(409);

    const busy = (await liveList(["A"])).list;
    await send("DELETE", `/api/lists/${busy.id}`);
    const busyDiscard = changeSetOf(
      await send("DELETE", `/api/lists/${busy.id}/draft`),
    );
    await draftChoices(busy.id, ["B"]);
    expect((await undo(busyDiscard)).statusCode).toBe(409);

    const { list, choices } = await liveList(["A"]);
    const field = await columnOn(list.id);
    const a = String(choices[0]?.id);
    await send("DELETE", `/api/lists/${list.id}/choices/${a}`);
    const choiceDiscard = changeSetOf(
      await send("DELETE", `/api/lists/${list.id}/choices/${a}/draft`),
    );
    await personWith(field.id, a);
    expect((await undo(choiceDiscard)).statusCode).toBe(409);
  });
});

describe("undoing changes to lists saved before lists had drafts", () => {
  const legacy = (made: Parameters<typeof recordChanges>[2]) =>
    test.connection.transaction((transaction) =>
      recordChanges(transaction, editorActor(), made),
    );
  const field = (
    recordType: "list" | "list-item",
    recordId: string,
    action: "created" | "changed" | "deleted",
    name: string,
    oldValue: unknown,
    newValue: unknown,
  ) => ({
    recordType,
    recordId,
    action,
    field: name,
    tier: "general" as const,
    oldValue,
    newValue,
  });

  it("puts back a deleted choice in its place, a moved one at the top, and a list's retirement", async () => {
    const { list, choices } = await liveList(["A", "B", "C"]);
    const [a, b, c] = choices.map(({ id }) => id);
    await test.connection
      .delete(listItems)
      .where(eq(listItems.id, c as string));
    const deleted = await legacy([
      field("list-item", c as string, "deleted", "listId", list.id, null),
      field("list-item", c as string, "deleted", "label", "C", null),
      field("list-item", c as string, "deleted", "description", "", null),
      field("list-item", c as string, "deleted", "retired", false, null),
      field("list-item", c as string, "deleted", "order", a, null),
    ]);
    expect((await undo(String(deleted))).statusCode).toBe(200);
    expect((await liveChoices(list.id)).map(({ label }) => label)).toEqual([
      "A",
      "C",
      "B",
    ]);
    const moved = await legacy([
      field("list-item", b as string, "changed", "order", null, c),
    ]);
    expect((await undo(String(moved))).statusCode).toBe(200);
    expect((await liveChoices(list.id)).map(({ label }) => label)).toEqual([
      "B",
      "A",
      "C",
    ]);
    const gone = await legacy([
      field("list-item", a as string, "changed", "order", randomUUID(), b),
    ]);
    expect((await undo(String(gone))).statusCode).toBe(200);
    expect((await liveChoices(list.id)).at(-1)?.label).toBe("A");
    const restored = await legacy([
      field("list", list.id, "changed", "retired", true, false),
    ]);
    expect((await undo(String(restored))).statusCode).toBe(200);
    expect(
      await test.connection
        .select({ retired: lists.retired })
        .from(lists)
        .where(eq(lists.id, list.id)),
    ).toEqual([{ retired: true }]);
  });

  it("brings back a deleted list in the class it had, the most sensitive when unknown", async () => {
    for (const [stored, expected] of [
      ["personal", "personal"],
      ["secret", "confidential"],
    ]) {
      const id = randomUUID();
      const deleted = await legacy([
        field("list", id, "deleted", "name", unique("Fictional List"), null),
        field("list", id, "deleted", "description", "", null),
        field("list", id, "deleted", "visibility", stored, null),
        field("list", id, "deleted", "retired", false, null),
      ]);
      expect((await undo(String(deleted))).statusCode).toBe(200);
      expect(
        await test.connection
          .select({ visibility: lists.visibility })
          .from(lists)
          .where(eq(lists.id, id)),
      ).toEqual([{ visibility: expected }]);
    }
  });

  it("refuses taking out a list that has choices, a choice a draft has, and a name taken since", async () => {
    const { list, choices } = await liveList(["A"]);
    const created = await legacy([
      field("list", list.id, "created", "name", null, list.name),
    ]);
    expect((await undo(String(created))).statusCode).toBe(409);
    const columnField = await columnOn(list.id);
    const a = String(choices[0]?.id);
    await personWith(columnField.id, a);
    const choiceCreated = await legacy([
      field("list-item", a, "created", "label", null, "A"),
    ]);
    expect((await undo(String(choiceCreated))).statusCode).toBe(409);
    const taken = (await liveList(["B"])).list;
    const renamed = await legacy([
      field("list", list.id, "changed", "name", taken.name, list.name),
    ]);
    expect((await undo(String(renamed))).statusCode).toBe(409);
  });
});
