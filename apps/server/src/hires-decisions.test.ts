// SPDX-License-Identifier: Apache-2.0

// Integration tests for hires' drafts, against a migrated PostgreSQL server: approving, rejecting,
// discarding, resending and undoing them, who may change the plan, and recording changes to it in
// the change and access histories without naming the hire.

import { changes, changeSets, people, plannedHires } from "@fathom/db";
import { type ChangeHistory, roleSchema } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import { otherTestPosition, testPosition } from "./test-app.ts";
import {
  type User,
  test,
  editor,
  approver,
  planner,
  proposed,
  open,
  recruiting,
  unique,
  send,
  ok,
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

describe("a hire's draft", () => {
  it("is approved into the live hire", async () => {
    const id = await liveHire();
    await changed(id, {
      requisition: "Fictional-REQ-After",
      stateId: open,
      targetDate: null,
    });
    await approved({ plannedHires: [id] });
    expect(await liveRow(id)).toMatchObject({
      requisition: "Fictional-REQ-After",
      temporaryNumber: null,
      stateId: open,
      targetDate: null,
    });
    expect((await hireSeen(id))?.draft).toBeUndefined();
  });

  it("is rejected with a reason, resent unchanged, and rejected again", async () => {
    const id = await liveHire();
    await changed(id, { requisition: unique("Fictional-Rejected") });
    const reject = async (reason: string) =>
      ok(
        await send(approver, "POST", "/api/drafts/rejection", {
          plannedHires: [id],
          reason,
        }),
      );
    await reject("Fictional reason");
    expect((await hireSeen(id))?.draft).toMatchObject({
      state: "rejected",
      reason: "Fictional reason",
    });
    // Rejecting again for the same reason records nothing more.
    const rejections = async () =>
      (await test.historyOf(id)).filter(({ field }) => field === "rejected");
    const once = (await rejections()).length;
    await reject("Fictional reason");
    expect(await rejections()).toHaveLength(once);
    await reject("Another fictional reason");
    expect((await rejections()).at(-1)).toMatchObject({
      oldValue: "Fictional reason",
      newValue: "Another fictional reason",
    });
    const refused = await approve({ plannedHires: [id] });
    expect(refused.statusCode).toBe(409);
    await ok(
      await send(editor, "DELETE", `/api/planned-hires/${id}/draft/rejection`),
    );
    expect((await hireSeen(id))?.draft).toMatchObject({ state: "waiting" });
    expect(
      (await send(editor, "DELETE", `/api/planned-hires/${id}/draft/rejection`))
        .statusCode,
    ).toBe(409);
  });

  it("clears its rejection when changed again", async () => {
    const id = await liveHire();
    await changed(id, { stateId: open });
    await ok(
      await send(approver, "POST", "/api/drafts/rejection", {
        plannedHires: [id],
        reason: "Fictional reason",
      }),
    );
    await changed(id, { stateId: recruiting });
    expect((await hireSeen(id))?.draft?.state).toBe("waiting");
  });

  it("is decided only by Approvers who see people and Confidential data, and only when there", async () => {
    const id = await liveHire();
    await changed(id, { stateId: open });
    const unseeing = await test.signedIn([
      "hiring-plan:approve",
      "people:view",
    ]);
    expect(
      (
        await send(unseeing, "POST", "/api/drafts/approval", {
          plannedHires: [id],
        })
      ).statusCode,
    ).toBe(404);
    expect((await approve({ plannedHires: [randomUUID()] })).statusCode).toBe(
      404,
    );
    expect(
      (
        await send(approver, "POST", "/api/drafts/rejection", {
          plannedHires: [randomUUID()],
          reason: "Fictional reason",
        })
      ).statusCode,
    ).toBe(404);
  });

  it("is discarded, leaving the hire as it is live, or gone if only drafted to be added", async () => {
    const id = await liveHire();
    const discard = (hire: string) =>
      send(editor, "DELETE", `/api/planned-hires/${hire}/draft`);
    expect((await discard(id)).statusCode).toBe(404);
    await changed(id, { positionId: otherTestPosition });
    await ok(await discard(id));
    expect(await hireSeen(id)).toMatchObject({ positionId: testPosition });
    expect((await hireSeen(id))?.draft).toBeUndefined();

    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}`));
    await ok(await discard(id));
    expect((await hireSeen(id))?.draft).toBeUndefined();

    const drafted = await draftHire();
    await ok(await discard(drafted.id));
    expect(await hireSeen(drafted.id)).toBeUndefined();
  });

  it("is undone by its maker: a hire added taken out, one removed put back, and details put back", async () => {
    const undo = (changeSetId: string | null) =>
      send(editor, "POST", `/api/undo/${String(changeSetId)}`);
    const added = await draftHire();
    await ok(await undo(added.changeSetId));
    expect(await hireSeen(added.id)).toBeUndefined();

    const manager = await person();
    const id = await liveHire({
      requisition: "Fictional-REQ-Original",
      managerId: manager,
    });
    const moved = await changed(id, { positionId: otherTestPosition });
    await ok(await undo(moved));
    expect((await hireSeen(id))?.positionId).toBe(testPosition);

    const removed = (
      await ok<{ changeSetId: string }>(
        await send(editor, "DELETE", `/api/planned-hires/${id}`),
      )
    ).changeSetId;
    await ok(await undo(removed));
    expect(await hireSeen(id)).toMatchObject({
      requisition: "Fictional-REQ-Original",
      managerId: manager,
    });
  });

  it("is not undone when the manager it puts back has since been drafted to be removed", async () => {
    const first = await person();
    const second = await person();
    const { id } = await draftHire({ managerId: first });
    const moved = await changed(id, { managerId: second });
    await ok(await send(editor, "DELETE", `/api/people/${first}`));
    const response = await send(editor, "POST", `/api/undo/${String(moved)}`);
    expect(response.statusCode).toBe(409);
  });
});

describe("changes to the hiring plan in the change history", () => {
  it("are shown to those who see people and Confidential data, naming the hire by position and ID, and its states and manager", async () => {
    const manager = await person();
    const requisition = unique("Fictional-Historic");
    const id = await liveHire({ requisition });
    await changed(id, { stateId: recruiting, managerId: manager });
    const entries = async (who: User) =>
      (
        await ok<ChangeHistory>(await send(who, "GET", "/api/changes"))
      ).entries.filter((entry) => JSON.stringify(entry).includes(requisition));
    const seen = JSON.stringify(await entries(approver));
    expect(seen).toContain(`Fictional Engineer, ${requisition}`);
    expect(seen).toContain("Fictional Recruiting");
    expect(seen).toContain("Request to hire");
    expect(seen).toContain("Fictional Person");
    expect(await entries(planner)).toEqual([]);
  });

  it("names a planned manager with no name by its position and ID", async () => {
    const manager = await liveHire({ isManager: true });
    const requisition = unique("Fictional-Reporting");
    const id = await liveHire({ requisition });
    await changed(id, { managerId: manager });
    const seen = JSON.stringify(
      (
        await ok<ChangeHistory>(await send(approver, "GET", "/api/changes"))
      ).entries.filter((entry) => JSON.stringify(entry).includes(requisition)),
    );
    const managerId = String((await hireSeen(manager))?.temporaryId);
    expect(seen).toContain(`Fictional Engineer, ${managerId}`);
  });
});

describe("a hire Fathom holds no history of", () => {
  it("is named in the change history as it is now, by position and ID", async () => {
    const withRequisition = randomUUID();
    const withNumber = randomUUID();
    const requisition = unique("Fictional-Carried");
    await test.connection.insert(plannedHires).values([
      {
        id: withRequisition,
        requisition,
        positionId: testPosition,
        stateId: proposed,
      },
      {
        id: withNumber,
        temporaryNumber: 900_006,
        positionId: otherTestPosition,
        stateId: proposed,
      },
    ]);
    await changed(withRequisition, { stateId: open });
    await changed(withNumber, { stateId: open });
    const seen = JSON.stringify(
      (await ok<ChangeHistory>(await send(approver, "GET", "/api/changes")))
        .entries,
    );
    expect(seen).toContain(`Fictional Engineer, ${requisition}`);
    expect(seen).toContain("Fictional Lead, TBD-900006");
  });
});

describe("who may change the hiring plan", () => {
  it("needs the right to change the hiring plan, not only to see it, nor to change Confidential data", async () => {
    const id = await liveHire();
    const who = await test.signedIn([]);
    await test.holdOnly(who.id, [
      "people:edit",
      "hiring-plan:view",
      "confidential:edit",
    ]);
    expect(
      (await send(who, "POST", "/api/planned-hires", hireRequest({})))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await send(who, "PATCH", `/api/planned-hires/${id}`, {
          requisition: null,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await send(who, "DELETE", `/api/planned-hires/${id}`)).statusCode,
    ).toBe(403);
    const draft = await draftHire();
    expect(
      (await send(who, "DELETE", `/api/planned-hires/${draft.id}/draft`))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await send(
          who,
          "DELETE",
          `/api/planned-hires/${draft.id}/draft/rejection`,
        )
      ).statusCode,
    ).toBe(403);
  });

  it.each(roleSchema.options)(
    "refuses a %s's changes to hires unless the role may edit people and the hiring plan",
    async (role) => {
      const live = await liveHire();
      const { id } = await draftHire();
      const who = await test.signedIn(role);
      const may =
        rolesGranting("people:edit").includes(role) &&
        rolesGranting("hiring-plan:edit").includes(role);
      const statuses = [
        await send(who, "POST", "/api/planned-hires", hireRequest({})),
        await send(who, "PATCH", `/api/planned-hires/${live}`, {
          requisition: null,
        }),
        await send(who, "DELETE", `/api/planned-hires/${live}`),
        await send(who, "DELETE", `/api/planned-hires/${id}/draft`),
        await send(who, "DELETE", `/api/planned-hires/${id}/draft/rejection`),
      ].map(({ statusCode }) => statusCode === 403);
      expect(statuses).toEqual(statuses.map(() => !may));
    },
  );

  it("lets those who may edit people, the hiring plan and its class change it", async () => {
    const who = await test.signedIn([]);
    await test.holdOnly(who.id, [
      "people:edit",
      "hiring-plan:edit",
      "confidential:edit",
    ]);
    expect(
      (await send(who, "POST", "/api/planned-hires", hireRequest({})))
        .statusCode,
    ).toBe(201);
  });
});

describe("undoing changes to the hiring plan", () => {
  it("needs only the rights to edit people, the hiring plan and its class to undo, discard, and resubmit", async () => {
    const who = await test.signedIn([]);
    await test.holdOnly(who.id, [
      "people:edit",
      "hiring-plan:edit",
      "confidential:edit",
    ]);
    const id = await liveHire();
    const dated = await ok<{ changeSetId: string }>(
      await change(id, { targetDate: "2027-07-15" }, who),
    );
    await ok(await send(who, "POST", `/api/undo/${dated.changeSetId}`));
    expect((await hireSeen(id))?.draft).toBeUndefined();
    await ok(await change(id, { targetDate: "2027-08-15" }, who));
    await ok(
      await send(approver, "POST", "/api/drafts/rejection", {
        plannedHires: [id],
        reason: "Fictional reason",
      }),
    );
    await ok(
      await send(who, "DELETE", `/api/planned-hires/${id}/draft/rejection`),
    );
    expect((await hireSeen(id))?.draft?.state).toBe("waiting");
    await ok(await send(who, "DELETE", `/api/planned-hires/${id}/draft`));
    expect((await hireSeen(id))?.draft).toBeUndefined();
  });

  it("needs the rights to change hires when undoing, not only when the change was made", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const { changeSetId } = await draftHire({}, maker);
    await test.holdOnly(maker.id, [
      "people:edit",
      "hiring-plan:view",
      "confidential:edit",
    ]);
    const response = await send(maker, "POST", `/api/undo/${changeSetId}`);
    expect(response.statusCode).toBe(403);
  });

  it("does not put back a requisition someone has taken since", async () => {
    const requisition = unique("Fictional-Taken");
    const { id } = await draftHire({ requisition });
    const cleared = await changed(id, { requisition: null });
    await person({ employeeId: requisition });
    const response = await send(editor, "POST", `/api/undo/${String(cleared)}`);
    expect(response.statusCode).toBe(409);
  });

  it("does not put back a hire removed before it had a position and state", async () => {
    const id = randomUUID();
    const [set] = await test.connection
      .insert(changeSets)
      .values({ madeBy: editor.id })
      .returning({ id: changeSets.id });
    await test.connection.insert(changes).values({
      changeSetId: String(set?.id),
      recordType: "planned-hire",
      recordId: id,
      action: "deleted",
      field: "title",
      tier: "confidential",
      oldValue: "Fictional Old Role",
      newValue: null,
      draft: true,
    });
    const response = await send(editor, "POST", `/api/undo/${String(set?.id)}`);
    expect(response.statusCode).toBe(409);
  });
});

describe("undoing changes saved straight to live people", () => {
  // A change set saved before people had drafts, as the change history holds it.
  async function liveChange(
    recordId: string,
    action: "changed" | "deleted",
    values: Record<string, [unknown, unknown]>,
    draft = false,
  ) {
    const [set] = await test.connection
      .insert(changeSets)
      .values({ madeBy: editor.id })
      .returning({ id: changeSets.id });
    await test.connection.insert(changes).values(
      Object.entries(values).map(([field, [oldValue, newValue]]) => ({
        changeSetId: String(set?.id),
        recordType: "person",
        recordId,
        action,
        field,
        tier: "general",
        oldValue,
        newValue,
        draft,
      })),
    );
    return String(set?.id);
  }

  it("does not put back an Employee ID a planned hire's requisition has taken since", async () => {
    const now = unique("Fictional-New-ID");
    const id = await person({ employeeId: now });
    const old = unique("Fictional-Old-ID");
    const undo = async () =>
      send(
        editor,
        "POST",
        `/api/undo/${await liveChange(id, "changed", { employeeId: [old, now] })}`,
      );
    // Free, it is put back; taken by a hire since, it is not.
    expect((await undo()).statusCode).toBe(200);
    await test.connection
      .update(people)
      .set({ employeeId: now })
      .where(eq(people.id, id));
    await draftHire({ requisition: old });
    expect((await undo()).statusCode).toBe(409);
  });

  it.each([
    ["live", false],
    ["in a draft", true],
  ])(
    "does not put back someone removed %s before people had positions",
    async (_where, draft) => {
      const changeSetId = await liveChange(
        randomUUID(),
        "deleted",
        {
          preferredName: ["Fictional Removed Long Ago", null],
          employeeId: [unique("Fictional-Gone"), null],
        },
        draft,
      );
      const response = await send(editor, "POST", `/api/undo/${changeSetId}`);
      expect(response.statusCode).toBe(409);
    },
  );
});
