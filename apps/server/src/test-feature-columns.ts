// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of the columns added to Features: a server of their own, the accounts that
// change, approve and read them, and columns, lists and features to try them on.

import { listItems, lists } from "@fathom/db";
import type { Feature, Field, ProjectPlan } from "@fathom/shared";
import { startingRoles } from "@fathom/shared";

import { randomUUID } from "node:crypto";
import { expect } from "vitest";

import { startTestApp, type TestApp, unique } from "./test-app.ts";

export let test: TestApp;
export let editor: { id: string; cookie: string };
export let columnApprover: { id: string; cookie: string };
export let planner: { id: string; cookie: string };
export let planApprover: { id: string; cookie: string };
export let viewer: { id: string; cookie: string };

export async function startFeatureColumnTests() {
  test = await startTestApp();
  // Edits features and configuration, so makes the lists its columns draw on.
  editor = await test.signedIn([
    ...startingRoles["workforce-administrator"].permissions,
    "features:edit",
  ]);
  columnApprover = await test.signedIn("engineering-director");
  planner = await test.signedIn("product-manager");
  planApprover = await test.signedIn("project-manager");
  viewer = await test.signedIn(["plan:view", "features:view"]);
}

export async function closeFeatureColumnTests() {
  await test.close();
}

export type FieldBody = Record<string, unknown>;

export const addColumn = (body: FieldBody, cookie = editor.cookie) =>
  test.request(cookie, "POST", "/api/features/columns", {
    name: unique("Fictional Column"),
    ...body,
  });

export async function addList(visibility = "general") {
  const listId = randomUUID();
  await test.connection
    .insert(lists)
    .values({ id: listId, name: unique("Fictional List"), visibility });
  const choices = [randomUUID(), randomUUID()];
  await test.connection.insert(listItems).values(
    choices.map((id, position) => ({
      id,
      listId,
      label: unique("Fictional Choice"),
      position,
    })),
  );
  return { listId, choices };
}

export async function approveColumn(id: string) {
  const response = await test.request(
    columnApprover.cookie,
    "POST",
    "/api/drafts/approval",
    { columns: [id] },
  );
  expect(response.statusCode).toBe(200);
}

export async function liveColumn(body: FieldBody = {}) {
  const { listId, choices } = await addList();
  const response = await addColumn({ listId, ...body });
  expect(response.statusCode).toBe(201);
  const { field } = response.json<{ field: Field }>();
  await approveColumn(field.id);
  return { field, choices, listId };
}

export async function addLive(body: FieldBody) {
  const { field } = (await addColumn(body)).json<{ field: Field }>();
  await approveColumn(field.id);
  return field;
}

export const features = async (cookie = planner.cookie) =>
  (await test.request(cookie, "GET", "/api/projects")).json<ProjectPlan>()
    .features;

export const shown = async (id: string, cookie?: string) =>
  (await features(cookie)).find((feature) => feature.id === id) as Feature;

export async function draftFeature(body: FieldBody = {}) {
  const name = unique("Fictional Feature");
  const response = await test.request(planner.cookie, "POST", "/api/features", {
    name,
    ...body,
  });
  expect(response.statusCode).toBe(201);
  return response
    .json<{ plan: ProjectPlan }>()
    .plan.features.find((feature) => feature.name === name) as Feature;
}

export const approveFeature = (id: string) =>
  test.request(planApprover.cookie, "POST", "/api/drafts/approval", {
    records: [{ type: "feature", id }],
  });

export async function liveFeature(body: FieldBody = {}) {
  const feature = await draftFeature(body);
  expect((await approveFeature(feature.id)).statusCode).toBe(200);
  return feature;
}

export const change = (feature: Feature, body: FieldBody) =>
  test.request(planner.cookie, "PUT", `/api/features/${feature.id}`, {
    name: feature.name,
    ...body,
  });

export const columns = async (cookie = planner.cookie) =>
  (await test.request(cookie, "GET", "/api/projects")).json<ProjectPlan>()
    .featureColumns;

// Enough that columns in any other order would not pass by chance.
export const columnsToOrder = 6;
