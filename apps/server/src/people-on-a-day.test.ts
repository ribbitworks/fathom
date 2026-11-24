// SPDX-License-Identifier: Apache-2.0

// Tests for People on a chosen day, against a migrated PostgreSQL server: who is listed, under
// which manager, with drafts laid over the day for those who may change reporting lines from it,
// planned hires on later days and none on earlier ones, and what each role may read.

import { accessHistory } from "@fathom/db";
import { type Permission, type Person } from "@fathom/shared";
import { and, eq, ne } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  approvedPerson,
  personalReader,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
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

async function approved(kind: "people" | "plannedHires", ids: string[]) {
  const approver = await test.signedIn("engineering-director");
  const response = await test.request(
    approver.cookie,
    "POST",
    "/api/drafts/approval",
    { [kind]: ids },
  );
  expect(response.statusCode, response.body).toBe(200);
}

// A fictional person, approved so they are live, who started in 2020 and is marked as a manager
// unless told otherwise.
const person = (details: object = {}) =>
  approvedPerson(test, cookie, (id) => approved("people", [id]), {
    isManager: true,
    ...details,
  });

async function changed(id: string, body: object) {
  const response = await test.request(
    cookie,
    "PATCH",
    `/api/people/${id}`,
    body,
  );
  expect(response.statusCode, response.body).toBe(200);
}

async function peopleOn(day: string, as = cookie) {
  const response = await test.request(as, "GET", `/api/people?on=${day}`);
  expect(response.statusCode, response.body).toBe(200);
  return new Map(
    response.json<{ people: Person[] }>().people.map((one) => [one.id, one]),
  );
}

// A report under one manager from 2024-01-01, drafted to another from the day given.
async function draftedReport(from: string) {
  const first = await person();
  const second = await person();
  const report = await person({ isManager: false });
  await changed(report, { managerId: first, managerFrom: "2024-01-01" });
  await approved("people", [report]);
  await changed(report, { managerId: second, managerFrom: from });
  return { first, second, report };
}

