// SPDX-License-Identifier: Apache-2.0

// Integration tests for a project's activities, against a PostgreSQL server of their own: the routes
// and who may use them, reading them with the plan, their drafts with their project's, and links.

import { allocations, people } from "@fathom/db";
import {
  type Activity,
  type ChangeHistory,
  type ProjectPlan,
  type RecordLookup,
  type Role,
  roleSchema,
  startingRoles,
  type Unpublished,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  missingRecord as missing,
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

type Saved = { plan: ProjectPlan; changeSetId: string | null };

const send = (
  method: "POST" | "PUT" | "DELETE",
  url: string,
  body?: object,
  cookie = planner.cookie,
) => test.request(cookie, method, url, body);

async function readPlan(cookie = planner.cookie): Promise<ProjectPlan> {
  const response = await test.request(cookie, "GET", "/api/projects");
  expect(response.statusCode).toBe(200);
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

// A project, approved, so its activities are drafts of their own.
async function liveProject(): Promise<{ id: string; name: string }> {
  const name = unique("Fictional Project");
  const response = await send("POST", "/api/projects", { name });
  expect(response.statusCode).toBe(201);
  const project = response
    .json<Saved>()
    .plan.projects.find((one) => one.name === name);
  const id = String(project?.id);
  await approve([{ type: "project", id }]);
  return { id, name };
}

async function addActivity(
  projectId: string,
  body: object = {},
): Promise<Activity> {
  const name = unique("Fictional Activity");
  const response = await send("POST", `/api/projects/${projectId}/activities`, {
    name,
    ...body,
  });
  expect(response.statusCode, response.body).toBe(201);
  return response
    .json<Saved>()
    .plan.activities.find((one) => one.name === name) as Activity;
}

// Someone allocated to an activity, added directly, as allocating to one isn't offered yet.
async function allocateTo(activityId: string): Promise<void> {
  const personId = randomUUID();
  await test.connection.insert(people).values({
    id: personId,
    preferredName: unique("Fictional Person"),
    employeeId: unique("ACT"),
    positionId: testPosition,
  });
  await test.connection.insert(allocations).values({
    personId,
    activityId,
    months: { "2027-01": 50 },
  });
}

describe("adding an activity", () => {
  it("drafts it on its project, with its fields, seen with the plan", async () => {
    const project = await liveProject();
    const activity = await addActivity(project.id, {
      description: "Move the old bookings",
      note: "Ask the harbour first",
      estimateHours: 120.456,
    });
    expect(activity).toMatchObject({
      projectId: project.id,
      releaseId: null,
      description: "Move the old bookings",
      note: "Ask the harbour first",
      estimateHours: 120.46,
      draft: { action: "created" },
    });
    expect(activity.keyNumber).toBeGreaterThan(0);
  });

  it.each(roleSchema.options)(
    "lets a %s add one only with Edit Plan",
    async (role: Role) => {
      const project = await liveProject();
      const actor = await test.signedIn(role);
      const response = await send(
        "POST",
        `/api/projects/${project.id}/activities`,
        { name: unique("Fictional Activity") },
        actor.cookie,
      );
      // The role is always one of the fixed starting roles.
      // eslint-disable-next-line security/detect-object-injection
      const { permissions } = startingRoles[role];
      expect(response.statusCode).toBe(
        permissions.includes("plan:edit") ? 201 : 403,
      );
    },
  );

  it("refuses a name another of its project's activities has", async () => {
    const project = await liveProject();
    const activity = await addActivity(project.id);
    const taken = await send("POST", `/api/projects/${project.id}/activities`, {
      name: activity.name,
    });
    expect(taken.statusCode).toBe(409);
    expect(errorOf(taken)).toBe(
      "This project already has an activity with that name",
    );
  });

  it("refuses a project that does not exist", async () => {
    const response = await send("POST", `/api/projects/${missing}/activities`, {
      name: unique("Fictional Activity"),
    });
    expect(response.statusCode).toBe(404);
  });

  it("is approved with the project it belongs to when that is only drafted", async () => {
    const name = unique("Fictional Project");
    const plan = (await send("POST", "/api/projects", { name })).json<Saved>()
      .plan;
    const projectId = String(
      plan.projects.find((one) => one.name === name)?.id,
    );
    const activity = await addActivity(projectId);
    expect(activity.draft?.uses).toEqual([{ type: "project", id: projectId }]);
    await approve([{ type: "project-activity", id: activity.id }]);
    const after = await readPlan();
    expect(after.projects.find((one) => one.id === projectId)?.draft).toBe(
      undefined,
    );
    expect(
      after.activities.find((one) => one.id === activity.id)?.draft,
    ).toBeUndefined();
  });
});

describe("changing and removing an activity", () => {
  it("changes it as a draft, and refuses one of another project", async () => {
    const [project, other] = [await liveProject(), await liveProject()];
    const activity = await addActivity(project.id);
    await approve([{ type: "project-activity", id: activity.id }]);
    const renamed = unique("Fictional Renamed");
    const changed = await send(
      "PUT",
      `/api/projects/${project.id}/activities/${activity.id}`,
      { name: renamed },
    );
    expect(changed.statusCode).toBe(200);
    expect(
      changed
        .json<Saved>()
        .plan.activities.find((one) => one.id === activity.id),
    ).toMatchObject({
      name: renamed,
      draft: { action: "changed", changed: ["name"] },
    });
    const elsewhere = await send(
      "PUT",
      `/api/projects/${other.id}/activities/${activity.id}`,
      { name: renamed },
    );
    expect(elsewhere.statusCode).toBe(404);
    expect(errorOf(elsewhere)).toBe(
      "There is no such activity in this project",
    );
  });

  it("removes it as a draft, refused while it has allocations", async () => {
    const project = await liveProject();
    const [free, allocated] = [
      await addActivity(project.id),
      await addActivity(project.id),
    ];
    await approve([
      { type: "project-activity", id: free.id },
      { type: "project-activity", id: allocated.id },
    ]);
    await allocateTo(allocated.id);
    const removed = await send(
      "DELETE",
      `/api/projects/${project.id}/activities/${free.id}`,
    );
    expect(removed.statusCode).toBe(200);
    const refused = await send(
      "DELETE",
      `/api/projects/${project.id}/activities/${allocated.id}`,
    );
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The activity ${allocated.name} of ${project.name} has allocations, so it can't be removed. Allocations are time spent, so the activity stays.`,
    );
  });
});

describe("removing a project", () => {
  it("removes its activities in the same draft", async () => {
    const project = await liveProject();
    const activity = await addActivity(project.id);
    await approve([{ type: "project-activity", id: activity.id }]);
    expect(
      (await send("DELETE", `/api/projects/${project.id}`)).statusCode,
    ).toBe(200);
    const plan = await readPlan();
    expect(
      plan.activities.find((one) => one.id === activity.id)?.draft,
    ).toMatchObject({
      action: "deleted",
      uses: [{ type: "project", id: project.id }],
    });
    await approve([{ type: "project", id: project.id }]);
    expect(
      (await readPlan()).activities.some((one) => one.id === activity.id),
    ).toBe(false);
  });

  it("is refused while one of its activities has allocations", async () => {
    const project = await liveProject();
    const activity = await addActivity(project.id);
    await approve([{ type: "project-activity", id: activity.id }]);
    await allocateTo(activity.id);
    const refused = await send("DELETE", `/api/projects/${project.id}`);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The project ${project.name} has allocations, so it can't be removed. Allocations are time spent, so the project stays.`,
    );
  });
});

