// SPDX-License-Identifier: Apache-2.0

// Shared setup for the org chart integration tests: a test app with a fixed clock, and helpers that
// add and change people and read the chart, live, drafted or on a chosen day, through the routes.

import { type OrgChartPerson } from "@fathom/shared";
import { expect, vi } from "vitest";
import { startTestApp, type TestApp, testPosition } from "./test-app.ts";

// The server takes today's date from the clock, so the tests fix it, to give the same days on every
// run.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

export let test: TestApp;
export let cookie = "";

export async function startOrgChartTests(): Promise<void> {
  test = await startTestApp();
  ({ cookie } = await test.signedIn("workforce-administrator"));
}

export async function closeOrgChartTests(): Promise<void> {
  await test.close();
  vi.useRealTimers();
}

let count = 0;

// A name or Employee ID no other test uses, so tests sharing the database do not collide.
export function unique(prefix: string): string {
  count += 1;
  return `${prefix} ${String(count)}`;
}

export async function approved(ids: readonly string[]) {
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
export async function person(details: object = {}): Promise<string> {
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

export async function changed(id: string, body: object) {
  const response = await test.request(
    cookie,
    "PATCH",
    `/api/people/${id}`,
    body,
  );
  expect(response.statusCode, response.body).toBe(200);
}

// The approved chart, or, when asked, the chart as drafts make it, by person.
export async function chart(
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

export const drafted = (as = cookie) => chart(as, "drafted");

export async function chartOn(
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
