// SPDX-License-Identifier: Apache-2.0

// Tests for owners not yet started, against a PostgreSQL server of their own: offered, named and
// kept as People shows them to a role that doesn't see start and end dates.

import { people, projects, proposals, recordChanges } from "@fathom/db";
import type { PlanChoices } from "@fathom/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addPerson,
  addProject,
  addProposal,
  approve,
  approver,
  closeProjectTests,
  projectNamed,
  readPlan,
  send,
  startProjectTests,
  test,
  viewer,
} from "./test-projects.ts";

beforeAll(startProjectTests);
afterAll(closeProjectTests);

const ownersFor = async (who: { cookie: string }) => {
  const response = await test.request(
    who.cookie,
    "GET",
    "/api/projects/choices",
  );
  expect(response.statusCode).toBe(200);
  return response.json<PlanChoices>().owners.map(({ id }) => id);
};

// Someone not yet started, their name recorded as Fathom does on adding them, so the history can
// name them.
async function joining(): Promise<string> {
  const id = await addPerson();
  const [person] = await test.connection
    .update(people)
    .set({ startDate: "2999-01-01" })
    .where(eq(people.id, id))
    .returning({ name: people.preferredName });
  await recordChanges(test.connection, null, [
    {
      recordType: "person",
      recordId: id,
      action: "created",
      field: "preferredName",
      tier: "general",
      oldValue: null,
      newValue: String(person?.name),
    },
  ]);
  return id;
}

// A live project owned by someone not yet started.
async function ownedByJoining(): Promise<{ id: string; ownerId: string }> {
  const ownerId = await joining();
  const project = await addProject();
  await approve([{ type: "project", id: project.id }]);
  await test.connection
    .update(projects)
    .set({ ownerId })
    .where(eq(projects.id, project.id));
  return { id: project.id, ownerId };
}

