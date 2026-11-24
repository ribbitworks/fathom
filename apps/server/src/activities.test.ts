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
  privateChanges,
} from "@fathom/db";
import { eq } from "drizzle-orm";
import type {
  Activity,
  Allocations,
  Field,
  Permission,
  ProjectPlan,
} from "@fathom/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  errorOf,
  generalReader,
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
  expect(response.statusCode, response.body).toBe(200);
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

async function addPerson(): Promise<string> {
  const personId = randomUUID();
  await test.connection.insert(people).values({
    id: personId,
    preferredName: unique("Fictional Person"),
    employeeId: unique("ACT"),
    positionId: testPosition,
  });
  return personId;
}

// Someone allocated to the activity, as approved.
async function allocateTo(activityId: string): Promise<string> {
  const personId = await addPerson();
  await test.connection.insert(allocations).values({
    personId,
    activityId,
    months: { "2027-01": 50 },
  });
  return personId;
}

const added = (saved: Saved, name: string) =>
  saved.plan.activities.find((one) => one.name === name) as Activity;

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
    const read = await readPlan();
    expect(read.activityColumns.fields.map(({ id }) => id)).toContain(field.id);
    expect(read.activityColumns.order.slice(0, 2)).toEqual([
      "name",
      "statusId",
    ]);
  });
});

