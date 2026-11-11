// SPDX-License-Identifier: Apache-2.0

// Tests for the projects and proposals that name a feature: telling a change to them apart from a
// change to the feature's own fields, saving each, and showing it in the plan before it is saved.

import type { ProjectPlan } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { namersIn, operationsOf, withNamers } from "./projects.ts";
import { bodyOf, noFeatureColumns, serverAnswers } from "./test-support.tsx";

const featureId = "a0000000-0000-4000-8000-000000000001";
const otherId = "a0000000-0000-4000-8000-000000000002";

const namer = (id: string, featureIds: string[]) => ({
  id,
  name: `Fictional ${id}`,
  externalId: null,
  ownerId: null,
  customerIds: [],
  featureIds,
});

const plan = (): ProjectPlan => ({
  customers: [],
  projects: [
    {
      ...namer("kept", [featureId, otherId]),
      proposalIds: [],
      milestones: [],
      dates: { first: null, last: null, nextDelivery: null },
    },
    {
      ...namer("added", [otherId]),
      proposalIds: [],
      milestones: [],
      dates: { first: null, last: null, nextDelivery: null },
    },
  ],
  proposals: [
    { ...namer("proposal", [featureId]), link: null, statusId: "open" },
  ],
  features: [],
  featureColumns: noFeatureColumns,
  canEdit: true,
  canEditFeatures: true,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a change to a feature", () => {
  it("is split into the records that name it and its own fields", () => {
    expect(namersIn({ projectIds: [otherId], name: "Renamed" })).toEqual({
      namers: { projectIds: [otherId] },
      own: { name: "Renamed" },
    });
  });

  it("saves the records that name it, then its own fields", async () => {
    const saved = () => Response.json({ plan: plan(), changeSetId: null });
    const fetch = serverAnswers({
      [`PUT /api/features/${featureId}/projects-and-proposals`]: saved,
      [`PUT /api/features/${featureId}`]: saved,
    });
    const feature = {
      id: featureId,
      name: "Fictional Feature",
      statusId: "possible",
      neededBy: null,
      customerIds: [],
      targetStreamId: null,
      targetCycle: null,
      estimateHours: null,
      featureTeamId: null,
      description: null,
      note: null,
      values: {},
      links: {},
    };
    await operationsOf("feature").change(feature, {
      proposalIds: [otherId],
      name: "Renamed",
    });
    expect(
      fetch.mock.calls.map(([url, init]) => `${String(init?.method)} ${url}`),
    ).toEqual([
      `PUT /api/features/${featureId}/projects-and-proposals`,
      `PUT /api/features/${featureId}`,
    ]);
    expect(
      bodyOf(fetch, "PUT", `/api/features/${featureId}/projects-and-proposals`),
    ).toEqual([{ proposalIds: [otherId] }]);
    expect(bodyOf(fetch, "PUT", `/api/features/${featureId}`)).toMatchObject([
      { name: "Renamed" },
    ]);
  });
});

describe("the plan with a feature's projects changed", () => {
  it("adds the feature to those named and takes it from the others, leaving a kind not named", () => {
    const changed = withNamers(plan(), featureId, { projectIds: ["added"] });
    expect(changed.projects.map(({ featureIds }) => featureIds)).toEqual([
      [otherId],
      [featureId, otherId].sort(),
    ]);
    expect(changed.proposals).toEqual(plan().proposals);
  });
});
