// SPDX-License-Identifier: Apache-2.0

// Tests for drafts on the org chart, against a PostgreSQL server of their own, so what the access
// history records is down to each test's drafts alone: which drafts showing Personal details are
// recorded, the reader's own unpublished drafts, and who sees people drafted to start later.

import { accessHistory, drafts } from "@fathom/db";
import type { OrgChartPerson } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { startTestApp, type TestApp, testPosition } from "./test-app.ts";

// The server takes today's date from the clock, so the tests fix it, to give the same days on every
// run.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

let test: TestApp;
let cookie = "";
let approver = "";

beforeAll(async () => {
  test = await startTestApp();
  ({ cookie } = await test.signedIn("workforce-administrator"));
  ({ cookie: approver } = await test.signedIn("engineering-director"));
});

// Each test starts with no drafts, so none is left to show another's Personal details.
afterEach(async () => {
  await test.request(cookie, "POST", "/api/unpublished/discard");
  await test.connection.delete(drafts);
});

afterAll(async () => {
  await test.close();
  vi.useRealTimers();
});

let count = 0;

function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

async function decided(path: string, body: object) {
  const response = await test.request(approver, "POST", path, body);
  expect(response.statusCode, response.body).toBe(200);
}

// A fictional person, approved so they are live, who started in 2020 and is marked as a manager.
async function person(details: object = {}): Promise<string> {
  const response = await test.request(cookie, "POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("OD"),
        positionId: testPosition,
        startDate: "2020-01-01",
        isManager: true,
        ...details,
      },
    ],
  });
  expect(response.statusCode, response.body).toBe(201);
  const id = String(response.json<{ ids: string[] }>().ids[0]);
  await decided("/api/drafts/approval", { people: [id] });
  return id;
}

async function changed(id: string, body: object, publish = true) {
  const response = await test.request(
    cookie,
    "PATCH",
    `/api/people/${id}`,
    body,
    { publish },
  );
  expect(response.statusCode, response.body).toBe(200);
}

async function chart(as: string) {
  const response = await test.request(as, "GET", "/api/org-chart");
  expect(response.statusCode, response.body).toBe(200);
  const read = response.json<{
    people: OrgChartPerson[];
    drafted: OrgChartPerson[];
  }>();
  const byId = (people: OrgChartPerson[]) =>
    new Map(people.map((one) => [one.id, one]));
  return { people: byId(read.people), drafted: byId(read.drafted) };
}

// Reads the chart as a new Executive, who sees Personal details, and says whether the access
// history recorded it.
async function recordedForExecutive(): Promise<boolean> {
  const executive = await test.signedIn("executive");
  await chart(executive.cookie);
  const views = await test.connection
    .select({ id: accessHistory.id })
    .from(accessHistory)
    .where(
      and(
        eq(accessHistory.actorId, executive.id),
        eq(accessHistory.action, "personal-viewed"),
      ),
    );
  return views.length > 0;
}

describe("drafts on the org chart", () => {
  it("records nothing when no draft shows Personal details", async () => {
    const manager = await person();
    await changed(manager, { teamName: unique("Fictional Team") });
    expect(await recordedForExecutive()).toBe(false);
  });

  it("records a rejected change of manager drawn beside the chart", async () => {
    const first = await person();
    const second = await person();
    const report = await person({ managerId: first, isManager: false });
    await changed(report, { managerId: second });
    await decided("/api/drafts/rejection", {
      people: [report],
      reason: "Fictional reason",
    });
    expect(await recordedForExecutive()).toBe(true);
  });

  it("records a draft changing only dates", async () => {
    const leaving = await person({ isManager: false });
    await changed(leaving, { endDate: "2026-12-31" });
    expect(await recordedForExecutive()).toBe(true);
  });

  it("shows the reader's own unpublished drafts, and nobody else's", async () => {
    const manager = await person();
    const name = unique("Fictional Team");
    await changed(manager, { teamName: name }, false);
    expect((await chart(cookie)).people.get(manager)?.draft).toEqual({
      teamName: name,
      state: "waiting",
      unpublished: true,
    });
    expect((await chart(cookie)).drafted.get(manager)?.teamName).toBe(name);
    const other = await test.signedIn("workforce-administrator");
    const seen = await chart(other.cookie);
    expect(seen.people.get(manager)).not.toHaveProperty("draft");
    expect(seen.drafted.get(manager)?.teamName).toBeNull();
  });

  it("draws someone drafted to be added only from their start date, as People does", async () => {
    const added = await test.request(cookie, "POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("OD"),
          positionId: testPosition,
          startDate: "2026-09-01",
        },
      ],
    });
    expect(added.statusCode, added.body).toBe(201);
    const id = String(added.json<{ ids: string[] }>().ids[0]);
    const planner = await test.signedIn("resource-planner");
    expect((await chart(planner.cookie)).drafted.has(id)).toBe(false);
  });
});
