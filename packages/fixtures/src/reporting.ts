// SPDX-License-Identifier: Apache-2.0

// Who reports to whom in a fictional organization, and the names of its managers' teams.

import { base, Faker } from "@faker-js/faker";
import type { FictionalLine, FictionalPerson, FictionalTeam } from "./types.ts";

const teamNames = [
  "Platform",
  "Payments",
  "Mobile",
  "Data",
  "Search",
  "Identity",
  "Billing",
  "Tools",
  "Quality",
  "Integrations",
  "Reporting",
  "Infrastructure",
];

// The colours the first named teams are given, from the palette; the rest have none.
const teamColours = ["teal", "grape", "orange", "indigo", "yellow", "pink"];

// Well past the seeds the organization's own generators take, for people, the names chosen and each
// name source.
const reportingSeedOffset = 50;

const reportsKeptByDeparted = 3;

const namedTeamEvery = 2;

// Who reports to whom: the earliest current manager at the top, with no manager; other managers
// under someone who started before them, so there are no loops; and everyone else under a manager.
// Each line starts when both have started, so the manager is employed that day, and a new
// employee's starts on their start date. One manager who has left keeps reports who were never
// moved, so the warning about them shows. Made by a generator of their own, so they change nothing
// else generated.
export function reporting(
  people: readonly FictionalPerson[],
  positionOf: (person: FictionalPerson) => string,
  managerChoice: string,
  seed: number,
  referenceDate: string,
): { reportingLines: FictionalLine[]; teams: FictionalTeam[] } {
  const faker = new Faker({ locale: [base], seed: seed + reportingSeedOffset });
  const started = (person: FictionalPerson) =>
    String(person.startDate) <= referenceDate;
  const managers = people
    .filter((person) => positionOf(person) === managerChoice && started(person))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  const top = managers.find(({ endDate }) => endDate === null);
  const departed = managers.find(
    ({ endDate }) => endDate !== null && endDate < referenceDate,
  );
  // The day a line starts, once both have started, or undefined when either has left by then.
  const fromFor = (person: FictionalPerson, manager: FictionalPerson) => {
    const from =
      String(person.startDate) > String(manager.startDate)
        ? String(person.startDate)
        : String(manager.startDate);
    return [manager.endDate, person.endDate].every(
      (end) => end === null || from <= end,
    )
      ? from
      : undefined;
  };
  const reportingLines: FictionalLine[] = [];
  let keptByDeparted = 0;
  for (const person of people) {
    if (person === top) continue;
    const isManager = managers.includes(person);
    const candidates = managers.filter(
      (manager) =>
        manager !== person &&
        manager.endDate === null &&
        fromFor(person, manager) !== undefined &&
        (!isManager || managers.indexOf(manager) < managers.indexOf(person)),
    );
    const stays =
      departed !== undefined &&
      !isManager &&
      person.endDate === null &&
      keptByDeparted < reportsKeptByDeparted &&
      fromFor(person, departed) !== undefined;
    let manager = stays ? departed : undefined;
    if (manager === undefined && candidates.length > 0) {
      manager = faker.helpers.arrayElement(candidates);
    }
    if (manager === undefined) continue;
    if (stays) keptByDeparted += 1;
    reportingLines.push({
      personId: person.id,
      managerId: manager.id,
      fromDate: String(fromFor(person, manager)),
    });
  }
  const named = managers.filter((_, index) => index % namedTeamEvery === 0);
  const teams = teamNames.slice(0, named.length).map((name, index) => ({
    managerId: String(named.at(index)?.id),
    name: `${name} team`,
    colour: teamColours.at(index) ?? null,
  }));
  return { reportingLines, teams };
}
