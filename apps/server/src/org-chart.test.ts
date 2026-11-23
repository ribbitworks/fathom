// SPDX-License-Identifier: Apache-2.0

// Integration tests for the org chart, against a migrated PostgreSQL server: who appears, under
// whom, with which details, as the lines approved for today have it, with drafts of managers,
// positions and team names beside, as each reader may see them; managers whose end date has passed;
// and what each role may read.

import { accessHistory, lists } from "@fathom/db";
import {
  type OrgChartPerson,
  type Permission,
  roleSchema,
} from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rolesGranting } from "./access.ts";
import { generalReader, otherTestPosition, testPosition } from "./test-app.ts";
import {
  test,
  cookie,
  unique,
  approved,
  person,
  changed,
  chart,
  drafted,
  startOrgChartTests,
  closeOrgChartTests,
} from "./test-org-chart.ts";

beforeAll(startOrgChartTests);

afterAll(closeOrgChartTests);

describe("the org chart", () => {
  const personalViews = (actorId: string) =>
    test.connection
      .select({ id: accessHistory.id })
      .from(accessHistory)
      .where(
        and(
          eq(accessHistory.actorId, actorId),
          eq(accessHistory.action, "personal-viewed"),
        ),
      );

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

  it("shows the lines approved for today, with a drafted manager beside", async () => {
    const first = await person();
    const second = await person();
    const report = await person({ managerId: first, isManager: false });
    await changed(report, { managerId: second });
    expect((await chart()).get(report)).toMatchObject({
      managerId: first,
      draft: { managerId: second, state: "waiting", unpublished: false },
    });
  });

  it("leaves out people only drafted to be added", async () => {
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

  it("leaves out a draft that keeps the manager, such as one moving only the line's date", async () => {
    const manager = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: manager, managerFrom: "2024-03-01" });
    await approved([report]);
    await changed(report, { managerFrom: "2024-04-01" });
    expect((await chart()).get(report)).not.toHaveProperty("draft");
  });

  it("shows a drafted manager, which is Personal, only to those who see Personal details, and records it", async () => {
    const first = await person();
    const second = await person();
    const report = await person({ managerId: first, isManager: false });
    await changed(report, { managerId: second });
    const executive = await test.signedIn("executive");
    expect((await chart(executive.cookie)).get(report)?.draft).toEqual({
      managerId: second,
      managerFrom: "2026-06-15",
      state: "waiting",
      unpublished: false,
    });
    expect(await personalViews(executive.id)).toHaveLength(1);
    const generalViewer = await test.signedIn(generalReader);
    const shown = (await chart(generalViewer.cookie)).get(report);
    expect(shown?.managerId).toBe(first);
    expect(shown).not.toHaveProperty("draft");
    expect(await personalViews(generalViewer.id)).toHaveLength(0);
  });

  it("shows a drafted team name, or its removal, to everyone who sees people", async () => {
    const named = await person({ teamName: unique("Fictional Team") });
    const unnamed = await person();
    const renamed = unique("Fictional Team");
    await changed(named, { teamName: null });
    await changed(unnamed, { teamName: renamed });
    const generalViewer = await test.signedIn(generalReader);
    const shown = await chart(generalViewer.cookie);
    expect(shown.get(named)?.draft).toEqual({
      teamName: null,
      state: "waiting",
      unpublished: false,
    });
    expect(shown.get(unnamed)).toMatchObject({
      teamName: null,
      draft: { teamName: renamed, state: "waiting", unpublished: false },
    });
  });

  it("shows a drafted position beside only to those who see the Positions list's tier, and records one above General", async () => {
    const changing = await person({ isManager: false });
    await changed(changing, { positionId: otherTestPosition });
    const draftFor = async (permissions: readonly Permission[]) => {
      const reader = await test.signedIn(permissions);
      return {
        draft: (await chart(reader.cookie)).get(changing)?.draft,
        recorded: (await personalViews(reader.id)).length > 0,
      };
    };
    expect(await draftFor(["people:view", "feature-teams:view"])).toEqual({
      draft: {
        position: "Fictional Lead",
        state: "waiting",
        unpublished: false,
      },
      recorded: false,
    });
    const marked = (visibility: "general" | "confidential") =>
      test.connection
        .update(lists)
        .set({ visibility })
        .where(eq(lists.builtIn, "positions"));
    await marked("confidential");
    try {
      expect(await draftFor(["people:view", "feature-teams:view"])).toEqual({
        draft: undefined,
        recorded: false,
      });
      // A reader without Personal details, so only the position can be what is recorded.
      expect(
        await draftFor([
          "people:view",
          "feature-teams:view",
          "confidential:view",
        ]),
      ).toEqual({
        draft: {
          position: "Fictional Lead",
          state: "waiting",
          unpublished: false,
        },
        recorded: true,
      });
    } finally {
      await marked("general");
    }
  });

  it("leaves out a drafted position that keeps the live one", async () => {
    const keeping = await person({ isManager: false });
    await changed(keeping, { positionId: otherTestPosition });
    await changed(keeping, { positionId: testPosition });
    expect((await chart()).get(keeping)).not.toHaveProperty("draft");
  });

  it("marks a rejected draft", async () => {
    const manager = await person();
    const name = unique("Fictional Team");
    await changed(manager, { teamName: name });
    const approver = await test.signedIn("engineering-director");
    const response = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/rejection",
      { people: [manager], reason: "Fictional reason" },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect((await chart()).get(manager)?.draft).toEqual({
      teamName: name,
      state: "rejected",
      unpublished: false,
    });
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

  it("draws the chart as drafts make it: managers, names, positions and team names changed", async () => {
    const first = await person();
    const second = await person({ teamName: unique("Fictional Team") });
    const report = await person({ managerId: first, isManager: false });
    const renamed = unique("Fictional Person");
    await changed(report, {
      managerId: second,
      preferredName: renamed,
      positionId: otherTestPosition,
    });
    await changed(second, { teamName: null });
    const shown = await drafted();
    expect(shown.get(report)).toMatchObject({
      managerId: second,
      preferredName: renamed,
      position: "Fictional Lead",
    });
    expect(shown.get(report)).not.toHaveProperty("draft");
    expect(shown.get(second)?.teamName).toBeNull();
  });

  it("draws people drafted to be added, and leaves out those drafted to be removed", async () => {
    const manager = await person();
    const leaving = await person({ isManager: false });
    const added = await test.request(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("OC"),
          positionId: testPosition,
          startDate: "2026-06-01",
          managerId: manager,
        },
      ],
    });
    expect(added.statusCode, added.body).toBe(201);
    const addedId = String(added.json<{ ids: string[] }>().ids[0]);
    const removed = await test.request(
      cookie,
      "DELETE",
      `/api/people/${leaving}`,
    );
    expect(removed.statusCode, removed.body).toBe(200);
    const shown = await drafted();
    expect(shown.get(addedId)?.managerId).toBe(manager);
    expect(shown.has(leaving)).toBe(false);
    expect((await chart()).has(leaving)).toBe(true);
  });

  it("leaves out someone whose draft adding them was rejected", async () => {
    const added = await test.request(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("OC"),
          positionId: testPosition,
          startDate: "2026-06-01",
        },
      ],
    });
    const addedId = String(added.json<{ ids: string[] }>().ids[0]);
    const approver = await test.signedIn("engineering-director");
    const response = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/rejection",
      { people: [addedId], reason: "Fictional reason" },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect((await drafted()).has(addedId)).toBe(false);
  });

  it("keeps positions, drafted or not, from those who cannot see the Positions list", async () => {
    const changing = await person({ isManager: false });
    await changed(changing, { positionId: otherTestPosition });
    const added = await test.request(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("OC"),
          positionId: otherTestPosition,
          startDate: "2026-06-01",
        },
      ],
    });
    const addedId = String(added.json<{ ids: string[] }>().ids[0]);
    const setVisibility = (visibility: string) =>
      test.connection
        .update(lists)
        .set({ visibility })
        .where(eq(lists.builtIn, "positions"));
    await setVisibility("personal");
    try {
      const generalViewer = await test.signedIn(generalReader);
      const shown = await drafted(generalViewer.cookie);
      expect(shown.get(changing)?.position).toBeNull();
      expect(shown.get(addedId)?.position).toBeNull();
    } finally {
      await setVisibility("general");
    }
  });

  it("takes rejected drafts back", async () => {
    const first = await person();
    const second = await person();
    const report = await person({ managerId: first, isManager: false });
    await changed(report, { managerId: second });
    const approver = await test.signedIn("engineering-director");
    const response = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/rejection",
      { people: [report], reason: "Fictional reason" },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect((await drafted()).get(report)?.managerId).toBe(first);
  });

  it("applies drafts' managers and dates only for those who see Personal details", async () => {
    const first = await person();
    const second = await person();
    const report = await person({ managerId: first, isManager: false });
    const ending = await person({ isManager: false });
    await changed(report, { managerId: second });
    await changed(ending, { endDate: "2026-06-01" });
    const executive = await test.signedIn("executive");
    const forExecutive = await drafted(executive.cookie);
    expect(forExecutive.get(report)?.managerId).toBe(second);
    expect(forExecutive.has(ending)).toBe(false);
    const generalViewer = await test.signedIn(generalReader);
    const forPlanner = await drafted(generalViewer.cookie);
    expect(forPlanner.get(report)?.managerId).toBe(first);
    expect(forPlanner.has(ending)).toBe(true);
    expect(await personalViews(generalViewer.id)).toHaveLength(0);
  });

  it("shows managers who have left, up the chain, to those who see Personal details, and records it", async () => {
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
    expect(await personalViews(viewer.id)).toHaveLength(1);
  });

  it("draws the whole chain for anyone else, without saying who has left", async () => {
    const { top, middle, report } = await leftChain();
    const generalViewer = await test.signedIn(generalReader);
    const shown = await chart(generalViewer.cookie);
    expect(shown.get(report)?.managerId).toBe(middle);
    expect(shown.get(middle)?.managerId).toBe(top);
    expect(shown.get(middle)).not.toHaveProperty("left");
    expect(shown.get(middle)?.employeeId).toBeNull();
    expect(shown.get(report)?.employeeId).not.toBeNull();
    expect(shown.has(top)).toBe(true);
    expect(await personalViews(generalViewer.id)).toHaveLength(0);
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

  it("shows a position only to those who see the positions list's tier, as People does", async () => {
    const manager = await person();
    const positionFor = async (permissions: readonly Permission[]) => {
      const { cookie: as } = await test.signedIn(permissions);
      return (await chart(as)).get(manager)?.position;
    };
    const marked = (visibility: "general" | "personal" | "confidential") =>
      test.connection
        .update(lists)
        .set({ visibility })
        .where(eq(lists.builtIn, "positions"));
    expect(await positionFor(["people:view"])).not.toBeNull();
    try {
      await marked("personal");
      expect(await positionFor(["people:view"])).toBeNull();
      expect(
        await positionFor(["people:view", "personal:view"]),
      ).not.toBeNull();
      await marked("confidential");
      expect(await positionFor(["people:view", "personal:view"])).toBeNull();
      expect(
        await positionFor(["people:view", "confidential:view"]),
      ).not.toBeNull();
    } finally {
      await marked("general");
    }
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
        const everyone = response.json<{ people: OrgChartPerson[] }>().people;
        const shown = everyone.find((one) => one.id === middle);
        const seesPersonal = rolesGranting("personal:view").includes(role);
        expect(shown?.left).toBe(seesPersonal ? true : undefined);
        expect(shown?.employeeId === null).toBe(
          !rolesGranting("people:view").includes(role) || !seesPersonal,
        );
        // Those who do not see people see names, positions, and teams, but no Employee IDs.
        if (!rolesGranting("people:view").includes(role)) {
          expect(everyone.every((one) => one.employeeId === null)).toBe(true);
          expect(everyone.some((one) => one.position !== null)).toBe(true);
        }
      },
    );
  });
});
