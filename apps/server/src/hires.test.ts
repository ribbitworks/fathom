// SPDX-License-Identifier: Apache-2.0

// Tests for planned hires, against a migrated PostgreSQL server: who sees the whole hiring plan and
// who sees only its placeholders; drafting hires added, changed, moved between states, and removed;
// their requisitions and temporary IDs; approving, rejecting, discarding, resending, and undoing
// those drafts; keeping the people hires name; and recording changes to the plan in the access
// history without naming the hire.

import {
  accessHistory,
  changes,
  changeSets,
  drafts,
  listItems,
  lists,
  people,
  plannedHires,
} from "@fathom/db";
import {
  type ChangeHistory,
  dayIn,
  defaultTimeZone,
  type Hire,
  type Hires,
  roleSchema,
  type Unpublished,
} from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  otherTestPosition,
  startTestApp,
  type TestApp,
  testPosition,
} from "./test-app.ts";

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
// The hiring states: Proposed and Open, as Fathom starts them, and a second state meaning Open.
let proposed: string;
let open: string;
let recruiting: string;
// A position no longer offered.
const retiredPosition = "00000000-0000-4000-8000-00000000f003";

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
  planner = await test.signedIn("resource-planner");
  const states = await test.connection
    .select({ id: listItems.id, label: listItems.label, listId: lists.id })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "hiring-states"));
  proposed = String(
    states.find(({ label }) => label === "Request to hire")?.id,
  );
  open = String(states.find(({ label }) => label === "Approved to hire")?.id);
  const [added] = await test.connection
    .insert(listItems)
    .values({
      listId: String(states[0]?.listId),
      label: "Fictional Recruiting",
      position: 3,
      meaning: "open",
    })
    .returning({ id: listItems.id });
  recruiting = String(added?.id);
  const [positions] = await test.connection
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.builtIn, "positions"));
  await test.connection.insert(listItems).values({
    id: retiredPosition,
    listId: String(positions?.id),
    label: "Fictional Retired Position",
    position: 3,
    retired: true,
  });
});

afterAll(async () => {
  await test.close();
});

let count = 0;

// A name or ID no other test uses, so tests sharing the database do not collide.
function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

