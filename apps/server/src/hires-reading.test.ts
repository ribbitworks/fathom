// SPDX-License-Identifier: Apache-2.0

// Integration tests for reading the hiring plan, against a migrated PostgreSQL server: who sees the
// whole plan and who sees only its placeholders, hires on People, and each role's view of the plan.

import { accessHistory, drafts, plannedHires } from "@fathom/db";
import {
  type ChangeHistory,
  dayIn,
  defaultTimeZone,
  type Hires,
  type Person,
  roleSchema,
  type Unpublished,
} from "@fathom/shared";
import { and, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  generalApprover,
  generalReader,
  ok,
  otherTestPosition,
  testPosition,
  unique,
  type User,
} from "./test-app.ts";
import {
  test,
  editor,
  approver,
  planner,
  proposed,
  open,
  hired,
  send,
  person,
  hireRequest,
  draftHire,
  liveHire,
  hiresSeen,
  hireSeen,
  change,
  changed,
  startHireTests,
  closeHireTests,
} from "./test-hires.ts";

beforeAll(startHireTests);

afterAll(closeHireTests);

// Positions and Hiring states start General, so every reader of placeholders sees both.
const placeholderKeys = [
  "days",
  "expected",
  "flags",
  "id",
  "isManager",
  "keyNumber",
  "linked",
  "links",
  "managerId",
  "managerName",
  "name",
  "notes",
  "numbers",
  "positionId",
  "requisition",
  "stateId",
  "temporaryId",
  "texts",
  "values",
];

describe("the hiring plan", () => {
  it("is shown whole, with its drafts, to those who see the hiring plan, by ID", async () => {
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
    const personalReader = await test.signedIn("engineering-manager");
    expect(await hireSeen(waiting, personalReader)).toBeUndefined();
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
    // No one changed it, so no one may discard it.
    await test.connection.delete(drafts).where(eq(drafts.recordId, id));
  });

  it("shows the user's own unpublished changes as theirs, and names them by position and ID among their unpublished changes", async () => {
    const requisition = unique("Fictional-Removed");
    const id = await liveHire({ requisition });
    const {
      ids: [added = ""],
    } = await ok<{ ids: string[] }>(
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
    const viewer = await test.signedIn(["plan:view"]);
    expect((await send(viewer, "GET", "/api/planned-hires")).statusCode).toBe(
      403,
    );
  });

  it("records reading the whole plan once a day, apart from viewing people's details, but not reading placeholders", async () => {
    await liveHire();
    const reader = await test.signedIn("executive");
    const placeholders = await test.signedIn(generalReader);
    await ok(await send(reader, "GET", "/api/people"));
    await hiresSeen(reader);
    await hiresSeen(reader);
    await hiresSeen(placeholders);
    const viewsBy = async (who: User) =>
      test.connection
        .select({ action: accessHistory.action })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, who.id),
            ne(accessHistory.action, "signed-in"),
          ),
        );
    expect(await viewsBy(reader)).toEqual([
      { action: "personal-viewed" },
      { action: "hiring-plan-viewed" },
    ]);
    expect(await viewsBy(placeholders)).toEqual([]);
  });
});

