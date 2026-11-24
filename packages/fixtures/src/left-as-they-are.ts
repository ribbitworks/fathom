// SPDX-License-Identifier: Apache-2.0

// Who the later steps, setting who leaves soon and growing the feature teams, leave as they are: the
// first people, whom the seed data names, those on a feature team or filling a planned hire, and the
// latest person on no team, whom a seed draft adds to one.

import type {
  FictionalFeatureTeam,
  FictionalHire,
  FictionalPerson,
} from "./types.ts";

// The seed data's drafts and tests name the first people, so what is added later changes only those
// after them.
export const firstUnnamed = 12;

export const featureTeamMembers = (
  featureTeams: readonly FictionalFeatureTeam[],
) =>
  new Set(
    featureTeams.flatMap(({ memberships }) =>
      memberships.map(({ personId }) => personId),
    ),
  );

// Everyone filling a planned hire, whom the seed data's later additions leave as they are.
export const fillingHires = (hires: readonly FictionalHire[]) =>
  new Set(hires.map(({ filledBy }) => filledBy));

// The latest person current on the reference date on no feature team, whom a seed draft adds to one.
export const lastOnNoTeam = (
  people: readonly FictionalPerson[],
  featureTeams: readonly FictionalFeatureTeam[],
  referenceDate: string,
): FictionalPerson | undefined => {
  const onTeams = featureTeamMembers(featureTeams);
  return people.findLast(
    ({ id, startDate, endDate }) =>
      !onTeams.has(id) &&
      endDate === null &&
      String(startDate) <= referenceDate,
  );
};
