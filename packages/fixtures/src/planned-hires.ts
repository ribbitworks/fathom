// SPDX-License-Identifier: Apache-2.0

// A fictional organization's planned hires, open and filled.

import { addMonths } from "@fathom/shared";
import { fictionalId } from "./fictional-id.ts";
import {
  choice,
  levelColumn,
  levels,
  positions,
  siteColumn,
  sites,
} from "./lists.ts";
import type { FictionalHire, FictionalLine, FictionalPerson } from "./types.ts";

// The planned hires not yet filled, each due some months after the reference date, or with no
// target date, under the current managers in turn, but for those with none and those under a
// planned manager, named by its key, which comes earlier in the list, and with a site and level
// where decided. Invented requisitions.
const openings: readonly {
  name: string | null;
  requisition: string | null;
  position: string;
  meaning: FictionalHire["meaning"];
  months: number | null;
  managed: boolean;
  // A place among the current managers instead of the next turn, so a later hire keeps off a manager
  // the manual tests count reports or Capacity rows for.
  managerPlace?: number;
  key?: string;
  managedBy?: string;
  isManager?: boolean;
  site?: string;
  level?: string;
}[] = [
  {
    name: "Backend engineer 1",
    requisition: null,
    position: "Software Engineer",
    meaning: "proposed",
    months: 5,
    managed: true,
    site: "Kestrel Bay",
  },
  {
    name: "Payments tester",
    requisition: "REQ-2041",
    position: "Test Engineer",
    meaning: "open",
    months: 3,
    managed: true,
    site: "Northmere",
    level: "P2",
  },
  {
    name: null,
    requisition: "REQ-2042",
    position: "SDET",
    meaning: "open",
    months: 2,
    managed: true,
    level: "P3",
  },
  {
    name: "Backend engineer 2",
    requisition: null,
    position: "Software Engineer",
    meaning: "open",
    months: 1,
    managed: true,
    site: "Ashgrove",
    level: "P1",
  },
  {
    name: null,
    requisition: null,
    position: "Engineering Manager",
    meaning: "proposed",
    months: null,
    managed: false,
    key: "planned-manager",
    isManager: true,
  },
  {
    name: null,
    requisition: "REQ-2047",
    position: "Software Engineer",
    meaning: "open",
    months: 2,
    managed: false,
  },
  {
    name: "Platform engineer",
    requisition: null,
    position: "Software Engineer",
    meaning: "proposed",
    months: 6,
    managed: false,
    managedBy: "planned-manager",
  },
  {
    name: null,
    requisition: null,
    position: "SDET",
    meaning: "proposed",
    months: null,
    managed: false,
    managedBy: "planned-manager",
  },
  {
    name: "Data engineer",
    requisition: "REQ-2053",
    position: "Software Engineer",
    meaning: "open",
    months: -1,
    managed: true,
    managerPlace: 5,
    level: "P2",
  },
  {
    name: "Mobile developer",
    requisition: "REQ-2055",
    position: "Software Engineer",
    meaning: "proposed",
    months: 4,
    managed: true,
    managerPlace: 6,
  },
];

export function hiresFor(
  people: readonly FictionalPerson[],
  reportingLines: readonly FictionalLine[],
  referenceDate: string,
): FictionalHire[] {
  const managerOf = new Map(
    reportingLines.map(({ personId, managerId }) => [personId, managerId]),
  );
  const current = (person: FictionalPerson) =>
    person.endDate === null &&
    person.startDate !== null &&
    person.startDate <= referenceDate;
  // The seed data's drafts change the first few people, so hires name only those after them.
  const named = people.slice(10);
  const managers = named.filter(
    (person) => person.isManager && current(person),
  );
  const due = (months: number) => addMonths(referenceDate, months);
  let next = 0;
  const openingId = (index: number) =>
    fictionalId(`planned-hire:${String(index)}`);
  const managerOfOpening = (
    managed: boolean,
    managedBy?: string,
    managerPlace?: number,
  ) => {
    if (managedBy !== undefined) {
      return openingId(openings.findIndex(({ key }) => key === managedBy));
    }
    if (!managed || managers.length === 0) return null;
    const place = managerPlace ?? next++;
    return String(managers.at(place % managers.length)?.id);
  };
  const open = openings.map(
    (
      {
        name,
        requisition,
        meaning,
        position,
        months,
        managed,
        managedBy,
        managerPlace,
        isManager,
        site,
        level,
      },
      index,
    ): FictionalHire => ({
      id: openingId(index),
      name,
      requisition,
      meaning,
      positionId: choice(positions, position),
      targetDate: months === null ? null : due(months),
      managerId: managerOfOpening(managed, managedBy, managerPlace),
      isManager: isManager ?? false,
      filledBy: null,
      values: {
        ...(site === undefined
          ? {}
          : { [siteColumn.id]: [choice(sites, site)] }),
        ...(level === undefined
          ? {}
          : { [levelColumn.id]: [choice(levels, level)] }),
      },
    }),
  );
  // Someone who has not started yet, and someone current who manages no one, as an internal
  // transfer, each filling a hire under the manager they report to.
  const starter = named.find(
    (person) =>
      person.endDate === null &&
      person.startDate !== null &&
      person.startDate > referenceDate &&
      managerOf.has(person.id),
  );
  const transfer = named.find(
    (person) =>
      current(person) && !person.isManager && managerOf.has(person.id),
  );
  const filled = (
    [
      ["REQ-2036", starter, starter?.startDate ?? null],
      ["REQ-2031", transfer, due(-2)],
    ] as const
  ).flatMap(([requisition, person, targetDate], index): FictionalHire[] =>
    person === undefined
      ? []
      : [
          {
            id: fictionalId(`planned-hire:filled:${String(index)}`),
            name: null,
            requisition,
            positionId: person.positionId,
            meaning: "open",
            targetDate,
            // Both were found among those with a manager.
            managerId: String(managerOf.get(person.id)),
            isManager: false,
            filledBy: person.id,
            values: { ...person.values },
          },
        ],
  );
  return [...open, ...filled];
}
