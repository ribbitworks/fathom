// SPDX-License-Identifier: Apache-2.0

// Tests for the org chart, against a migrated PostgreSQL server: who appears, under whom, with
// which details, as the lines approved for today have it, never as drafted; managers whose end date
// has passed, and what each reader is told of them; and what each role may read.

import { accessHistory, teams } from "@fathom/db";
import { type OrgChartPerson, roleSchema } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  otherTestPosition,
  startTestApp,
  type TestApp,
  testPosition,
} from "./test-app.ts";

// The server takes today's date from the clock, so the tests fix it, to give the same days on every
// run.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

let test: TestApp;
let cookie = "";

beforeAll(async () => {
  test = await startTestApp();
  ({ cookie } = await test.signedIn("workforce-administrator"));
});

afterAll(async () => {
  await test.close();
  vi.useRealTimers();
});

let count = 0;

// A name or Employee ID no other test uses, so tests sharing the database do not collide.
function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

async function approved(ids: readonly string[]) {
  const approver = await test.signedIn("engineering-director");
  const response = await test.request(
    approver.cookie,
    "POST",
    "/api/drafts/approval",
    { people: ids },
  );
  expect(response.statusCode, response.body).toBe(200);
}

// A fictional person, approved so they are live, who started in 2020 and is marked as a manager
// unless told otherwise.
async function person(details: object = {}): Promise<string> {
  const response = await test.request(cookie, "POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("OC"),
        positionId: testPosition,
        startDate: "2020-01-01",
        isManager: true,
        ...details,
      },
    ],
  });
  expect(response.statusCode, response.body).toBe(201);
  const id = String(response.json<{ ids: string[] }>().ids[0]);
  await approved([id]);
  return id;
}

async function changed(id: string, body: object) {
  const response = await test.request(
    cookie,
    "PATCH",
    `/api/people/${id}`,
    body,
  );
  expect(response.statusCode, response.body).toBe(200);
}

async function chart(as = cookie): Promise<Map<string, OrgChartPerson>> {
  const response = await test.request(as, "GET", "/api/org-chart");
  expect(response.statusCode, response.body).toBe(200);
  return new Map(
    response
      .json<{ people: OrgChartPerson[] }>()
      .people.map((one) => [one.id, one]),
  );
}

describe("the org chart", () => {
  it("shows each person under their manager, with their position and the team they lead", async () => {
    const manager = await person({
      positionId: otherTestPosition,
      teamName: unique("Fictional Team"),
    });
    const report = await person({ managerId: manager, isManager: false });
    const shown = await chart();
    expect(shown.get(manager)).toMatchObject({
      managerId: null,
      position: "Fictional Lead",
      teamName: expect.stringMatching(/^Fictional Team/) as unknown,
    });
    const reportShown = shown.get(report);
    expect(reportShown?.managerId).toBe(manager);
    expect(reportShown?.position).toBe("Fictional Engineer");
    expect(reportShown?.teamName).toBeNull();
    expect(reportShown).not.toHaveProperty("startDate");
    expect(reportShown).not.toHaveProperty("left");
  });

  it("shows the lines approved for today, never a draft's", async () => {
    const first = await person();
    const second = await person();
    const report = await person({ managerId: first, isManager: false });
    await changed(report, { managerId: second });
    expect((await chart()).get(report)?.managerId).toBe(first);
    const added = await test.request(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("OC"),
          positionId: testPosition,
        },
      ],
    });
    const draftedId = String(added.json<{ ids: string[] }>().ids[0]);
    expect((await chart()).has(draftedId)).toBe(false);
  });

  it("leaves out people who have not started or have gone", async () => {
    const future = await person({ startDate: "2026-09-01" });
    const gone = await person({ endDate: "2025-12-31", isManager: false });
    const shown = await chart();
    expect(shown.has(future)).toBe(false);
    expect(shown.has(gone)).toBe(false);
  });

  // A current report under a manager who has left, under another manager who has left.
  async function leftChain() {
    const top = await person();
    const middle = await person({ teamName: unique("Fictional Team") });
    const report = await person({ isManager: false });
    await changed(middle, { managerId: top, managerFrom: "2024-03-01" });
    await changed(report, { managerId: middle, managerFrom: "2024-03-01" });
    await approved([middle, report]);
    await changed(top, { endDate: "2026-06-01" });
    await changed(middle, { endDate: "2026-06-14" });
    await approved([top, middle]);
    return { top, middle, report };
  }

  const restrictedViews = (actorId: string) =>
    test.connection
      .select({ id: accessHistory.id })
      .from(accessHistory)
      .where(
        and(
          eq(accessHistory.actorId, actorId),
          eq(accessHistory.action, "restricted-viewed"),
        ),
      );

  it("shows managers who have left, up the chain, to those who see Restricted details, and records it", async () => {
    const { top, middle, report } = await leftChain();
    const viewer = await test.signedIn("executive");
    const shown = await chart(viewer.cookie);
    expect(shown.get(report)?.managerId).toBe(middle);
    expect(shown.get(middle)).toMatchObject({
      managerId: top,
      employeeId: expect.stringMatching(/^OC/) as unknown,
      position: "Fictional Engineer",
      left: true,
    });
    expect(shown.get(top)?.left).toBe(true);
    expect(await restrictedViews(viewer.id)).toHaveLength(1);
  });

  it("shows anyone else only a report's own manager who has left, by name, at the top", async () => {
    const { top, middle, report } = await leftChain();
    const planner = await test.signedIn("resource-planner");
    const shown = await chart(planner.cookie);
    expect(shown.get(report)?.managerId).toBe(middle);
    expect(shown.get(middle)).toEqual({
      id: middle,
      preferredName: expect.stringMatching(/^Fictional Person/) as unknown,
      employeeId: null,
      position: null,
      teamName: expect.stringMatching(/^Fictional Team/) as unknown,
      teamColour: null,
      managerId: null,
    });
    expect(shown.has(top)).toBe(false);
    expect(await restrictedViews(planner.id)).toHaveLength(0);
  });

  it("leaves out a manager who has left once nobody current reports to them", async () => {
    const manager = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: manager, managerFrom: "2024-03-01" });
    await approved([report]);
    await changed(report, { endDate: "2026-06-01" });
    await changed(manager, { endDate: "2026-06-14" });
    await approved([manager, report]);
    const shown = await chart();
    expect(shown.has(manager)).toBe(false);
    expect(shown.has(report)).toBe(false);
  });

  describe("for each role", () => {
    let middle = "";

    beforeAll(async () => {
      ({ middle } = await leftChain());
    });

    it.each(roleSchema.options)(
      "answers a %s as its access allows",
      async (role) => {
        const { cookie: as } = await test.signedIn(role);
        const response = await test.request(as, "GET", "/api/org-chart");
        if (!rolesGranting("people:view").includes(role)) {
          expect(response.statusCode).toBe(403);
          return;
        }
        expect(response.statusCode).toBe(200);
        const shown = response
          .json<{ people: OrgChartPerson[] }>()
          .people.find((one) => one.id === middle);
        const restricted = rolesGranting("restricted:view").includes(role);
        expect(shown?.left).toBe(restricted ? true : undefined);
        expect(shown?.employeeId === null).toBe(!restricted);
      },
    );
  });
});

