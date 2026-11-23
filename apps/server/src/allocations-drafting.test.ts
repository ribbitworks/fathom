// SPDX-License-Identifier: Apache-2.0

// Integration tests for drafting allocations, against a PostgreSQL server of their own: changing one
// as a draft from a month, the people, planned hires and features that can be allocated and when,
// unpublished changes, and someone's employment dates.

import { features, people, projects } from "@fathom/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, unique } from "./test-app.ts";
import {
  test,
  manager,
  director,
  month,
  dayIn,
  addPerson,
  addHire,
  addFeature,
  addGeneralFeature,
  change,
  changed,
  read,
  allocationOf,
  approved,
  liveAllocation,
  startAllocationTests,
  closeAllocationTests,
} from "./test-allocations.ts";

beforeAll(startAllocationTests);

afterAll(closeAllocationTests);

describe("allocating", () => {
  it("refuses in words to stop an allocation that was never made", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();

    const response = await change({
      personId,
      featureId,
      percentage: null,
      from: month(0),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "There is no allocation to stop on that feature",
    });
  });

  it("saves a range as a draft of its first month and the month it stops, live once approved", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({
      personId,
      featureId,
      percentage: 50,
      from: month(1),
      to: month(3),
    });
    const drafted = await allocationOf({ personId }, featureId);
    expect(drafted?.months).toEqual({});
    expect(drafted?.draft).toMatchObject({
      action: "created",
      state: "waiting",
      months: { [month(1)]: 50, [month(4)]: null },
    });
    await approved(String(drafted?.id));
    const live = await allocationOf({ personId }, featureId);
    expect(live?.months).toEqual({ [month(1)]: 50, [month(4)]: null });
    expect(live?.draft).toBeUndefined();
  });

  it("keeps the months around one month changed within a range, in the allocation's one draft", async () => {
    const { personId, featureId, id } = await liveAllocation({
      from: 0,
      to: 5,
    });
    await changed({
      personId,
      featureId,
      percentage: 100,
      from: month(2),
      to: month(2),
    });
    await changed({
      personId,
      featureId,
      percentage: 25,
      from: month(4),
      to: month(4),
    });
    const allocations = (await read()).allocations.filter(
      (allocation) =>
        allocation.personId === personId && allocation.featureId === featureId,
    );
    expect(allocations.map((allocation) => allocation.id)).toEqual([id]);
    expect(allocations[0]?.draft).toMatchObject({
      action: "changed",
      months: {
        [month(0)]: 50,
        [month(2)]: 100,
        [month(3)]: 50,
        [month(4)]: 25,
        [month(5)]: 50,
        [month(6)]: null,
      },
    });
  });

  it("drafts removing an allocation a change leaves with no months, which can be allocated again", async () => {
    const { personId, featureId, id } = await liveAllocation({
      from: 0,
      to: 1,
    });
    const stop = {
      personId,
      featureId,
      percentage: null,
      from: month(0),
      to: month(1),
    };
    await changed(stop);
    expect((await allocationOf({ personId }, featureId))?.draft?.action).toBe(
      "deleted",
    );
    await changed({ ...stop, percentage: 75 });
    expect((await allocationOf({ personId }, featureId))?.draft).toMatchObject({
      action: "changed",
      months: { [month(0)]: 75, [month(2)]: null },
    });
    await changed(stop);
    await approved(id);
    expect(await allocationOf({ personId }, featureId)).toBeUndefined();
  });

  it("takes away an allocation only drafted to be added once a change leaves it no months", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    await changed({ personId, featureId, percentage: 50, from: month(0) });
    await changed({ personId, featureId, percentage: null, from: month(0) });
    expect(await allocationOf({ personId }, featureId)).toBeUndefined();
  });

  it("allocates a planned hire from the month it is expected", async () => {
    const plannedHireId = await addHire({ targetDate: dayIn(2) });
    const featureId = await addFeature();
    const early = await change({
      plannedHireId,
      featureId,
      percentage: 100,
      from: month(1),
    });
    expect(early.statusCode).toBe(400);
    expect(errorOf(early)).toBe(
      `This planned hire is expected in ${month(2)}. Choose a first month from then on.`,
    );
    await changed({
      plannedHireId,
      featureId,
      percentage: 100,
      from: month(2),
    });
    expect(
      (await allocationOf({ plannedHireId }, featureId))?.draft?.months,
    ).toEqual({ [month(2)]: 100 });
  });

  it("expects a planned hire with no target date from the current month", async () => {
    const plannedHireId = await addHire();
    const featureId = await addFeature();
    const early = await change({
      plannedHireId,
      featureId,
      percentage: 100,
      from: month(-1),
    });
    expect(early.statusCode).toBe(400);
    await changed({
      plannedHireId,
      featureId,
      percentage: 100,
      from: month(0),
    });
  });

  it("refuses a planned hire that has been filled", async () => {
    const plannedHireId = await addHire({ filledBy: await addPerson() });
    const response = await change({
      plannedHireId,
      featureId: await addFeature(),
      percentage: 50,
      from: month(0),
    });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe("This planned hire can't be allocated yet");
  });

  it("refuses filling a planned hire with allocations, which filling can't move yet", async () => {
    const plannedHireId = await addHire();
    await changed({
      plannedHireId,
      featureId: await addFeature(),
      percentage: 50,
      from: month(0),
    });
    const response = await test.request(
      director.cookie,
      "POST",
      `/api/planned-hires/${plannedHireId}/fill`,
      { by: "existing person", personId: await addPerson() },
    );
    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toBe(
      "This planned hire has allocations, which filling it can't move yet. Remove them first.",
    );
  });

  it("refuses approving a fill once the planned hire has been allocated", async () => {
    const plannedHireId = await addHire();
    const filling = await test.request(
      director.cookie,
      "POST",
      `/api/planned-hires/${plannedHireId}/fill`,
      { by: "existing person", personId: await addPerson() },
    );
    expect(filling.statusCode, filling.body).toBe(200);
    await changed({
      plannedHireId,
      featureId: await addFeature(),
      percentage: 50,
      from: month(0),
    });
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/drafts/approval",
      { plannedHires: [plannedHireId] },
    );
    expect(response.statusCode).toBe(409);
  });

  it.each([
    ["person", { personId: randomUUID() }],
    ["planned hire", { plannedHireId: randomUUID() }],
  ])("refuses a %s who does not exist", async (_, assignee) => {
    const response = await change({
      ...assignee,
      featureId: await addFeature(),
      percentage: 50,
      from: month(0),
    });
    expect(response.statusCode).toBe(404);
    expect(errorOf(response)).toBe("Choose someone from People");
  });

  it("refuses a feature that does not exist", async () => {
    const response = await change({
      personId: await addPerson(),
      featureId: randomUUID(),
      percentage: 50,
      from: month(0),
    });
    expect(response.statusCode).toBe(404);
  });

  it("refuses a feature only drafted to be added", async () => {
    const name = unique("Fictional Feature");
    const response = await test.request(
      director.cookie,
      "POST",
      "/api/features",
      {
        name,
      },
    );
    expect(response.statusCode, response.body).toBe(201);
    const drafted = response
      .json<{ plan: { features: { id: string; name: string }[] } }>()
      .plan.features.find((feature) => feature.name === name);
    const refused = await change({
      personId: await addPerson(),
      featureId: String(drafted?.id),
      percentage: 50,
      from: month(0),
    });
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      "This feature is waiting for approval. Allocate people to it once it's approved.",
    );
  });

  it("refuses changing an allocation someone else holds", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    expect(
      (
        await change(
          { personId, featureId, percentage: 50, from: month(0) },
          manager,
          false,
        )
      ).statusCode,
    ).toBe(200);
    const refused = await change({
      personId,
      featureId,
      percentage: 25,
      from: month(0),
    });
    expect(refused.statusCode).toBe(409);
    await test.request(manager.cookie, "POST", "/api/unpublished/discard");
  });
});

