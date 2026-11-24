// SPDX-License-Identifier: Apache-2.0

// Shared setup for the org chart and reporting line integration tests: a test app with a fixed
// clock, and helpers that add and change people, approve their managers, and read people and the
// chart, live, drafted or on a chosen day, through the routes.

import { type OrgChartPerson, type Person } from "@fathom/shared";
import { expect, vi } from "vitest";
import {
  approvedPerson,
  startTestApp,
  type TestApp,
  unique,
} from "./test-app.ts";

// The server takes today's date from the clock, so the tests fix it, to give the same days on every
// run.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

export let test: TestApp;
export let cookie = "";
export let editorId = "";

export async function startOrgChartTests(): Promise<void> {
  test = await startTestApp();
  ({ cookie, id: editorId } = await test.signedIn("workforce-administrator"));
}

export async function closeOrgChartTests(): Promise<void> {
  await test.close();
  vi.useRealTimers();
}

export const day = (offset: number) => {
  const moment = new Date();
  moment.setUTCDate(moment.getUTCDate() + offset);
  return moment.toISOString().slice(0, 10);
};
export const today = day(0);

export async function approve(ids: readonly string[]) {
  const approver = await test.signedIn("engineering-director");
  return test.request(approver.cookie, "POST", "/api/drafts/approval", {
    people: ids,
  });
}

export async function approved(ids: readonly string[]) {
  const response = await approve(ids);
  expect(response.statusCode, response.body).toBe(200);
}

// A fictional person, approved so they are live, who started in 2020 and is marked as a manager
// unless told otherwise, with an Employee ID starting OC, which the chart's tests look for.
export const person = (details: object = {}) =>
  approvedPerson(test, cookie, (id) => approved([id]), {
    employeeId: unique("OC"),
    isManager: true,
    ...details,
  });

export async function change(id: string, body: object, as = cookie) {
  return test.request(as, "PATCH", `/api/people/${id}`, body);
}

export async function changed(id: string, body: object) {
  const response = await change(id, body);
  expect(response.statusCode, response.body).toBe(200);
}

// Drafts and approves a new manager for the person.
export async function reportsTo(
  id: string,
  managerId: string | null,
  from?: string,
) {
  await changed(id, { managerId, ...(from ? { managerFrom: from } : {}) });
  await approved([id]);
}

export async function readPerson(
  id: string,
  as = cookie,
): Promise<Person | undefined> {
  const response = await test.request(as, "GET", "/api/people");
  expect(response.statusCode).toBe(200);
  return response
    .json<{ people: Person[] }>()
    .people.find((one) => one.id === id);
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
