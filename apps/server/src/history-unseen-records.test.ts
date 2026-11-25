// SPDX-License-Identifier: Apache-2.0

// Tests for the records the change history and a scope history name, to a role that can't read their
// kind, against a PostgreSQL server of their own.

import type { ChangeHistory, Permission, ScopeHistory } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addCustomer,
  addFeature,
  addProject,
  addProposal,
  approve,
  closeProjectTests,
  send,
  startProjectTests,
  test,
} from "./test-projects.ts";

beforeAll(startProjectTests);
afterAll(closeProjectTests);

// Every value the change history shows a role in a field of a record of the kind given.
async function valuesIn(
  permissions: readonly Permission[],
  kind: string,
  field: string,
): Promise<string[]> {
  const reader = await test.signedIn([...permissions]);
  const response = await test.request(reader.cookie, "GET", "/api/changes");
  expect(response.statusCode).toBe(200);
  return response
    .json<ChangeHistory>()
    .entries.flatMap(({ records }) => records)
    .filter((record) => record.kind === kind)
    .flatMap(({ fields }) => fields)
    .filter((changed) => changed.field === field)
    .flatMap(({ oldValue, newValue }) => [oldValue, newValue])
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map(String);
}

describe("records a change links to, in the history", () => {
  it("name a project's features only to a role that reads features", async () => {
    const feature = await addFeature();
    const project = await addProject();
    await send("PUT", `/api/projects/${project.id}`, {
      name: project.name,
      featureIds: [feature.id],
    });

    const planOnly = await valuesIn(["plan:view"], "project", "featureIds");
    expect(planOnly).not.toContain(feature.name);
    expect(planOnly).toContain("A feature");
    expect(
      await valuesIn(["plan:view", "features:view"], "project", "featureIds"),
    ).toContain(feature.name);
  });

  it("name an activity's project only to a role that reads the plan, and the activity only to a reader of activities", async () => {
    const first = await addProject();
    const second = await addProject();
    await approve([
      { type: "project", id: first.id },
      { type: "project", id: second.id },
    ]);
    const name = `Fictional Activity ${first.id.slice(0, 8)}`;
    const added = await send("POST", "/api/activities", {
      name,
      projectId: first.id,
    });
    expect(added.statusCode, added.body).toBe(201);
    const activityId = String(
      added
        .json<{ plan: { activities: { id: string; name: string }[] } }>()
        .plan.activities.find((one) => one.name === name)?.id,
    );
    await approve([{ type: "activity", id: activityId }]);
    const moved = await send("PUT", `/api/activities/${activityId}`, {
      name,
      projectId: second.id,
    });
    expect(moved.statusCode, moved.body).toBe(200);

    const featuresOnly = await valuesIn(
      ["features:view"],
      "activity",
      "projectId",
    );
    expect(featuresOnly).not.toContain(second.name);
    expect(featuresOnly).toContain("A project");
    expect(
      await valuesIn(["plan:view", "features:view"], "activity", "projectId"),
    ).toContain(second.name);
    expect(await valuesIn(["plan:view"], "activity", "projectId")).toEqual([]);
  });

  it("name a feature's customers only to a role that reads the plan", async () => {
    const customer = await addCustomer();
    const feature = await addFeature();
    await send("PUT", `/api/features/${feature.id}`, {
      name: feature.name,
      customerIds: [customer.id],
    });

    const featuresOnly = await valuesIn(
      ["features:view"],
      "feature",
      "customerIds",
    );
    expect(featuresOnly).not.toContain(customer.name);
    expect(featuresOnly).toContain("A customer");
    expect(
      await valuesIn(["features:view", "plan:view"], "feature", "customerIds"),
    ).toContain(customer.name);
  });

  it("name the feature a proposal's removal reason is for only to a role that reads features", async () => {
    const feature = await addFeature();
    const proposal = await addProposal({ featureIds: [feature.id] });
    await approve([
      { type: "feature", id: feature.id },
      { type: "proposal", id: proposal.id },
    ]);
    await send("PUT", `/api/features/${feature.id}/projects-and-proposals`, {
      proposalIds: [],
    });
    await send(
      "PUT",
      `/api/features/${feature.id}/proposals/${proposal.id}/removal-reason`,
      { removalReason: "Fictional reason" },
    );

    const planOnly = await valuesIn(
      ["plan:view"],
      "proposal",
      "removalReasons",
    );
    expect(planOnly).toContain("A feature: Fictional reason");
    expect(planOnly).not.toContain(`${feature.name}: Fictional reason`);
    expect(
      await valuesIn(
        ["plan:view", "features:view"],
        "proposal",
        "removalReasons",
      ),
    ).toContain(`${feature.name}: Fictional reason`);
  });
});

describe("a project's scope history", () => {
  it("is empty to a role that sees the plan but not features", async () => {
    const feature = await addFeature();
    const project = await addProject({ featureIds: [feature.id] });
    await approve([
      { type: "feature", id: feature.id },
      { type: "project", id: project.id },
    ]);
    const scopeOf = async (permissions: readonly Permission[]) => {
      const reader = await test.signedIn([...permissions]);
      const response = await test.request(
        reader.cookie,
        "GET",
        `/api/projects/${project.id}/scope-history`,
      );
      expect(response.statusCode).toBe(200);
      return response.json<ScopeHistory>().changes;
    };

    expect(await scopeOf(["plan:view"])).toEqual([]);
    expect(
      (await scopeOf(["plan:view", "features:view"])).map(({ name }) => name),
    ).toContain(feature.name);
  });
});
