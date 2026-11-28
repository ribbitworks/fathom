// SPDX-License-Identifier: Apache-2.0

// Integration tests for publishing private changes to the plan's records: each is checked by its
// kind's own rules against the data as it is now, and refused with the reason a fresh change gets,
// naming the record.

import { featureTeams, listItems } from "@fathom/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
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

// No route retires a built-in choice or removes a live feature team without approvals that would
// end the private change, so the tests change storage.
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
});
