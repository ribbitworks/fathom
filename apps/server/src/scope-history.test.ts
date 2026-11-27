// SPDX-License-Identifier: Apache-2.0

// Tests for a project's and proposal's scope history, against a PostgreSQL server of their own: the
// features given and removed, newest first, and the reason for taking a feature off a proposal.

import type {
  ChangeHistory,
  ProjectPlan,
  Proposal,
  ScopeHistory,
} from "@fathom/shared";
import { recordChanges } from "@fathom/db";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addingOne,
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

type Saved = { plan: ProjectPlan; changeSetId: string | null };

const send = (method: "POST" | "PUT" | "DELETE", url: string, body?: object) =>
  test.request(planner.cookie, method, url, body);

async function added<Named extends { name: string }>(
  path: string,
  pick: (plan: ProjectPlan) => readonly Named[],
  body: object = {},
): Promise<Named & { id: string }> {
  const name = unique("Fictional Record");
  const response = await send(
    "POST",
    `/api/${path}`,
    addingOne({ name, ...body }),
  );
  expect(response.statusCode).toBe(201);
  return pick(response.json<Saved>().plan).find(
    (record) => record.name === name,
  ) as Named & { id: string };
}

const approve = async (records: { type: string; id: string }[]) => {
  const response = await test.request(
    approver.cookie,
    "POST",
    "/api/drafts/approval",
    { records },
  );
  expect(response.statusCode).toBe(200);
};

async function readHistory(
  path: "projects" | "proposals",
  id: string,
  cookie = planner.cookie,
): Promise<ScopeHistory> {
  const response = await test.request(
    cookie,
    "GET",
    `/api/${path}/${id}/scope-history`,
  );
  expect(response.statusCode).toBe(200);
  return response.json<ScopeHistory>();
}

const changeNamers = (featureId: string, body: object) =>
  send("PUT", `/api/features/${featureId}/projects-and-proposals`, body);

const changeReason = (featureId: string, proposalId: string, body: object) =>
  send(
    "PUT",
    `/api/features/${featureId}/proposals/${proposalId}/removal-reason`,
    body,
  );

async function proposalOf(id: string): Promise<Proposal> {
  const response = await test.request(planner.cookie, "GET", "/api/projects");
  return response
    .json<ProjectPlan>()
    .proposals.find((proposal) => proposal.id === id) as Proposal;
}

// A live feature, with a live proposal and project that name it.
async function liveLinks() {
  const feature = await added("features", (plan) => plan.features);
  const proposal = await added("proposals", (plan) => plan.proposals, {
    featureIds: [feature.id],
  });
  const project = await added("projects", (plan) => plan.projects, {
    featureIds: [feature.id],
  });
  await approve([
    { type: "feature", id: feature.id },
    { type: "proposal", id: proposal.id },
    { type: "project", id: project.id },
  ]);
  return { feature, proposal, project };
}

