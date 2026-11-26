// SPDX-License-Identifier: Apache-2.0

// Integration tests for reading allocations, against a PostgreSQL server of their own: each
// allocation as each reader may see it, and a feature's staffing on the plan.

import { accessHistory, activities, featureTeams, features } from "@fathom/db";
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
  activityAllocation,
  director,
  nameOfFeature,
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
  it("names each feature allocated, with its status's meaning", async () => {
    const personId = await addPerson();
    const possible = await addFeature("possible");
    await changed({
      personId,
      featureId: possible,
      percentage: 25,
      from: month(0),
    });
    const { features: named } = await read(viewer);
    expect(named.find(({ id }) => id === possible)?.meaning).toBe("possible");
  });

  it("names a feature as its draft renames it, with its live name and the rename's state", async () => {
    // Given a feature someone is allocated to, whose rename was rejected
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const live = await nameOfFeature(featureId);
    const renamed = unique("Fictional Renamed");
    const drafted = await test.request(
      director.cookie,
      "PUT",
      `/api/features/${featureId}`,
      { name: renamed },
    );
    expect(drafted.statusCode, drafted.body).toBe(200);
    const featureApprover = await test.signedIn([
      "plan:view",
      "features:view",
      "features:approve",
    ]);
    const rejected = await test.request(
      featureApprover.cookie,
      "POST",
      "/api/drafts/rejection",
      {
        records: [{ type: "feature", id: featureId }],
        reason: "Fictional reason",
      },
    );
    expect(rejected.statusCode, rejected.body).toBe(200);

    // When the allocations are read
    const { features: named } = await read(viewer);

    // Then the feature is named as drafted, with its live name and the rejection beside it
    expect(named.find(({ id }) => id === featureId)).toMatchObject({
      name: renamed,
      rename: {
        action: "changed",
        changed: ["name"],
        live: { name: live },
        state: "rejected",
        reason: "Fictional reason",
      },
    });
  });

  it("marks the reader's own rename, not yet published, as unpublished", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const drafted = await test.request(
      director.cookie,
      "PUT",
      `/api/features/${featureId}`,
      { name: unique("Fictional Renamed") },
      { publish: false },
    );
    expect(drafted.statusCode, drafted.body).toBe(200);

    const { features: named } = await read(director);

    expect(named.find(({ id }) => id === featureId)?.rename).toMatchObject({
      state: "waiting",
      unpublished: true,
    });
  });

  it("names an activity as its draft renames it, with its live name", async () => {
    // Given an activity someone is allocated to, drafted to be renamed
    const { activityId } = await activityAllocation();
    const projectId = String(
      (
        await test.connection
          .select({ projectId: activities.projectId })
          .from(activities)
          .where(eq(activities.id, activityId))
      )[0]?.projectId,
    );
    const renamed = unique("Fictional Renamed");
    const drafted = await test.request(
      director.cookie,
      "PUT",
      `/api/activities/${activityId}`,
      { name: renamed, projectId, releaseId: null },
    );
    expect(drafted.statusCode, drafted.body).toBe(200);

    // When the allocations are read
    const { activities: named } = await read(director);

    // Then the activity is named as drafted, with its live name beside it
    expect(named.find(({ id }) => id === activityId)).toMatchObject({
      name: renamed,
      rename: { live: { name: "Fictional Activity" }, state: "waiting" },
    });
  });

  it("gives a feature no rename while its draft keeps its name", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });

    const { features: named } = await read(viewer);

    expect(named.find(({ id }) => id === featureId)?.rename).toBeUndefined();
  });

  it("reads allocations to activities beside a feature's, naming each activity with its project", async () => {
    const { personId, id, activityId, project } = await activityAllocation();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    const { allocations: all, activities: named } = await read();
    const allocated = all.filter((one) => one.personId === personId);
    expect(
      allocated.map((one) => [one.id === id, one.featureId, one.activityId]),
    ).toEqual(
      expect.arrayContaining([
        [true, null, activityId],
        [false, featureId, null],
      ]),
    );
    expect(named.find((one) => one.id === activityId)).toEqual({
      id: activityId,
      name: "Fictional Activity",
      owner: project,
      meaning: "in-progress",
      colour: null,
    });
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
    // Given a role that reads allocations, Personal details and features, but not feature teams
    const ids = await tealAndTeamless();
    const noTeams = await test.signedIn([
      "allocations:view",
      "personal:view",
      "features:view",
    ]);

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
