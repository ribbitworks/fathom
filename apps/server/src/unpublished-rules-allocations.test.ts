// SPDX-License-Identifier: Apache-2.0

// Integration tests for publishing private changes to allocations and activities: each is checked by
// its kind's own rules against the data as it is now, and refused with the reason a fresh change
// gets.

import { activities, allocations, people, projects } from "@fathom/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { builtInChoice, unique } from "./test-app.ts";
import {
  addFeature,
  addPerson,
  allocator,
  change,
  closeAllocationTests,
  dayIn,
  month,
  projectManager,
  startAllocationTests,
  test,
} from "./test-allocations.ts";

beforeAll(startAllocationTests);

afterAll(closeAllocationTests);

const publishing = (who: { cookie: string }) =>
  test.request(who.cookie, "POST", "/api/unpublished/publish");

const errorOf = (response: { json: () => unknown }) =>
  (response.json() as { error: string }).error;

// No route ends someone's employment, or allocates someone to an activity, without approvals that
// would end the private change, so the tests change storage.
describe("publishing a private change", () => {
  it("is refused for an allocation outside the months its person now has", async () => {
    // Given a private allocation from this month, and the person's last day since set earlier
    const personId = await addPerson();
    const featureId = await addFeature();
    const drafted = await change(
      { personId, featureId, percentage: 50, from: month(0) },
      allocator,
      false,
    );
    expect(drafted.statusCode, drafted.body).toBe(200);
    await test.connection
      .update(people)
      .set({ endDate: dayIn(-3) })
      .where(eq(people.id, personId));

    const response = await publishing(allocator);

    expect(response.statusCode, response.body).toBe(409);
    expect(errorOf(response)).toContain(
      `: This person's last month is ${month(-3)}. Choose a last month by then.`,
    );
  });

  it("is refused for an activity's removal once it has allocations", async () => {
    // Given a project's activity removed privately, and someone allocated to it since
    const projectId = randomUUID();
    await test.connection
      .insert(projects)
      .values({ id: projectId, name: unique("Fictional Project") });
    const [activity] = await test.connection
      .insert(activities)
      .values({
        projectId,
        name: unique("Fictional Activity"),
        statusId: await builtInChoice(
          test.connection,
          "feature-statuses",
          "in-progress",
        ),
      })
      .returning({ id: activities.id, name: activities.name });
    const removed = await test.request(
      projectManager.cookie,
      "DELETE",
      `/api/activities/${String(activity?.id)}`,
      undefined,
      { publish: false },
    );
    expect(removed.statusCode, removed.body).toBe(200);
    await test.connection.insert(allocations).values({
      id: randomUUID(),
      personId: await addPerson(),
      activityId: activity?.id,
      months: { [month(0)]: 50 },
    });

    const response = await publishing(projectManager);

    expect(response.statusCode, response.body).toBe(409);
    expect(errorOf(response)).toMatch(
      /has allocations, so it can't be removed/,
    );
  });
});
