// SPDX-License-Identifier: Apache-2.0

// Tests for planned hires as rows of the grids of months: their names, managers, and the months
// before each is expected, and everyone the rows report to.

import type { OrgChart, OrgChartPerson, TeamMonths } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { hireRows, monthManagers } from "./planned-hire-months.ts";

const card = (fields: Partial<OrgChartPerson>): OrgChartPerson => ({
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

const chart: OrgChart = {
  people: [
    card({}),
    card({
      id: "h-tester",
      preferredName: "Payments tester",
      managerId: "p-blair",
      planned: { expected: "2027-03" },
    }),
    card({
      id: "h-unnamed",
      preferredName: "SDET, TBD-7",
      planned: { expected: "2027-01", shownId: "TBD-7" },
    }),
  ],
  drafted: [],
};

const months = ["2027-01", "2027-02", "2027-03", "2027-04"];

describe("hireRows", () => {
  it("gives each planned hire a row under its manager, with the month it is expected, not employed before it", () => {
    const [tester] = hireRows(chart, months);
    expect(tester).toEqual({
      id: "h-tester",
      personId: "h-tester",
      name: "Payments tester",
      manager: { id: "p-blair", name: "Blair Fictional" },
      values: {},
      links: {},
      outside: new Set(["2027-01", "2027-02"]),
      plannedHire: true,
      expected: "2027-03",
    });
  });

  it("names a planned hire with no name by its position and ID, in place of a name", () => {
    const [, unnamed] = hireRows(chart, months);
    expect([unnamed?.name, unnamed?.madeName, unnamed?.manager]).toEqual([
      "",
      "SDET, TBD-7",
      null,
    ]);
  });
});

describe("monthManagers", () => {
  const teamMonths: TeamMonths = {
    months,
    teams: [],
    people: [
      {
        id: "p-casey",
        preferredName: "Casey Fictional",
        manager: { id: "p-blair", name: "Blair Fictional" },
        managers: { "2027-02": { id: "p-dana", name: "Dana Fictional" } },
        teams: {},
      },
    ],
    drafts: [],
  };

  it("lists people's managers in any month, and planned hires' managers", () => {
    expect(monthManagers(teamMonths, chart).map(({ name }) => name)).toContain(
      "Dana Fictional",
    );
  });

  it("lists people's managers alone for a reader who sees no planned hires", () => {
    expect(
      monthManagers(teamMonths, undefined).map(({ name }) => name),
    ).toEqual(["Blair Fictional", "Dana Fictional"]);
  });
});
