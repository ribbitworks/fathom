// SPDX-License-Identifier: Apache-2.0

// Tests for workstreams and general features, against a PostgreSQL server of their own: workstreams
// kept with the projects but listed apart, what they refuse, the features on them, and the general
// feature that follows each project's and workstream's approval and stays off every roadmap.

import { features, listItems, lists } from "@fathom/db";
import type { ProjectPlan, Unpublished, Workstream } from "@fathom/shared";
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
let viewer: { id: string; cookie: string };

beforeAll(async () => {
  test = await startTestApp();
  planner = await test.signedIn("product-manager");
  approver = await test.signedIn("project-manager");
  viewer = await test.signedIn("team-member");
});

afterAll(async () => {
  await test.close();
});

type Saved = { plan: ProjectPlan };

const send = (method: "POST" | "PUT" | "DELETE", url: string, body?: object) =>
  test.request(planner.cookie, method, url, body);

async function readPlan(cookie = planner.cookie): Promise<ProjectPlan> {
  const response = await test.request(cookie, "GET", "/api/projects");
  expect(response.statusCode).toBe(200);
  return response.json<ProjectPlan>();
}

async function addWorkstream(): Promise<Workstream> {
  const name = unique("Fictional Workstream");
  const response = await send("POST", "/api/workstreams", { name });
  expect(response.statusCode).toBe(201);
  return response
    .json<Saved>()
    .plan.workstreams.find((one) => one.name === name) as Workstream;
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

async function addFeature(workstreamId: string | null) {
  return send("POST", "/api/features", {
    name: unique("Fictional Feature"),
    workstreamId,
  });
}

describe("workstreams", () => {
  it("are drafted, listed apart from projects, and read by those who see the plan", async () => {
    const workstream = await addWorkstream();
    expect(workstream.draft?.action).toBe("created");
    await approve(workstream.id);
    const plan = await readPlan(viewer.cookie);
    expect(plan.workstreams.map(({ id }) => id)).toContain(workstream.id);
    expect(plan.projects.map(({ id }) => id)).not.toContain(workstream.id);
  });

  it("take a new name through a draft", async () => {
    const workstream = await addWorkstream();
    const name = unique("Fictional Renamed Workstream");
    const response = await send("PUT", `/api/workstreams/${workstream.id}`, {
      name,
    });
    expect(response.statusCode).toBe(200);
    expect(
      response.json<Saved>().plan.workstreams.map((one) => one.name),
    ).toContain(name);
  });

  it("share their names with projects, ignoring letter case", async () => {
    const project = await addProject();
    const response = await send("POST", "/api/workstreams", {
      name: project.name.toUpperCase(),
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "There is already a project or workstream with that name",
    );
  });

  it("are refused an owner who is not one of People", async () => {
    const response = await send("POST", "/api/workstreams", {
      name: unique("Fictional Workstream"),
      ownerId: "00000000-0000-4000-8000-000000000001",
    });
    expect(response.statusCode).toBe(400);
  });

  it("are not reached through projects, nor projects through them", async () => {
    const workstream = await addWorkstream();
    const project = await addProject();
    const name = unique("Fictional Other Name");
    for (const [method, url, body] of [
      ["PUT", `/api/projects/${workstream.id}`, { name }],
      ["DELETE", `/api/projects/${workstream.id}`, undefined],
      ["PUT", `/api/workstreams/${project.id}`, { name }],
      ["DELETE", `/api/workstreams/${project.id}`, undefined],
    ] as const) {
      expect((await send(method, url, body)).statusCode).toBe(404);
    }
  });

  it("have no milestones", async () => {
    const workstream = await addWorkstream();
    const response = await send(
      "POST",
      `/api/projects/${workstream.id}/milestones`,
      { name: "Fictional Milestone", date: "2027-01-04" },
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe("A workstream has no milestones");
  });

  it("are named as workstreams among the maker's unpublished changes", async () => {
    const name = unique("Fictional Unpublished Workstream");
    await test.request(
      planner.cookie,
      "POST",
      "/api/workstreams",
      { name },
      { publish: false },
    );
    const response = await test.request(
      planner.cookie,
      "GET",
      "/api/unpublished",
    );
    expect(
      response.json<Unpublished>().changes.map(({ subject }) => subject),
    ).toContain(`the workstream ${name}`);
    await test.request(planner.cookie, "POST", "/api/unpublished/discard");
  });

  it("can be removed, and take their general feature with them", async () => {
    const workstream = await addWorkstream();
    await approve(workstream.id);
    const removed = await send("DELETE", `/api/workstreams/${workstream.id}`);
    expect(removed.statusCode).toBe(200);
    await approve(workstream.id);
    expect(await generalFeatures(workstream.id)).toEqual([]);
    expect((await readPlan()).workstreams.map(({ id }) => id)).not.toContain(
      workstream.id,
    );
  });

  it("are refused to those who may only see the plan", async () => {
    const response = await test.request(
      viewer.cookie,
      "POST",
      "/api/workstreams",
      { name: unique("Fictional Workstream") },
    );
    expect(response.statusCode).toBe(403);
  });
});

describe("a feature on a workstream", () => {
  it("names its workstream, and stops it being removed", async () => {
    const workstream = await addWorkstream();
    await approve(workstream.id);
    const response = await addFeature(workstream.id);
    expect(response.statusCode).toBe(201);
    const feature = response
      .json<Saved>()
      .plan.features.find((one) => one.workstreamId === workstream.id);
    expect(feature).toBeDefined();
    const removed = await send("DELETE", `/api/workstreams/${workstream.id}`);
    expect(removed.statusCode).toBe(409);
    expect(errorOf(removed)).toBe(
      `This is used by the feature ${String(feature?.name)}; change that first`,
    );
  });

  it("refuses approving its workstream's removal while the feature is live on it", async () => {
    const workstream = await addWorkstream();
    await approve(workstream.id);
    const name = unique("Fictional Feature");
    const added = await send("POST", "/api/features", {
      name,
      workstreamId: workstream.id,
    });
    const id = String(
      added.json<Saved>().plan.features.find((one) => one.name === name)?.id,
    );
    const approved = await decide("approval", {
      records: [{ type: "feature", id }],
    });
    expect(approved.statusCode).toBe(200);
    await send("PUT", `/api/features/${id}`, { name });
    await send("DELETE", `/api/workstreams/${workstream.id}`);
    const response = await decide("approval", {
      records: [{ type: "project", id: workstream.id }],
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      `This is used by the feature ${name}; change that first`,
    );
  });

  it("is approved with the workstream only drafted to be added", async () => {
    const workstream = await addWorkstream();
    const feature = (await addFeature(workstream.id))
      .json<Saved>()
      .plan.features.find((one) => one.workstreamId === workstream.id);
    const response = await decide("approval", {
      records: [{ type: "feature", id: feature?.id }],
    });
    expect(response.statusCode).toBe(200);
    expect(await generalFeatures(workstream.id)).toHaveLength(1);
  });

  it("is refused a project in place of a workstream, or nothing at all", async () => {
    const project = await addProject();
    for (const id of [project.id, "00000000-0000-4000-8000-000000000001"]) {
      const response = await addFeature(id);
      expect(response.statusCode).toBe(400);
      expect(errorOf(response)).toBe("Choose a workstream");
    }
  });
});

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

  it("is made for a workstream too", async () => {
    const workstream = await addWorkstream();
    await approve(workstream.id);
    expect(await generalFeatures(workstream.id)).toHaveLength(1);
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
