// SPDX-License-Identifier: Apache-2.0

// Integration tests for what a change to the plan's records answers with: the plan as the editor
// may read it, never records of a kind the role doesn't see.

import type { Field, ProjectPlan } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, type TestApp, unique } from "./test-app.ts";

let test: TestApp;
let planner: { id: string; cookie: string };
let featureId: string;
let customerId: string;
let projectId: string;
let columnId: string;

type Saved = { plan: ProjectPlan; changeSetId: string | null };

const ids = (records: readonly { id: string }[]) => records.map(({ id }) => id);

const sent = async (
  cookie: string,
  method: "POST" | "PUT",
  url: string,
  body: object,
): Promise<ProjectPlan> => {
  const response = await test.request(cookie, method, url, body);
  expect(response.statusCode, response.body).toBeLessThan(300);
  return response.json<Saved>().plan;
};

beforeAll(async () => {
  test = await startTestApp();
  planner = await test.signedIn("product-manager");
  // Given a feature, a column on Features, a customer and a project in the plan
  const featureName = unique("Fictional Feature");
  featureId = String(
    (
      await sent(planner.cookie, "POST", "/api/features", { name: featureName })
    ).features.find(({ name }) => name === featureName)?.id,
  );
  const column = await test.request(
    planner.cookie,
    "POST",
    "/api/features/columns",
    {
      name: unique("Fictional Runbook"),
      type: "link",
      visibility: "general",
    },
  );
  expect(column.statusCode, column.body).toBe(201);
  columnId = column.json<{ field: Field }>().field.id;
  const customerName = unique("Fictional Customer");
  customerId = String(
    (
      await sent(planner.cookie, "POST", "/api/customers", {
        name: customerName,
      })
    ).customers.find(({ name }) => name === customerName)?.id,
  );
  const projectName = unique("Fictional Project");
  projectId = String(
    (
      await sent(planner.cookie, "POST", "/api/projects", { name: projectName })
    ).projects.find(({ name }) => name === projectName)?.id,
  );
});

afterAll(async () => {
  await test.close();
});

describe("a change to the plan's records", () => {
  // Each change a role editing the plan, without seeing features, may make.
  const planChanges: [string, () => ["POST" | "PUT", string, object]][] = [
    [
      "adding a customer",
      () => ["POST", "/api/customers", { name: unique("Fictional Customer") }],
    ],
    [
      "changing a customer",
      () => [
        "PUT",
        `/api/customers/${customerId}`,
        { name: unique("Fictional Customer") },
      ],
    ],
    [
      "adding a milestone",
      () => [
        "POST",
        `/api/projects/${projectId}/milestones`,
        {
          name: unique("Fictional Milestone"),
          date: "2027-03-31",
          customerDelivery: false,
        },
      ],
    ],
  ];

  it.each(planChanges)(
    "answers %s with the plan's records but no features to a role that doesn't see features",
    async (_case, request) => {
      const editor = await test.signedIn(["plan:view", "plan:edit"]);
      const plan = await sent(editor.cookie, ...request());
      expect(ids(plan.customers)).toContain(customerId);
      expect(ids(plan.features)).not.toContain(featureId);
      expect(ids(plan.featureColumns.fields)).not.toContain(columnId);
    },
  );

  it("answers a change to a feature with features but none of the plan's other records to a role that doesn't see the plan", async () => {
    const editor = await test.signedIn(["features:view", "features:edit"]);
    const plan = await sent(editor.cookie, "POST", "/api/features", {
      name: unique("Fictional Feature"),
    });
    expect(ids(plan.features)).toContain(featureId);
    expect(ids(plan.featureColumns.fields)).toContain(columnId);
    expect(ids(plan.customers)).not.toContain(customerId);
    expect(ids(plan.projects)).not.toContain(projectId);
    expect(plan.proposals).toEqual([]);
  });
});