describe("unpublished changes", () => {
  it("are seen as drafts only by their maker, and named by their feature", async () => {
    const personId = await addPerson();
    const featureId = await addFeature();
    const general = await addGeneralFeature();
    for (const each of [featureId, general.featureId]) {
      expect(
        (
          await change(
            { personId, featureId: each, percentage: 50, from: month(0) },
            manager,
            false,
          )
        ).statusCode,
      ).toBe(200);
    }
    expect(
      (await allocationOf({ personId }, featureId, manager))?.draft
        ?.unpublished,
    ).toBe(true);
    expect(await allocationOf({ personId }, featureId)).toBeUndefined();
    const [feature] = await test.connection
      .select({ name: features.name })
      .from(features)
      .where(eq(features.id, featureId));
    const [project] = await test.connection
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, general.projectId));
    const listed = await test.request(
      manager.cookie,
      "GET",
      "/api/unpublished",
    );
    expect(
      listed
        .json<{ changes: { subject: string }[] }>()
        .changes.map(({ subject }) => subject)
        .sort(),
    ).toEqual(
      [
        `an allocation to the feature ${String(feature?.name)}`,
        `an allocation to the project ${String(project?.name)}`,
      ].sort(),
    );
    await test.request(manager.cookie, "POST", "/api/unpublished/discard");
  });
});

describe("employment dates", () => {
  it("refuses, to an editor who sees Personal details, months before someone's start", async () => {
    const personId = await addPerson({ startDate: dayIn(2) });
    const response = await change(
      {
        personId,
        featureId: await addFeature(),
        percentage: 50,
        from: month(1),
      },
      manager,
    );
    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toBe(
      `This person starts in ${month(2)}. Choose a first month from then on.`,
    );
  });

  it("refuses, to an editor who sees Personal details, months after someone's end, and no end", async () => {
    const personId = await addPerson({ endDate: dayIn(3) });
    const featureId = await addFeature();
    const ongoing = await change(
      { personId, featureId, percentage: 50, from: month(0) },
      manager,
    );
    expect(ongoing.statusCode).toBe(400);
    expect(errorOf(ongoing)).toBe(
      `This person's last month is ${month(3)}. Choose a last month by then.`,
    );
    await changed(
      { personId, featureId, percentage: 50, from: month(0), to: month(3) },
      manager,
    );
  });

  it("refuses, to any editor, months after an end date that has passed", async () => {
    const personId = await addPerson({ endDate: dayIn(-2) });
    const response = await change({
      personId,
      featureId: await addFeature(),
      percentage: 50,
      from: month(-1),
    });
    expect(response.statusCode).toBe(400);
  });

  it("lets a stop be drafted outside someone's employment", async () => {
    const { personId, featureId } = await liveAllocation({ from: 0 });
    await test.connection
      .update(people)
      .set({ endDate: dayIn(2) })
      .where(eq(people.id, personId));
    await changed(
      { personId, featureId, percentage: null, from: month(3) },
      manager,
    );
  });
});
