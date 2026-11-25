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
  fictionalTeamMonths,
  fictionalUser,
  gridNow,
  monthsUrl,
  planAnswers,
  platform,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";
import { project } from "./test-projects-page.tsx";
import { fictionalStream, streamId } from "./test-releases.ts";

const depot = project({
  id: "00000000-0000-4000-8000-0000000000d1",
  name: "Depot Operations",
  externalId: "P-2001",
});

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
      months: {
        "2027-01": 25,
        "2027-02": null,
        "2027-03": 25,
        "2027-04": null,
      },
    },
  ],
  features: [
    {
      id: "f-checkout",
      name: "Checkout",
      meaning: "in-progress",
      colour: null,
    },
    {
      id: "g-depot",
      name: "Depot Operations",
      meaning: null,
      colour: null,
      projectId: depot.id,
    },
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
    ...planAnswers(features, [depot]),
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

    // Then it shows its effort, the 128 h allocated, and 32 h over it, as a minus
    expect(row.getByText("96 h")).toBeDefined();
    expect(row.getByText("128 h")).toBeDefined();
    expect(row.getByText("−32 h")).toBeDefined();
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

  // A role that sees Projects, so it is sent Depot Operations' project.
  const seesProjects = [...seesCoverage, "plan:view"];

  it("names a project's own work with its Project ID first, dimmed, and reads None for its effort", async () => {
    // Given Avery on Depot Operations' own work, which has no effort
    openCoverage(seesProjects);

    // When its row shows
    const row = await rowOf("Depot Operations");

    // Then its Project ID is dimmed, as links to records dim it
    expect(row.getByText("P-2001").getAttribute("style") ?? "").toContain(
      "dimmed",
    );
    // And its Effort and Remaining read None, and it has 64 h allocated
    expect(row.getAllByText("None")).toHaveLength(2);
    expect(row.getByText("64 h")).toBeDefined();
  });

  it("shows a past month's hours alone, in grey, and nothing in a month with none", async () => {
    // Given Avery's quarter month in January and March on Depot Operations, none in February, seen
    // in March
    openCoverage(seesProjects);
    const row = await rowOf("Depot Operations");

    // Then January and March each read 32 h, January's in grey, and February nothing
    expect(row.queryByText("0 h")).toBeNull();
    const months = row.getAllByText("32 h");
    expect(months.map((month) => month.getAttribute("style") ?? "")).toEqual([
      expect.stringContaining("dimmed"),
      expect.not.stringContaining("dimmed"),
    ]);
  });

  it("opens a project's own work on Projects from its details button", async () => {
    // Given Depot Operations' row
    const history = openCoverage(seesProjects);
    const row = await rowOf("Depot Operations");

    // When its details button is selected
    await userEvent.click(
      row.getByRole("button", {
        name: "Show details of P-2001 Depot Operations",
      }),
    );

    // Then Projects opens on it
    await waitFor(() => {
      expect(history.location.pathname).toBe("/projects");
    });
    expect(history.location.search).toContain(depot.id);
  });

  it("reads a part of an hour over the effort as 0 h", async () => {
    // Given Checkout's estimate 0.4 h under the 128 h allocated
    openCoverage(seesCoverage, {
      features: [{ ...checkout, estimateHours: 127.6 }],
    });
    const row = await rowOf("Checkout");

    // Then Remaining reads 0 h, with no minus
    expect(row.getByText("0 h")).toBeDefined();
    expect(row.queryByText(/\u2212/u)).toBeNull();
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
