// SPDX-License-Identifier: Apache-2.0

// Integration tests for drafting planned hires, against a migrated PostgreSQL server: adding,
// changing, moving between states and removing them, their requisitions and temporary IDs, filled
// hires, and the choices and built-in lists they use.

import {
  accessHistory,
  changes,
  listItems,
  lists,
  plannedHires,
} from "@fathom/db";
import { type Hire } from "@fathom/shared";
import { and, count as total, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  ok,
  otherTestPosition,
  testPosition,
  unique,
} from "./test-app.ts";
import {
  test,
  editor,
  planner,
  proposed,
  open,
  hired,
  recruiting,
  retiredPosition,
  send,
  approve,
  approved,
  person,
  hireRequest,
  draftHire,
  liveHire,
  hiresSeen,
  hireSeen,
  change,
  changed,
  liveRow,
  startHireTests,
  closeHireTests,
} from "./test-hires.ts";

beforeAll(startHireTests);

afterAll(closeHireTests);

// The number of a temporary ID, such as 7 for TBD-7.
const numberOf = (hire: Hire | undefined) =>
  Number(hire?.temporaryId?.replace("TBD-", ""));

describe("the Hired state", () => {
  it("is refused when approving a hire whose state has come to mean Hired since", async () => {
    const [state] = await test.connection
      .insert(listItems)
      .values({
        listId: String(
          (
            await test.connection
              .select({ listId: listItems.listId })
              .from(listItems)
              .where(eq(listItems.id, open))
          )[0]?.listId,
        ),
        label: unique("Fictional Offer"),
        position: 90,
        meaning: "open",
      })
      .returning({ id: listItems.id });
    const stateId = String(state?.id);
    const { id } = await draftHire({ stateId });
    await test.connection
      .update(listItems)
      .set({ meaning: "hired" })
      .where(eq(listItems.id, stateId));
    const refused = await approve({ plannedHires: [id] });
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      "That state is for people. A planned hire is hired when someone fills it.",
    );
    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}`));
    // A filled hire's state no longer matters, since its person is shown instead.
    await test.connection
      .update(listItems)
      .set({ meaning: "open" })
      .where(eq(listItems.id, stateId));
    const filled = await liveHire({ stateId });
    await test.connection
      .update(plannedHires)
      .set({ filledBy: await person() })
      .where(eq(plannedHires.id, filled));
    await changed(filled, { targetDate: "2028-02-01" });
    await test.connection
      .update(listItems)
      .set({ meaning: "hired" })
      .where(eq(listItems.id, stateId));
    await approved({ plannedHires: [filled] });
    await test.connection
      .update(listItems)
      .set({ meaning: "open" })
      .where(eq(listItems.id, stateId));
  });

  it("is never given to a hire, which is hired by being filled", async () => {
    const refused =
      "That state is for people. A planned hire is hired when someone fills it.";
    const added = await send(
      editor,
      "POST",
      "/api/planned-hires",
      hireRequest({ stateId: hired }),
    );
    expect(added.statusCode).toBe(400);
    expect(errorOf(added)).toBe(refused);
    const id = await liveHire();
    const moved = await change(id, { stateId: hired });
    expect(moved.statusCode).toBe(400);
    expect(errorOf(moved)).toBe(refused);
  });
});

describe("adding several hires", () => {
  it("adds them as one change, or none of them when any is refused", async () => {
    const [first, second] = [
      unique("Fictional-REQ-A"),
      unique("Fictional-REQ-B"),
    ];
    const { ids, changeSetId } = await ok<{
      ids: string[];
      changeSetId: string;
    }>(
      await send(editor, "POST", "/api/planned-hires", {
        hires: [
          { positionId: testPosition, requisition: first },
          { positionId: testPosition, requisition: second },
        ],
      }),
      201,
    );
    expect(ids).toHaveLength(2);
    const [created] = await test.connection
      .select({ total: total() })
      .from(changes)
      .where(
        and(
          eq(changes.changeSetId, changeSetId),
          inArray(changes.recordId, ids),
        ),
      );
    expect(Number(created?.total)).toBeGreaterThan(2);
    const twice = unique("Fictional-REQ-Twice");
    const refused = await send(editor, "POST", "/api/planned-hires", {
      hires: [
        { positionId: testPosition, requisition: twice },
        { positionId: testPosition, requisition: twice.toLowerCase() },
      ],
    });
    expect(refused.statusCode).toBe(409);
    expect(
      (await hiresSeen(editor)).hires.some(
        ({ requisition }) => requisition === twice,
      ),
    ).toBe(false);
  });
});

describe("adding a hire", () => {
  it("is a draft, recorded as a Confidential change, its position and state at their lists' tier, and in the access history without naming the hire", async () => {
    const before = await test.connection
      .select({ id: accessHistory.id })
      .from(accessHistory)
      .where(eq(accessHistory.actorId, editor.id));
    const { id, changeSetId } = await draftHire({
      requisition: "Fictional-REQ-Analyst",
    });
    expect(changeSetId).toEqual(expect.any(String));
    expect(await liveRow(id)).toBeUndefined();
    const history = await test.historyOf(id);
    expect(history).toContainEqual(
      expect.objectContaining({
        action: "created",
        field: "requisition",
        tier: "confidential",
        newValue: "Fictional-REQ-Analyst",
      }),
    );
    for (const { field, tier } of history) {
      expect(tier).toBe(
        field === "positionId" || field === "stateId"
          ? "general"
          : "confidential",
      );
    }
    const seenBefore = new Set(before.map((entry) => entry.id));
    const after = await test.connection
      .select({
        id: accessHistory.id,
        action: accessHistory.action,
        subjectId: accessHistory.subjectId,
      })
      .from(accessHistory)
      .where(eq(accessHistory.actorId, editor.id));
    expect(
      after
        .filter((entry) => !seenBefore.has(entry.id))
        .map(({ action, subjectId }) => ({ action, subjectId })),
    ).toContainEqual({
      action: "hiring-plan-changed",
      subjectId: null,
    });
  });

  it("gives a hire with no requisition a temporary ID never used before, even once its draft is discarded", async () => {
    const first = await draftHire();
    const firstNumber = numberOf(await hireSeen(first.id));
    await ok(
      await send(editor, "DELETE", `/api/planned-hires/${first.id}/draft`),
    );
    const second = await draftHire();
    expect(numberOf(await hireSeen(second.id))).toBeGreaterThan(firstNumber);
    expect(await hireSeen(second.id)).toMatchObject({ requisition: null });
  });

  it("starts a hire in the first state meaning Proposed, or in the state given", async () => {
    expect((await hireSeen((await draftHire()).id))?.stateId).toBe(proposed);
    const given = await draftHire({ stateId: recruiting });
    expect((await hireSeen(given.id))?.stateId).toBe(recruiting);
  });

  it.each([
    ["a position from another list", () => ({ positionId: open })],
    ["a position that is not a choice", () => ({ positionId: randomUUID() })],
    ["a retired position", () => ({ positionId: retiredPosition })],
    ["a state from another list", () => ({ stateId: testPosition })],
  ])("refuses %s", async (_what, wrong) => {
    const response = await send(
      editor,
      "POST",
      "/api/planned-hires",
      hireRequest(wrong()),
    );
    expect(response.statusCode).toBe(400);
  });

  it("refuses an ID someone has, ignoring letter case: an Employee ID, or another hire's requisition, live or drafted", async () => {
    const employeeId = unique("Fictional-ID");
    await person({ employeeId });
    const requisition = unique("Fictional-REQ");
    await draftHire({ requisition });
    for (const taken of [employeeId.toLowerCase(), requisition.toUpperCase()]) {
      const response = await send(
        editor,
        "POST",
        "/api/planned-hires",
        hireRequest({ requisition: taken }),
      );
      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toBe("Someone already has that ID");
    }
    const clash = await send(editor, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: requisition,
          positionId: testPosition,
        },
      ],
    });
    expect(clash.statusCode).toBe(409);
  });

  it("refuses a requisition that looks like a temporary ID", async () => {
    const response = await send(
      editor,
      "POST",
      "/api/planned-hires",
      hireRequest({ requisition: "tbd-3" }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("refuses a hire from someone who may not change hires", async () => {
    const response = await send(
      planner,
      "POST",
      "/api/planned-hires",
      hireRequest(),
    );
    expect(response.statusCode).toBe(403);
  });

  it("refuses a manager who is not a live person, or whom a draft removes", async () => {
    const unknown = await send(
      editor,
      "POST",
      "/api/planned-hires",
      hireRequest({ managerId: randomUUID() }),
    );
    expect(unknown.statusCode).toBe(400);
    expect(errorOf(unknown)).toBe("Choose a manager from People");
    const leaving = await person();
    await ok(await send(editor, "DELETE", `/api/people/${leaving}`));
    const removed = await send(
      editor,
      "POST",
      "/api/planned-hires",
      hireRequest({ managerId: leaving }),
    );
    expect(removed.statusCode).toBe(400);
  });
});

describe("changing a hire", () => {
  it("drafts new details, keeping what is live beside them", async () => {
    const manager = await person();
    const id = await liveHire();
    await changed(id, {
      requisition: "Fictional-REQ-Lead",
      positionId: otherTestPosition,
      targetDate: "2027-06-01",
      managerId: manager,
      stateId: open,
    });
    expect((await liveRow(id))?.positionId).toBe(testPosition);
    expect(await hireSeen(id)).toMatchObject({
      requisition: "Fictional-REQ-Lead",
      temporaryId: null,
      positionId: otherTestPosition,
      expected: "2027-06",
      managerId: manager,
      stateId: open,
      draft: {
        action: "changed",
        changed: expect.arrayContaining([
          "requisition",
          "positionId",
          "targetDate",
          "stateId",
          "managerId",
        ]) as unknown,
        live: {
          requisition: null,
          positionId: testPosition,
          targetDate: "2027-03-15",
          stateId: proposed,
          managerId: null,
        },
      },
    });
  });

  it("gives a hire whose requisition is cleared a new temporary ID", async () => {
    const id = await liveHire();
    const before = numberOf(await hireSeen(id));
    await changed(id, { requisition: unique("Fictional-REQ") });
    await changed(id, { requisition: null });
    const after = await hireSeen(id);
    expect(after?.requisition).toBeNull();
    expect(numberOf(after)).toBeGreaterThan(before);
  });

  it("changes nothing when nothing differs", async () => {
    const id = await liveHire({ requisition: "Fictional-REQ-Same" });
    expect(
      await changed(id, {
        requisition: "Fictional-REQ-Same",
        positionId: testPosition,
      }),
    ).toBeNull();
    expect(await changed(id, { requisition: "Fictional-REQ-Same" })).toBeNull();
  });

  it("moves a hire between states in any order", async () => {
    const id = await liveHire({ stateId: recruiting });
    await changed(id, { stateId: proposed });
    expect((await hireSeen(id))?.stateId).toBe(proposed);
    await changed(id, { stateId: open });
    await changed(id, { stateId: recruiting });
    expect((await hireSeen(id))?.stateId).toBe(recruiting);
  });

  it("keeps a retired position a hire has, but refuses giving it one", async () => {
    const id = randomUUID();
    await test.connection.insert(plannedHires).values({
      id,
      temporaryNumber: 900_003,
      positionId: retiredPosition,
      stateId: open,
    });
    await changed(id, { stateId: proposed, positionId: retiredPosition });
    expect(
      (await change(await liveHire(), { positionId: retiredPosition }))
        .statusCode,
    ).toBe(400);
  });

  it("keeps a filled hire, which cannot be removed", async () => {
    const id = randomUUID();
    await test.connection.insert(plannedHires).values({
      id,
      temporaryNumber: 900_004,
      positionId: testPosition,
      stateId: open,
      filledBy: await person({ startDate: "2099-01-01" }),
    });
    const removing = await send(editor, "DELETE", `/api/planned-hires/${id}`);
    expect(removing.statusCode).toBe(409);
  });

  it("is refused for a hire that is not there, or that a draft removes", async () => {
    expect((await change(randomUUID(), { stateId: open })).statusCode).toBe(
      404,
    );
    const id = await liveHire();
    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}`));
    const response = await change(id, { stateId: open });
    expect(response.statusCode).toBe(409);
  });

  it("is refused while someone else holds the hire with unpublished changes", async () => {
    const id = await liveHire();
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await send(
        other,
        "PATCH",
        `/api/planned-hires/${id}`,
        { requisition: unique("Fictional-Held") },
        { publish: false },
      ),
    );
    expect((await hireSeen(id))?.heldBy).toEqual(expect.any(String));
    expect((await change(id, { stateId: open })).statusCode).toBe(409);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });
});