describe("a team's colour", () => {
  const colour = (managerId: string, body: object, as = cookie) =>
    test.request(as, "PUT", `/api/org-chart/teams/${managerId}/colour`, body);
  const teamRow = async (managerId: string) =>
    test.connection.select().from(teams).where(eq(teams.managerId, managerId));

  it("is set at once, with no draft, and drawn on the chart", async () => {
    const manager = await person({ teamName: unique("Fictional Team") });
    expect((await colour(manager, { colour: "teal" })).statusCode).toBe(204);
    expect((await chart()).get(manager)?.teamColour).toBe("teal");
    const listed = await test.request(cookie, "GET", "/api/people");
    const shown = listed
      .json<{ people: { id: string; draft?: unknown }[] }>()
      .people.find((one) => one.id === manager);
    expect(shown?.draft).toBeUndefined();
    const unpublished = await test.request(cookie, "GET", "/api/unpublished");
    expect(unpublished.json<{ changes: unknown[] }>().changes).toEqual([]);
  });

  it("is removed with none, keeping the team's name", async () => {
    const name = unique("Fictional Team");
    const manager = await person({ teamName: name });
    await colour(manager, { colour: "lime" });
    expect((await colour(manager, { colour: null })).statusCode).toBe(204);
    expect(await teamRow(manager)).toEqual([
      { managerId: manager, name, colour: null },
    ]);
  });

  it("may not be one the palette does not have", async () => {
    const manager = await person({ teamName: unique("Fictional Team") });
    expect((await colour(manager, { colour: "beige" })).statusCode).toBe(400);
  });

  it("needs the team's name to be approved", async () => {
    const unnamed = await person();
    expect((await colour(unnamed, { colour: "teal" })).statusCode).toBe(404);
    await changed(unnamed, { teamName: unique("Fictional Team") });
    expect((await colour(unnamed, { colour: "teal" })).statusCode).toBe(404);
  });

  it("is kept when the team is renamed, and goes with its name", async () => {
    const manager = await person({ teamName: unique("Fictional Team") });
    await colour(manager, { colour: "orange" });
    await changed(manager, { teamName: unique("Fictional Team") });
    await approved([manager]);
    expect((await teamRow(manager))[0]?.colour).toBe("orange");
    await changed(manager, { teamName: "" });
    await approved([manager]);
    expect(await teamRow(manager)).toEqual([]);
    await changed(manager, { teamName: unique("Fictional Team") });
    await approved([manager]);
    expect((await teamRow(manager))[0]?.colour).toBeNull();
  });

  it("is changed only by those whose roles let them colour teams, such as Engineering Managers", async () => {
    const manager = await person({ teamName: unique("Fictional Team") });
    const reader = await test.signedIn("resource-planner");
    expect(
      (await colour(manager, { colour: "teal" }, reader.cookie)).statusCode,
    ).toBe(403);
    expect((await teamRow(manager))[0]?.colour).toBeNull();
    const engineeringManager = await test.signedIn("engineering-manager");
    expect(
      (await colour(manager, { colour: "teal" }, engineeringManager.cookie))
        .statusCode,
    ).toBe(204);
    expect((await teamRow(manager))[0]?.colour).toBe("teal");
  });

  it("shows as none once the palette no longer has it", async () => {
    const manager = await person({ teamName: unique("Fictional Team") });
    await test.connection
      .update(teams)
      .set({ colour: "beige" })
      .where(eq(teams.managerId, manager));
    expect((await chart()).get(manager)?.teamColour).toBeNull();
  });
});