describe("reading", () => {
  it("leaves activities out for a reader who sees features but not the plan", async () => {
    const project = await liveProject();
    await addActivity(project.id);
    const featuresOnly = await test.signedIn(["features:view"]);
    expect((await readPlan(featuresOnly.cookie)).activities).toEqual([]);
  });

  it("names a draft of an activity by its project among unpublished changes", async () => {
    const project = await liveProject();
    const name = unique("Fictional Activity");
    await test.request(
      planner.cookie,
      "POST",
      `/api/projects/${project.id}/activities`,
      { name },
      { publish: false },
    );
    const listed = await test.request(
      planner.cookie,
      "GET",
      "/api/unpublished",
    );
    expect(
      listed.json<Unpublished>().changes.map(({ subject }) => subject),
    ).toContain(`the activity ${name} of ${project.name}`);
    await test.request(planner.cookie, "POST", "/api/unpublished/discard");
  });

  it("names an activity in the change history, to those who see the plan", async () => {
    const project = await liveProject();
    const activity = await addActivity(project.id);
    await approve([{ type: "project-activity", id: activity.id }]);
    const named = async (cookie: string) => {
      const response = await test.request(cookie, "GET", "/api/changes");
      expect(response.statusCode).toBe(200);
      return response
        .json<ChangeHistory>()
        .entries.flatMap(({ records }) => records)
        .some(
          ({ kind, name }) =>
            kind === "project-activity" && name === activity.name,
        );
    };
    expect(await named(planner.cookie)).toBe(true);
    const outside = await test.signedIn(["features:view"]);
    expect(await named(outside.cookie)).toBe(false);
  });
});

describe("answering an edit", () => {
  it("sends a role without View Plan none of the plan's other records", async () => {
    const project = await liveProject();
    await addActivity(project.id);
    const featuresOnly = await test.signedIn([
      "features:view",
      "features:edit",
    ]);
    const response = await send(
      "POST",
      "/api/features",
      { name: unique("Fictional Feature") },
      featuresOnly.cookie,
    );
    expect(response.statusCode).toBe(201);
    const { plan } = response.json<Saved>();
    expect(plan.activities).toEqual([]);
    expect(plan.projects).toEqual([]);
    expect(plan.customers).toEqual([]);
    expect(plan.proposals).toEqual([]);
  });
});

describe("links", () => {
  it("opens an activity on its project's page, for a reader who sees the plan", async () => {
    const project = await liveProject();
    const activity = await addActivity(project.id);
    const found = await test.request(
      planner.cookie,
      "GET",
      `/api/go/activity/${String(activity.keyNumber)}`,
    );
    expect(found.json<RecordLookup>()).toEqual({
      result: "found",
      kind: "activity",
      id: activity.id,
      activityOf: { owner: "project", id: project.id },
    });
    const outside = await test.signedIn(["features:view"]);
    const hidden = await test.request(
      outside.cookie,
      "GET",
      `/api/go/activity/${String(activity.keyNumber)}`,
    );
    expect(hidden.json<RecordLookup>()).toEqual({ result: "nothing" });
  });
});
