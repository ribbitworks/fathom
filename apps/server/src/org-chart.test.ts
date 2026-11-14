// SPDX-License-Identifier: Apache-2.0

// Tests for the org chart, against a migrated PostgreSQL server: who appears, under whom, with
// which details, as the lines approved for today have it, with drafts of managers, positions and
// team names beside, as each reader may see them; managers whose end date has passed, and what each
// reader is told of them; planned hires as placeholders, and their drafts; the chart on a chosen
// day, with drafts laid over it for those who may change reporting lines from it; and what each
// role may read.

import {
  accessHistory,
  dataClasses,
  listItems,
  lists,
  plannedHires,
  teams,
} from "@fathom/db";
import {
  type OrgChartPerson,
  type Permission,
  roleSchema,
} from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rolesGranting } from "./access.ts";
import {
  generalApprover,
  generalReader,
  otherTestPosition,
  personalReader,
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

// The approved chart, or, when asked, the chart as drafts make it, by person.
async function chart(
  as = cookie,
  part: "people" | "drafted" = "people",
): Promise<Map<string, OrgChartPerson>> {
  const response = await test.request(as, "GET", "/api/org-chart");
  expect(response.statusCode, response.body).toBe(200);
  const read = response.json<{
    people: OrgChartPerson[];
    drafted: OrgChartPerson[];
  }>();
  const shown = part === "people" ? read.people : read.drafted;
  return new Map(shown.map((one) => [one.id, one]));
}

const drafted = (as = cookie) => chart(as, "drafted");

async function chartOn(
  day: string,
  as = cookie,
  part: "people" | "drafted" = "people",
) {
  const response = await test.request(as, "GET", `/api/org-chart?on=${day}`);
  expect(response.statusCode, response.body).toBe(200);
  const read = response.json<{
    people: OrgChartPerson[];
    drafted: OrgChartPerson[];
  }>();
  const shown = part === "people" ? read.people : read.drafted;
  return new Map(shown.map((one) => [one.id, one]));
}

describe("the org chart on a chosen day", () => {
  it("shows each person under the manager they had that day", async () => {
    const earlier = await person();
    const later = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: earlier, managerFrom: "2024-01-01" });
    await approved([report]);
    await changed(report, { managerId: later, managerFrom: "2024-03-01" });
    await approved([report]);

    expect((await chartOn("2024-02-29")).get(report)?.managerId).toBe(earlier);
    expect((await chartOn("2024-03-01")).get(report)?.managerId).toBe(later);
  });

  it("shows only those employed that day", async () => {
    const starter = await person({ startDate: "2024-06-01" });

    expect((await chartOn("2024-05-31")).has(starter)).toBe(false);
    expect((await chartOn("2024-06-01")).has(starter)).toBe(true);
  });

  // A report under one manager from 2024-01-01, drafted to another from the day given.
  async function draftedReport(from: string) {
    const first = await person();
    const second = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: first, managerFrom: "2024-01-01" });
    await approved([report]);
    await changed(report, { managerId: second, managerFrom: from });
    return { first, second, report };
  }

  it("lays drafts over an earlier day for those who may change reporting lines then", async () => {
    const { first, second, report } = await draftedReport("2024-03-01");

    expect((await chartOn("2024-06-01")).get(report)).toMatchObject({
      managerId: first,
      draft: { managerId: second, managerFrom: "2024-03-01" },
    });
    expect(
      (await chartOn("2024-06-01", cookie, "drafted")).get(report)?.managerId,
    ).toBe(second);
  });

  it("leaves a line drafted from a later day out of an earlier one", async () => {
    const { first, report } = await draftedReport("2024-03-01");

    const shown = (await chartOn("2024-02-01")).get(report);

    expect(shown?.managerId).toBe(first);
    expect(shown?.draft).toBeUndefined();
    expect(
      (await chartOn("2024-02-01", cookie, "drafted")).get(report)?.managerId,
    ).toBe(first);
  });

  it("dates a draft changing only the manager as the current line is", async () => {
    const { report } = await draftedReport("2024-03-01");
    await approved([report]);
    const third = await person();
    await changed(report, { managerId: third, managerFrom: "2024-03-01" });

    expect((await chartOn("2024-02-01")).get(report)?.draft).toBeUndefined();
    expect((await chartOn("2024-06-01")).get(report)?.draft).toEqual({
      managerId: third,
      managerFrom: "2024-03-01",
      state: "waiting",
      unpublished: false,
    });
  });

  it("lays a draft moving only the line's date over an earlier day, with the date", async () => {
    const manager = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: manager, managerFrom: "2024-01-01" });
    await approved([report]);
    await changed(report, { managerFrom: "2024-04-01" });

    expect((await chartOn("2024-03-01")).get(report)?.draft).toEqual({
      managerId: null,
      managerFrom: "2024-04-01",
      state: "waiting",
      unpublished: false,
    });
  });

  it("draws someone drafted to be added under their manager on an earlier day", async () => {
    const manager = await person();
    const added = await test.request(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("OC"),
          positionId: testPosition,
          startDate: "2020-01-01",
          managerId: manager,
          managerFrom: "2024-01-01",
        },
      ],
    });
    const id = String(added.json<{ ids: string[] }>().ids[0]);

    const drafted = await chartOn("2024-06-01", cookie, "drafted");

    expect(drafted.get(id)?.managerId).toBe(manager);
  });

  it.each([
    ["people:edit", "personal:view"],
    ["personal:edit", "personal:view"],
  ])(
    "shows an earlier day as approved, without drafts, to those with %s alone",
    async (...granted) => {
      const { first, report } = await draftedReport("2024-03-01");
      const reader = await test.signedIn([
        "people:view",
        ...granted,
      ] as Permission[]);

      const shown = (await chartOn("2024-06-01", reader.cookie)).get(report);

      expect(shown?.managerId).toBe(first);
      expect(shown?.draft).toBeUndefined();
    },
  );

  it("lays drafts over an earlier day for those who change past managers' class, wherever it is kept", async () => {
    const { report } = await draftedReport("2024-03-01");
    const editor = await test.signedIn([
      "people:view",
      "people:edit",
      "feature-teams:view",
      "personal:view",
    ]);
    await test.connection
      .insert(dataClasses)
      .values({ field: "managerHistory", dataClass: "general" });
    try {
      const shown = (await chartOn("2024-06-01", editor.cookie)).get(report);

      expect(shown?.draft).toBeDefined();
    } finally {
      await test.connection.delete(dataClasses);
    }
  });

  it("shows an earlier day as approved to those who edit Personal details once past managers are kept Confidential", async () => {
    const { report } = await draftedReport("2024-03-01");
    const editor = await test.signedIn([
      "people:view",
      "people:edit",
      "feature-teams:view",
      "personal:view",
      "personal:edit",
      "confidential:view",
    ]);
    await test.connection
      .insert(dataClasses)
      .values({ field: "managerHistory", dataClass: "confidential" });
    try {
      const shown = (await chartOn("2024-06-01", editor.cookie)).get(report);

      expect(shown?.draft).toBeUndefined();
    } finally {
      await test.connection.delete(dataClasses);
    }
  });

  it("shows the chart as approved, without drafts, to those who may not change reporting lines", async () => {
    const { first, report } = await draftedReport("2024-03-01");
    const reader = await test.signedIn("engineering-manager");

    const shown = (await chartOn("2024-06-01", reader.cookie)).get(report);

    expect(shown?.managerId).toBe(first);
    expect(shown?.draft).toBeUndefined();
  });

  it("shows a later day as approved, without drafts, since reporting lines are not dated ahead", async () => {
    const { first, report } = await draftedReport("2024-03-01");

    const shown = (await chartOn("2026-07-01")).get(report);

    expect(shown?.managerId).toBe(first);
    expect(shown?.draft).toBeUndefined();
  });

  it.each([
    ["engineering-manager", 200],
    ["engineering-director", 200],
    ["workforce-administrator", 200],
    ["executive", 200],
    ["team-member", 403],
    ["product-manager", 403],
    ["feature-lead", 403],
    ["project-manager", 200],
  ] as const)("answers %s with %i", async (role, status) => {
    const reader = await test.signedIn(role);

    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/org-chart?on=2024-06-01",
    );

    expect(response.statusCode).toBe(status);
  });

  it("is refused without View People", async () => {
    const reader = await test.signedIn(["personal:view"]);

    expect(
      (await test.request(reader.cookie, "GET", "/api/org-chart?on=2024-06-01"))
        .statusCode,
    ).toBe(403);
  });

  it("is refused when signed out", async () => {
    expect(
      (await test.request("", "GET", "/api/org-chart?on=2024-06-01"))
        .statusCode,
    ).toBe(401);
  });

  it("is refused a day that does not exist", async () => {
    expect(
      (await test.request(cookie, "GET", "/api/org-chart?on=2024-02-30"))
        .statusCode,
    ).toBe(400);
  });

  it("is refused on a later day to readers who do not see Confidential data", async () => {
    const reader = await test.signedIn(personalReader);

    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/org-chart?on=2099-06-01",
    );

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: string }>().error).toBe(
      "Future dates need Confidential access.",
    );
  });

  it("is refused to readers who do not see Personal details", async () => {
    const reader = await test.signedIn(generalReader);

    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/org-chart?on=2024-06-01",
    );

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: string }>().error).toBe(
      "Other dates need Personal access.",
    );
  });

  it("records a view of Personal details", async () => {
    const reader = await test.signedIn("engineering-director");

    await chartOn("2024-06-01", reader.cookie);

    expect(
      await test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, reader.id),
            eq(accessHistory.action, "personal-viewed"),
          ),
        ),
    ).not.toEqual([]);
  });
});

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
