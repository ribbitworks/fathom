// SPDX-License-Identifier: Apache-2.0

// Planned hires as rows of the grids of months, from the org chart that draws them.

import type { OrgChart, OrgChartPerson, TeamMonths } from "@fathom/shared";
import { type MonthRow, peopleManagers } from "./team-months.tsx";

const plannedHires = (chart: OrgChart) =>
  chart.people.flatMap((card) =>
    card.planned === undefined ? [] : [{ ...card, planned: card.planned }],
  );

// A planned hire's manager, a person or a planned manager, who is on the chart.
function hireManager(
  chart: OrgChart,
  { managerId }: OrgChartPerson,
): MonthRow["manager"] {
  if (managerId === null) return null;
  // The chart draws every placeholder under a manager it holds.
  const manager = chart.people.find(
    ({ id }) => id === managerId,
  ) as OrgChartPerson;
  return { id: managerId, name: manager.preferredName };
}

// Everyone the grid's rows report to: people's managers, in any month, and planned hires'.
export const monthManagers = (
  teamMonths: TeamMonths,
  chart: OrgChart | undefined,
) => [
  ...peopleManagers(teamMonths),
  ...teamMonths.people.flatMap(({ managers }) =>
    Object.values(managers ?? {}).flatMap((manager) => manager ?? []),
  ),
  ...(chart === undefined
    ? []
    : plannedHires(chart).flatMap((card) => hireManager(chart, card) ?? [])),
];

export function hireRows(
  chart: OrgChart,
  months: readonly string[],
): MonthRow[] {
  return plannedHires(chart).map((card) => {
    const unnamed = card.planned.shownId !== undefined;
    return {
      id: card.id,
      personId: card.id,
      name: unnamed ? "" : card.preferredName,
      ...(unnamed ? { madeName: card.preferredName } : {}),
      manager: hireManager(chart, card),
      values: {},
      links: {},
      outside: new Set(months.filter((month) => month < card.planned.expected)),
      plannedHire: true,
      expected: card.planned.expected,
    };
  });
}
