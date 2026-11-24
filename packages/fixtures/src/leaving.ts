// SPDX-License-Identifier: Apache-2.0

// The people who leave soon after the reference date.

import { addDays } from "@fathom/shared";
import {
  featureTeamMembers,
  fillingHires,
  firstUnnamed,
  lastOnNoTeam,
} from "./left-as-they-are.ts";
import type {
  FictionalFeatureTeam,
  FictionalHire,
  FictionalPerson,
} from "./types.ts";

// How many days after the reference date each of those leaving soon leaves: one within the month,
// one later.
export const leavingInDays = [12, 45] as const;

// Set last, on people nothing else picks, since everything worked out above, and the seed data's
// own picks, read an end date as having left.
export function setLeaving(
  people: readonly FictionalPerson[],
  hires: readonly FictionalHire[],
  featureTeams: readonly FictionalFeatureTeam[],
  referenceDate: string,
): void {
  const onTeams = featureTeamMembers(featureTeams);
  const filling = fillingHires(hires);
  const notes = people.flatMap(({ notes }) => Object.values(notes)).join("\n");
  const joining = lastOnNoTeam(people, featureTeams, referenceDate);
  const leaving = people
    .slice(firstUnnamed)
    .filter(
      (person) =>
        person !== joining &&
        person.endDate === null &&
        person.startDate !== null &&
        person.startDate <= referenceDate &&
        !person.isManager &&
        Object.keys(person.notes).length === 0 &&
        !notes.includes(`**${person.preferredName}**`) &&
        !onTeams.has(person.id) &&
        !filling.has(person.id),
    )
    .slice(-leavingInDays.length);
  leavingInDays.forEach((days, at) => {
    const person = leaving.at(at);
    if (person !== undefined) person.endDate = addDays(referenceDate, days);
  });
}
