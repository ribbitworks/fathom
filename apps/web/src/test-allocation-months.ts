// SPDX-License-Identifier: Apache-2.0

// Fixtures for the tests of allocations month by month: the months, a team's months, features,
// allocations and their drafts, the org chart's cards, and the rows they make.

import type {
  AllocatedActivity,
  Allocation,
  AllocationDraft,
  Allocations,
  OrgChart,
  OrgChartPerson,
  TeamMonths,
} from "@fathom/shared";
import {
  allocationMonthRecords,
  type AllocationRow,
} from "./allocation-rows.ts";

export const months = ["2027-02", "2027-03", "2027-04"];
export const search = { id: "t-search", name: "Search", colour: null };

export const teamMonths: TeamMonths = {
  months,
  teams: [search],
  drafts: [],
  people: [
    {
      id: "p-casey",
      preferredName: "Casey Fictional",
      manager: { id: "p-blair", name: "Blair Fictional" },
      managers: {},
      teams: { "2027-03": [search.id] },
      outside: ["2027-02"],
    },
  ],
};

export const features: Allocations["features"] = [
  { id: "f-checkout", name: "Checkout", meaning: "in-progress", colour: null },
  { id: "f-billing", name: "Billing", meaning: "in-progress", colour: null },
  { id: "f-maybe", name: "Maybe later", meaning: "possible", colour: null },
];

export const activities: AllocatedActivity[] = [
  {
    id: "a-general",
    name: "General",
    owner: "Crane Control",
    meaning: "in-progress",
    colour: null,
  },
];

export const allocation = (fields: Partial<Allocation> = {}): Allocation => ({
  id: "a-1",
  personId: "p-casey",
  plannedHireId: null,
  featureId: "f-checkout",
  activityId: null,
  months: { "2027-03": 50 },
  ...fields,
});

export const draft = (
  fields: Partial<AllocationDraft> = {},
): AllocationDraft => ({
  action: "changed",
  months: { "2027-03": 75 },
  state: "waiting",
  madeBy: "Engineering Manager",
  madeAt: null,
  ...fields,
});

export const card = (fields: Partial<OrgChartPerson>): OrgChartPerson => ({
  id: "p-blair",
  keyNumber: 1,
  preferredName: "Blair Fictional",
  employeeId: null,
  position: null,
  teamName: null,
  teamColour: null,
  managerId: null,
  ...fields,
});

export const noHires: OrgChart = { people: [card({})], drafted: [] };

export const rowsOf = (
  allocated: readonly Allocation[],
  {
    chart = noHires,
    grouping,
    show = "both",
    hires = [],
  }: {
    chart?: OrgChart;
    grouping?: string;
    show?: "both" | "drafts" | "live";
    // Planned hires' teams by month.
    hires?: NonNullable<TeamMonths["hires"]>;
  } = {},
) =>
  allocationMonthRecords({
    teamMonths: { ...teamMonths, hires },
    allocations: { allocations: [...allocated], features, activities },
    chart,
    grouping,
    show,
  });

export const casey = (rows: readonly AllocationRow[]) =>
  rows.find(({ personId }) => personId === "p-casey") as AllocationRow;

export const linesIn = (row: AllocationRow, month: string) =>
  (row.allocated.get(month) ?? []).map(
    ({ name, percentage, drafted }) =>
      `${name} ${String(percentage)}%${drafted === undefined ? "" : ` ${drafted}`}`,
  );
