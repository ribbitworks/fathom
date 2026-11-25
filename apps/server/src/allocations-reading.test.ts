// SPDX-License-Identifier: Apache-2.0

// Integration tests for reading allocations, against a PostgreSQL server of their own: each
// allocation as each reader may see it, and a feature's staffing on the plan.

import { accessHistory, featureTeams, features, projects } from "@fathom/db";
import { type ProjectPlan } from "@fathom/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unique } from "./test-app.ts";
import {
  test,
  type Account,
  allocator,
  manager,
  projectManager,
  viewer,
  month,
  dayIn,
  addPerson,
  addFeature,
  addGeneralFeature,
  change,
  changed,
  read,
  allocationOf,
  decide,
  startAllocationTests,
  closeAllocationTests,
} from "./test-allocations.ts";

beforeAll(startAllocationTests);

afterAll(closeAllocationTests);

describe("reading", () => {
  it("names each feature allocated, a general feature by its project, with that project and its status's meaning", async () => {
    const personId = await addPerson();
    const possible = await addFeature("possible");
    const general = await addGeneralFeature();
    await changed({
      personId,
      featureId: possible,
      percentage: 25,
      from: month(0),
    });
    await changed({
      personId,
      featureId: general.featureId,
      percentage: 50,
      from: month(0),
    });
    const { features: named } = await read(viewer);
    expect(named.find(({ id }) => id === possible)?.meaning).toBe("possible");
    const [project] = await test.connection
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, general.projectId));
    expect(named.find(({ id }) => id === general.featureId)).toEqual({
      id: general.featureId,
      name: project?.name,
      meaning: "in-progress",
      colour: null,
      projectId: general.projectId,
    });
    expect(named.find(({ id }) => id === possible)).not.toHaveProperty(
      "projectId",
    );
  });

  // A feature of a teal team, and one of no team, each allocated.
  async function tealAndTeamless(): Promise<[string, string]> {
    const personId = await addPerson();
    const [team] = await test.connection
      .insert(featureTeams)
      .values({ name: unique("Fictional Team"), colour: "teal" })
      .returning({ id: featureTeams.id });
    const teamed = await addFeature();
    await test.connection
      .update(features)
      .set({ featureTeamId: team?.id })
      .where(eq(features.id, teamed));
    const teamless = await addFeature();
    for (const featureId of [teamed, teamless]) {
      await changed({ personId, featureId, percentage: 50, from: month(0) });
    }
    return [teamed, teamless];
  }

  const coloursFor = async (
    who: Awaited<ReturnType<typeof test.signedIn>>,
    ids: readonly string[],
  ) => {
    const { features: named } = await read(who);
    return ids.map((id) => named.find((feature) => feature.id === id)?.colour);
  };

  it("gives each feature its feature team's colour, to a role that sees feature teams", async () => {
    const ids = await tealAndTeamless();
    expect(await coloursFor(viewer, ids)).toEqual(["teal", null]);
  });

  it("gives no feature a colour for a role that doesn't see feature teams", async () => {
    // Given a role that reads allocations and Personal details, but not feature teams
    const ids = await tealAndTeamless();
    const noTeams = await test.signedIn(["allocations:view", "personal:view"]);

    // Then neither feature has a colour
    expect(await coloursFor(noTeams, ids)).toEqual([null, null]);
  });

  it("shows someone who has not started, recording a view of Personal details", async () => {
    const personId = await addPerson({ startDate: dayIn(2) });
    const featureId = await addFeature();
    await changed(
      { personId, featureId, percentage: 50, from: month(2) },
      manager,
    );
    expect(await allocationOf({ personId }, featureId, manager)).toBeDefined();
    expect(
      await test.connection
        .select({ id: accessHistory.id })
        .from(accessHistory)
        .where(
          and(
            eq(accessHistory.actorId, manager.id),
            eq(accessHistory.action, "personal-viewed"),
          ),
        ),
    ).not.toEqual([]);
  });
});

describe("a feature's staffing on the plan", () => {
  // Seen by everyone who sees features, though the allocations themselves aren't.
  const staffingOf = async (
    featureId: string,
    who: Account,
  ): Promise<[boolean, boolean]> => {
    const response = await test.request(who.cookie, "GET", "/api/projects");
    expect(response.statusCode).toBe(200);
    const feature = response
      .json<ProjectPlan>()
      .features.find(({ id }) => id === featureId);
    return [Boolean(feature?.staffed), Boolean(feature?.staffedLive)];
  };

  it("is not staffed with no allocation, to a role that doesn't see allocations", async () => {
    const featureLead = await test.signedIn("feature-lead");
    const featureId = await addFeature();
    expect(await staffingOf(featureId, featureLead)).toEqual([false, false]);
  });

  it("is staffed as drafted while an allocation's draft waits, and live once approved", async () => {
    const featureLead = await test.signedIn("feature-lead");
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    expect(await staffingOf(featureId, featureLead)).toEqual([true, false]);
    const id = String((await allocationOf({ personId }, featureId))?.id);
    expect((await decide(projectManager, "approval", [id])).statusCode).toBe(
      200,
    );
    expect(await staffingOf(featureId, featureLead)).toEqual([true, true]);
  });

  it("is staffed only to its maker while the change is unpublished", async () => {
    const featureLead = await test.signedIn("feature-lead");
    const personId = await addPerson();
    const featureId = await addFeature();
    const response = await change(
      { personId, featureId, percentage: 50, from: month(0) },
      allocator,
      false,
    );
    expect(response.statusCode).toBe(200);
    expect(await staffingOf(featureId, allocator)).toEqual([true, false]);
    expect(await staffingOf(featureId, featureLead)).toEqual([false, false]);
  });

  it("is not staffed by an allocation drafted to stop from its first month", async () => {
    const featureLead = await test.signedIn("feature-lead");
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    await changed({ personId, featureId, percentage: null, from: month(0) });
    expect(await staffingOf(featureId, featureLead)).toEqual([false, false]);
  });
});
