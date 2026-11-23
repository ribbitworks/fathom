// SPDX-License-Identifier: Apache-2.0

// Shared setup for the integration tests of customers, projects and proposals: a test app with the
// users they act as, and helpers that add, approve and read the plan's records through the routes.

import { listItems, lists, people } from "@fathom/db";
import type { Project, ProjectPlan } from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import {
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

export let test: TestApp;
export let planner: { id: string; cookie: string };
export let approver: { id: string; cookie: string };
export let viewer: { id: string; cookie: string };

export async function startProjectTests(): Promise<void> {
  test = await startTestApp();
  planner = await test.signedIn("product-manager");
  approver = await test.signedIn("project-manager");
  viewer = await test.signedIn("team-member");
}

export async function closeProjectTests(): Promise<void> {
  await test.close();
}

export type Saved = { plan: ProjectPlan; changeSetId: string | null };

export async function readPlan(cookie = planner.cookie): Promise<ProjectPlan> {
  const response = await test.request(cookie, "GET", "/api/projects");
  expect(response.statusCode).toBe(200);
  return response.json<ProjectPlan>();
}

export const send = (
  method: "POST" | "PUT" | "DELETE",
  url: string,
  body?: object,
  options?: { publish?: boolean },
) => test.request(planner.cookie, method, url, body, options);

export async function added(path: string, body: object): Promise<ProjectPlan> {
  const response = await send("POST", `/api/${path}`, body);
  expect(response.statusCode).toBe(201);
  return response.json<Saved>().plan;
}

export const byName = <Named extends { name: string }>(
  records: readonly Named[],
  name: string,
): Named => records.find((record) => record.name === name) as Named;

export async function addCustomer(name = unique("Fictional Customer")) {
  return byName((await added("customers", { name })).customers, name);
}

export async function addProject(body: object = {}) {
  const name = unique("Fictional Project");
  return byName((await added("projects", { name, ...body })).projects, name);
}

export async function addProposal(body: object = {}) {
  const name = unique("Fictional Proposal");
  return byName((await added("proposals", { name, ...body })).proposals, name);
}

export async function addFeature() {
  const name = unique("Fictional Feature");
  return byName((await added("features", { name })).features, name);
}

export async function addMilestone(projectId: string, body: object) {
  const response = await send("POST", `/api/projects/${projectId}/milestones`, {
    name: unique("Fictional Milestone"),
    ...body,
  });
  expect(response.statusCode).toBe(201);
}

export const approve = async (records: { type: string; id: string }[]) => {
  const response = await test.request(
    approver.cookie,
    "POST",
    "/api/drafts/approval",
    { records },
  );
  expect(response.statusCode).toBe(200);
};

export const projectNamed = async (id: string): Promise<Project> =>
  (await readPlan()).projects.find((project) => project.id === id) as Project;

// The built-in proposal statuses, by label, in order.
export async function statuses(): Promise<Map<string, string>> {
  const rows = await test.connection
    .select({ id: listItems.id, label: listItems.label })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(lists.builtIn, "proposal-statuses"))
    .orderBy(asc(listItems.position));
  return new Map(rows.map(({ id, label }) => [label, id]));
}

export async function addPerson(): Promise<string> {
  const id = randomUUID();
  await test.connection.insert(people).values({
    id,
    preferredName: unique("Fictional Owner"),
    employeeId: unique("OWN"),
    positionId: testPosition,
  });
  return id;
}