const send = (
  who: User,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
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

// A fictional person, approved so they are live and marked as a manager unless told otherwise.
async function person(details: object = {}): Promise<string> {
  const { ids } = await ok<{ ids: string[] }>(
    await send(editor, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("HP"),
          positionId: testPosition,
          startDate: "2020-01-01",
          isManager: true,
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

// A hire with a temporary ID, the test position, and a target date unless told otherwise.
const hireRequest = (details: object = {}) => ({
  positionId: testPosition,
  targetDate: "2027-03-15",
  ...details,
});

async function draftHire(
  details: object = {},
  who = editor,
): Promise<{ id: string; changeSetId: string }> {
  return ok(
    await send(who, "POST", "/api/planned-hires", hireRequest(details)),
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

// The number of a temporary ID, such as 7 for TBD-7.
const numberOf = (hire: Hire | undefined) =>
  Number(hire?.temporaryId?.replace("TBD-", ""));

// Positions and Hiring states start General, so every reader of placeholders sees both.
const placeholderKeys = [
  "expected",
  "id",
  "managerId",
  "managerName",
  "positionId",
  "requisition",
  "stateId",
  "temporaryId",
];

describe("the hiring plan", () => {
  it("is shown whole, with its drafts, to those who see Confidential data, by ID", async () => {
    const manager = await person();
    const later = await liveHire({
      requisition: "Zz-Fictional-REQ",
      managerId: manager,
      stateId: open,
    });
    const sooner = await draftHire({ requisition: "Aa-Fictional-REQ" });
    const { hires, wholePlan } = await hiresSeen(editor);
    expect(wholePlan).toBe(true);
    const ids = hires.map(({ id }) => id);
    expect(ids.indexOf(sooner.id)).toBeLessThan(ids.indexOf(later));
    expect(hires.find(({ id }) => id === later)).toMatchObject({
      requisition: "Zz-Fictional-REQ",
      temporaryId: null,
      positionId: testPosition,
      managerId: manager,
      managerName: expect.stringMatching(/^Fictional Person/) as unknown,
      expected: "2027-03",
      targetDate: "2027-03-15",
      stateId: open,
    });
    expect(hires.find(({ id }) => id === sooner.id)).toMatchObject({
      managerId: null,
      managerName: null,
      stateId: proposed,
      draft: { action: "created", state: "waiting", live: {} },
    });
    expect(
      hires.find(({ id }) => id === sooner.id)?.draft?.changed.sort(),
    ).toEqual(["positionId", "requisition", "stateId", "targetDate"]);
  });

  it("shows those who see people but not Confidential data only placeholders, as they are live", async () => {
    const shown = await liveHire({ stateId: proposed });
    await changed(shown, { positionId: otherTestPosition });
    const drafted = await draftHire();
    const { hires, wholePlan } = await hiresSeen(planner);
    expect(wholePlan).toBe(false);
    const ids = hires.map(({ id }) => id);
    expect(ids).toContain(shown);
    expect(ids).not.toContain(drafted.id);
    const placeholder = hires.find(({ id }) => id === shown);
    expect(Object.keys(placeholder ?? {}).sort()).toEqual(placeholderKeys);
    expect(placeholder?.positionId).toBe(testPosition);
  });

  it("expects a hire in the month of its target date, or from this month without one", async () => {
    const dated = await liveHire({ targetDate: "2028-11-30" });
    const undated = await liveHire({ targetDate: null });
    expect((await hireSeen(dated, planner))?.expected).toBe("2028-11");
    expect(await hireSeen(undated)).toMatchObject({
      expected: dayIn(defaultTimeZone).slice(0, 7),
      targetDate: null,
    });
  });

  it("shows a filled hire whose person has not started as a placeholder only to those who do not see that person", async () => {
    const starter = await person({ startDate: "2099-01-01" });
    const started = await person();
    const waiting = randomUUID();
    const done = randomUUID();
    await test.connection.insert(plannedHires).values([
      {
        id: waiting,
        temporaryNumber: 900_001,
        positionId: testPosition,
        stateId: open,
        targetDate: "2098-06-01",
        filledBy: starter,
      },
      {
        id: done,
        temporaryNumber: 900_002,
        positionId: testPosition,
        stateId: open,
        filledBy: started,
      },
    ]);
    const forPlanner = (await hiresSeen(planner)).hires.map(({ id }) => id);
    expect(forPlanner).toContain(waiting);
    expect(forPlanner).not.toContain(done);
    expect((await hireSeen(waiting, planner))?.expected).toBe("2099-01");
    const restricted = await test.signedIn("engineering-manager");
    expect(await hireSeen(waiting, restricted)).toBeUndefined();
    expect(await hireSeen(waiting)).toBeUndefined();
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

  it("shows the user's own unpublished changes as theirs, and names them by position and ID among their unpublished changes", async () => {
    const requisition = unique("Fictional-Removed");
    const id = await liveHire({ requisition });
    const { id: added } = await ok<{ id: string }>(
      await send(
        editor,
        "POST",
        "/api/planned-hires",
        hireRequest({ positionId: otherTestPosition }),
        { publish: false },
      ),
      201,
    );
    await ok(
      await send(editor, "DELETE", `/api/planned-hires/${id}`, undefined, {
        publish: false,
      }),
    );
    const shown = await hireSeen(added);
    expect(shown?.draft).toMatchObject({
      action: "created",
      unpublished: true,
    });
    const { changes } = await ok<Unpublished>(
      await send(editor, "GET", "/api/unpublished"),
    );
    const subjects = JSON.stringify(changes);
    expect(subjects).toContain(
      `the planned hire Fictional Lead, ${String(shown?.temporaryId)}`,
    );
    expect(subjects).toContain(
      `the planned hire Fictional Engineer, ${requisition}`,
    );
    await ok(await send(editor, "POST", "/api/unpublished/discard"));
    expect(await hireSeen(added)).toBeUndefined();
    expect((await hireSeen(id))?.draft).toBeUndefined();
  });

  it("is refused to those who see neither", async () => {
    const viewer = await test.signedIn("team-member");
    expect((await send(viewer, "GET", "/api/planned-hires")).statusCode).toBe(
      403,
    );
  });

  it("records reading the whole plan once a day, apart from viewing people's details, but not reading placeholders", async () => {
    await liveHire();
    const reader = await test.signedIn("executive");
    const placeholders = await test.signedIn("resource-planner");
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
      expect(refusal(response)).toBe("Someone already has that ID");
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
    expect(refusal(unknown)).toBe("Choose a manager from People");
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
    const unseeing = await test.signedIn(["drafts:approve", "people:view"]);
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
});

describe("each role's view of the hiring plan", () => {
  it("shows an Engineering Manager, who sees Restricted but not Confidential data, only placeholders and none of the plan's history", async () => {
    const manager = await test.signedIn("engineering-manager");
    const requisition = unique("Fictional-Managed");
    const id = await liveHire({ requisition });
    await changed(id, { stateId: open });
    const { hires, wholePlan } = await hiresSeen(manager);
    expect(wholePlan).toBe(false);
    expect(
      Object.keys(hires.find((hire) => hire.id === id) ?? {}).sort(),
    ).toEqual(placeholderKeys);
    expect(
      JSON.stringify(
        (await ok<ChangeHistory>(await send(manager, "GET", "/api/changes")))
          .entries,
      ),
    ).not.toContain(requisition);
  });

  it("shows Leadership the whole plan, without letting it change the plan", async () => {
    const leader = await test.signedIn("executive");
    const id = await liveHire({ stateId: open });
    expect((await hireSeen(id, leader))?.stateId).toBe(open);
    expect(
      (await send(leader, "POST", "/api/planned-hires", hireRequest()))
        .statusCode,
    ).toBe(403);
    expect((await change(id, { stateId: proposed }, leader)).statusCode).toBe(
      403,
    );
  });

  it.each([
    ["administrator"],
    ["team-member"],
    ["planner"],
    ["project-manager"],
  ] as const)("refuses the plan to the %s role alone", async (role) => {
    const user = await test.signedIn(role);
    expect((await send(user, "GET", "/api/planned-hires")).statusCode).toBe(
      403,
    );
  });

  it("shows Administrators that the hiring plan changed, without naming the hire", async () => {
    const administrator = await test.signedIn("administrator");
    const requisition = unique("Fictional-Unnamed");
    await draftHire({ requisition });
    const { entries } = await ok<{
      entries: { action: string; subject: unknown }[];
    }>(await send(administrator, "GET", "/api/access-history"));
    const changes = entries.filter(
      ({ action }) => action === "hiring-plan-changed",
    );
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(({ subject }) => subject === null)).toBe(true);
    expect(JSON.stringify(entries)).not.toContain(requisition);
  });

  it("answers an Approver who does not see Confidential data as if a hire had no draft", async () => {
    const approving = await test.signedIn([
      "drafts:approve",
      "people:view",
      "restricted:view",
    ]);
    const id = await liveHire();
    await changed(id, { stateId: open });
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
    const id = await liveHire();
    await changed(id, { positionId: otherTestPosition });
    await ok(
      await send(approver, "POST", "/api/drafts/rejection", {
        plannedHires: [id],
        reason: "Fictional reason",
      }),
    );
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
    const placeholder = await hireSeen(id, planner);
    expect(Object.keys(placeholder ?? {}).sort()).toEqual(placeholderKeys);
    expect(placeholder?.positionId).toBe(testPosition);
    expect(placeholder?.requisition).toBeNull();
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
      const restricted = await test.signedIn("engineering-manager");
      expect((await hireSeen(id, restricted))?.managerId).toBe(manager);
      expect((await hireSeen(id))?.managerId).toBe(manager);
    },
  );

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
    expect(refusal(refused)).toBe(
      "Manager? stays checked while a planned hire not yet filled names this person as its manager",
    );
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
    expect(refusal(response)).toBe(
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
    expect(refusal(undone)).toBe(
      "Manager? stays checked while a planned hire not yet filled names this person as its manager",
    );
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
    expect(refusal(undone)).toBe(
      "Fictional First Manager is not a manager yet: check Manager? on their row and have it approved first",
    );
  });

  it("is refused while someone's unpublished change removes them", async () => {
    const leaving = await person();
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await send(other, "DELETE", `/api/people/${leaving}`, undefined, {
        publish: false,
      }),
    );
    const response = await send(
      editor,
      "POST",
      "/api/planned-hires",
      hireRequest({ managerId: leaving }),
    );
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
    expect(refusal(removed)).toBe(
      "This list cannot be deleted while a column draws on it: Position",
    );
    const retired = await send(who, "PUT", `/api/lists/${states.id}/retired`, {
      retired: true,
    });
    expect(retired.statusCode).toBe(409);
    expect(refusal(retired)).toBe(
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
      expect(refusal(response)).toBe(
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
  it("needs the right to change Confidential data, not only to see it", async () => {
    const id = await liveHire();
    const who = await test.signedIn([]);
    await test.holdOnly(who.id, ["people:edit", "confidential:view"]);
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
    "refuses a %s's changes to hires unless the role may edit people and change Confidential data",
    async (role) => {
      const live = await liveHire();
      const { id } = await draftHire();
      const who = await test.signedIn(role);
      const may =
        rolesGranting("people:edit").includes(role) &&
        rolesGranting("confidential:edit").includes(role);
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

  it("lets those who may edit people and change Confidential data change it", async () => {
    const who = await test.signedIn([]);
    await test.holdOnly(who.id, ["people:edit", "confidential:edit"]);
    expect(
      (await send(who, "POST", "/api/planned-hires", hireRequest({})))
        .statusCode,
    ).toBe(201);
  });
});

describe("undoing changes to the hiring plan", () => {
  it("needs the rights to change hires when undoing, not only when the change was made", async () => {
    const maker = await test.signedIn("workforce-administrator");
    const { changeSetId } = await draftHire({}, maker);
    await test.holdOnly(maker.id, ["people:edit", "confidential:view"]);
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
