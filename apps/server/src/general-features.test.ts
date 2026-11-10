// SPDX-License-Identifier: Apache-2.0

// Tests for general features, against a PostgreSQL server of their own: the general feature that
// follows each project's approval and stays off every roadmap.

import { features, listItems, lists } from "@fathom/db";
import type { ProjectPlan } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readRecordsState } from "./data/records.ts";
import { featureKind } from "./data/release-kinds.ts";
import {
  builtInChoice,
  errorOf,
  startTestApp,
  type TestApp,
  unique,
} from "./test-app.ts";

let test: TestApp;
let planner: { id: string; cookie: string };
let approver: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  planner = await test.signedIn("product-manager");
  approver = await test.signedIn("project-manager");
});

afterAll(async () => {
  await test.close();
});

type Saved = { plan: ProjectPlan };

const send = (method: "POST" | "PUT" | "DELETE", url: string, body?: object) =>
  test.request(planner.cookie, method, url, body);

async function readPlan(): Promise<ProjectPlan> {
  const response = await test.request(planner.cookie, "GET", "/api/projects");
  expect(response.statusCode).toBe(200);
  return response.json<ProjectPlan>();
}

async function addProject(): Promise<{ id: string; name: string }> {
  const name = unique("Fictional Project");
  const response = await send("POST", "/api/projects", { name });
  expect(response.statusCode).toBe(201);
  return response
    .json<Saved>()
    .plan.projects.find((one) => one.name === name) as {
    id: string;
    name: string;
  };
}

const decide = (asking: "approval" | "rejection", body: object) =>
  test.request(approver.cookie, "POST", `/api/drafts/${asking}`, body);

const approve = async (id: string) => {
  const response = await decide("approval", {
    records: [{ type: "project", id }],
  });
  expect(response.statusCode).toBe(200);
};

const generalFeatures = (projectId: string) =>
  test.connection
    .select()
    .from(features)
    .where(eq(features.generalForProjectId, projectId));

async function approvedGeneralFeature(): Promise<string> {
  const project = await addProject();
  await approve(project.id);
  const [general] = await generalFeatures(project.id);
  return String(general?.id);
}

describe("a general feature", () => {
  it("is made in the first status meaning In progress when a project is approved", async () => {
    const project = await addProject();
    expect(await generalFeatures(project.id)).toEqual([]);
    await approve(project.id);
    const [general] = await generalFeatures(project.id);
    expect(general?.name).toBeNull();
    expect(general?.statusId).toBe(
      await builtInChoice(test.connection, "feature-statuses", "in-progress"),
    );
  });

  it("is not made when the draft adding the project is rejected", async () => {
    const project = await addProject();
    const response = await decide("rejection", {
      records: [{ type: "project", id: project.id }],
      reason: "Fictional reason",
    });
    expect(response.statusCode).toBe(200);
    expect(await generalFeatures(project.id)).toEqual([]);
  });

  it("is removed when removing the project is approved", async () => {
    const project = await addProject();
    await approve(project.id);
    await send("DELETE", `/api/projects/${project.id}`);
    await approve(project.id);
    expect(await generalFeatures(project.id)).toEqual([]);
  });

  it("stays when a change to the project is approved", async () => {
    const project = await addProject();
    await approve(project.id);
    await send("PUT", `/api/projects/${project.id}`, {
      name: unique("Fictional Renamed Project"),
    });
    await approve(project.id);
    expect(await generalFeatures(project.id)).toHaveLength(1);
  });

  it("is named by its project", async () => {
    const project = await addProject();
    await approve(project.id);
    const [general] = await generalFeatures(project.id);
    const state = await readRecordsState(test.connection);
    expect(featureKind.subject(state, String(general?.id))).toBe(
      `the project ${project.name}`,
    );
  });

  it("is kept off the features listed", async () => {
    const general = await approvedGeneralFeature();
    expect((await readPlan()).features.map(({ id }) => id)).not.toContain(
      general,
    );
  });

  it("can't be changed or removed", async () => {
    const general = await approvedGeneralFeature();
    const changed = await send("PUT", `/api/features/${general}`, {
      name: unique("Fictional Feature"),
    });
    expect(changed.statusCode).toBe(404);
    const removed = await send("DELETE", `/api/features/${general}`);
    expect(removed.statusCode).toBe(404);
  });

  it("refuses approving a project while no status means In progress", async () => {
    const inProgress = and(
      eq(listItems.meaning, "in-progress"),
      eq(
        listItems.listId,
        test.connection
          .select({ id: lists.id })
          .from(lists)
          .where(eq(lists.builtIn, "feature-statuses")),
      ),
    );
    const project = await addProject();
    await test.connection
      .update(listItems)
      .set({ retired: true })
      .where(inProgress);
    try {
      const response = await decide("approval", {
        records: [{ type: "project", id: project.id }],
      });
      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toBe(
        "No feature status means In progress. Add one to the list first.",
      );
      expect(await generalFeatures(project.id)).toEqual([]);
    } finally {
      await test.connection
        .update(listItems)
        .set({ retired: false })
        .where(inProgress);
    }
  });
});
