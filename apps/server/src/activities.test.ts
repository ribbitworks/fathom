// SPDX-License-Identifier: Apache-2.0

// Integration tests for activities, against a PostgreSQL server of their own: the routes, reading
// them with Activities' columns, drafting them on a release or a project, moving them, and removing
// them.

import {
  allocations,
  cyclePatterns,
  drafts,
  people,
  releases,
  releaseStreams,
  unpublishedDrafts,
} from "@fathom/db";
import { eq } from "drizzle-orm";
import type {
  Activity,
  ActivityPlan,
  Field,
  ProjectPlan,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  startTestApp,
  type TestApp,
  testPosition,
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

type Saved = { activities: ActivityPlan; changeSetId: string | null };

const send = (
  method: "POST" | "PUT" | "DELETE",
  url: string,
  body?: object,
  cookie = planner.cookie,
) => test.request(cookie, method, url, body);

async function readActivities(cookie = planner.cookie): Promise<ActivityPlan> {
  const response = await test.request(cookie, "GET", "/api/activities");
  expect(response.statusCode, response.body).toBe(200);
  return response.json<ActivityPlan>();
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

// A project, approved, so its activities are drafts of their own.
async function liveProject(): Promise<string> {
  const name = unique("Fictional Project");
  const response = await send("POST", "/api/projects", { name });
  expect(response.statusCode, response.body).toBe(201);
  const id = String(
    response
      .json<{ plan: ProjectPlan }>()
      .plan.projects.find((one) => one.name === name)?.id,
  );
  await approve([{ type: "project", id }]);
  return id;
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

const added = (saved: Saved, name: string) =>
  saved.activities.activities.find((one) => one.name === name) as Activity;

async function addActivity(
  owner: { projectId?: string; releaseId?: string },
  body: object = {},
  cookie = planner.cookie,
): Promise<Activity> {
  const name = unique("Fictional Activity");
  const response = await send(
    "POST",
    "/api/activities",
    { name, ...owner, ...body },
    cookie,
  );
  expect(response.statusCode, response.body).toBe(201);
  return added(response.json<Saved>(), name);
}

describe("adding an activity", () => {
  it("drafts it on its project with a feature's planning fields, starting in Possible", async () => {
    const projectId = await liveProject();
    const activity = await addActivity(
      { projectId },
      { estimateHours: 40, neededBy: "2027-03", description: "Fictional work" },
    );
    const statuses = (
      await test.request(planner.cookie, "GET", "/api/projects/choices")
    ).json<{ featureStatuses: { id: string; meaning: string }[] }>()
      .featureStatuses;
    expect(activity).toMatchObject({
      projectId,
      releaseId: null,
      statusId: statuses.find(({ meaning }) => meaning === "possible")?.id,
      estimateHours: 40,
      neededBy: "2027-03",
      description: "Fictional work",
      staffed: false,
      draft: { action: "created" },
    });
  });

  it("drafts it on a release", async () => {
    const releaseId = await liveRelease();
    const activity = await addActivity({ releaseId });
    expect(activity).toMatchObject({ releaseId, projectId: null });
  });

  it("is open to the Feature Lead, who edits features", async () => {
    const lead = await test.signedIn("feature-lead");
    const activity = await addActivity(
      { projectId: await liveProject() },
      {},
      lead.cookie,
    );
    expect(activity.draft?.action).toBe("created");
  });

  it("refuses one of neither a release nor a project", async () => {
    const response = await send("POST", "/api/activities", {
      name: unique("Fictional Activity"),
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe("Choose a release or a project");
  });

  it("refuses a name its project already has, and takes one a release has", async () => {
    const projectId = await liveProject();
    const first = await addActivity({ projectId });
    const repeated = await send("POST", "/api/activities", {
      name: first.name.toUpperCase(),
      projectId,
    });
    expect(repeated.statusCode).toBe(409);
    expect(errorOf(repeated)).toBe(
      "This project already has an activity with that name",
    );
    const elsewhere = await send("POST", "/api/activities", {
      name: first.name,
      releaseId: await liveRelease(),
    });
    expect(elsewhere.statusCode, elsewhere.body).toBe(201);
  });
});

describe("changing an activity", () => {
  it("moves it from its project to a release, clearing the project", async () => {
    const activity = await addActivity({ projectId: await liveProject() });
    await approve([{ type: "activity", id: activity.id }]);
    const releaseId = await liveRelease();
    const response = await send("PUT", `/api/activities/${activity.id}`, {
      name: activity.name,
      releaseId,
    });
    expect(response.statusCode, response.body).toBe(200);
    const moved = added(response.json<Saved>(), activity.name);
    expect(moved).toMatchObject({ releaseId, projectId: null });
    expect(moved.draft?.changed).toEqual(
      expect.arrayContaining(["projectId", "releaseId"]),
    );
  });

  it("gives it a value in a column added to Activities", async () => {
    const column = await send("POST", "/api/activities/columns", {
      name: unique("Fictional Runbook"),
      type: "link",
      visibility: "general",
    });
    expect(column.statusCode, column.body).toBe(201);
    const { field } = column.json<{ field: Field }>();
    const activity = await addActivity(
      { projectId: await liveProject() },
      {
        links: {
          [field.id]: { address: "https://example.com/runbook", text: "" },
        },
      },
    );
    expect(activity.links[field.id]).toEqual({
      address: "https://example.com/runbook",
      text: "",
    });
    const read = await readActivities();
    expect(read.columns.fields.map(({ id }) => id)).toContain(field.id);
    expect(read.columns.order.slice(0, 2)).toEqual(["name", "statusId"]);
  });
});

describe("removing an activity", () => {
  it("drafts its removal", async () => {
    const activity = await addActivity({ projectId: await liveProject() });
    await approve([{ type: "activity", id: activity.id }]);
    const response = await send("DELETE", `/api/activities/${activity.id}`);
    expect(response.statusCode, response.body).toBe(200);
    const read = await readActivities();
    expect(
      read.activities.find(({ id }) => id === activity.id)?.draft?.action,
    ).toBe("deleted");
  });

  it("refuses while someone is allocated to it", async () => {
    const activity = await addActivity({ projectId: await liveProject() });
    await approve([{ type: "activity", id: activity.id }]);
    const personId = randomUUID();
    await test.connection.insert(people).values({
      id: personId,
      preferredName: unique("Fictional Person"),
      employeeId: unique("ACT"),
      positionId: testPosition,
    });
    await test.connection.insert(allocations).values({
      personId,
      activityId: activity.id,
      months: { "2027-01": 50 },
    });
    const response = await send("DELETE", `/api/activities/${activity.id}`);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toContain(
      "has allocations, so it can't be removed",
    );
  });

  it("keeps a project with an activity from being removed", async () => {
    const projectId = await liveProject();
    const activity = await addActivity({ projectId });
    await approve([{ type: "activity", id: activity.id }]);
    const response = await send("DELETE", `/api/projects/${projectId}`);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toContain(activity.name);
  });
});

describe("a release's activity", () => {
  it("is named with its release and schedule where a refusal names it", async () => {
    const activity = await addActivity({ releaseId: await liveRelease() });
    await approve([{ type: "activity", id: activity.id }]);
    const personId = randomUUID();
    await test.connection.insert(people).values({
      id: personId,
      preferredName: unique("Fictional Person"),
      employeeId: unique("ACT"),
      positionId: testPosition,
    });
    await test.connection.insert(allocations).values({
      personId,
      activityId: activity.id,
      months: { "2027-01": 50 },
    });
    const response = await send("DELETE", `/api/activities/${activity.id}`);
    expect(errorOf(response)).toMatch(
      /^The activity .+ of Fictional Release \d+ \(Fictional Stream \d+\) has allocations/u,
    );
  });
});

describe("a column on Activities", () => {
  it("cannot be required while activities have no value in it", async () => {
    // Given a live activity, and no drafts of activities, which are refused first
    const activity = await addActivity({ projectId: await liveProject() });
    await approve([{ type: "activity", id: activity.id }]);
    for (const table of [drafts, unpublishedDrafts]) {
      await test.connection
        .delete(table)
        .where(eq(table.recordType, "activity"));
    }
    const response = await send("POST", "/api/activities/columns", {
      name: unique("Fictional Runbook"),
      type: "link",
      visibility: "general",
      required: true,
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toMatch(
      /activit(y has|ies have) no .+, so it cannot be required yet$/u,
    );
  });
});

describe("a link to an activity", () => {
  it("finds the activity, and a column added to Activities", async () => {
    const activity = await addActivity({ projectId: await liveProject() });
    const found = await test.request(
      planner.cookie,
      "GET",
      `/api/go/activity/${String(activity.keyNumber)}`,
    );
    expect(found.json()).toEqual({
      result: "found",
      kind: "activity",
      id: activity.id,
    });
    const column = await send("POST", "/api/activities/columns", {
      name: unique("Fictional Runbook"),
      type: "link",
      visibility: "general",
    });
    const { field } = column.json<{ field: Field }>();
    const columnFound = await test.request(
      planner.cookie,
      "GET",
      `/api/go/column/${String(field.keyNumber)}`,
    );
    expect(columnFound.json()).toEqual({
      result: "found",
      kind: "column",
      id: field.id,
      table: "activities",
    });
  });

  it("finds nothing for a role that doesn't see features", async () => {
    const activity = await addActivity({ projectId: await liveProject() });
    const outsider = await test.signedIn("administrator");
    const found = await test.request(
      outsider.cookie,
      "GET",
      `/api/go/activity/${String(activity.keyNumber)}`,
    );
    expect(found.json()).toEqual({ result: "nothing" });
  });
});

describe("reading activities", () => {
  it("answers whether the role may change them", async () => {
    const member = await test.signedIn("team-member");
    expect((await readActivities(member.cookie)).canEdit).toBe(false);
    expect((await readActivities()).canEdit).toBe(true);
  });
});
