// SPDX-License-Identifier: Apache-2.0

// Shared setup for the integration tests of customers, projects and proposals: a test app with the
// users they act as, and helpers that add, approve and read the plan's records through the routes.

import { listItems, lists, people } from "@fathom/db";
import type { Project, ProjectPlan } from "@fathom/shared";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  addingOne,
  type Method,
  ok,
  sender,
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

const sendAs = sender(() => test);

export const readPlan = async (cookie = planner.cookie) =>
  ok<ProjectPlan>(await sendAs(cookie, "GET", "/api/projects"));

export const send = (
  method: Exclude<Method, "GET" | "PATCH">,
  url: string,
  body?: object,
  options?: { publish?: boolean },
) => sendAs(planner, method, url, body, options);

export const added = async (path: string, body: object) =>
  (await ok<Saved>(await send("POST", `/api/${path}`, addingOne(body)), 201))
    .plan;

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
  await ok(
    await send(
      "POST",
      "/api/milestones",
      addingOne({ projectId, name: unique("Fictional Milestone"), ...body }),
    ),
    201,
  );
}

export const approve = async (records: { type: string; id: string }[]) => {
  await ok(await sendAs(approver, "POST", "/api/drafts/approval", { records }));
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