describe("People on a chosen day", () => {
  it("lists each person under the manager they had that day", async () => {
    const earlier = await person();
    const later = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: earlier, managerFrom: "2024-01-01" });
    await approved("people", [report]);
    await changed(report, { managerId: later, managerFrom: "2024-03-01" });
    await approved("people", [report]);

    expect((await peopleOn("2024-02-29")).get(report)?.manager?.id).toBe(
      earlier,
    );
    expect((await peopleOn("2024-03-01")).get(report)?.manager?.id).toBe(later);
  });

  it("lists only those employed that day", async () => {
    const starter = await person({ startDate: "2024-06-01" });
    const leaver = await person({ endDate: "2024-06-30" });

    expect((await peopleOn("2024-05-31")).has(starter)).toBe(false);
    expect((await peopleOn("2024-06-01")).has(starter)).toBe(true);
    expect((await peopleOn("2024-06-30")).has(leaver)).toBe(true);
    expect((await peopleOn("2024-07-01")).has(leaver)).toBe(false);
  });

  it("lays a drafted line over a later day than it starts, for those who may change reporting lines then", async () => {
    const { first, second, report } = await draftedReport("2024-03-01");

    const shown = (await peopleOn("2024-06-01")).get(report);

    expect(shown?.manager?.id).toBe(second);
    expect(shown?.managerFrom).toBe("2024-03-01");
    expect(shown?.draft?.live.managerId).toBe(first);
  });

  it("leaves a line drafted from a later day out of an earlier one", async () => {
    const { first, report } = await draftedReport("2024-03-01");

    const shown = (await peopleOn("2024-02-01")).get(report);

    expect(shown?.manager?.id).toBe(first);
    expect(shown?.managerFrom).toBe("2024-01-01");
    expect(shown?.draft).toBeUndefined();
  });

  it("keeps a draft's other changes on a day before its line starts", async () => {
    const { report } = await draftedReport("2024-03-01");
    await changed(report, { preferredName: unique("Fictional Person") });

    const shown = (await peopleOn("2024-02-01")).get(report);

    expect(shown?.draft?.changed).toEqual(["preferredName"]);
  });

  it("keeps a draft that changes no line on another day", async () => {
    const id = await person();
    await changed(id, { preferredName: unique("Fictional Person") });

    expect((await peopleOn("2024-02-01")).get(id)?.draft?.changed).toEqual([
      "preferredName",
    ]);
  });

  it("gives someone drafted their first manager no draft before it starts", async () => {
    const manager = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: manager, managerFrom: "2024-03-01" });

    const before = (await peopleOn("2024-02-01")).get(report);
    const after = (await peopleOn("2024-06-01")).get(report);

    expect(before?.manager).toBeNull();
    expect(before?.draft).toBeUndefined();
    expect(after?.manager?.id).toBe(manager);
    expect(after?.draft?.live.managerId).toBeNull();
  });

  it("reads today as People without a date", async () => {
    const id = await person();
    const response = await test.request(cookie, "GET", "/api/people");
    const today = response
      .json<{ people: Person[] }>()
      .people.find((one) => one.id === id);

    expect((await peopleOn("2026-06-15")).get(id)).toEqual(today);
  });

  it("shows no manager before a line drafted to start later", async () => {
    const manager = await person();
    const report = await person({ isManager: false });
    await changed(report, { managerId: manager, managerFrom: "2024-01-01" });
    await approved("people", [report]);
    await changed(report, { managerFrom: "2024-04-01" });

    const shown = (await peopleOn("2024-03-01")).get(report);

    expect(shown?.manager).toBeNull();
    expect(shown?.draft?.live.managerId).toBe(manager);
  });

  it("shows the day as approved, without drafts, to those who may not change reporting lines", async () => {
    const { first, report } = await draftedReport("2024-03-01");
    const reader = await test.signedIn("engineering-manager");

    const shown = (await peopleOn("2024-06-01", reader.cookie)).get(report);

    expect(shown?.manager?.id).toBe(first);
    expect(shown?.draft).toBeUndefined();
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

      const shown = (await peopleOn("2024-06-01", reader.cookie)).get(report);

      expect(shown?.manager?.id).toBe(first);
      expect(shown?.draft).toBeUndefined();
    },
  );

  it("shows a later day as approved, without drafts, since reporting lines are not dated ahead", async () => {
    const { first, report } = await draftedReport("2024-03-01");

    const shown = (await peopleOn("2026-07-01")).get(report);

    expect(shown?.manager?.id).toBe(first);
    expect(shown?.draft).toBeUndefined();
  });

  // A planned hire with the test position, drafted, and approved unless told otherwise.
  async function hire(details: object = {}, approve = true) {
    const response = await test.request(cookie, "POST", "/api/planned-hires", {
      hires: [{ positionId: testPosition, ...details }],
    });
    expect(response.statusCode, response.body).toBe(201);
    const id = String(response.json<{ ids: string[] }>().ids[0]);
    if (approve) await approved("plannedHires", [id]);
    return id;
  }

  it("lists planned hires as approved on a later day, without their drafts", async () => {
    const live = await hire();
    const drafted = await hire({}, false);
    const named = await test.request(
      cookie,
      "PATCH",
      `/api/planned-hires/${live}`,
      { name: unique("Fictional Opening") },
    );
    expect(named.statusCode, named.body).toBe(200);

    const later = await peopleOn("2026-07-01");

    expect(later.get(live)?.draft).toBeUndefined();
    expect(later.get(live)?.preferredName).toBe("");
    expect(later.has(drafted)).toBe(false);
  });

  it("marks a planned hire with no date as undated, today and on a later day", async () => {
    const undated = await hire();
    const dated = await hire({ targetDate: "2026-12-01" });
    const response = await test.request(cookie, "GET", "/api/people");
    const today = new Map(
      response.json<{ people: Person[] }>().people.map((one) => [one.id, one]),
    );
    const plan = await test.request(cookie, "GET", "/api/planned-hires");
    const hires = new Map(
      plan
        .json<{ hires: { id: string; undated?: true }[] }>()
        .hires.map((one) => [one.id, one]),
    );

    expect(today.get(undated)).toMatchObject({
      expected: "2026-06",
      undated: true,
    });
    expect(today.get(dated)?.undated).toBeUndefined();
    expect(hires.get(undated)?.undated).toBe(true);
    expect(hires.get(dated)?.undated).toBeUndefined();
    expect((await peopleOn("2026-09-01")).get(undated)).toMatchObject({
      expected: "2026-09",
      undated: true,
    });
  });

  it("lists planned hires not yet filled on later days, whatever their target date, and none on earlier ones", async () => {
    const response = await test.request(cookie, "POST", "/api/planned-hires", {
      hires: [{ positionId: testPosition, targetDate: "2026-12-01" }],
    });
    expect(response.statusCode, response.body).toBe(201);
    const hire = String(response.json<{ ids: string[] }>().ids[0]);
    await approved("plannedHires", [hire]);

    expect((await peopleOn("2026-07-01")).has(hire)).toBe(true);
    expect((await peopleOn("2027-06-01")).has(hire)).toBe(true);
    expect((await peopleOn("2026-06-01")).has(hire)).toBe(false);
  });

  it.each([
    ["engineering-manager", 200],
    ["workforce-administrator", 200],
    ["feature-lead", 403],
  ] as const)("answers %s on an earlier day with %i", async (role, status) => {
    const reader = await test.signedIn(role);

    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/people?on=2024-06-01",
    );

    expect(response.statusCode).toBe(status);
  });

  // What the access history records of an account's reads, besides signing in.
  const viewsOf = async (actorId: string) =>
    test.connection
      .select({ action: accessHistory.action })
      .from(accessHistory)
      .where(
        and(
          eq(accessHistory.actorId, actorId),
          ne(accessHistory.action, "signed-in"),
        ),
      );

  it("records a Personal view for another day, since it tells who was employed then", async () => {
    const reader = await test.signedIn("engineering-manager");

    await peopleOn("2024-06-01", reader.cookie);

    expect(await viewsOf(reader.id)).toContainEqual({
      action: "personal-viewed",
    });
  });

  it("records no Personal view for today asked by date, to a reader who sees none", async () => {
    const reader = await test.signedIn(["people:view", "feature-teams:view"]);

    await peopleOn("2026-06-15", reader.cookie);

    expect(await viewsOf(reader.id)).toEqual([]);
  });

  it("is refused a later day to readers who do not see Confidential data", async () => {
    const reader = await test.signedIn(personalReader);

    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/people?on=2026-07-01",
    );

    expect(response.statusCode).toBe(403);
  });

  it("is refused a day that does not exist", async () => {
    expect(
      (await test.request(cookie, "GET", "/api/people?on=2024-02-30"))
        .statusCode,
    ).toBe(400);
  });
});
