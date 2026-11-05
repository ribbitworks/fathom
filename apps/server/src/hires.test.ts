// SPDX-License-Identifier: Apache-2.0

// Tests for planned hires, against a migrated PostgreSQL server: who sees the whole hiring plan and
// who sees only its placeholders; drafting hires added, changed, moved between states, and removed;
// approving, rejecting, discarding, resending, and undoing those drafts; keeping the people hires
// name; and recording changes to the plan in the access history without naming the hire.

import { accessHistory, drafts, plannedHires } from "@fathom/db";
import type { ChangeHistory, Hire, Hires, Unpublished } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "./test-app.ts";

interface User {
  id: string;
  cookie: string;
}

let test: TestApp;
// A Workforce Administrator, who changes the hiring plan.
let editor: User;
// An Approver who sees Confidential data, so decides hires' drafts.
let approver: User;
// A Resource Planner, who sees people, so the hiring plan's placeholders.
let planner: User;

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn(["workforce-administrator"]);
  approver = await test.signedIn(["approver", "leadership"]);
  planner = await test.signedIn(["resource-planner"]);
});

afterAll(async () => {
  await test.close();
});

let count = 0;

// A title or name no other test uses, so tests sharing the database do not collide.
function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

const send = (
  who: User,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  payload?: object,
  options?: { publish?: boolean },
) => test.request(who.cookie, method, url, payload, options);

async function ok<T>(
  response: Awaited<ReturnType<typeof send>>,
  status = 200,
): Promise<T> {
  expect(response.statusCode, response.body).toBe(status);
  return Promise.resolve(response.json<T>());
}

async function approve(ids: { people?: string[]; plannedHires?: string[] }) {
  return send(approver, "POST", "/api/drafts/approval", ids);
}

async function approved(ids: { people?: string[]; plannedHires?: string[] }) {
  await ok(await approve(ids));
}

// A fictional person, approved so they are live, who started in 2020 unless told otherwise.
async function person(details: object = {}): Promise<string> {
  const { ids } = await ok<{ ids: string[] }>(
    await send(editor, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("HP"),
          startDate: "2020-01-01",
          ...details,
        },
      ],
    }),
    201,
  );
  const id = String(ids[0]);
  await approved({ people: [id] });
  return id;
}

async function draftHire(
  details: object = {},
  who = editor,
): Promise<{ id: string; changeSetId: string }> {
  return ok(
    await send(who, "POST", "/api/planned-hires", {
      title: unique("Fictional Role"),
      targetDate: "2027-03-15",
      ...details,
    }),
    201,
  );
}

// A planned hire, drafted and approved, so it is live.
async function liveHire(details: object = {}): Promise<string> {
  const { id } = await draftHire(details);
  await approved({ plannedHires: [id] });
  return id;
}

async function hiresSeen(who: User): Promise<Hires> {
  return ok(await send(who, "GET", "/api/planned-hires"));
}

async function hireSeen(id: string, who = editor): Promise<Hire | undefined> {
  return (await hiresSeen(who)).hires.find((hire) => hire.id === id);
}

const change = (id: string, body: object, who = editor) =>
  send(who, "PATCH", `/api/planned-hires/${id}`, body);

async function changed(id: string, body: object): Promise<string | null> {
  return (await ok<{ changeSetId: string | null }>(await change(id, body)))
    .changeSetId;
}

const refusal = (response: Awaited<ReturnType<typeof send>>) =>
  response.json<{ error: string }>().error;

async function liveRow(id: string) {
  const [row] = await test.connection
    .select()
    .from(plannedHires)
    .where(eq(plannedHires.id, id));
  return row;
}

