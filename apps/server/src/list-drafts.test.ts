// SPDX-License-Identifier: Apache-2.0

// Tests for drafts of lists, choices, and the order of lists' choices, against a PostgreSQL server
// of their own: approving and rejecting them with the drafts they use or that use them, discarding
// and resending them, their names, removals, the roles they are made under, and refusals.

import {
  changes,
  changeSets,
  drafts,
  lists,
  rolePermissions,
  roles,
  userRoles,
} from "@fathom/db";
import type { List } from "@fathom/shared";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findStartingRole } from "./data/roles.ts";
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

const draftsOf = (recordId: string) =>
  test.connection.select().from(drafts).where(eq(drafts.recordId, recordId));

describe("approving drafts of lists", () => {
  it("approving a choice added to a list drafted to be added approves the list too", async () => {
    const list = await draftList();
    const [first, second] = await draftChoices(list.id, ["North", "South"]);
    const response = await decide("approval", {
      choices: [String(second?.id)],
    });
    expect(response.statusCode).toBe(200);
    expect(
      await test.connection.select().from(lists).where(eq(lists.id, list.id)),
    ).toHaveLength(1);
    expect(await liveChoices(list.id)).toEqual([
      { label: "South", position: 1 },
    ]);
    // The other choice still waits, now in a live list.
    expect((await readList(list.id))?.choices).toMatchObject([
      { label: "South" },
      { id: first?.id, label: "North", draft: { action: "created" } },
    ]);
    expect(await draftsOf(list.id)).toEqual([]);
  });

  it("applies a renamed choice and a new order only once approved", async () => {
    const { list, choices } = await liveList(["A", "B", "C"]);
    const [a, , c] = choices;
    await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(a?.id)}`,
      { label: "Alpha" },
    );
    await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(c?.id)}/position`,
      { after: null },
    );
    const drafted = await readList(list.id);
    expect(drafted?.choices.map(({ label }) => label)).toEqual([
      "C",
      "Alpha",
      "B",
    ]);
    expect(drafted?.orderDraft).toMatchObject({
      live: choices.map(({ id }) => id),
      state: "waiting",
    });
    expect((await liveChoices(list.id)).map(({ label }) => label)).toEqual([
      "A",
      "B",
      "C",
    ]);
    const response = await decide("approval", {
      choices: [String(a?.id)],
      orders: [list.id],
    });
    expect(response.statusCode).toBe(200);
    expect((await liveChoices(list.id)).map(({ label }) => label)).toEqual([
      "C",
      "Alpha",
      "B",
    ]);
    expect(await readList(list.id)).not.toHaveProperty("orderDraft");
  });

  it("approving an order that places a choice drafted to be added approves the choice", async () => {
    const { list } = await liveList(["A", "B"]);
    const [added] = await draftChoices(list.id, ["New"]);
    await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(added?.id)}/position`,
      { after: null },
    );
    expect((await decide("approval", { orders: [list.id] })).statusCode).toBe(
      200,
    );
    expect((await liveChoices(list.id)).map(({ label }) => label)).toEqual([
      "New",
      "A",
      "B",
    ]);
  });

  it("an order that only adds choices at the end, in the order drafted, needs no draft", async () => {
    const { list } = await liveList(["A"]);
    await draftChoices(list.id, ["B", "C"]);
    expect(await readList(list.id)).not.toHaveProperty("orderDraft");
  });

  it("refuses those who may not approve", async () => {
    const list = await draftList();
    const response = await decide(
      "approval",
      { lists: [list.id] },
      editor.cookie,
    );
    expect(response.statusCode).toBe(403);
  });

  it("refuses drafts that do not exist", async () => {
    const { list } = await liveList(["A"]);
    expect((await decide("approval", { lists: [list.id] })).statusCode).toBe(
      404,
    );
  });
});

describe("rejecting drafts of lists", () => {
  it("rejects a list drafted to be added only together with the choices that use it", async () => {
    const list = await draftList();
    const [choice] = await draftChoices(list.id, ["North"]);
    const alone = await decide("rejection", {
      lists: [list.id],
      reason: "Not needed",
    });
    expect(alone.statusCode).toBe(409);
    const together = await decide("rejection", {
      lists: [list.id],
      choices: [String(choice?.id)],
      reason: "Not needed",
    });
    expect(together.statusCode).toBe(200);
    const read = await readList(list.id);
    expect(read?.draft).toMatchObject({
      state: "rejected",
      reason: "Not needed",
    });
    expect(read?.choices[0]?.draft).toMatchObject({ state: "rejected" });
  });

  it("approves a choice only once the rejected list it is added to is sent again", async () => {
    const list = await draftList();
    const [choice] = await draftChoices(list.id, ["North"]);
    await decide("rejection", {
      lists: [list.id],
      choices: [String(choice?.id)],
      reason: "Not yet",
    });
    await test.request(
      editor.cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(choice?.id)}/draft/rejection`,
    );
    const waiting = await decide("approval", { choices: [String(choice?.id)] });
    expect(waiting.statusCode).toBe(409);
    expect(waiting.json()).toEqual({
      error:
        "One of these drafts, or one it depends on, was rejected; it can be approved once that draft is resubmitted",
    });
    await test.request(
      editor.cookie,
      "DELETE",
      `/api/lists/${list.id}/draft/rejection`,
    );
    expect(
      (await decide("approval", { choices: [String(choice?.id)] })).statusCode,
    ).toBe(200);
  });

  it("sends a rejected draft for approval again, and discarding a list drafted to be added discards its choices", async () => {
    const list = await draftList();
    const [choice] = await draftChoices(list.id, ["North"]);
    await decide("rejection", {
      lists: [list.id],
      choices: [String(choice?.id)],
      reason: "Check the name",
    });
    const resubmitted = await test.request(
      editor.cookie,
      "DELETE",
      `/api/lists/${list.id}/draft/rejection`,
    );
    expect(resubmitted.statusCode).toBe(200);
    expect((await readList(list.id))?.draft).toMatchObject({
      state: "waiting",
    });
    const discarded = await test.request(
      editor.cookie,
      "DELETE",
      `/api/lists/${list.id}/draft`,
    );
    expect(discarded.statusCode).toBe(200);
    expect(await readList(list.id)).toBeUndefined();
    expect(await draftsOf(String(choice?.id))).toEqual([]);
  });
});

