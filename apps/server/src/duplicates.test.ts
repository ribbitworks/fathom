// SPDX-License-Identifier: Apache-2.0

// Integration tests for duplicating a feature or an activity, against a PostgreSQL server of their
// own: the copy drafted, named and placed, and who may duplicate what.

import { cyclePatterns, fields, releases, releaseStreams } from "@fathom/db";
import type {
  Activity,
  Duplicated,
  Feature,
  ProjectPlan,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  missingRecord as missing,
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

const send = (url: string, body?: object, cookie = planner.cookie) =>
  test.request(cookie, "POST", url, body);

async function readPlan(): Promise<ProjectPlan> {
  const response = await test.request(planner.cookie, "GET", "/api/projects");
  return response.json<ProjectPlan>();
}

const approve = async (records: { type: string; id: string }[]) => {
  const response = await test.request(
    approver.cookie,
    "POST",
    "/api/drafts/approval",
    { records },
  );
  expect(response.statusCode, response.body).toBe(200);
};

async function liveFeature(body: object = {}): Promise<Feature> {
  const name = unique("Fictional Feature");
  const response = await send("/api/features", { name, ...body });
  expect(response.statusCode, response.body).toBe(201);
  const feature = response
    .json<Saved>()
    .plan.features.find((one) => one.name === name) as Feature;
  await approve([{ type: "feature", id: feature.id }]);
  return feature;
}

async function liveProject(): Promise<string> {
  const name = unique("Fictional Project");
  const response = await send("/api/projects", { name });
  const id = String(
    response.json<Saved>().plan.projects.find((one) => one.name === name)?.id,
  );
  await approve([{ type: "project", id }]);
  return id;
}

async function liveActivity(projectId: string, body: object = {}) {
  const name = unique("Fictional Activity");
  const response = await send(`/api/projects/${projectId}/activities`, {
    name,
    ...body,
  });
  const activity = response
    .json<Saved>()
    .plan.activities.find((one) => one.name === name) as Activity;
  await approve([{ type: "project-activity", id: activity.id }]);
  return activity;
}

async function liveRelease(): Promise<string> {
  const streamId = randomUUID();
  await test.connection
    .insert(releaseStreams)
    .values({ id: streamId, name: unique("Fictional Stream") });
  await test.connection.insert(cyclePatterns).values({
    streamId,
    startsOn: "2027-01-01",
    length: 3,
    unit: "months",
    naming: "{YY}.{N}",
  });
  const id = randomUUID();
  await test.connection.insert(releases).values({
    id,
    streamId,
    name: unique("Fictional Release"),
    firstCycle: "2027-01-01",
    lastCycle: "2027-01-01",
  });
  return id;
}

describe("duplicating a feature", () => {
  it("drafts a copy named (copy), keeping what describes the work and none of where it is committed", async () => {
    const original = await liveFeature({
      description: "Work offline",
      estimateHours: 40,
    });
    const response = await send(`/api/features/${original.id}/duplicate`);
    expect(response.statusCode, response.body).toBe(201);
    const { id } = response.json<Duplicated>();
    const copy = (await readPlan()).features.find((one) => one.id === id);
    expect(copy).toMatchObject({
      name: `${original.name} (copy)`,
      description: "Work offline",
      estimateHours: 40,
      customerIds: [],
      targetCycle: null,
      draft: { action: "created" },
    });
  });

  it("starts in a new feature's status, keeping its team and planning values", async () => {
    const original = await liveFeature({ neededBy: "2027-03", note: "Kept" });
    const response = await send(`/api/features/${original.id}/duplicate`);
    const { id } = response.json<Duplicated>();
    const copy = (await readPlan()).features.find((one) => one.id === id);
    expect(copy).toMatchObject({
      statusId: original.statusId,
      neededBy: "2027-03",
      note: "Kept",
      featureTeamId: original.featureTeamId,
      priorityId: original.priorityId,
    });
  });

  it("keeps its values in the columns added to Features", async () => {
    const [column] = await test.connection
      .insert(fields)
      .values({
        tableName: "features",
        name: unique("Fictional Score"),
        type: "number",
        visibility: "general",
      })
      .returning({ id: fields.id });
    const columnId = String(column?.id);
    const original = await liveFeature({ numbers: { [columnId]: 7 } });
    const response = await send(`/api/features/${original.id}/duplicate`);
    expect(response.statusCode, response.body).toBe(201);
    const { id } = response.json<Duplicated>();
    expect(
      (await readPlan()).features.find((one) => one.id === id)?.numbers,
    ).toEqual({ [columnId]: 7 });
  });

  it("counts on once a copy's name is taken", async () => {
    const original = await liveFeature();
    await send(`/api/features/${original.id}/duplicate`);
    const second = await send(`/api/features/${original.id}/duplicate`);
    const { id } = second.json<Duplicated>();
    expect((await readPlan()).features.find((one) => one.id === id)?.name).toBe(
      `${original.name} (copy 2)`,
    );
  });

  it("refuses a feature that does not exist", async () => {
    const response = await send(`/api/features/${missing}/duplicate`);
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toBe("There is no such feature");
  });

  it("is refused to a role that may not edit features", async () => {
    const original = await liveFeature();
    const viewer = await test.signedIn("team-member");
    const response = await send(
      `/api/features/${original.id}/duplicate`,
      undefined,
      viewer.cookie,
    );
    expect(response.statusCode).toBe(403);
  });
});

describe("duplicating an activity", () => {
  it("drafts a copy into another project, keeping its description, note and effort", async () => {
    const original = await liveActivity(await liveProject(), {
      description: "Move the old bookings",
      estimateHours: 80,
    });
    const target = await liveProject();
    const response = await send(`/api/activities/${original.id}/duplicate`, {
      projectId: target,
    });
    expect(response.statusCode, response.body).toBe(201);
    const { id } = response.json<Duplicated>();
    expect(
      (await readPlan()).activities.find((one) => one.id === id),
    ).toMatchObject({
      projectId: target,
      name: `${original.name} (copy)`,
      description: "Move the old bookings",
      estimateHours: 80,
      draft: { action: "created" },
    });
  });

  it("drafts a copy into a release", async () => {
    const original = await liveActivity(await liveProject());
    const release = await liveRelease();
    const response = await send(`/api/activities/${original.id}/duplicate`, {
      releaseId: release,
    });
    expect(response.statusCode, response.body).toBe(201);
  });

  it("counts on within the same project, and not in another", async () => {
    const projectId = await liveProject();
    const original = await liveActivity(projectId);
    const same = await send(`/api/activities/${original.id}/duplicate`, {
      projectId,
    });
    const again = await send(`/api/activities/${original.id}/duplicate`, {
      projectId,
    });
    const elsewhere = await send(`/api/activities/${original.id}/duplicate`, {
      projectId: await liveProject(),
    });
    const named = async (response: typeof same) =>
      (await readPlan()).activities.find(
        (one) => one.id === response.json<Duplicated>().id,
      )?.name;
    expect(await named(same)).toBe(`${original.name} (copy)`);
    expect(await named(again)).toBe(`${original.name} (copy 2)`);
    expect(await named(elsewhere)).toBe(`${original.name} (copy)`);
  });

  it("refuses a project that does not exist", async () => {
    const original = await liveActivity(await liveProject());
    const response = await send(`/api/activities/${original.id}/duplicate`, {
      projectId: missing,
    });
    expect(response.statusCode).toBe(404);
  });

  it("refuses an activity a role may not read", async () => {
    const original = await liveActivity(await liveProject());
    const release = await liveRelease();
    const featuresOnly = await test.signedIn([
      "features:view",
      "features:edit",
    ]);
    const response = await send(
      `/api/activities/${original.id}/duplicate`,
      { releaseId: release },
      featuresOnly.cookie,
    );
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toBe("There is no such activity");
  });

  it("refuses both a project and a release", async () => {
    const response = await send(`/api/activities/${missing}/duplicate`, {
      projectId: missing,
      releaseId: missing,
    });
    expect(response.statusCode).toBe(400);
  });
});
