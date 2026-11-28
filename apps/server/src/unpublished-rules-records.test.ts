// SPDX-License-Identifier: Apache-2.0

// Integration tests for publishing private changes to the plan's records: each is checked by its
// kind's own rules against the data as it is now, and refused with the reason a fresh change gets,
// naming the record.

import { featureTeams, listItems, lists, people } from "@fathom/db";
import { startingRoles } from "@fathom/shared";
import { and, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPosition, unique } from "./test-app.ts";
import {
  approver,
  closeFeatureTests,
  featureLead,
  liveFeature,
  liveTeam,
  planner,
  startFeatureTests,
  statusMeaning,
  test,
} from "./test-features.ts";

beforeAll(startFeatureTests);

afterAll(closeFeatureTests);

const publishing = (who = planner) =>
  test.request(who.cookie, "POST", "/api/unpublished/publish");

const changedPrivately = async (id: string, body: object, who = planner) => {
  const response = await test.request(
    who.cookie,
    "PUT",
    `/api/features/${id}`,
    body,
    { publish: false },
  );
  expect(response.statusCode, response.body).toBe(200);
};

// No route retires a built-in choice, removes a live feature team or someone in People without
// approvals that would end the private change, so the tests change storage.
describe("publishing a private change to a feature", () => {
  it("is refused for a status retired since, naming the feature", async () => {
    // Given a private change of a live feature's status, whose choice is retired since
    const feature = await liveFeature();
    const planned = await statusMeaning("planned");
    await changedPrivately(feature.id, {
      name: feature.name,
      statusId: planned,
    });
    await test.connection
      .update(listItems)
      .set({ retired: true })
      .where(eq(listItems.id, planned));

    // When the planner publishes
    const response = await publishing();

    // Then it is refused with the reason a fresh change gets
    await test.connection
      .update(listItems)
      .set({ retired: false })
      .where(eq(listItems.id, planned));
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      `The feature ${feature.name}: Choose a status that is offered`,
    );
  });

  it("is refused for a feature team removed since", async () => {
    const feature = await liveFeature();
    const team = await liveTeam();
    await changedPrivately(
      feature.id,
      {
        name: feature.name,
        featureTeamId: team,
      },
      featureLead,
    );
    await test.connection.delete(featureTeams).where(eq(featureTeams.id, team));

    const response = await publishing(featureLead);

    expect(response.statusCode, response.body).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      `The feature ${feature.name}: Choose a feature team that has been approved`,
    );
  });

  it("is refused for a field the role may no longer change", async () => {
    // Given a Feature Lead's private feature team for a feature, and the role since without the
    // right to change feature teams
    const lead = await test.signedIn("feature-lead");
    const feature = await liveFeature();
    await changedPrivately(
      feature.id,
      { name: feature.name, featureTeamId: await liveTeam() },
      lead,
    );
    await test.holdOnly(
      lead.id,
      startingRoles["feature-lead"].permissions.filter(
        (permission) => permission !== "feature-teams:edit",
      ),
    );

    const response = await publishing(lead);

    expect(response.statusCode, response.body).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      `The feature ${feature.name}: This role can't change a feature's feature team`,
    );
  });
});

describe("publishing a private change to a project", () => {
  it("is refused for an owner no longer among People", async () => {
    // Given a project with an owner given privately, who has since left People
    const name = unique("Fictional Project");
    const created = await test.request(
      approver.cookie,
      "POST",
      "/api/projects",
      {
        name,
      },
    );
    expect(created.statusCode, created.body).toBe(201);
    const project = created
      .json<{ plan: { projects: { id: string; name: string }[] } }>()
      .plan.projects.find((each) => each.name === name);
    const ownerId = randomUUID();
    await test.connection.insert(people).values({
      id: ownerId,
      preferredName: unique("Fictional Owner"),
      employeeId: unique("OWN"),
      positionId: testPosition,
    });
    const changed = await test.request(
      approver.cookie,
      "PUT",
      `/api/projects/${String(project?.id)}`,
      { name: project?.name, ownerId },
      { publish: false },
    );
    expect(changed.statusCode, changed.body).toBe(200);
    await test.connection.delete(people).where(eq(people.id, ownerId));

    const response = await publishing(approver);

    expect(response.statusCode, response.body).toBe(409);
    expect(response.json<{ error: string }>().error).toBe(
      `The project ${String(project?.name)}: Choose an owner from People`,
    );
  });
});

describe("publishing a private change to a proposal", () => {
  it("is refused for a status retired since", async () => {
    // Given a proposal's status changed privately to another, which is retired since
    const name = unique("Fictional Proposal");
    const created = await test.request(
      approver.cookie,
      "POST",
      "/api/proposals",
      {
        name,
      },
    );
    expect(created.statusCode, created.body).toBe(201);
    const proposal = created
      .json<{
        plan: { proposals: { id: string; name: string; statusId: string }[] };
      }>()
      .plan.proposals.find((each) => each.name === name);
    const [other] = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .where(
        and(
          eq(lists.builtIn, "proposal-statuses"),
          ne(listItems.id, String(proposal?.statusId)),
        ),
      );
    const changed = await test.request(
      approver.cookie,
      "PUT",
      `/api/proposals/${String(proposal?.id)}`,
      { name, statusId: other?.id },
      { publish: false },
    );
    expect(changed.statusCode, changed.body).toBe(200);
    const retire = (retired: boolean) =>
      test.connection
        .update(listItems)
        .set({ retired })
        .where(eq(listItems.id, String(other?.id)));
    await retire(true);

    const response = await publishing(approver);

    await retire(false);
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json<{ error: string }>().error).toMatch(
      /^The proposal .*: Choose a .* that is offered$/,
    );
  });
});