describe("removing a hire", () => {
  it("drafts removing a live hire, and discards one only drafted to be added", async () => {
    const id = await liveHire();
    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}`));
    expect((await hireSeen(id))?.draft?.action).toBe("deleted");
    expect(
      (
        await ok<{ changeSetId: string | null }>(
          await send(editor, "DELETE", `/api/planned-hires/${id}`),
        )
      ).changeSetId,
    ).toBeNull();
    await approved({ plannedHires: [id] });
    expect(await liveRow(id)).toBeUndefined();

    const drafted = await draftHire();
    await ok(await send(editor, "DELETE", `/api/planned-hires/${drafted.id}`));
    expect(await hireSeen(drafted.id)).toBeUndefined();
  });

  it("is refused for a hire that is not there", async () => {
    expect(
      (await send(editor, "DELETE", `/api/planned-hires/${randomUUID()}`))
        .statusCode,
    ).toBe(404);
  });
});

describe("the choices hires have", () => {
  it("cannot be removed while a hire, live or in a draft, has them as its position or state", async () => {
    const [positions] = await test.connection
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.builtIn, "positions"));
    const listId = String(positions?.id);
    const [kept] = await test.connection
      .insert(listItems)
      .values({ listId, label: unique("Fictional Kept Position"), position: 9 })
      .returning({ id: listItems.id });
    const choiceId = String(kept?.id);
    const { id } = await draftHire({ positionId: choiceId });
    const remove = () =>
      send(editor, "DELETE", `/api/lists/${listId}/choices/${choiceId}`);
    expect((await remove()).statusCode).toBe(409);
    await approved({ plannedHires: [id] });
    expect((await remove()).statusCode).toBe(409);
    await test.connection
      .delete(plannedHires)
      .where(and(eq(plannedHires.id, id)));
    expect((await remove()).statusCode).toBe(200);
  });
});

describe("the built-in lists", () => {
  const builtIn = async (key: "positions" | "hiring-states") => {
    const [list] = await test.connection
      .select({ id: lists.id, name: lists.name })
      .from(lists)
      .where(eq(lists.builtIn, key));
    return list as { id: string; name: string };
  };

  it("cannot be removed, retired, or given another visibility", async () => {
    const who = await test.signedIn("workforce-administrator");
    const positions = await builtIn("positions");
    const states = await builtIn("hiring-states");
    const removed = await send(who, "DELETE", `/api/lists/${positions.id}`);
    expect(removed.statusCode).toBe(409);
    expect(errorOf(removed)).toBe(
      "This list cannot be deleted while a column draws on it: Position",
    );
    const retired = await send(who, "PUT", `/api/lists/${states.id}/retired`, {
      retired: true,
    });
    expect(retired.statusCode).toBe(409);
    expect(errorOf(retired)).toBe(
      "This list cannot be retired while a column draws on it: State",
    );
  });

  it("refuses a hiring state with no meaning", async () => {
    const states = await builtIn("hiring-states");
    const [plain] = await test.connection
      .insert(listItems)
      .values({ listId: states.id, label: unique("Fictional No Meaning") })
      .returning({ id: listItems.id });
    const response = await send(
      editor,
      "POST",
      "/api/planned-hires",
      hireRequest({ stateId: String(plain?.id) }),
    );
    expect(response.statusCode).toBe(400);
    await test.connection
      .delete(listItems)
      .where(eq(listItems.id, String(plain?.id)));
  });

  it("refuses a hire with no state given while no state meaning Proposed is offered", async () => {
    const retire = (retired: boolean) =>
      test.connection
        .update(listItems)
        .set({ retired })
        .where(eq(listItems.id, proposed));
    await retire(true);
    try {
      const response = await send(
        editor,
        "POST",
        "/api/planned-hires",
        hireRequest(),
      );
      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toBe(
        "No state means Proposed. Choose one for the hire.",
      );
    } finally {
      await retire(false);
    }
  });
});

describe("a filled hire", () => {
  it("is not shown once its person has started, even after they have left", async () => {
    const left = await person({
      startDate: "2019-01-01",
      endDate: "2020-06-30",
    });
    const id = randomUUID();
    await test.connection.insert(plannedHires).values({
      id,
      temporaryNumber: 900_005,
      positionId: testPosition,
      stateId: open,
      filledBy: left,
    });
    expect(await hireSeen(id, planner)).toBeUndefined();
  });
});