describe("removing an activity", () => {
  it("drafts its removal", async () => {
    const activity = await addActivity({ projectId: await liveProject() });
    await approve([{ type: "activity", id: activity.id }]);
    const response = await send("DELETE", `/api/activities/${activity.id}`);
    expect(response.statusCode, response.body).toBe(200);
    const read = await readPlan();
    expect(
      read.activities.find(({ id }) => id === activity.id)?.draft?.action,
    ).toBe("deleted");
  });

  it("refuses while someone is allocated to it", async () => {
    const activity = await addActivity({ projectId: await liveProject() });
    await approve([{ type: "activity", id: activity.id }]);
    await allocateTo(activity.id);
    const response = await send("DELETE", `/api/activities/${activity.id}`);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toContain(
      "has allocations, so it can't be removed",
    );
  });

  it("refuses while its only allocation is a draft", async () => {
    const activity = await addActivity({ projectId: await liveProject() });
    await approve([{ type: "activity", id: activity.id }]);
    const allocator = await test.signedIn([...generalReader, "personal:view"]);
    const drafted = await test.request(
      allocator.cookie,
      "POST",
      "/api/allocations/changes",
      {
        personId: await addPerson(),
        activityId: activity.id,
        percentage: 50,
        from: "2027-01",
      },
      { publish: true },
    );
    expect(drafted.statusCode, drafted.body).toBe(200);
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

  it("names no activity keeping a project to a role that can't read activities", async () => {
    const projectId = await liveProject();
    const activity = await addActivity({ projectId });
    await approve([{ type: "activity", id: activity.id }]);
    const editor = await test.signedIn(["plan:edit"]);
    const response = await test.request(
      editor.cookie,
      "DELETE",
      `/api/projects/${projectId}`,
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This is used by an activity; change that first",
    );
  });

  it("keeps a release with an activity from being removed", async () => {
    const releaseId = await liveRelease();
    const activity = await addActivity({ releaseId });
    await approve([{ type: "activity", id: activity.id }]);
    const [release] = await test.connection
      .select({ streamId: releases.streamId })
      .from(releases)
      .where(eq(releases.id, releaseId));
    const response = await send(
      "DELETE",
      `/api/release-streams/${String(release?.streamId)}/releases/${releaseId}`,
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toContain(activity.name);
  });
});

describe("a release's activity", () => {
  it("is named with its release and schedule where a refusal names it", async () => {
    const activity = await addActivity({ releaseId: await liveRelease() });
    await approve([{ type: "activity", id: activity.id }]);
    await allocateTo(activity.id);
    const response = await send("DELETE", `/api/activities/${activity.id}`);
    expect(errorOf(response)).toMatch(
      /^The activity .+ of Fictional Stream \d+: Fictional Release \d+ has allocations/u,
    );
  });
});

describe("a column on Activities", () => {
  it("cannot be required while activities have no value in it", async () => {
    // Given a live activity, and no drafts of activities, which are refused first
    const activity = await addActivity({ projectId: await liveProject() });
    await approve([{ type: "activity", id: activity.id }]);
    for (const table of [drafts, privateChanges]) {
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
  const noColumns = { fields: [], order: [], lists: [] };
  const ids = (records: readonly { id: string }[]) =>
    records.map(({ id }) => id);

  it("sends them and Activities' columns only to those who see features", async () => {
    const activity = await addActivity({ projectId: await liveProject() });
    const featuresOnly = await test.signedIn(["features:view"]);
    const planOnly = await test.signedIn(["plan:view"]);
    const seen = await readPlan(featuresOnly.cookie);
    expect(ids(seen.activities)).toContain(activity.id);
    expect(ids(seen.activityColumns.fields)).toEqual(
      ids((await readPlan()).activityColumns.fields),
    );
    const unseen = await readPlan(planOnly.cookie);
    expect(unseen.activities).toEqual([]);
    expect(unseen.activityColumns).toEqual(noColumns);
  });

  it("answers a change to the plan with only what the role sees", async () => {
    await addActivity({ projectId: await liveProject() });
    const planEditor = await test.signedIn(["plan:view", "plan:edit"]);
    const saved = await send(
      "POST",
      "/api/customers",
      { name: unique("Fictional Customer") },
      planEditor.cookie,
    );
    expect(saved.statusCode, saved.body).toBe(201);
    const { plan } = saved.json<Saved>();
    expect(plan.activities).toEqual([]);
    expect(plan.activityColumns).toEqual(noColumns);
    expect(plan.features).toEqual([]);
  });

  it("answers a change to an activity without the plan's other records to a role that sees only features", async () => {
    await liveProject();
    const featuresEditor = await test.signedIn([
      "features:view",
      "features:edit",
    ]);
    const saved = await send(
      "POST",
      "/api/activities",
      { name: unique("Fictional Activity"), releaseId: await liveRelease() },
      featuresEditor.cookie,
    );
    expect(saved.statusCode, saved.body).toBe(201);
    const { plan } = saved.json<Saved>();
    expect(plan.projects).toEqual([]);
    expect(plan.customers).toEqual([]);
    expect(plan.activities.length).toBeGreaterThan(0);
  });

  it("tells a role that sees features whether it may change them", async () => {
    const member = await test.signedIn("team-member");
    expect((await readPlan(member.cookie)).canEditFeatures).toBe(false);
  });
});

describe("an activity someone is allocated to", () => {
  it("reads as staffed", async () => {
    const activity = await addActivity({ projectId: await liveProject() });
    await approve([{ type: "activity", id: activity.id }]);
    await allocateTo(activity.id);
    const read = (await readPlan()).activities.find(
      ({ id }) => id === activity.id,
    );
    expect(read).toMatchObject({ staffed: true, staffedLive: true });
  });

  it("is named on Capacity only to a reader of activities, with its release, and its project only to a reader of the plan", async () => {
    const ofRelease = await addActivity({ releaseId: await liveRelease() });
    const ofProject = await addActivity({ projectId: await liveProject() });
    await approve([
      { type: "activity", id: ofRelease.id },
      { type: "activity", id: ofProject.id },
    ]);
    await allocateTo(ofRelease.id);
    await allocateTo(ofProject.id);
    const ownersFor = async (permissions: Permission[]) => {
      const reader = await test.signedIn([
        ...permissions,
        "allocations:view",
        "people:view",
        "personal:view",
        "feature-teams:view",
      ]);
      const response = await test.request(
        reader.cookie,
        "GET",
        "/api/allocations",
      );
      expect(response.statusCode, response.body).toBe(200);
      const { activities: named } = response.json<Allocations>();
      return [ofRelease.id, ofProject.id].map((id) => {
        const one = named.find((each) => each.id === id);
        return [one?.name, one?.owner];
      });
    };
    const [release, project] = (
      await ownersFor(["plan:view", "features:view"])
    ).map(([, owner]) => owner);
    expect(release).toMatch(/^Fictional Stream \d+: Fictional Release \d+$/u);
    expect(project).toMatch(/^Fictional Project/u);
    expect(
      (await ownersFor(["features:view"])).map(([, owner]) => owner),
    ).toEqual([release, "a project"]);
    // A role that doesn't read activities is told only that it's an activity.
    expect(await ownersFor(["plan:view"])).toEqual([
      ["An activity", undefined],
      ["An activity", undefined],
    ]);
  });
});
