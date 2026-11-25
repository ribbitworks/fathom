// SPDX-License-Identifier: Apache-2.0

// Shared setup for the features integration tests: a test app with the users they act as, and
// helpers that draft, approve and read features, schedules and teams.

import { featureTeams } from "@fathom/db";
import type { Feature, Meaning, ProjectPlan } from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import {
  builtInChoice,
  startTestApp,
  type TestApp,
  unique,
} from "./test-app.ts";

type User = Awaited<ReturnType<TestApp["signedIn"]>>;

export let test: TestApp;
export let planner: User;
export let approver: User;
export let viewer: User;
export let featureLead: User;
export let configurer: User;

export async function startFeatureTests(): Promise<void> {
  test = await startTestApp();
  planner = await test.signedIn("product-manager");
  approver = await test.signedIn("project-manager");
  viewer = await test.signedIn("team-member");
  featureLead = await test.signedIn("feature-lead");
  configurer = await test.signedIn("workforce-administrator");
}

export async function closeFeatureTests(): Promise<void> {
  await test.close();
}

export type Saved = { plan: ProjectPlan; changeSetId: string | null };

export async function liveTeam(): Promise<string> {
  const id = randomUUID();
  await test.connection
    .insert(featureTeams)
    .values({ id, name: unique("Fictional Team") });
  return id;
}

export async function readPlan(cookie = planner.cookie): Promise<ProjectPlan> {
  const response = await test.request(cookie, "GET", "/api/projects");
  expect(response.statusCode).toBe(200);
  return response.json<ProjectPlan>();
}

export const statusMeaning = (meaning: Meaning) =>
  builtInChoice(test.connection, "feature-statuses", meaning);

export const post = (body: object, cookie = planner.cookie) =>
  test.request(cookie, "POST", "/api/features", body);

export const put = (id: string, body: object, cookie = planner.cookie) =>
  test.request(cookie, "PUT", `/api/features/${id}`, body);

export const removal = (id: string) =>
  test.request(planner.cookie, "DELETE", `/api/features/${id}`);

export const decide = (asking: "approval" | "rejection", body: object) =>
  test.request(approver.cookie, "POST", `/api/drafts/${asking}`, body);

export const featureRecords = (...ids: string[]) =>
  ids.map((id) => ({ type: "feature", id }));

export async function approved(...ids: string[]): Promise<void> {
  const response = await decide("approval", {
    records: featureRecords(...ids),
  });
  expect(response.statusCode).toBe(200);
}

const featureNamed = (features: readonly Feature[], name: string): Feature =>
  features.find((feature) => feature.name === name) as Feature;

export async function draftFeature(
  body: Record<string, unknown> = {},
  cookie = planner.cookie,
): Promise<Feature> {
  const name =
    typeof body.name === "string" ? body.name : unique("Fictional Feature");
  const response = await post({ ...body, name }, cookie);
  expect(response.statusCode).toBe(201);
  return featureNamed(response.json<Saved>().plan.features, name);
}

export async function liveFeature(
  body: Record<string, unknown> = {},
): Promise<Feature> {
  const feature = await draftFeature(body);
  await approved(feature.id);
  return shown(feature.id);
}

export const shown = async (id: string): Promise<Feature> =>
  (await readPlan()).features.find((feature) => feature.id === id) as Feature;