describe("the hiring plan", () => {
  it("is shown whole, with its drafts, to those who see Confidential data, by title", async () => {
    const manager = await person();
    const later = await liveHire({
      title: "Zz Fictional Role",
      managerId: manager,
      state: "approved",
    });
    const sooner = await draftHire({ title: "Aa Fictional Role" });
    const { hires, wholePlan } = await hiresSeen(editor);
    expect(wholePlan).toBe(true);
    const ids = hires.map(({ id }) => id);
    expect(ids.indexOf(sooner.id)).toBeLessThan(ids.indexOf(later));
    expect(hires.find(({ id }) => id === later)).toMatchObject({
      title: "Zz Fictional Role",
      managerId: manager,
      managerName: expect.stringMatching(/^Fictional Person/) as unknown,
      firstMonth: "2027-03",
      targetDate: "2027-03-15",
      state: "approved",
      cancelledFrom: null,
    });
    expect(hires.find(({ id }) => id === sooner.id)).toMatchObject({
      managerId: null,
      managerName: null,
      state: "proposed",
      draft: { action: "created", state: "waiting", live: {} },
    });
    expect(
      hires.find(({ id }) => id === sooner.id)?.draft?.changed.sort(),
    ).toEqual(["state", "targetDate", "title"]);
  });

  it("shows those who see people but not Confidential data only the open hires' placeholders, as they are live", async () => {
    const open = await liveHire({ title: unique("Fictional Placeholder") });
    const cancelled = await liveHire();
    await changed(cancelled, { state: "cancelled" });
    await approved({ plannedHires: [cancelled] });
    await changed(open, { title: unique("Fictional Renamed") });
    const drafted = await draftHire();
    const { hires, wholePlan } = await hiresSeen(planner);
    expect(wholePlan).toBe(false);
    const ids = hires.map(({ id }) => id);
    expect(ids).toContain(open);
    expect(ids).not.toContain(cancelled);
    expect(ids).not.toContain(drafted.id);
    const placeholder = hires.find(({ id }) => id === open);
    expect(Object.keys(placeholder ?? {}).sort()).toEqual([
      "firstMonth",
      "id",
      "managerId",
      "managerName",
      "title",
    ]);
    expect(placeholder?.title).toMatch(/^Fictional Placeholder/);
  });

  it("lists hires of the same title in the same order every time", async () => {
    const title = unique("Fictional Twin");
    const ids = [await liveHire({ title }), await liveHire({ title })].sort();
    const { hires } = await hiresSeen(editor);
    expect(
      hires.filter((hire) => hire.title === title).map(({ id }) => id),
    ).toEqual(ids);
  });

  it("shows drafts written without the change history without who made them", async () => {
    const manager = await person();
    const id = await liveHire({ managerId: manager });
    await test.connection.insert(drafts).values({
      recordType: "planned-hire",
      recordId: id,
      action: "changed",
      fields: { managerId: randomUUID() },
    });
    expect(await hireSeen(id)).toMatchObject({
      managerName: null,
      draft: {
        changed: ["managerId"],
        live: { managerId: manager },
        madeBy: null,
        madeAt: null,
        editors: [],
        changedBy: { managerId: null },
      },
    });
    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}/draft`));
  });

  it("shows the user's own unpublished changes as theirs, and names them among their unpublished changes", async () => {
    const id = await liveHire({ title: unique("Fictional Removed") });
    const { id: added } = await ok<{ id: string }>(
      await send(
        editor,
        "POST",
        "/api/planned-hires",
        { title: "Fictional Unpublished", targetDate: "2027-03-15" },
        { publish: false },
      ),
      201,
    );
    await ok(
      await send(editor, "DELETE", `/api/planned-hires/${id}`, undefined, {
        publish: false,
      }),
    );
    expect((await hireSeen(added))?.draft).toMatchObject({
      action: "created",
      unpublished: true,
    });
    const { changes } = await ok<Unpublished>(
      await send(editor, "GET", "/api/unpublished"),
    );
    const subjects = JSON.stringify(changes);
    expect(subjects).toContain("the planned hire Fictional Unpublished");
    expect(subjects).toContain("the planned hire Fictional Removed");
    await ok(await send(editor, "POST", "/api/unpublished/discard"));
    expect(await hireSeen(added)).toBeUndefined();
    expect((await hireSeen(id))?.draft).toBeUndefined();
  });

  it("is refused to those who see neither", async () => {
    const viewer = await test.signedIn(["viewer"]);
    expect((await send(viewer, "GET", "/api/planned-hires")).statusCode).toBe(
      403,
    );
  });

  it("records reading the whole plan once a day, apart from viewing people's details, but not reading placeholders", async () => {
    await liveHire();
    const reader = await test.signedIn(["leadership"]);
    const placeholders = await test.signedIn(["resource-planner"]);
    await ok(await send(reader, "GET", "/api/people"));
    await hiresSeen(reader);
    await hiresSeen(reader);
    await hiresSeen(placeholders);
    const viewsBy = async (who: User) =>
      test.connection
        .select({ action: accessHistory.action })
        .from(accessHistory)
        .where(eq(accessHistory.actorId, who.id));
    expect(await viewsBy(reader)).toEqual([
      { action: "restricted-viewed" },
      { action: "hiring-plan-viewed" },
    ]);
    expect(await viewsBy(placeholders)).toEqual([]);
  });
});

describe("adding a hire", () => {
  it("is a draft, recorded as a Confidential change and in the access history without naming the hire", async () => {
    const before = await test.connection
      .select({ id: accessHistory.id })
      .from(accessHistory)
      .where(eq(accessHistory.actorId, editor.id));
    const { id, changeSetId } = await draftHire({ title: "Fictional Analyst" });
    expect(changeSetId).toEqual(expect.any(String));
    expect(await liveRow(id)).toBeUndefined();
    const history = await test.historyOf(id);
    expect(history).toContainEqual(
      expect.objectContaining({
        action: "created",
        field: "title",
        tier: "confidential",
        newValue: "Fictional Analyst",
      }),
    );
    expect(history.every(({ tier }) => tier === "confidential")).toBe(true);
    const after = await test.connection
      .select({
        action: accessHistory.action,
        subjectId: accessHistory.subjectId,
      })
      .from(accessHistory)
      .where(eq(accessHistory.actorId, editor.id));
    expect(after.slice(before.length)).toContainEqual({
      action: "hiring-plan-changed",
      subjectId: null,
    });
  });

  it("needs the rights to change people and Confidential data", async () => {
    const response = await send(planner, "POST", "/api/planned-hires", {
      title: "Fictional Role",
      targetDate: "2027-03-15",
    });
    expect(response.statusCode).toBe(403);
  });

  it("refuses a manager who is not a live person, or whom a draft removes", async () => {
    const unknown = await send(editor, "POST", "/api/planned-hires", {
      title: "Fictional Role",
      targetDate: "2027-03-15",
      managerId: randomUUID(),
    });
    expect(unknown.statusCode).toBe(400);
    expect(refusal(unknown)).toBe("Choose a manager from People");
    const leaving = await person();
    await ok(await send(editor, "DELETE", `/api/people/${leaving}`));
    const removed = await send(editor, "POST", "/api/planned-hires", {
      title: "Fictional Role",
      targetDate: "2027-03-15",
      managerId: leaving,
    });
    expect(removed.statusCode).toBe(400);
  });
});

describe("changing a hire", () => {
  it("drafts new details, keeping what is live beside them", async () => {
    const manager = await person();
    const id = await liveHire({ title: "Fictional Tester" });
    await changed(id, {
      title: "Fictional Lead Tester",
      targetDate: "2027-06-01",
      managerId: manager,
      state: "approved",
    });
    expect((await liveRow(id))?.title).toBe("Fictional Tester");
    expect(await hireSeen(id)).toMatchObject({
      title: "Fictional Lead Tester",
      firstMonth: "2027-06",
      managerId: manager,
      state: "approved",
      draft: {
        action: "changed",
        changed: expect.arrayContaining([
          "title",
          "targetDate",
          "state",
          "managerId",
        ]) as unknown,
        live: {
          title: "Fictional Tester",
          targetDate: "2027-03-15",
          state: "proposed",
          managerId: null,
        },
      },
    });
  });

  it("changes nothing when nothing differs", async () => {
    const id = await liveHire({ title: "Fictional Same" });
    expect(await changed(id, { title: "Fictional Same" })).toBeNull();
  });

  it("moves a hire one state at a time, cancels it from any open state, and brings it back to the state it left", async () => {
    const id = await liveHire({ state: "recruiting" });
    const skip = await change(id, { state: "proposed" });
    expect(skip.statusCode).toBe(409);
    expect(refusal(skip)).toMatch(/one state at a time/);
    await changed(id, { state: "cancelled" });
    expect(await hireSeen(id)).toMatchObject({
      state: "cancelled",
      cancelledFrom: "recruiting",
    });
    expect((await change(id, { state: "approved" })).statusCode).toBe(409);
    await changed(id, { state: "recruiting" });
    expect(await hireSeen(id)).toMatchObject({
      state: "recruiting",
      cancelledFrom: null,
    });
    await changed(id, { state: "offer-accepted" });
    expect((await hireSeen(id))?.state).toBe("offer-accepted");
  });

  it("never moves a filled hire", async () => {
    const id = randomUUID();
    await test.connection.insert(plannedHires).values({
      id,
      title: "Fictional Filled Role",
      targetDate: "2026-01-01",
      state: "filled",
      filledBy: await person(),
    });
    const response = await change(id, { state: "cancelled" });
    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe("A filled hire stays filled");
    const removing = await send(editor, "DELETE", `/api/planned-hires/${id}`);
    expect(removing.statusCode).toBe(409);
    await changed(id, { title: "Fictional Filled Role, renamed" });
    await approved({ plannedHires: [id] });
    expect(await liveRow(id)).toMatchObject({
      title: "Fictional Filled Role, renamed",
      state: "filled",
    });
  });

  it("is refused for a hire that is not there, or that a draft removes", async () => {
    expect(
      (await change(randomUUID(), { title: "Fictional Role" })).statusCode,
    ).toBe(404);
    const id = await liveHire();
    await ok(await send(editor, "DELETE", `/api/planned-hires/${id}`));
    const response = await change(id, { title: "Fictional Role" });
    expect(response.statusCode).toBe(409);
  });

  it("is refused while someone else holds the hire with unpublished changes", async () => {
    const id = await liveHire();
    const other = await test.signedIn(["workforce-administrator"]);
    await ok(
      await send(
        other,
        "PATCH",
        `/api/planned-hires/${id}`,
        { title: unique("Fictional Held") },
        { publish: false },
      ),
    );
    expect((await hireSeen(id))?.heldBy).toEqual(expect.any(String));
    expect((await change(id, { title: "Fictional Role" })).statusCode).toBe(
      409,
    );
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

describe("a hire's draft", () => {
  it("is approved into the live hire", async () => {
    const id = await liveHire({ title: "Fictional Before" });
    await changed(id, { title: "Fictional After", state: "cancelled" });
    await approved({ plannedHires: [id] });
    expect(await liveRow(id)).toMatchObject({
      title: "Fictional After",
      state: "cancelled",
      cancelledFrom: "proposed",
    });
    expect((await hireSeen(id))?.draft).toBeUndefined();
  });

  it("is rejected with a reason, resent unchanged, and rejected again", async () => {
    const id = await liveHire();
    await changed(id, { title: unique("Fictional Rejected") });
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
    await changed(id, { title: unique("Fictional Rejected") });
    await ok(
      await send(approver, "POST", "/api/drafts/rejection", {
        plannedHires: [id],
        reason: "Fictional reason",
      }),
    );
    await changed(id, { title: unique("Fictional Fixed") });
    expect((await hireSeen(id))?.draft?.state).toBe("waiting");
  });

  it("is decided only by Approvers who see people and Confidential data, and only when there", async () => {
    const id = await liveHire();
    await changed(id, { title: unique("Fictional Role") });
    const unseeing = await test.signedIn(["approver", "resource-planner"]);
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
    const id = await liveHire({ title: "Fictional Kept" });
    const discard = (hire: string) =>
      send(editor, "DELETE", `/api/planned-hires/${hire}/draft`);
    expect((await discard(id)).statusCode).toBe(404);
    await changed(id, { title: "Fictional Changed" });
    await ok(await discard(id));
    expect(await hireSeen(id)).toMatchObject({ title: "Fictional Kept" });
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
      title: "Fictional Original",
      managerId: manager,
    });
    const renamed = await changed(id, { title: "Fictional Renamed" });
    await ok(await undo(renamed));
    expect((await hireSeen(id))?.title).toBe("Fictional Original");

    const removed = (
      await ok<{ changeSetId: string }>(
        await send(editor, "DELETE", `/api/planned-hires/${id}`),
      )
    ).changeSetId;
    await ok(await undo(removed));
    expect(await hireSeen(id)).toMatchObject({
      title: "Fictional Original",
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

describe("the people hires name", () => {
  it("cannot be removed while a hire, live or in a draft, names them as its manager", async () => {
    const live = await person();
    await liveHire({ managerId: live });
    const remove = (id: string, options?: { publish?: boolean }) =>
      send(editor, "DELETE", `/api/people/${id}`, undefined, options);
    const response = await remove(live);
    expect(response.statusCode).toBe(409);
    expect(refusal(response)).toBe(
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
        {
          title: unique("Fictional Role"),
          targetDate: "2027-03-15",
          managerId: manager,
        },
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

describe("changes to the hiring plan in the change history", () => {
  it("are shown to those who see people and Confidential data, naming states and managers", async () => {
    const manager = await person();
    const id = await liveHire({ title: unique("Fictional Historic") });
    await changed(id, { state: "cancelled", managerId: manager });
    const entries = async (who: User) =>
      (
        await ok<ChangeHistory>(await send(who, "GET", "/api/changes"))
      ).entries.filter((entry) =>
        JSON.stringify(entry).includes("Fictional Historic"),
      );
    const seen = JSON.stringify(await entries(approver));
    expect(seen).toContain("Cancelled");
    expect(seen).toContain("Proposed");
    expect(seen).toContain("Fictional Person");
    expect(await entries(planner)).toEqual([]);
  });
});

describe("each role's view of the hiring plan", () => {
  it("shows a People Manager, who sees Restricted but not Confidential data, only placeholders and none of the plan's history", async () => {
    const manager = await test.signedIn(["people-manager"]);
    const id = await liveHire({ title: unique("Fictional Managed") });
    await changed(id, { state: "cancelled" });
    const { hires, wholePlan } = await hiresSeen(manager);
    expect(wholePlan).toBe(false);
    expect(
      Object.keys(hires.find((hire) => hire.id === id) ?? {}).sort(),
    ).toEqual(["firstMonth", "id", "managerId", "managerName", "title"]);
    expect(
      JSON.stringify(
        (await ok<ChangeHistory>(await send(manager, "GET", "/api/changes")))
          .entries,
      ),
    ).not.toContain("Fictional Managed");
  });

  it("shows Leadership the whole plan, without letting it change the plan", async () => {
    const leader = await test.signedIn(["leadership"]);
    const id = await liveHire({ state: "approved" });
    expect((await hireSeen(id, leader))?.state).toBe("approved");
    expect(
      (
        await send(leader, "POST", "/api/planned-hires", {
          title: "Fictional Role",
          targetDate: "2027-03-15",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await change(id, { title: "Fictional Role" }, leader)).statusCode,
    ).toBe(403);
  });

  it.each([["administrator"], ["project-planner"], ["approver"]] as const)(
    "refuses the plan to the %s role alone",
    async (role) => {
      const user = await test.signedIn([role]);
      expect((await send(user, "GET", "/api/planned-hires")).statusCode).toBe(
        403,
      );
    },
  );

  it("shows Administrators that the hiring plan changed, without naming the hire", async () => {
    const administrator = await test.signedIn(["administrator"]);
    await draftHire({ title: unique("Fictional Unnamed") });
    const { entries } = await ok<{
      entries: { action: string; subject: unknown }[];
    }>(await send(administrator, "GET", "/api/access-history"));
    const changes = entries.filter(
      ({ action }) => action === "hiring-plan-changed",
    );
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(({ subject }) => subject === null)).toBe(true);
    expect(JSON.stringify(entries)).not.toContain("Fictional Unnamed");
  });

  it("answers an Approver who does not see Confidential data as if a hire had no draft", async () => {
    const approving = await test.signedIn(["approver", "people-manager"]);
    const id = await liveHire();
    await changed(id, { title: unique("Fictional Role") });
    expect(
      (
        await send(approving, "POST", "/api/drafts/rejection", {
          plannedHires: [id],
          reason: "Fictional reason",
        })
      ).statusCode,
    ).toBe(404);
  });

  it("keeps a placeholder as it is live, without who holds it or why its draft was rejected", async () => {
    const id = await liveHire({ title: unique("Fictional Open") });
    await changed(id, { state: "cancelled" });
    await ok(
      await send(approver, "POST", "/api/drafts/rejection", {
        plannedHires: [id],
        reason: "Fictional reason",
      }),
    );
    const other = await test.signedIn(["workforce-administrator"]);
    await ok(
      await send(
        other,
        "PATCH",
        `/api/planned-hires/${id}`,
        { title: unique("Fictional Held") },
        { publish: false },
      ),
    );
    const placeholder = await hireSeen(id, planner);
    expect(Object.keys(placeholder ?? {}).sort()).toEqual([
      "firstMonth",
      "id",
      "managerId",
      "managerName",
      "title",
    ]);
    expect(placeholder?.title).toMatch(/^Fictional Open/);
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });
});

describe("a hire's manager", () => {
  it.each([
    ["not yet started", { startDate: "2099-01-01" }],
    ["who has left", { startDate: "2019-01-01", endDate: "2020-06-30" }],
  ])(
    "is shown to readers without Restricted data only while current staff, so not one %s",
    async (_who, dates) => {
      const manager = await person(dates);
      const id = await liveHire({ managerId: manager });
      expect(await hireSeen(id, planner)).toMatchObject({
        managerId: null,
        managerName: null,
      });
      const restricted = await test.signedIn(["people-manager"]);
      expect((await hireSeen(id, restricted))?.managerId).toBe(manager);
      expect((await hireSeen(id))?.managerId).toBe(manager);
    },
  );

  it("is refused while someone's unpublished change removes them", async () => {
    const leaving = await person();
    const other = await test.signedIn(["workforce-administrator"]);
    await ok(
      await send(other, "DELETE", `/api/people/${leaving}`, undefined, {
        publish: false,
      }),
    );
    const response = await send(editor, "POST", "/api/planned-hires", {
      title: "Fictional Role",
      targetDate: "2027-03-15",
      managerId: leaving,
    });
    expect(response.statusCode).toBe(400);
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
    expect(refusal(response)).toBe(
      "A planned hire names this person; change the hire first",
    );
    await test.connection.delete(drafts).where(eq(drafts.recordId, manager));
  });
});
