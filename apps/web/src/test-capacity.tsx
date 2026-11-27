// SPDX-License-Identifier: Apache-2.0

// The fictional allocations, org chart and accounts the Capacity page's tests open it with.

import {
  type Allocations,
  type OrgChart,
  startingPlanningSettings,
} from "@fathom/shared";
import { screen } from "@testing-library/react";
import {
  fictionalTeamMonths,
  fictionalUser,
  monthsUrl,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

export const allocations: Allocations = {
  allocations: [
    {
      id: "a-1",
      personId: "p-casey",
      plannedHireId: null,
      featureId: "f-checkout",
      activityId: null,
      months: { "2027-03": 50, "2027-05": null },
    },
    {
      id: "a-2",
      personId: null,
      plannedHireId: "h-tester",
      featureId: "f-checkout",
      activityId: null,
      months: { "2027-04": 100 },
    },
  ],
  features: [
    {
      id: "f-checkout",
      name: "Checkout",
      meaning: "in-progress",
      colour: null,
    },
  ],
  activities: [],
};

export const chart: OrgChart = {
  people: [
    {
      id: "p-blair",
      keyNumber: 1,
      preferredName: "Blair Fictional",
      employeeId: null,
      position: null,
      teamName: null,
      teamColour: null,
      managerId: null,
    },
    {
      id: "h-tester",
      keyNumber: 1,
      preferredName: "Payments tester",
      employeeId: null,
      position: null,
      teamName: null,
      teamColour: null,
      managerId: "p-blair",
      planned: { expected: "2027-04" },
    },
  ],
  drafted: [],
};

// What Allocations reads: allocations, the feature teams' months and the org chart's planned hires, with
// the Personal details they need.
export const seesAllocations = [
  "allocations:view",
  "feature-teams:view",
  "people:view",
  "personal:view",
];

export const session = (permissions: readonly string[]) => () =>
  Response.json({ ...fictionalUser, permissions });

// Capacity on the tab the search names, or Allocations.
export function openAllocations(
  search = "",
  {
    permissions = [
      ...seesAllocations,
      "confidential:view",
      "configuration:view",
    ],
    allocationsAnswer = () => Response.json(allocations),
    tab = "allocations",
  }: {
    permissions?: readonly string[];
    allocationsAnswer?: () => Response;
    // The tab the address names when the search names none, if any.
    tab?: string | null;
  } = {},
) {
  serverAnswers({
    "GET /api/session": session(permissions),
    [monthsUrl]: () => Response.json(fictionalTeamMonths),
    "GET /api/allocations": allocationsAnswer,
    "GET /api/org-chart": () => Response.json(chart),
    "GET /api/planning-settings": () => Response.json(startingPlanningSettings),
  });
  const tabbed =
    search.includes("mode=") || tab === null
      ? search
      : `${search === "" ? "?" : `${search}&`}mode=${tab}`;
  return renderApp(`/capacity${tabbed}`);
}

export const grid = () =>
  screen.findByRole("grid", { name: "Allocations by month" });

export const address = (history: ReturnType<typeof renderApp>) =>
  decodeURIComponent(history.location.search);