describe("a project's and proposal's scope history", () => {
  it("lists each feature given and removed, newest first, with the reason for a proposal's", async () => {
    // Given a feature in a proposal and a project
    const { feature, proposal, project } = await liveLinks();
    // When it is removed from both, the proposal's removal given a reason, and that is approved
    const response = await changeNamers(feature.id, {
      projectIds: [],
      proposalIds: [],
    });
    expect(response.statusCode).toBe(200);
    await changeReason(feature.id, proposal.id, {
      removalReason: " Too costly ",
    });
    await approve([
      { type: "proposal", id: proposal.id },
      { type: "project", id: project.id },
    ]);
    // Then each lists the removal before the addition, the reason on the proposal's alone
    const shown = (history: ScopeHistory) =>
      history.changes.map(({ featureId, name, added, reason }) => ({
        featureId,
        name,
        added,
        reason,
      }));
    const added = {
      featureId: feature.id,
      name: feature.name,
      added: true,
      reason: null,
    };
    expect(shown(await readHistory("proposals", proposal.id))).toEqual([
      { ...added, added: false, reason: "Too costly" },
      added,
    ]);
    expect(shown(await readHistory("projects", project.id))).toEqual([
      { ...added, added: false },
      added,
    ]);
    const { changes } = await readHistory("projects", project.id);
    expect(changes.every(({ at }) => !Number.isNaN(Date.parse(at)))).toBe(true);
  });

  it("leaves out drafts, and names each feature of one change", async () => {
    const { feature, proposal } = await liveLinks();
    const other = await added("features", (plan) => plan.features);
    await approve([{ type: "feature", id: other.id }]);
    await send("PUT", `/api/proposals/${proposal.id}`, {
      name: proposal.name,
      featureIds: [feature.id, other.id],
    });
    await approve([{ type: "proposal", id: proposal.id }]);
    await changeNamers(feature.id, { proposalIds: [] });
    const { changes } = await readHistory("proposals", proposal.id);
    expect(changes.map(({ name, added }) => [name, added])).toEqual([
      [other.name, true],
      [feature.name, true],
    ]);
  });

  it("dates an approved change by when it was drafted, not when it was approved", async () => {
    // Given a feature drafted to be removed from a proposal
    const { feature, proposal } = await liveLinks();
    await changeNamers(feature.id, { proposalIds: [] });
    const drafted = (await proposalOf(proposal.id)).draft?.madeAt;
    // When it is approved
    await approve([{ type: "proposal", id: proposal.id }]);
    // Then the removal keeps the day it was drafted
    const [removal] = (await readHistory("proposals", proposal.id)).changes;
    expect(removal).toMatchObject({ added: false, at: drafted });
  });

  it("dates a removal drafted again after a discard by its new draft", async () => {
    // Given a removal drafted, then discarded
    const { feature, proposal } = await liveLinks();
    await changeNamers(feature.id, { proposalIds: [] });
    const first = (await proposalOf(proposal.id)).draft?.madeAt;
    expect(
      (await send("DELETE", `/api/records/proposal/${proposal.id}/draft`))
        .statusCode,
    ).toBe(200);
    // When it is drafted again and approved
    await changeNamers(feature.id, { proposalIds: [] });
    const again = (await proposalOf(proposal.id)).draft?.madeAt;
    await approve([{ type: "proposal", id: proposal.id }]);
    // Then the removal is dated by the second draft
    expect(again).not.toBe(first);
    const [removal] = (await readHistory("proposals", proposal.id)).changes;
    expect(removal).toMatchObject({ added: false, at: again });
  });

  it("dates a change saved without a draft when it was saved, and names a feature the history never named as none", async () => {
    // Given a change to a proposal's features saved live, as the seed saves its own
    const { proposal } = await liveLinks();
    const unnamed = randomUUID();
    await recordChanges(test.connection, null, [
      {
        recordType: "proposal",
        recordId: proposal.id,
        action: "changed",
        field: "featureIds",
        tier: "general",
        oldValue: null,
        newValue: [unnamed],
      },
    ]);
    // When its history is read
    const [latest] = (await readHistory("proposals", proposal.id)).changes;
    // Then the feature is added, unnamed, on the day the change was saved
    expect(latest).toMatchObject({
      featureId: unnamed,
      name: null,
      added: true,
    });
    expect(Number.isNaN(Date.parse(String(latest?.at)))).toBe(false);
  });

  it("is empty for a record never given a feature", async () => {
    expect((await readHistory("projects", missing)).changes).toEqual([]);
  });

  it("is read by those who see the plan, and refused to others", async () => {
    const { proposal } = await liveLinks();
    const member = await test.signedIn("team-member");
    expect(
      (await readHistory("proposals", proposal.id, member.cookie)).changes,
    ).toHaveLength(1);
    const administrator = await test.signedIn("administrator");
    const refused = await test.request(
      administrator.cookie,
      "GET",
      `/api/proposals/${proposal.id}/scope-history`,
    );
    expect(refused.statusCode).toBe(403);
  });
});

