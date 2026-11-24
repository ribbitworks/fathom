// SPDX-License-Identifier: Apache-2.0

// Tests for Capacity's Coverage tab: each work's effort, hours allocated and what is left, its months
// as allocated of needed, work allocated that the plan doesn't list, who sees the tab, grouping by
// feature team, and opening a feature's details.

import {
  type Allocations,
  type OrgChart,
  startingPlanningSettings,
} from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  featureDraft,
  fictionalFeature,
  fictionalStream,
  fictionalTeamMonths,
  fictionalUser,
  gridNow,
  monthsUrl,
  planAnswers,
  platform,
  renderApp,
  serverAnswers,
  streamId,
} from "./test-support.tsx";

const allocations: Allocations = {
  allocations: [
    {
      id: "a-1",
      personId: "p-casey",
      plannedHireId: null,
      featureId: "f-checkout",
      months: { "2027-03": 50, "2027-05": null },
    },
    {
      id: "a-2",
      personId: "p-avery",
      plannedHireId: null,
      featureId: "g-depot",
      months: { "2027-03": 25, "2027-04": null },
    },
  ],
  features: [
    {
      id: "f-checkout",
      name: "Checkout",
      meaning: "in-progress",
      colour: null,
    },
    { id: "g-depot", name: "Depot Operations", meaning: null, colour: null },
  ],
};

const chart: OrgChart = { people: [], drafted: [] };

const checkout = fictionalFeature({
  id: "f-checkout",
  name: "Checkout",
  estimateHours: 96,
  targetStreamId: streamId,
  targetCycle: "2027-04-01",
  featureTeamId: platform.id,
});

const seesCoverage = [
  "allocations:view",
  "feature-teams:view",
  "people:view",
  "personal:view",
  "features:view",
  "configuration:view",
];

function openCoverage(
  permissions: readonly string[] = seesCoverage,
  { features = [checkout], search = "" } = {},
) {
  serverAnswers({
    "GET /api/session": () => Response.json({ ...fictionalUser, permissions }),
    [monthsUrl]: () => Response.json(fictionalTeamMonths),
    "GET /api/allocations": () => Response.json(allocations),
    "GET /api/org-chart": () => Response.json(chart),
    ...planAnswers(features),
    "GET /api/release-streams": () =>
      Response.json({
        streams: [fictionalStream()],
        canEditStreams: false,
        canEditReleases: false,
      }),
    "GET /api/planning-settings": () => Response.json(startingPlanningSettings),
    "GET /api/projects/choices": () =>
      Response.json({
        owners: [],
        statuses: [],
        featureStatuses: [
          {
            id: checkout.statusId,
            name: "In progress",
            retired: false,
            meaning: "in-progress",
          },
        ],
        featureTeams: [],
        priorities: [],
        sizes: [],
        risks: [],
      }),
  });
  return renderApp(`/capacity?mode=coverage${search}`);
}

const rowOf = async (name: string) =>
  within((await screen.findByText(name)).closest("tr") as HTMLElement);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${gridNow}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Capacity's Coverage", () => {
  it("shows a feature's effort, hours allocated, what is left, and its months", async () => {
    // Given Checkout, 96 h, targeting April to June 2027, with Casey on it at half a month in March
    // and April, 64 h each at 80% focus, seen in March
    openCoverage();
    const row = await rowOf("Checkout");

    // Then it shows its effort, the 128 h allocated, and 32 h over it
    expect(row.getByText("96 h")).toBeDefined();
    expect(row.getByText("128 h")).toBeDefined();
    expect(row.getByText("Over +32 h")).toBeDefined();
    // And March and April each read their 64 h of the 96 h needed, spread over March to June
    expect(row.getAllByText("64 of 24 h")).toHaveLength(2);
    expect(row.getAllByText("0 of 24 h")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe(
      "1 feature and 1 project",
    );
  });

  it("shows what is left with drafts applied, from a drafted estimate", async () => {
    // Given Checkout's estimate drafted from 96 h to 400 h, seen with drafts applied
    openCoverage(seesCoverage, {
      features: [
        {
          ...checkout,
          estimateHours: 400,
          draft: featureDraft({
            changed: ["estimateHours"],
            live: { estimateHours: 96 },
          }),
        },
      ],
      search: "&show=drafts",
    });
    const row = await rowOf("Checkout");

    // Then 272 h is left after the 128 h allocated
    expect(row.getByText("400 h")).toBeDefined();
    expect(row.getByText("272 h")).toBeDefined();
  });

  it("shows work the plan doesn't list by its allocations' name, with no effort and no details", async () => {
    openCoverage();
    const row = await rowOf("Depot Operations");
    expect(row.queryByRole("button", { name: /Show details/u })).toBeNull();
    // Avery's quarter month in March: 32 h, allocated in all and in March
    expect(row.getAllByText("32 h")).toHaveLength(2);
  });

  it("isn't offered to a role that doesn't see the planning settings", async () => {
    openCoverage(
      seesCoverage.filter((permission) => permission !== "configuration:view"),
    );
    expect(
      await screen.findByRole("tab", { name: "Allocations" }),
    ).toBeDefined();
    expect(screen.queryByRole("tab", { name: "Coverage" })).toBeNull();
  });

  it("groups the work by feature team", async () => {
    const history = openCoverage();
    await rowOf("Checkout");
    await userEvent.click(screen.getByRole("button", { name: "Group by" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Feature team/u }),
    );
    // The feature team column is hidden, so the team's name shows only as its group's heading
    expect(await screen.findByText(platform.name)).toBeDefined();
    expect(decodeURIComponent(history.location.search)).toContain(
      "grouping=featureTeam",
    );
  });

  it("opens a feature on Features from its details button", async () => {
    // The feature's details opening there is proved in the browser, by apps/web/e2e/coverage.test.ts
    const history = openCoverage();
    await rowOf("Checkout");
    await userEvent.click(
      screen.getByRole("button", { name: "Show details of Checkout" }),
    );
    await waitFor(() => {
      expect(history.location.pathname).toBe("/features");
    });
  });
});