describe("names and removals in drafts", () => {
  it("takes a list's name while a draft has it, and keeps a live name taken until its rename is approved", async () => {
    const name = unique("Fictional Taken");
    await draftList(name);
    const again = await test.request(editor.cookie, "POST", "/api/lists", {
      name: name.toUpperCase(),
    });
    expect(again.statusCode).toBe(409);
    const list = await draftList();
    await decide("approval", { lists: [list.id] });
    const live = await readList(list.id);
    await test.request(editor.cookie, "PUT", `/api/lists/${list.id}`, {
      name: unique("Fictional Renamed"),
    });
    const reuse = await test.request(editor.cookie, "POST", "/api/lists", {
      name: String(live?.name),
    });
    expect(reuse.statusCode).toBe(409);
  });

  it("drafts deleting a live list, which stays until approved, and cannot be changed meanwhile", async () => {
    const { list, choices } = await liveList(["A"]);
    const deleted = await test.request(
      editor.cookie,
      "DELETE",
      `/api/lists/${list.id}`,
    );
    expect(deleted.statusCode).toBe(200);
    expect((await readList(list.id))?.draft).toMatchObject({
      action: "deleted",
    });
    const changed = await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`,
      { label: "B" },
    );
    expect(changed.statusCode).toBe(409);
    expect((await decide("approval", { lists: [list.id] })).statusCode).toBe(
      200,
    );
    expect(await readList(list.id)).toBeUndefined();
    expect(await liveChoices(list.id)).toEqual([]);
  });

  it("refuses drafting the deletion of a list whose choices have drafts", async () => {
    const { list } = await liveList(["A"]);
    await draftChoices(list.id, ["B"]);
    const deleted = await test.request(
      editor.cookie,
      "DELETE",
      `/api/lists/${list.id}`,
    );
    expect(deleted.statusCode).toBe(409);
  });
});

describe("discarding drafts and sending them again", () => {
  it("sends a rejected order again, discards it, and refuses drafts that are not there", async () => {
    const { list, choices } = await liveList(["A", "B"]);
    await move(list.id, String(choices[1]?.id), null);
    await decide("rejection", { orders: [list.id], reason: "Not now" });
    const order = `/api/lists/${list.id}/order/draft`;
    expect((await send("DELETE", `${order}/rejection`)).statusCode).toBe(200);
    expect((await readList(list.id))?.orderDraft?.state).toBe("waiting");
    expect((await send("DELETE", `${order}/rejection`)).statusCode).toBe(409);
    expect((await send("DELETE", order)).statusCode).toBe(200);
    expect(await readList(list.id)).not.toHaveProperty("orderDraft");
    expect((await send("DELETE", order)).statusCode).toBe(404);
    expect(
      (await send("DELETE", `/api/lists/${randomUUID()}/draft`)).statusCode,
    ).toBe(404);
    expect(
      (
        await send(
          "DELETE",
          `/api/lists/${list.id}/choices/${randomUUID()}/draft`,
        )
      ).statusCode,
    ).toBe(404);
  });

  it("sends a rejected choice again, and discards drafting the removal of a live choice", async () => {
    const { list, choices } = await liveList(["A"]);
    const choice = `/api/lists/${list.id}/choices/${String(choices[0]?.id)}`;
    await send("PUT", choice, { label: "Alpha" });
    await decide("rejection", {
      choices: [String(choices[0]?.id)],
      reason: "Keep A",
    });
    expect((await send("DELETE", `${choice}/draft/rejection`)).statusCode).toBe(
      200,
    );
    expect((await send("DELETE", choice)).statusCode).toBe(200);
    expect((await readList(list.id))?.choices[0]?.draft?.action).toBe(
      "deleted",
    );
    expect((await send("DELETE", `${choice}/draft`)).statusCode).toBe(200);
    expect((await readList(list.id))?.choices[0]).not.toHaveProperty("draft");
  });

  it("discards a list drafted to be added with its choices and their order, and a live list's draft", async () => {
    const list = await draftList();
    const [x, y] = await draftChoices(list.id, ["X", "Y"]);
    await move(list.id, String(y?.id), null);
    expect((await readList(list.id))?.orderDraft).toBeDefined();
    expect(
      (await send("DELETE", `/api/lists/${list.id}/draft`)).statusCode,
    ).toBe(200);
    expect(await draftsOf(list.id)).toEqual([]);
    expect(await draftsOf(String(x?.id))).toEqual([]);

    const live = (await liveList(["A"])).list;
    await send("PUT", `/api/lists/${live.id}`, { name: unique("Renamed") });
    await send("DELETE", `/api/lists/${live.id}/draft`);
    expect((await readList(live.id))?.name).toBe(live.name);
  });

  it("refuses changes to a removed choice, a choice in another list, and moves that go nowhere", async () => {
    const { list, choices } = await liveList(["A", "B"]);
    const [a, b] = choices.map(({ id }) => id);
    const other = (await liveList(["C"])).list;
    await send("DELETE", `/api/lists/${list.id}/choices/${String(a)}`);
    expect(
      (
        await send("PUT", `/api/lists/${list.id}/choices/${String(a)}`, {
          label: "Z",
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await send("PUT", `/api/lists/${other.id}/choices/${String(b)}`, {
          label: "Z",
        })
      ).statusCode,
    ).toBe(404);
    expect((await move(list.id, String(b), String(b))).statusCode).toBe(400);
    expect((await move(list.id, String(b), randomUUID())).statusCode).toBe(400);
    const unmoved = await move(list.id, String(b), String(a));
    expect(unmoved.json()).toEqual({ changeSetId: null });
  });
});

describe("drafts made under several roles", () => {
  // The roles each change set to a list was made as, oldest first.
  const madeAs = async (id: string) =>
    (
      await test.connection
        .selectDistinct({
          kind: changeSets.kind,
          roleId: changeSets.madeAsRoleId,
          madeAt: changeSets.madeAt,
        })
        .from(changes)
        .innerJoin(changeSets, eq(changeSets.id, changes.changeSetId))
        .where(and(eq(changes.recordId, id), eq(changeSets.unpublished, false)))
        .orderBy(asc(changeSets.madeAt))
    ).map(({ kind, roleId }) => ({ kind, roleId }));

  it("records the role each change was made as, and refuses its maker approving it under another role", async () => {
    const person = await test.signedIn("workforce-administrator");
    const [approving] = await test.connection
      .insert(roles)
      .values({ name: unique("Fictional Approving Role") })
      .returning({ id: roles.id });
    const approvingId = String(approving?.id);
    await test.connection
      .insert(rolePermissions)
      .values(
        (
          [
            "configuration:approve",
            "configuration:view",
            "people:view",
          ] as const
        ).map((permission) => ({ roleId: approvingId, permission })),
      );
    await test.connection
      .insert(userRoles)
      .values({ userId: person.id, roleId: approvingId });
    const drafted = await test.request(person.cookie, "POST", "/api/lists", {
      name: unique("Fictional List"),
    });
    const { list } = drafted.json<{ list: List }>();
    const switched = await test.request(
      person.cookie,
      "PUT",
      "/api/session/role",
      { roleId: approvingId },
      { publish: false },
    );
    expect(switched.statusCode, switched.body).toBe(204);
    const refused = await decide(
      "approval",
      { lists: [list.id] },
      person.cookie,
    );
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toEqual({
      error: "Drafts changed by the approver need another approver",
    });
    expect((await decide("approval", { lists: [list.id] })).statusCode).toBe(
      200,
    );
    const [approverRole] = await test.connection
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, approver.id));
    expect(await madeAs(list.id)).toEqual([
      {
        kind: "edit",
        roleId: await findStartingRole(
          test.connection,
          "workforce-administrator",
        ),
      },
      { kind: "approval", roleId: approverRole?.roleId },
    ]);
  });
});

describe("approving and rejecting drafts of lists, refused", () => {
  it("refuses approving the retiring of a list a column now draws on", async () => {
    const { list } = await liveList(["A"]);
    await send("PUT", `/api/lists/${list.id}/retired`, { retired: true });
    await columnOn(list.id);
    expect((await decide("approval", { lists: [list.id] })).statusCode).toBe(
      409,
    );
  });

  it("refuses approving the removal of a choice a person's draft has", async () => {
    const { list, choices } = await liveList(["A"]);
    const field = await columnOn(list.id);
    const a = String(choices[0]?.id);
    await send("DELETE", `/api/lists/${list.id}/choices/${a}`);
    await personWith(field.id, a);
    expect((await decide("approval", { choices: [a] })).statusCode).toBe(409);
  });

  it("refuses approving the removal of a list whose choices have drafts", async () => {
    const { list } = await liveList(["A"]);
    await send("DELETE", `/api/lists/${list.id}`);
    // Drafting refuses this, so it is made directly, as another version of Fathom might have.
    await test.connection.insert(drafts).values({
      recordType: "list-item",
      recordId: randomUUID(),
      action: "created",
      fields: {
        listId: list.id,
        label: "Stray",
        description: "",
        retired: false,
      },
    });
    expect((await decide("approval", { lists: [list.id] })).statusCode).toBe(
      409,
    );
  });

  it("refuses drafts of choices and orders that are not there, and rejecting a choice an order uses alone", async () => {
    const { list, choices } = await liveList(["A"]);
    expect(
      (await decide("approval", { choices: [String(choices[0]?.id)] }))
        .statusCode,
    ).toBe(404);
    expect((await decide("approval", { orders: [list.id] })).statusCode).toBe(
      404,
    );
    const [added] = await draftChoices(list.id, ["New"]);
    await move(list.id, String(added?.id), null);
    expect(
      (
        await decide("rejection", {
          choices: [String(added?.id)],
          reason: "No",
        })
      ).statusCode,
    ).toBe(409);
  });

  it("records nothing when rejecting again for the same reason, and the old reason for another", async () => {
    const list = await draftList();
    const reject = (reason: string) =>
      decide("rejection", { lists: [list.id], reason });
    await reject("First");
    expect((await reject("First")).json()).toEqual({ changeSetId: null });
    await reject("Second");
    expect((await test.historyOf(list.id)).at(-1)).toMatchObject({
      field: "rejected",
      oldValue: "First",
      newValue: "Second",
    });
  });
});

describe("drafts of lists, further cases", () => {
  it("leaves out a draft of a list that is not there, and names no one for a draft without history", async () => {
    const { list, choices } = await liveList(["A", "B"]);
    const ghost = randomUUID();
    await test.connection.insert(drafts).values([
      {
        recordType: "list",
        recordId: ghost,
        action: "changed",
        fields: { name: "Fictional Ghost" },
      },
      {
        recordType: "choice-order",
        recordId: list.id,
        action: "changed",
        fields: { order: [choices[1]?.id, choices[0]?.id] },
      },
    ]);
    expect(await readList(ghost)).toBeUndefined();
    expect((await readList(list.id))?.orderDraft).toMatchObject({
      madeBy: null,
      madeAt: null,
    });
    await send("DELETE", `/api/lists/${list.id}/order/draft`);
    await test.connection.delete(drafts).where(eq(drafts.recordId, ghost));
  });

  it("orders lists whose names differ only in accents the same way every time", async () => {
    const plain = await draftList(unique("Fictional Cafe"));
    const accented = await draftList(plain.name.replace("Cafe", "Café"));
    const response = await send("GET", "/api/lists");
    const ids = response
      .json<{ lists: List[] }>()
      .lists.map(({ id }) => id)
      .filter((id) => id === plain.id || id === accented.id);
    expect(ids).toEqual([plain.id, accented.id].sort());
  });

  it("clears a rejection when the draft is changed again, discarded, or its order moved again", async () => {
    const list = await draftList();
    await decide("rejection", { lists: [list.id], reason: "Rename it" });
    await send("PUT", `/api/lists/${list.id}`, { name: unique("Renamed") });
    expect((await readList(list.id))?.draft?.state).toBe("waiting");
    await decide("rejection", { lists: [list.id], reason: "Still no" });
    await send("DELETE", `/api/lists/${list.id}/draft`);
    expect(await readList(list.id)).toBeUndefined();

    const live = await liveList(["A", "B", "C"]);
    const [, b, c] = live.choices.map(({ id }) => id);
    await move(live.list.id, c as string, null);
    await decide("rejection", { orders: [live.list.id], reason: "Not so" });
    await move(live.list.id, b as string, null);
    expect((await readList(live.list.id))?.orderDraft?.state).toBe("waiting");
  });

  it("rejects a list drafted to be added only with the order of its choices too", async () => {
    const list = await draftList();
    const [x, y] = await draftChoices(list.id, ["X", "Y"]);
    await move(list.id, String(y?.id), null);
    const asked = {
      lists: [list.id],
      choices: [String(x?.id), String(y?.id)],
      reason: "Not needed",
    };
    expect((await decide("rejection", asked)).statusCode).toBe(409);
    expect(
      (await decide("rejection", { ...asked, orders: [list.id] })).statusCode,
    ).toBe(200);
  });

  it("puts back a discarded list drafted to be added with its choices, and a discarded removal of a live list", async () => {
    const list = await draftList();
    const [x] = await draftChoices(list.id, ["X"]);
    const discarded = changeSetOf(
      await send("DELETE", `/api/lists/${list.id}`),
    );
    expect((await undo(discarded)).statusCode).toBe(200);
    expect((await readList(list.id))?.choices.map(({ id }) => id)).toEqual([
      x?.id,
    ]);

    const live = (await liveList(["A"])).list;
    await send("DELETE", `/api/lists/${live.id}`);
    const kept = changeSetOf(
      await send("DELETE", `/api/lists/${live.id}/draft`),
    );
    expect((await undo(kept)).statusCode).toBe(200);
    expect((await readList(live.id))?.draft?.action).toBe("deleted");
  });
});

describe("drafts of an order that place choices drafted to be added", () => {
  it("says which added choices the order uses, and approving it approves just those", async () => {
    const { list } = await liveList(["X"]);
    const [a, b] = await draftChoices(list.id, ["A", "B"]);
    await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(b?.id)}/position`,
      { after: null },
    );
    expect((await readList(list.id))?.orderDraft?.uses).toEqual([b?.id]);
    expect((await decide("approval", { orders: [list.id] })).statusCode).toBe(
      200,
    );
    expect((await liveChoices(list.id)).map(({ label }) => label)).toEqual([
      "B",
      "X",
    ]);
    expect((await readList(list.id))?.choices).toMatchObject([
      { label: "B" },
      { label: "X" },
      { id: a?.id, draft: { action: "created" } },
    ]);
  });

  it("drops the order's draft once the added choice it placed is discarded", async () => {
    const { list } = await liveList(["X"]);
    const [added] = await draftChoices(list.id, ["A"]);
    await test.request(
      editor.cookie,
      "PUT",
      `/api/lists/${list.id}/choices/${String(added?.id)}/position`,
      { after: null },
    );
    expect((await readList(list.id))?.orderDraft).toBeDefined();
    await test.request(
      editor.cookie,
      "DELETE",
      `/api/lists/${list.id}/choices/${String(added?.id)}`,
    );
    expect(await readList(list.id)).not.toHaveProperty("orderDraft");
    expect(await draftsOf(list.id)).toEqual([]);
  });
});