describe("the reason for removing a feature from a proposal", () => {
  it("starts empty when a feature is removed, whatever the change sends", async () => {
    // Given two features in a live proposal
    const { feature, proposal } = await liveLinks();
    const other = await added("features", (plan) => plan.features);
    await approve([{ type: "feature", id: other.id }]);
    await send("PUT", `/api/proposals/${proposal.id}`, {
      name: proposal.name,
      featureIds: [feature.id, other.id],
    });
    await approve([{ type: "proposal", id: proposal.id }]);
    // When the proposal removes one, and the feature's side removes the other, each sending a reason
    const fromProposal = await send("PUT", `/api/proposals/${proposal.id}`, {
      name: proposal.name,
      featureIds: [other.id],
      removalReason: "Out of scope",
    });
    const fromFeature = await changeNamers(other.id, {
      proposalIds: [],
      removalReason: "Too costly",
    });
    // Then neither reason is kept, since a reason is given once the removal is drafted
    expect([fromProposal.statusCode, fromFeature.statusCode]).toEqual([
      200, 200,
    ]);
    expect((await proposalOf(proposal.id)).removalReasons).toEqual({});
  });

  it("is dropped when the feature is added again", async () => {
    const { feature, proposal } = await liveLinks();
    await changeNamers(feature.id, { proposalIds: [] });
    await changeReason(feature.id, proposal.id, {
      removalReason: "Too costly",
    });
    await changeNamers(feature.id, { proposalIds: [proposal.id] });
    expect((await proposalOf(proposal.id)).removalReasons).toEqual({});
  });

  it("is changed, and cleared, while a draft removes the feature", async () => {
    const { feature, proposal } = await liveLinks();
    await changeNamers(feature.id, { proposalIds: [] });
    const changed = await changeReason(feature.id, proposal.id, {
      removalReason: "Customer withdrew it",
    });
    expect(changed.statusCode).toBe(200);
    expect(
      changed.json<Saved>().plan.proposals.find(({ id }) => id === proposal.id)
        ?.removalReasons,
    ).toEqual({ [feature.id]: "Customer withdrew it" });
    await changeReason(feature.id, proposal.id, { removalReason: "" });
    expect((await proposalOf(proposal.id)).removalReasons).toEqual({});
  });

  it("can't be given for a feature only a draft added, then removed", async () => {
    // Given a live proposal and a feature it never proposed
    const { proposal } = await liveLinks();
    const other = await added("features", (plan) => plan.features);
    await approve([{ type: "feature", id: other.id }]);
    // When a draft adds the feature and then removes it
    await changeNamers(other.id, { proposalIds: [proposal.id] });
    await changeNamers(other.id, { proposalIds: [] });
    // Then it has no reason to give, since the live proposal never had it
    const response = await changeReason(other.id, proposal.id, {
      removalReason: "Too costly",
    });
    expect(response.statusCode).toBe(409);
  });

  it("can't be changed unless a draft removes the feature from the proposal", async () => {
    const { feature, proposal } = await liveLinks();
    const response = await changeReason(feature.id, proposal.id, {
      removalReason: "Too costly",
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "No draft removes this feature from the proposal, so it has no reason to change",
    );
  });

  it("is refused to those who edit features but not the rest of the plan", async () => {
    const { feature, proposal } = await liveLinks();
    await changeNamers(feature.id, { proposalIds: [] });
    const lead = await test.signedIn("feature-lead");
    const response = await test.request(
      lead.cookie,
      "PUT",
      `/api/features/${feature.id}/proposals/${proposal.id}/removal-reason`,
      { removalReason: "Too costly" },
    );
    expect(response.statusCode).toBe(403);
  });

  it("refuses a reason too long to read beside the removal", async () => {
    const { feature, proposal } = await liveLinks();
    await changeNamers(feature.id, { proposalIds: [] });
    const response = await changeReason(feature.id, proposal.id, {
      removalReason: "a".repeat(201),
    });
    expect(response.statusCode).toBe(400);
  });

  it("is named in the change history as for a removed feature when the feature has no name", async () => {
    const { proposal } = await liveLinks();
    await recordChanges(test.connection, null, [
      {
        recordType: "proposal",
        recordId: proposal.id,
        action: "changed",
        field: "removalReasons",
        tier: "general",
        oldValue: {},
        newValue: { [randomUUID()]: "Too costly" },
      },
    ]);
    const response = await test.request(planner.cookie, "GET", "/api/changes");
    expect(
      response
        .json<ChangeHistory>()
        .entries.flatMap((entry) => entry.records)
        .filter(({ name }) => name === proposal.name)
        .flatMap(({ fields }) => fields),
    ).toContainEqual({
      field: "removalReasons",
      oldValue: [],
      newValue: ["A removed feature: Too costly"],
    });
  });

  it("is named in the change history after the feature it is for", async () => {
    const { feature, proposal } = await liveLinks();
    await changeNamers(feature.id, { proposalIds: [] });
    await changeReason(feature.id, proposal.id, {
      removalReason: "Too costly",
    });
    const response = await test.request(planner.cookie, "GET", "/api/changes");
    const fields = response
      .json<ChangeHistory>()
      .entries.flatMap((entry) => entry.records)
      .filter(({ name }) => name === proposal.name)
      .flatMap(({ fields }) => fields);
    expect(fields).toContainEqual({
      field: "removalReasons",
      oldValue: [],
      newValue: [`${feature.name}: Too costly`],
    });
  });
});
