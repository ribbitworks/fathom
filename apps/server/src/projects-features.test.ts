// SPDX-License-Identifier: Apache-2.0

// Tests for the features that projects and proposals name, against a PostgreSQL server of their own:
// naming them from a project or proposal, and a feature's projects and proposals.

import { features } from "@fathom/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { missingRecord as missing, unique, errorOf } from "./test-app.ts";
import {
  test,
  planner,
  viewer,
  type Saved,
  readPlan,
  send,
  byName,
  addProject,
  addProposal,
  addFeature,
  approve,
  startProjectTests,
  closeProjectTests,
} from "./test-projects.ts";

beforeAll(startProjectTests);

afterAll(closeProjectTests);

describe("the features projects and proposals name", () => {
  it("are kept each once, in order, and use the drafts of features only drafted to be added", async () => {
    // Given two features only drafted to be added
    const first = await addFeature();
    const second = await addFeature();
    // When a project and a proposal name them
    const project = await addProject({
      featureIds: [second.id, first.id, second.id],
    });
    const proposal = await addProposal({ featureIds: [first.id] });
    // Then each is named once, in order, and approving them approves the features
    expect(project.featureIds).toEqual([first.id, second.id].sort());
    expect(proposal.featureIds).toEqual([first.id]);
    expect(project.draft?.uses).toEqual(
      expect.arrayContaining([
        { type: "feature", id: first.id },
        { type: "feature", id: second.id },
      ]),
    );
    await approve([
      { type: "project", id: project.id },
      { type: "proposal", id: proposal.id },
    ]);
    const plan = await readPlan(viewer.cookie);
    expect(byName(plan.projects, project.name)).toMatchObject({
      featureIds: [first.id, second.id].sort(),
    });
    expect(byName(plan.proposals, proposal.name)).toMatchObject({
      featureIds: [first.id],
    });
    expect(byName(plan.features, first.name).draft).toBeUndefined();
  });

  it("refuses a proposal taking along a feature drafted to be added to one who approves the plan alone, leaving both drafts", async () => {
    // Given a proposal's draft naming a feature only drafted to be added
    const feature = await addFeature();
    const proposal = await addProposal({ featureIds: [feature.id] });
    const decider = await test.signedIn(["plan:approve", "plan:view"]);

    // When one who approves the plan but not features approves the proposal
    const response = await test.request(
      decider.cookie,
      "POST",
      "/api/drafts/approval",
      { records: [{ type: "proposal", id: proposal.id }] },
    );

    // Then it is refused, and both stay drafts
    expect(response.statusCode).toBe(403);
    const plan = await readPlan(viewer.cookie);
    expect([
      byName(plan.proposals, proposal.name).draft?.action,
      byName(plan.features, feature.name).draft?.action,
    ]).toEqual(["created", "created"]);
  });

  it("are changed as a draft of the project or proposal", async () => {
    const feature = await addFeature();
    const project = await addProject();
    const proposal = await addProposal();
    await approve([
      { type: "feature", id: feature.id },
      { type: "project", id: project.id },
      { type: "proposal", id: proposal.id },
    ]);
    const changed = await send("PUT", `/api/projects/${project.id}`, {
      name: project.name,
      featureIds: [feature.id],
    });
    expect(changed.statusCode).toBe(200);
    const proposed = await send("PUT", `/api/proposals/${proposal.id}`, {
      name: proposal.name,
      featureIds: [feature.id],
    });
    expect(proposed.statusCode).toBe(200);
    const plan = await readPlan();
    expect(byName(plan.projects, project.name).draft).toMatchObject({
      changed: ["featureIds"],
      live: { featureIds: [] },
    });
    expect(byName(plan.proposals, proposal.name).draft).toMatchObject({
      changed: ["featureIds"],
      live: { featureIds: [] },
    });
  });

  it("refuse a project's general feature, which is off the roadmap", async () => {
    const project = await addProject();
    await approve([{ type: "project", id: project.id }]);
    const [general] = await test.connection
      .select({ id: features.id })
      .from(features)
      .where(eq(features.generalForProjectId, project.id));
    const generalId = String(general?.id);
    for (const path of ["projects", "proposals"]) {
      const response = await send("POST", `/api/${path}`, {
        name: unique("Fictional Record"),
        featureIds: [generalId],
      });
      expect(response.statusCode).toBe(400);
      expect(errorOf(response)).toBe("Choose features from Features");
    }
  });

  it("refuse a feature that does not exist", async () => {
    const response = await send("POST", "/api/proposals", {
      name: unique("Fictional Proposal"),
      featureIds: [missing],
    });
    expect(response.statusCode).toBe(404);
  });

  it("keep a feature from being removed while a project or proposal names it", async () => {
    const feature = await addFeature();
    await approve([{ type: "feature", id: feature.id }]);
    // Given a live feature a proposal names
    const proposal = await addProposal({ featureIds: [feature.id] });
    // When its removal is drafted, it is refused, naming the proposal, then the project
    const refused = await send("DELETE", `/api/features/${feature.id}`);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `This is used by the proposal ${proposal.name}; change that first`,
    );
    await send("DELETE", `/api/proposals/${proposal.id}`);
    const project = await addProject({ featureIds: [feature.id] });
    expect(errorOf(await send("DELETE", `/api/features/${feature.id}`))).toBe(
      `This is used by the project ${project.name}; change that first`,
    );
  });
});

