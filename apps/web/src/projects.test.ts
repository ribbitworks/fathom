// SPDX-License-Identifier: Apache-2.0

// Tests for the projects and proposals that name a feature: telling a change to them apart from a
// change to the feature's own fields, saving each, and showing it in the plan before it is saved.

import type { ProjectPlan } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  namersIn,
  operationsOf,
  releaseOfCycle,
  streamOfReleaseGroup,
  withNamers,
} from "./projects.ts";
import { formatDay } from "./table-view.ts";
import {
  bodyOf,
  fictionalRelease,
  fictionalStream,
  noFeatureColumns,
  quarters,
  recordDraft,
  serverAnswers,
} from "./test-support.tsx";

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

describe("the release each cycle is in", () => {
  const majors = fictionalStream({
    // 27.1 to 27.4, then a cycle only as it is live.
    liveCycles: [
      {
        startsOn: "2028-01-01",
        endsOn: "2028-03-31",
        name: "28.1",
        months: [],
      },
    ],
    releases: [
      fictionalRelease({
        id: "later-release",
        name: "Fictional Two",
        firstCycle: "2027-07-01",
        lastCycle: "2027-07-01",
        shipsOn: "2027-10-15",
      }),
      fictionalRelease({
        id: "first-release",
        firstCycle: "2027-01-01",
        lastCycle: "2027-04-01",
      }),
      fictionalRelease({
        id: "removed-release",
        name: "Fictional Removed",
        firstCycle: "2027-10-01",
        lastCycle: "2027-10-01",
        draft: recordDraft({ action: "deleted" }),
      }),
    ],
  });
  const patches = fictionalStream({
    id: "patches",
    name: "Fictional Patches",
    cycles: quarters(1),
    releases: [
      fictionalRelease({
        id: "patch",
        name: "Fictional Patch",
        // No cycle starts on this day, so the day it ships is not known.
        lastCycle: "2027-02-01",
      }),
    ],
  });
  const groups = releaseOfCycle([majors, patches]);
  const of = (streamId: string, startsOn: string) =>
    groups.get(`${streamId} ${startsOn}`);

  it("names a release with its stream and the end of its last cycle, when it has no day of its own", () => {
    expect(of(majors.id, "2027-04-01")).toMatchObject({
      label: `Fictional Majors: Fictional One, ships ${formatDay("2027-06-30")}`,
      name: "Fictional Majors: Fictional One",
    });
  });

  it("names a release with the day it ships, when it has one of its own", () => {
    expect(of(majors.id, "2027-07-01")?.label).toBe(
      `Fictional Majors: Fictional Two, ships ${formatDay("2027-10-15")}`,
    );
  });

  it("names a release whose ship day is not known without one", () => {
    expect(of("patches", "2027-01-01")?.label).toBe(
      "Fictional Patches: Fictional Patch",
    );
  });

  it("places the cycles in no release, those only live too, under their stream", () => {
    expect([of(majors.id, "2027-10-01"), of(majors.id, "2028-01-01")]).toEqual([
      expect.objectContaining({ label: "Fictional Majors: Not released yet" }),
      expect.objectContaining({ label: "Fictional Majors: Not released yet" }),
    ]);
  });

  it("places the cycles of a release a draft removes under its stream's Not released yet", () => {
    expect(of(majors.id, "2027-10-01")?.label).toBe(
      "Fictional Majors: Not released yet",
    );
  });

  it("ranks releases by stream and date, then each stream's cycles in none", () => {
    const ranked = [
      of(majors.id, "2027-01-01"),
      of(majors.id, "2027-07-01"),
      of("patches", "2027-01-01"),
      of(majors.id, "2027-10-01"),
    ].map((group) => group?.rank);
    expect(ranked).toEqual([0, 1, 2, 3]);
  });

  it("keys each group by its stream", () => {
    expect(
      [of(majors.id, "2027-01-01"), of(majors.id, "2027-10-01")].map((group) =>
        streamOfReleaseGroup(group?.key ?? ""),
      ),
    ).toEqual([majors.id, majors.id]);
  });
});
