// SPDX-License-Identifier: Apache-2.0

// Integration tests for the people planned hires name, against a migrated PostgreSQL server:
// keeping them, a hire's manager, and planned managers, whom other hires report to.

import { drafts, people, plannedHires } from "@fathom/db";
import { type Person } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, ok, testPosition, unique, type User } from "./test-app.ts";
import {
  test,
  editor,
  planner,
  open,
  send,
  approve,
  approved,
  person,
  hireRequest,
  draftHire,
  liveHire,
  hireSeen,
  change,
  changed,
  liveRow,
  startHireTests,
  closeHireTests,
} from "./test-hires.ts";

beforeAll(startHireTests);

afterAll(closeHireTests);

describe("the people hires name", () => {
  it("cannot be removed while a hire, live or in a draft, names them as its manager", async () => {
    const live = await person();
    await liveHire({ managerId: live });
    const remove = (id: string, options?: { publish?: boolean }) =>
      send(editor, "DELETE", `/api/people/${id}`, undefined, options);
    const response = await remove(live);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "A planned hire names this person; change the hire first",
    );

    const drafted = await person();
    await draftHire({ managerId: drafted });
    expect((await remove(drafted)).statusCode).toBe(409);
  });

  it("cannot be removed while the user's own unpublished hire names them", async () => {
    const manager = await person();
    const unnamed = await person();
    await ok(
      await send(
        editor,
        "POST",
        "/api/planned-hires",
        hireRequest({ managerId: manager }),
        { publish: false },
      ),
      201,
    );
    const remove = (id: string) =>
      send(editor, "DELETE", `/api/people/${id}`, undefined, {
        publish: false,
      });
    expect((await remove(manager)).statusCode).toBe(409);
    expect((await remove(unnamed)).statusCode).toBe(200);
    await ok(await send(editor, "POST", "/api/unpublished/discard"));
  });

  it("can be removed once no hire names them", async () => {
    const manager = await person();
    const { id } = await draftHire({ managerId: manager });
    await changed(id, { managerId: null });
    expect(
      (await send(editor, "DELETE", `/api/people/${manager}`)).statusCode,
    ).toBe(200);
  });
});

describe("a hire's manager", () => {
  it("is shown to readers without Personal data once the manager has started, so not one starting later", async () => {
    const starting = await person({ startDate: "2099-01-01" });
    const id = await liveHire({ managerId: starting });
    expect(await hireSeen(id, planner)).toMatchObject({
      managerId: null,
      managerName: null,
    });
    const personalReader = await test.signedIn("engineering-manager");
    expect((await hireSeen(id, personalReader))?.managerId).toBe(starting);
    expect((await hireSeen(id))?.managerId).toBe(starting);
  });

  it("is shown to everyone who sees people once the manager has left, as People shows them", async () => {
    const left = await person({
      startDate: "2019-01-01",
      endDate: "2020-06-30",
    });
    const id = await liveHire({ managerId: left });
    expect((await hireSeen(id, planner))?.managerId).toBe(left);
  });

  it("must be marked as a manager while the hire is not yet filled, as people's managers are", async () => {
    const unmarked = await person({ isManager: false });
    const created = await send(
      editor,
      "POST",
      "/api/planned-hires",
      hireRequest({ managerId: unmarked }),
    );
    expect(created.statusCode).toBe(400);
    const id = await liveHire();
    expect((await change(id, { managerId: unmarked })).statusCode).toBe(400);
  });

  it("stays marked as a manager while a hire not yet filled names them, and cannot be named again once cleared", async () => {
    const manager = await person();
    const other = await person();
    const id = await liveHire({ managerId: manager });
    const unmark = () =>
      send(editor, "PATCH", `/api/people/${manager}`, { isManager: false });
    const refused = await unmark();
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe("Reassign direct reports first");
    await changed(id, { managerId: other });
    expect((await unmark()).statusCode).toBe(409);
    await approved({ plannedHires: [id] });
    await ok(await unmark());
    await approved({ people: [manager] });
    expect((await change(id, { managerId: manager })).statusCode).toBe(400);
  });

  it("is refused on approval once no longer marked as a manager, however that came about", async () => {
    const manager = await person({ preferredName: "Fictional Unmarked" });
    const { id } = await draftHire({ managerId: manager });
    await test.connection
      .update(people)
      .set({ isManager: false })
      .where(eq(people.id, manager));
    const response = await approve({ plannedHires: [id] });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "Fictional Unmarked is not a manager yet: check Manager? on their row and have it approved first",
    );
  });

  it("stays marked as a manager when undoing a change would clear it while a hire names them", async () => {
    const manager = await person();
    const path = `/api/people/${manager}`;
    await ok(await send(editor, "PATCH", path, { isManager: false }));
    const { changeSetId } = await ok<{ changeSetId: string }>(
      await send(editor, "PATCH", path, { isManager: true }),
    );
    await draftHire({ managerId: manager });
    const undone = await send(editor, "POST", `/api/undo/${changeSetId}`);
    expect(undone.statusCode).toBe(409);
    expect(errorOf(undone)).toBe("Reassign direct reports first");
  });

  it("is needed by a manager an undo puts back on a hire not yet filled", async () => {
    const first = await person({ preferredName: "Fictional First Manager" });
    const second = await person();
    const { id } = await draftHire({ managerId: first });
    const changeSetId = await changed(id, { managerId: second });
    await ok(
      await send(editor, "PATCH", `/api/people/${first}`, {
        isManager: false,
      }),
    );
    await approved({ people: [first] });
    const undone = await send(
      editor,
      "POST",
      `/api/undo/${String(changeSetId)}`,
    );
    expect(undone.statusCode).toBe(409);
    expect(errorOf(undone)).toBe(
      "Fictional First Manager is not a manager yet: check Manager? on their row and have it approved first",
    );
  });

  it("is taken while only another user's unpublished change removes them", async () => {
    const leaving = await person();
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await send(other, "DELETE", `/api/people/${leaving}`, undefined, {
        publish: false,
      }),
    );
    await ok(
      await send(
        editor,
        "POST",
        "/api/planned-hires",
        hireRequest({ managerId: leaving }),
      ),
      201,
    );
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("cannot be removed by approving a draft that removes them, however the draft came about", async () => {
    const manager = await person();
    await draftHire({ managerId: manager });
    await test.connection.insert(drafts).values({
      recordType: "person",
      recordId: manager,
      action: "deleted",
      fields: {},
    });
    const response = await approve({ people: [manager] });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "A planned hire names this person; change the hire first",
    );
    await test.connection.delete(drafts).where(eq(drafts.recordId, manager));
  });
});

