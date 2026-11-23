// SPDX-License-Identifier: Apache-2.0

// Integration tests for planned hires on the org chart, against a migrated PostgreSQL server: hires
// as placeholders and their drafts, then a team's colour.

import {
  accessHistory,
  listItems,
  lists,
  plannedHires,
  teams,
} from "@fathom/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generalApprover,
  generalReader,
  otherTestPosition,
  testPosition,
} from "./test-app.ts";
import {
  test,
  cookie,
  unique,
  approved,
  person,
  changed,
  chart,
  drafted,
  chartOn,
  startOrgChartTests,
  closeOrgChartTests,
} from "./test-org-chart.ts";

beforeAll(startOrgChartTests);

afterAll(closeOrgChartTests);

describe("planned hires on the chart", () => {
  const approveHires = async (ids: readonly string[]) => {
    const approver = await test.signedIn("engineering-director");
    const response = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/approval",
      { plannedHires: ids },
    );
    expect(response.statusCode, response.body).toBe(200);
  };
  // A planned hire with the test position, drafted, and approved unless told otherwise.
  const hire = async (details: object = {}, approve = true) => {
    const response = await test.request(cookie, "POST", "/api/planned-hires", {
      hires: [{ positionId: testPosition, ...details }],
    });
    expect(response.statusCode, response.body).toBe(201);
    const id = String(response.json<{ ids: string[] }>().ids[0]);
    if (approve) await approveHires([id]);
    return id;
  };

  it("are left out of the chart on an earlier day", async () => {
    const id = await hire();

    expect((await chart()).has(id)).toBe(true);
    expect((await chartOn("2024-06-01")).has(id)).toBe(false);
  });

  it("are drawn on later days, whatever their target date, with an undated hire expected in the day's month", async () => {
    const dated = await hire({ targetDate: "2026-07-10" });
    const undated = await hire();

    const later = await chartOn("2026-09-01");

    expect(later.get(dated)?.planned?.expected).toBe("2026-07");
    expect(later.get(dated)?.planned?.undated).toBeUndefined();
    expect(later.get(undated)?.planned).toMatchObject({
      expected: "2026-09",
      undated: true,
    });
  });
  const changeHire = async (id: string, body: object) => {
    const response = await test.request(
      cookie,
      "PATCH",
      `/api/planned-hires/${id}`,
      body,
    );
    expect(response.statusCode, response.body).toBe(200);
  };
  const madeName = /^Fictional Engineer, TBD-\d+$/;

  it("shows each hire as a placeholder under its manager, a person or a planned manager, to every reader of the chart", async () => {
    const manager = await person();
    const planned = await hire({
      isManager: true,
      managerId: manager,
      targetDate: "2026-09-10",
    });
    const name = unique("Fictional Planned Report");
    const report = await hire({ managerId: planned, name });
    const shown = await chart();
    expect(shown.get(planned)).toEqual({
      id: planned,
      keyNumber: expect.any(Number) as unknown,
      preferredName: expect.stringMatching(madeName) as unknown,
      employeeId: null,
      position: "Fictional Engineer",
      teamName: null,
      teamColour: null,
      managerId: manager,
      planned: {
        expected: "2026-09",
        shownId: expect.stringMatching(/^TBD-\d+$/) as unknown,
      },
    });
    expect(shown.get(report)).toMatchObject({
      preferredName: name,
      managerId: planned,
    });
    expect(shown.get(report)?.planned).toEqual({
      expected: "2026-06",
      undated: true,
    });
    const viewer = await test.signedIn(["people:view", "feature-teams:view"]);
    expect((await chart(viewer.cookie)).get(report)?.managerId).toBe(planned);
  });

  it("names a hire by its ID alone to those who cannot see positions", async () => {
    const id = await hire();
    await test.connection
      .update(lists)
      .set({ visibility: "personal" })
      .where(eq(lists.builtIn, "positions"));
    try {
      const viewer = await test.signedIn(["people:view", "feature-teams:view"]);
      expect((await chart(viewer.cookie)).get(id)).toMatchObject({
        preferredName: expect.stringMatching(/^TBD-\d+$/) as unknown,
        position: null,
      });
    } finally {
      await test.connection
        .update(lists)
        .set({ visibility: "general" })
        .where(eq(lists.builtIn, "positions"));
    }
  });

  it("puts a hire whose manager has not started at the top until they do", async () => {
    const starting = await person({ startDate: "2027-01-01" });
    const id = await hire({ managerId: starting });
    const shown = await chart();
    expect(shown.get(id)?.managerId).toBeNull();
    expect(shown.has(starting)).toBe(false);
    await changeHire(id, { managerId: null });
    expect((await chart()).get(id)?.draft).toBeUndefined();
    const placed = await hire({ managerId: await person() });
    await changeHire(placed, { managerId: starting });
    expect((await chart()).get(placed)?.draft?.managerId).toBeNull();
    expect((await drafted()).get(placed)?.managerId).toBeNull();
  });

  it("shows a filled hire whose person has not started only to those who do not see them", async () => {
    const starter = await person({ startDate: "2026-08-03", isManager: false });
    const started = await person({ isManager: false });
    const [waiting, done] = [randomUUID(), randomUUID()];
    const states = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .where(eq(listItems.meaning, "open"))
      .limit(1);
    const stateId = String(states[0]?.id);
    await test.connection.insert(plannedHires).values([
      {
        id: waiting,
        temporaryNumber: 900_101,
        positionId: testPosition,
        stateId,
        filledBy: starter,
      },
      {
        id: done,
        temporaryNumber: 900_102,
        positionId: testPosition,
        stateId,
        filledBy: started,
      },
    ]);
    const viewer = await test.signedIn(["people:view", "feature-teams:view"]);
    const shown = await chart(viewer.cookie);
    expect(shown.get(waiting)?.planned).toEqual({
      expected: "2026-08",
      shownId: "TBD-900101",
    });
    expect(shown.has(done)).toBe(false);
    expect((await chart()).has(waiting)).toBe(false);
  });

  it("keeps a new person a fill drafts off the chart as drafts make it until they start, for readers who do not see them", async () => {
    // Given a planned manager, approved to hire, with a hire reporting to it
    const [open] = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .where(eq(listItems.meaning, "open"))
      .limit(1);
    const stateId = String(open?.id);
    const planned = await hire({
      managerId: await person(),
      isManager: true,
      stateId,
    });
    const report = await hire({ managerId: planned });
    const starter = unique("Fictional Starter");

    // When it is filled with someone who starts later
    const response = await test.request(
      cookie,
      "POST",
      `/api/planned-hires/${planned}/fill`,
      {
        by: "new person",
        preferredName: starter,
        employeeId: unique("OC"),
        startDate: "2026-09-01",
      },
    );
    expect(response.statusCode, response.body).toBe(200);

    // Then a reader who sees the hiring plan but not Personal details sees the planned manager
    // still, its hire at the top rather than under the starter, and never the starter
    const manager = await test.signedIn(generalApprover);
    const asDrafted = await drafted(manager.cookie);
    expect(asDrafted.has(planned)).toBe(true);
    expect(asDrafted.get(report)?.managerId).toBeNull();
    expect(
      [...asDrafted.values()].some(
        ({ preferredName }) => preferredName === starter,
      ),
    ).toBe(false);
    expect((await drafted()).has(planned)).toBe(false);
  });

  it("shows hires' drafts to those who see the hiring plan: a manager beside, and the chart as drafts make it", async () => {
    const first = await person();
    const second = await person();
    const moving = await hire({ managerId: first });
    await changeHire(moving, { managerId: second });
    const renamed = await hire({ managerId: first });
    await changeHire(renamed, { name: unique("Fictional Renamed Hire") });
    const added = await hire({ managerId: first }, false);
    const removed = await hire({ managerId: first });
    const removal = await test.request(
      cookie,
      "DELETE",
      `/api/planned-hires/${removed}`,
    );
    expect(removal.statusCode, removal.body).toBe(200);
    const shown = await chart();
    expect(shown.get(moving)).toMatchObject({
      managerId: first,
      draft: { managerId: second, state: "waiting", unpublished: false },
    });
    expect(shown.get(renamed)?.draft).toBeUndefined();
    expect(shown.has(added)).toBe(false);
    const asDrafted = await drafted();
    expect(asDrafted.get(moving)?.managerId).toBe(second);
    expect(asDrafted.get(added)?.managerId).toBe(first);
    expect(asDrafted.get(renamed)?.preferredName).toMatch(
      /^Fictional Renamed Hire/,
    );
    expect(asDrafted.has(removed)).toBe(false);
    const generalViewer = await test.signedIn(generalReader);
    expect(
      (await chart(generalViewer.cookie)).get(moving)?.draft,
    ).toBeUndefined();
    const viewerDrafted = await drafted(generalViewer.cookie);
    expect(viewerDrafted.get(moving)?.managerId).toBe(first);
    expect(viewerDrafted.has(added)).toBe(false);
  });

  it("shows a hire's drafted position beside only to those who see the Positions list's tier", async () => {
    const id = await hire();
    await changeHire(id, { positionId: otherTestPosition });
    expect((await chart()).get(id)?.draft).toEqual({
      position: "Fictional Lead",
      state: "waiting",
      unpublished: false,
    });
    await test.connection
      .update(lists)
      .set({ visibility: "personal" })
      .where(eq(lists.builtIn, "positions"));
    try {
      const planReader = await test.signedIn([
        "people:view",
        "feature-teams:view",
        "hiring-plan:view",
        "confidential:view",
      ]);
      expect((await chart(planReader.cookie)).get(id)).toMatchObject({
        position: null,
      });
      expect((await chart(planReader.cookie)).get(id)?.draft).toBeUndefined();
    } finally {
      await test.connection
        .update(lists)
        .set({ visibility: "general" })
        .where(eq(lists.builtIn, "positions"));
    }
  });

  it("sends hires' drafts only to those who see people and the hiring plan, and records their view of the hiring plan", async () => {
    const first = await person();
    const moving = await hire({ managerId: first });
    await changeHire(moving, { managerId: await person() });
    const added = await hire({ managerId: first }, false);
    const plansViewed = (actorId: string) =>
      test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, actorId),
            eq(accessHistory.action, "hiring-plan-viewed"),
          ),
        );
    const chartOnly = await test.signedIn([
      "people:view",
      "feature-teams:view",
    ]);
    expect((await chart(chartOnly.cookie)).get(moving)?.draft).toBeUndefined();
    const asDrafted = await drafted(chartOnly.cookie);
    expect(asDrafted.get(moving)?.managerId).toBe(first);
    expect(asDrafted.has(added)).toBe(false);
    expect(await plansViewed(chartOnly.id)).toHaveLength(0);
    const planReader = await test.signedIn([
      "people:view",
      "feature-teams:view",
      "hiring-plan:view",
      "confidential:view",
    ]);
    await chart(planReader.cookie);
    expect(await plansViewed(planReader.id)).toHaveLength(1);
  });

  it("records a view of Personal details when placeholders show positions more sensitive than General", async () => {
    await hire();
    await test.connection
      .update(lists)
      .set({ visibility: "personal" })
      .where(eq(lists.builtIn, "positions"));
    try {
      const viewer = await test.signedIn([
        "people:view",
        "feature-teams:view",
        "personal:view",
      ]);
      await chart(viewer.cookie);
      const views = await test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, viewer.id),
            eq(accessHistory.action, "personal-viewed"),
          ),
        );
      expect(views).toHaveLength(1);
    } finally {
      await test.connection
        .update(lists)
        .set({ visibility: "general" })
        .where(eq(lists.builtIn, "positions"));
    }
  });

  it("takes a rejected hire's draft back on the chart as drafts make it, and records no Personal view for it", async () => {
    const first = await person();
    const second = await person();
    const moving = await hire({ managerId: first });
    await changeHire(moving, { managerId: second });
    const approver = await test.signedIn("engineering-director");
    const rejected = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/rejection",
      { plannedHires: [moving], reason: "Fictional reason" },
    );
    expect(rejected.statusCode, rejected.body).toBe(200);
    expect((await chart()).get(moving)?.draft?.state).toBe("rejected");
    expect((await drafted()).get(moving)?.managerId).toBe(first);
    const viewer = await test.signedIn([
      "people:view",
      "feature-teams:view",
      "hiring-plan:view",
      "confidential:view",
    ]);
    expect((await chart(viewer.cookie)).get(moving)?.draft?.managerId).toBe(
      second,
    );
    const views = await test.connection
      .select({ id: accessHistory.id })
      .from(accessHistory)
      .where(
        and(
          eq(accessHistory.actorId, viewer.id),
          eq(accessHistory.action, "personal-viewed"),
        ),
      );
    expect(views).toHaveLength(0);
  });
});

// After the planned hire tests: run as the same user, these publish a planned hire's fill one of
// them leaves unpublished, the only test of taking a fill into what is published.
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

  it("is changed only by those whose roles let them edit people, such as Engineering Directors", async () => {
    const manager = await person({ teamName: unique("Fictional Team") });
    const reader = await test.signedIn(generalReader);
    expect(
      (await colour(manager, { colour: "teal" }, reader.cookie)).statusCode,
    ).toBe(403);
    expect((await teamRow(manager))[0]?.colour).toBeNull();
    const director = await test.signedIn("engineering-director");
    expect(
      (await colour(manager, { colour: "teal" }, director.cookie)).statusCode,
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