describe("an owner not yet started", () => {
  it("is offered only to a role that sees start and end dates", async () => {
    const id = await joining();

    expect(await ownersFor(approver)).toContain(id);
    expect(await ownersFor(viewer)).not.toContain(id);
  });

  it("is named as no owner to a role that doesn't see start and end dates", async () => {
    const { id, ownerId } = await ownedByJoining();
    const ownerFor = async (cookie: string) =>
      (await readPlan(cookie)).projects.find((project) => project.id === id)
        ?.ownerId;

    expect(await ownerFor(approver.cookie)).toBe(ownerId);
    expect(await ownerFor(viewer.cookie)).toBeNull();
  });

  it("is kept when such a role saves the project naming no owner", async () => {
    const { id, ownerId } = await ownedByJoining();
    const project = await projectNamed(id);
    const saved = await send("PUT", `/api/projects/${id}`, {
      name: project.name,
      externalId: "P-9001",
      ownerId: null,
    });
    expect(saved.statusCode, saved.body).toBe(200);

    const drafted = (await readPlan(approver.cookie)).projects.find(
      (one) => one.id === id,
    );
    expect(drafted?.ownerId).toBe(ownerId);
  });

  it("is refused as a new owner from such a role, as no one in People", async () => {
    const hidden = await joining();
    const project = await addProject();
    const refused = await send("PUT", `/api/projects/${project.id}`, {
      name: project.name,
      ownerId: hidden,
    });
    expect(refused.statusCode).toBe(400);
  });

  it("is named nowhere in the change history to such a role", async () => {
    const hidden = await joining();
    const [person] = await test.connection
      .select({ name: people.preferredName })
      .from(people)
      .where(eq(people.id, hidden));
    const project = await addProject();
    await approve([{ type: "project", id: project.id }]);
    const response = await test.request(
      approver.cookie,
      "PUT",
      `/api/projects/${project.id}`,
      { name: project.name, ownerId: hidden },
      { publish: true },
    );
    expect(response.statusCode, response.body).toBe(200);
    const historyFor = async (cookie: string) =>
      (await test.request(cookie, "GET", "/api/changes")).body;

    expect(await historyFor(approver.cookie)).toContain(String(person?.name));
    expect(await historyFor(viewer.cookie)).not.toContain(String(person?.name));
  });

  it("is named as no owner of a proposal to such a role", async () => {
    const ownerId = await joining();
    const proposal = await addProposal();
    await approve([{ type: "proposal", id: proposal.id }]);
    await test.connection
      .update(proposals)
      .set({ ownerId })
      .where(eq(proposals.id, proposal.id));
    const ownerFor = async (cookie: string) =>
      (await readPlan(cookie)).proposals.find((one) => one.id === proposal.id)
        ?.ownerId;

    expect(await ownerFor(approver.cookie)).toBe(ownerId);
    expect(await ownerFor(viewer.cookie)).toBeNull();
  });

  // A live project with a published draft making someone not yet started its owner.
  async function draftedToJoining(): Promise<string> {
    const hidden = await joining();
    const project = await addProject();
    await approve([{ type: "project", id: project.id }]);
    const drafted = await test.request(
      approver.cookie,
      "PUT",
      `/api/projects/${project.id}`,
      { name: project.name, ownerId: hidden },
      { publish: true },
    );
    expect(drafted.statusCode, drafted.body).toBe(200);
    return project.id;
  }

  it("makes no draft to such a role of a draft that only gives them the project", async () => {
    const id = await draftedToJoining();
    const projectFor = async (cookie: string) =>
      (await readPlan(cookie)).projects.find((one) => one.id === id);

    expect((await projectFor(approver.cookie))?.draft?.changed).toContain(
      "ownerId",
    );
    const seen = await projectFor(viewer.cookie);
    expect(seen?.draft).toBeUndefined();
    expect(seen?.ownerId).toBeNull();
  });

  it("can't be approved or rejected by such a role", async () => {
    const id = await draftedToJoining();
    const decider = await test.signedIn(["plan:view", "plan:approve"]);
    for (const asking of ["approval", "rejection"]) {
      const response = await test.request(
        decider.cookie,
        "POST",
        `/api/drafts/${asking}`,
        {
          records: [{ type: "project", id }],
          ...(asking === "rejection" ? { reason: "Fictional reason" } : {}),
        },
      );
      expect(response.statusCode, asking).toBe(403);
    }
  });

  it("leaves a new project drafted with them readable to such a role, naming no owner", async () => {
    const hidden = await joining();
    const added = await test.request(
      approver.cookie,
      "POST",
      "/api/projects",
      { records: [{ name: "Fictional Future Project", ownerId: hidden }] },
      { publish: true },
    );
    expect(added.statusCode, added.body).toBe(201);

    const project = (await readPlan(viewer.cookie)).projects.find(
      ({ name }) => name === "Fictional Future Project",
    );
    expect(project?.ownerId).toBeNull();
  });

  it("is kept in another maker's draft when such a role saves the project as it is shown", async () => {
    const visible = await addPerson();
    const project = await addProject({ ownerId: visible });
    await approve([{ type: "project", id: project.id }]);
    const hidden = await joining();
    await test.request(
      approver.cookie,
      "PUT",
      `/api/projects/${project.id}`,
      { name: project.name, ownerId: hidden },
      { publish: true },
    );
    const shown = await projectNamed(project.id);
    expect(shown.ownerId).toBeNull();

    const saved = await send("PUT", `/api/projects/${project.id}`, {
      name: project.name,
      externalId: "P-9002",
      ownerId: shown.ownerId,
    });
    expect(saved.statusCode, saved.body).toBe(200);
    const drafted = (await readPlan(approver.cookie)).projects.find(
      ({ id }) => id === project.id,
    );
    expect(drafted?.ownerId).toBe(hidden);
  });

  // A live project with a published draft linking a new proposal owned by someone not yet started.
  async function linkingHiddenOwner(): Promise<string> {
    const hidden = await joining();
    const name = `Fictional Future Proposal ${hidden.slice(0, 8)}`;
    const proposal = await test.request(
      approver.cookie,
      "POST",
      "/api/proposals",
      { records: [{ name, ownerId: hidden }] },
      { publish: true },
    );
    expect(proposal.statusCode, proposal.body).toBe(201);
    const proposalId = String(
      (await readPlan(approver.cookie)).proposals.find(
        (one) => one.name === name,
      )?.id,
    );
    const project = await addProject();
    await approve([{ type: "project", id: project.id }]);
    const linked = await test.request(
      approver.cookie,
      "PUT",
      `/api/projects/${project.id}`,
      { name: project.name, proposalIds: [proposalId] },
      { publish: true },
    );
    expect(linked.statusCode, linked.body).toBe(200);
    return project.id;
  }

  const decide = async (asking: "approval" | "rejection", id: string) => {
    const decider = await test.signedIn(["plan:view", "plan:approve"]);
    return test.request(decider.cookie, "POST", `/api/drafts/${asking}`, {
      records: [{ type: "project", id }],
      ...(asking === "rejection" ? { reason: "Fictional reason" } : {}),
    });
  };

  it("can't be approved by such a role along with a draft that uses theirs", async () => {
    const id = await linkingHiddenOwner();
    expect((await decide("approval", id)).statusCode).toBe(403);
  });

  it("leaves such a role free to reject a draft that only uses theirs", async () => {
    const id = await linkingHiddenOwner();
    const response = await decide("rejection", id);
    expect(response.statusCode, response.body).toBe(200);
  });

  it("leaves such a role free to clear an owner it sees", async () => {
    const visible = await addPerson();
    const project = await addProject({ ownerId: visible });
    const cleared = await send("PUT", `/api/projects/${project.id}`, {
      name: project.name,
      ownerId: null,
    });
    expect(cleared.statusCode, cleared.body).toBe(200);
    expect((await projectNamed(project.id)).ownerId).toBeNull();
  });
});

describe("an owner who has left", () => {
  it("leaves a rejection naming them shown to a role that doesn't see start and end dates, as the plan names them retired", async () => {
    // Given a project's draft giving it an owner, rejected
    const ownerId = await addPerson();
    const project = await addProject();
    await approve([{ type: "project", id: project.id }]);
    const drafted = await test.request(
      approver.cookie,
      "PUT",
      `/api/projects/${project.id}`,
      { name: project.name, ownerId },
      { publish: true },
    );
    expect(drafted.statusCode, drafted.body).toBe(200);
    const rejected = await test.request(
      approver.cookie,
      "POST",
      "/api/drafts/rejection",
      {
        records: [{ type: "project", id: project.id }],
        reason: "Fictional reason",
      },
    );
    expect(rejected.statusCode, rejected.body).toBe(200);
    const { changeSetId } = rejected.json<{ changeSetId: string }>();

    // When the owner leaves, and a General change to them is in the history the role reads too
    await test.connection
      .update(people)
      .set({ endDate: "2021-01-31" })
      .where(eq(people.id, ownerId));
    await recordChanges(test.connection, null, [
      {
        recordType: "person",
        recordId: ownerId,
        action: "changed",
        field: "preferredName",
        tier: "general",
        oldValue: null,
        newValue: "Fictional Leaver",
      },
    ]);

    // Then the rejection is still shown to a role that doesn't see start and end dates
    const { entries } = (
      await test.request(viewer.cookie, "GET", "/api/changes")
    ).json<{ entries: { id: string }[] }>();
    expect(entries.map(({ id }) => id)).toContain(changeSetId);
  });
});