describe("a feature's projects and proposals", () => {
  const changeNamers = (
    featureId: string,
    body: object,
    cookie = planner.cookie,
  ) =>
    test.request(
      cookie,
      "PUT",
      `/api/features/${featureId}/projects-and-proposals`,
      body,
    );

  async function liveRecords() {
    const feature = await addFeature();
    const kept = await addProject({ featureIds: [feature.id] });
    const dropped = await addProject({ featureIds: [feature.id] });
    const added = await addProject();
    const proposal = await addProposal();
    await approve([
      { type: "feature", id: feature.id },
      ...[kept, dropped, added].map(({ id }) => ({ type: "project", id })),
      { type: "proposal", id: proposal.id },
    ]);
    return { feature, kept, dropped, added, proposal };
  }

  it("are changed as drafts of each project and proposal added or taken away, in one change", async () => {
    // Given a feature two live projects need
    const { feature, kept, dropped, added, proposal } = await liveRecords();
    // When it is moved from one project to another, and added to a proposal
    const response = await changeNamers(feature.id, {
      projectIds: [kept.id, added.id],
      proposalIds: [proposal.id],
    });
    // Then each record that changes has a draft, and the one kept has none
    expect(response.statusCode).toBe(200);
    const { plan, changeSetId } = response.json<Saved>();
    expect(byName(plan.projects, kept.name).draft).toBeUndefined();
    expect(byName(plan.projects, dropped.name)).toMatchObject({
      featureIds: [],
      draft: { changed: ["featureIds"] },
    });
    expect(byName(plan.projects, added.name)).toMatchObject({
      featureIds: [feature.id],
      draft: { changed: ["featureIds"] },
    });
    expect(byName(plan.proposals, proposal.name).featureIds).toEqual([
      feature.id,
    ]);
    expect(byName(plan.features, feature.name).draft).toBeUndefined();
    // And all of them are one change
    expect(changeSetId).not.toBeNull();
  });

  it("leave a kind not named as it is, and save nothing when nothing changes", async () => {
    const { feature, kept } = await liveRecords();
    const response = await changeNamers(feature.id, { proposalIds: [] });
    expect(response.statusCode).toBe(200);
    const { plan, changeSetId } = response.json<Saved>();
    expect(changeSetId).toBeNull();
    expect(byName(plan.projects, kept.name).featureIds).toEqual([feature.id]);
  });

  it("refuse a feature that does not exist, or a project's general feature", async () => {
    const project = await addProject();
    await approve([{ type: "project", id: project.id }]);
    const [general] = await test.connection
      .select({ id: features.id })
      .from(features)
      .where(eq(features.generalForProjectId, project.id));
    for (const featureId of [missing, String(general?.id)]) {
      const response = await changeNamers(featureId, {
        projectIds: [project.id],
      });
      expect(response.statusCode).toBe(404);
      expect(errorOf(response)).toBe("There is no such feature");
    }
  });

  it("leave a project drafted to be removed as it is, and refuse adding the feature to one", async () => {
    // Given a project needing the feature, drafted to be removed, and another drafted to be removed
    const { feature, kept, dropped, added } = await liveRecords();
    for (const project of [dropped, added]) {
      expect(
        (await send("DELETE", `/api/projects/${project.id}`)).statusCode,
      ).toBe(200);
    }
    // When a view of the drafts applied, which shows neither, names only the project kept
    const unchanged = await changeNamers(feature.id, {
      projectIds: [kept.id],
    });
    // Then nothing changes
    expect(unchanged.statusCode).toBe(200);
    expect(unchanged.json<Saved>().changeSetId).toBeNull();
    // And adding the feature to a project drafted to be removed is refused, naming it
    const refused = await changeNamers(feature.id, {
      projectIds: [kept.id, added.id],
    });
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The project ${added.name} is drafted to be removed, so it can't be changed`,
    );
  });

  it("refuse a project that does not exist", async () => {
    const { feature } = await liveRecords();
    const response = await changeNamers(feature.id, { projectIds: [missing] });
    expect(response.statusCode).toBe(404);
  });

  it("refuse a project another planner is changing", async () => {
    const { feature, added } = await liveRecords();
    const other = await test.signedIn("product-manager");
    const held = await test.request(
      other.cookie,
      "PUT",
      `/api/projects/${added.id}`,
      { name: unique("Fictional Renamed") },
      { publish: false },
    );
    expect(held.statusCode).toBe(200);
    const response = await changeNamers(feature.id, {
      projectIds: [added.id],
    });
    expect(response.statusCode).toBe(409);
  });

  it("are refused to those who edit features but not the rest of the plan", async () => {
    const { feature } = await liveRecords();
    const lead = await test.signedIn("feature-lead");
    const response = await changeNamers(
      feature.id,
      { projectIds: [] },
      lead.cookie,
    );
    expect(response.statusCode).toBe(403);
  });
});