describe("a planned manager", () => {
  const peopleRow = async (id: string, who: User) =>
    (
      await ok<{ people: Person[] }>(await send(who, "GET", "/api/people"))
    ).people.find((row) => row.id === id);
  const temporaryManager = /^Fictional Engineer, TBD-\d+$/;
  const loop =
    "That manager reports to this planned hire, directly or through others";
  const stillReporting = "Reassign direct reports first";

  it("has planned hires report to it, named as its row is, to everyone who sees people", async () => {
    const manager = await liveHire({ isManager: true });
    const id = await liveHire({ managerId: manager });
    expect(await liveRow(id)).toMatchObject({
      managerId: null,
      managerHireId: manager,
    });
    expect(await hireSeen(id, planner)).toMatchObject({
      managerId: manager,
      managerName: expect.stringMatching(temporaryManager) as unknown,
    });
    expect((await hireSeen(manager, planner))?.isManager).toBe(true);
    expect(await peopleRow(id, planner)).toMatchObject({
      manager: { id: manager },
      team: null,
    });
    expect((await peopleRow(manager, planner))?.isManager).toBe(true);
    const name = unique("Fictional Planned Lead");
    const named = await liveHire({ isManager: true, name });
    const report = await liveHire({ managerId: named });
    expect((await hireSeen(report, planner))?.managerName).toBe(name);
  });

  it("keeps a hire's manager in the column for its kind when it moves between a person and a planned hire", async () => {
    const manager = await liveHire({ isManager: true });
    const id = await liveHire({ managerId: manager });
    const somebody = await person();
    await changed(id, { managerId: somebody });
    await approved({ plannedHires: [id] });
    expect(await liveRow(id)).toMatchObject({
      managerId: somebody,
      managerHireId: null,
    });
  });

  it("must be marked as a manager, as a person must", async () => {
    const name = unique("Fictional Unmarked Hire");
    const unmarked = await liveHire({ name });
    const response = await send(
      editor,
      "POST",
      "/api/planned-hires",
      hireRequest({ managerId: unmarked }),
    );
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      `${name} is not a manager yet: check Manager? on their row and have it approved first`,
    );
    const nameless = await liveHire();
    const id = await liveHire();
    const refused = await change(id, { managerId: nameless });
    expect(errorOf(refused)).toMatch(
      /^Fictional Engineer, TBD-\d+ is not a manager yet/,
    );
  });

  it("is refused on approval once no longer marked, however that came about", async () => {
    const manager = await liveHire({ isManager: true });
    const { id } = await draftHire({ managerId: manager });
    await test.connection
      .update(plannedHires)
      .set({ isManager: false })
      .where(eq(plannedHires.id, manager));
    expect((await approve({ plannedHires: [id] })).statusCode).toBe(409);
  });

  it("cannot manage once filled, or while a draft removes it", async () => {
    const filled = randomUUID();
    await test.connection.insert(plannedHires).values({
      id: filled,
      temporaryNumber: 900_011,
      positionId: testPosition,
      stateId: open,
      isManager: true,
      filledBy: await person(),
    });
    const naming = (managerId: string) =>
      send(editor, "POST", "/api/planned-hires", hireRequest({ managerId }));
    expect((await naming(filled)).statusCode).toBe(400);
    const leaving = await liveHire({ isManager: true });
    await ok(await send(editor, "DELETE", `/api/planned-hires/${leaving}`));
    expect((await naming(leaving)).statusCode).toBe(400);
  });

  it("is never a person's manager", async () => {
    const manager = await liveHire({ isManager: true });
    const somebody = await person();
    const response = await send(editor, "PATCH", `/api/people/${somebody}`, {
      managerId: manager,
    });
    expect(response.statusCode).toBe(400);
  });

  it("cannot report to itself, or to a planned hire that reports to it", async () => {
    const top = await liveHire({ isManager: true });
    const below = await liveHire({ isManager: true, managerId: top });
    expect(errorOf(await change(top, { managerId: top }))).toBe(
      "A planned hire can't report to itself",
    );
    expect(errorOf(await change(top, { managerId: below }))).toBe(loop);
  });

  it("is refused on publishing a change that closes a loop with a draft published since", async () => {
    // Given one user's private change of First's manager to Second, and another's of Second's to
    // First, published first
    const first = await liveHire({ isManager: true });
    const second = await liveHire({ isManager: true });
    const one = await test.signedIn("workforce-administrator");
    const other = await test.signedIn("workforce-administrator");
    const unpublished = { publish: false };
    const path = (id: string) => `/api/planned-hires/${id}`;
    await ok(
      await send(one, "PATCH", path(first), { managerId: second }, unpublished),
    );
    await ok(
      await send(
        other,
        "PATCH",
        path(second),
        { managerId: first },
        unpublished,
      ),
    );
    await ok(await send(other, "POST", "/api/unpublished/publish"));

    const response = await send(one, "POST", "/api/unpublished/publish");

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toMatch(
      /: That manager reports to this planned hire, directly or through others$/,
    );
    await send(one, "POST", "/api/unpublished/discard");
  });

  it("is refused on approval when drafts would make a loop", async () => {
    // Given Second's manager changed to First, and a waiting draft of First's manager as Second,
    // which no route can publish any more, so the test writes it directly
    const first = await liveHire({ isManager: true });
    const second = await liveHire({ isManager: true });
    await ok(
      await send(
        await test.signedIn("workforce-administrator"),
        "PATCH",
        `/api/planned-hires/${second}`,
        { managerId: first },
      ),
    );
    await test.connection.insert(drafts).values({
      recordType: "planned-hire",
      recordId: first,
      action: "changed",
      fields: { managerId: second },
      state: "waiting",
    });

    const response = await approve({ plannedHires: [first, second] });

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toMatch(
      /^Fictional Engineer, TBD-\d+ would end up reporting to itself$/,
    );
  });

  it("stays marked while a planned hire reports to it, or is drafted to", async () => {
    const manager = await liveHire({ isManager: true });
    await liveHire({ managerId: manager });
    const refused = await change(manager, { isManager: false });
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(stillReporting);
    const drafting = await liveHire({ isManager: true });
    await draftHire({ managerId: drafting });
    expect(errorOf(await change(drafting, { isManager: false }))).toBe(
      stillReporting,
    );
  });

  it("shows its mark drafted to be cleared beside the live one", async () => {
    const manager = await liveHire({ isManager: true });
    await changed(manager, { isManager: false });
    expect((await hireSeen(manager))?.draft).toMatchObject({
      changed: ["isManager"],
      live: { isManager: true },
    });
    expect((await peopleRow(manager, editor))?.draft?.live.isManager).toBe(
      true,
    );
  });

  it("keeps its mark on approval while a planned hire has come to report to it", async () => {
    const manager = await liveHire({ isManager: true });
    await changed(manager, { isManager: false });
    const report = await liveHire({ managerId: manager });
    expect(report).toEqual(expect.any(String));
    const response = await approve({ plannedHires: [manager] });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(stillReporting);
  });

  it("cannot be removed while planned hires report to it", async () => {
    const manager = await liveHire({ isManager: true });
    await liveHire({ managerId: manager });
    const response = await send(
      editor,
      "DELETE",
      `/api/planned-hires/${manager}`,
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe("Reassign direct reports first");
  });

  it("keeps its mark when undoing a change would clear it while a hire reports to it", async () => {
    const manager = await liveHire({ isManager: true });
    await changed(manager, { isManager: false });
    const marked = await changed(manager, { isManager: true });
    await draftHire({ managerId: manager });
    const undone = await send(editor, "POST", `/api/undo/${String(marked)}`);
    expect(undone.statusCode).toBe(409);
  });

  it("is checked as a manager, and for loops, when an undo puts it back", async () => {
    const top = await liveHire({ isManager: true });
    const below = await liveHire({ isManager: true });
    await changed(top, { managerId: below });
    const cleared = await changed(top, { managerId: null });
    await changed(below, { managerId: top });
    const looping = await send(editor, "POST", `/api/undo/${String(cleared)}`);
    expect(errorOf(looping)).toBe(loop);
    const manager = await liveHire({ isManager: true });
    const id = await liveHire();
    await changed(id, { managerId: manager });
    const unnamed = await changed(id, { managerId: null });
    await changed(manager, { isManager: false });
    await approved({ plannedHires: [manager] });
    const unmarked = await send(editor, "POST", `/api/undo/${String(unnamed)}`);
    expect(unmarked.statusCode).toBe(409);
    expect(errorOf(unmarked)).toMatch(/^TBD-\d+ is not a manager yet/);
  });
});