describe("on People", () => {
  const rowOn = async (id: string, who: User) =>
    (
      await ok<{ people: Person[] }>(await send(who, "GET", "/api/people"))
    ).people.find((row) => row.id === id);

  it("shows each hire as a row after the people, by its ID, its target date as its start date and its draft beside, to those who see the whole plan", async () => {
    const manager = await person({ teamName: unique("Fictional Team") });
    const requisition = unique("Fictional-REQ-Row");
    const id = await liveHire({ requisition, managerId: manager });
    await changed(id, { requisition: null, targetDate: "2027-05-02" });
    const row = await rowOn(id, editor);
    expect(row).toMatchObject({
      kind: "planned-hire",
      preferredName: "",
      employeeId: expect.stringMatching(/^TBD-\d+$/) as string,
      positionId: testPosition,
      stateId: proposed,
      startDate: "2027-05-02",
      expected: "2027-05",
      manager: { id: manager },
      team: expect.stringMatching(/^Fictional Team/) as string,
      values: {},
      draft: {
        action: "changed",
        changed: expect.arrayContaining([
          "employeeId",
          "startDate",
        ]) as string[],
        live: { employeeId: requisition, startDate: "2027-03-15" },
      },
    });
    const { people } = await ok<{ people: { kind?: string }[] }>(
      await send(editor, "GET", "/api/people"),
    );
    const firstHire = people.findIndex(({ kind }) => kind === "planned-hire");
    expect(
      people.slice(firstHire).every(({ kind }) => kind === "planned-hire"),
    ).toBe(true);
  });

  it("names a named hire by its name in the change history and among unpublished changes", async () => {
    const name = unique("Fictional History Hire");
    const id = await liveHire({ name });
    const history = JSON.stringify(
      (await ok<ChangeHistory>(await send(approver, "GET", "/api/changes")))
        .entries,
    );
    expect(history).toContain(name);
    await ok(
      await send(
        editor,
        "PATCH",
        `/api/planned-hires/${id}`,
        { targetDate: "2028-01-03" },
        { publish: false },
      ),
    );
    expect(
      JSON.stringify(
        await ok<Unpublished>(await send(editor, "GET", "/api/unpublished")),
      ),
    ).toContain(`the planned hire ${name}`);
    await ok(await send(editor, "POST", "/api/unpublished/discard"));
  });

  it("names a hire as it is named, to everyone who sees it, and shows every person Hired", async () => {
    const name = unique("Fictional Backend Hire");
    const id = await liveHire({ name });
    expect(await rowOn(id, planner)).toMatchObject({ preferredName: name });
    await changed(id, { name: null });
    expect(await rowOn(id, editor)).toMatchObject({
      preferredName: "",
      draft: { changed: ["preferredName"], live: { preferredName: name } },
    });
    const someone = await person();
    expect(await rowOn(someone, planner)).toMatchObject({ stateId: hired });
  });

  it("shows a draft that names a hire, gives it a requisition, and changes its manager with the row's live values, and who holds it", async () => {
    const manager = await person();
    const id = await liveHire();
    await changed(id, {
      name: unique("Fictional Named"),
      requisition: unique("Fictional-REQ-Given"),
      managerId: manager,
    });
    const row = await rowOn(id, editor);
    expect(row?.draft?.changed).toEqual(
      expect.arrayContaining(["preferredName", "employeeId", "managerId"]),
    );
    expect(row?.draft?.live).toMatchObject({
      preferredName: "",
      employeeId: expect.stringMatching(/^TBD-\d+$/) as string,
      managerId: null,
    });
    const held = await liveHire();
    const other = await test.signedIn("workforce-administrator");
    await ok(
      await send(
        other,
        "PATCH",
        `/api/planned-hires/${held}`,
        { name: unique("Fictional Held") },
        { publish: false },
      ),
    );
    expect((await rowOn(held, editor))?.heldBy).toEqual(expect.any(String));
    await ok(await send(other, "POST", "/api/unpublished/discard"));
  });

  it("shows only the placeholder, live, to those who do not see the whole plan", async () => {
    const requisition = unique("Fictional-REQ-Placeholder");
    const id = await liveHire({ requisition });
    await changed(id, { targetDate: "2027-08-01" });
    const row = await rowOn(id, planner);
    expect(row).toMatchObject({
      kind: "planned-hire",
      employeeId: requisition,
      expected: "2027-03",
    });
    expect(row).not.toHaveProperty("startDate");
    expect(row).not.toHaveProperty("draft");
  });
});

describe("each role's view of the hiring plan", () => {
  it("shows those who see Personal and Confidential data, but not the hiring plan, only placeholders and none of the plan's history", async () => {
    const manager = await test.signedIn([
      "people:view",
      "personal:view",
      "confidential:view",
    ]);
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

  it("shows an Approver of hires without Personal data the whole plan, with each hire's target date on People", async () => {
    const id = await liveHire({ stateId: open });
    const manager = await test.signedIn(generalApprover);
    const seen = await hiresSeen(manager);
    expect(seen.wholePlan).toBe(true);
    expect(seen.hires.find((hire) => hire.id === id)?.targetDate).toBe(
      "2027-03-15",
    );
    const { people: rows } = await ok<{ people: Person[] }>(
      await send(manager, "GET", "/api/people"),
    );
    expect(rows.find((row) => row.id === id)?.startDate).toBe("2027-03-15");
    expect(
      rows.some((row) => row.kind !== "planned-hire" && "startDate" in row),
    ).toBe(false);
  });

  it.each(roleSchema.options)(
    "shows a %s the whole plan, with target dates, only when the role sees people and the hiring plan",
    async (role) => {
      const id = await liveHire();
      const who = await test.signedIn(role);
      const response = await send(who, "GET", "/api/planned-hires");
      if (!rolesGranting("people:view").includes(role)) {
        expect(response.statusCode).toBe(403);
        return;
      }
      const { hires, wholePlan } = response.json<Hires>();
      const whole = rolesGranting("hiring-plan:view").includes(role);
      expect(wholePlan).toBe(whole);
      expect(hires.find((hire) => hire.id === id)?.targetDate).toBe(
        whole ? "2027-03-15" : undefined,
      );
    },
  );

  it("lets a Project Manager approve drafts of people's General details and of hires", async () => {
    const manager = await test.signedIn("project-manager");
    const someone = await person();
    await ok(
      await send(editor, "PATCH", `/api/people/${someone}`, {
        preferredName: unique("Fictional Renamed"),
      }),
    );
    const id = await liveHire();
    await changed(id, {
      requisition: unique("Fictional-PM-Approved"),
      stateId: open,
    });
    await ok(
      await send(manager, "POST", "/api/drafts/approval", {
        people: [someone],
        plannedHires: [id],
      }),
    );
    expect((await hireSeen(id))?.draft).toBeUndefined();
    expect((await hireSeen(id))?.stateId).toBe(open);
  });

  it.each([["administrator"]] as const)(
    "refuses the plan to the %s role alone",
    async (role) => {
      const user = await test.signedIn(role);
      expect((await send(user, "GET", "/api/planned-hires")).statusCode).toBe(
        403,
      );
    },
  );

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

  it("answers an Approver who does not see the hiring plan as if a hire had no draft", async () => {
    const approving = await test.signedIn([
      "hiring-plan:approve",
      "people:view",
      "personal:view",
      "confidential:view",
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
