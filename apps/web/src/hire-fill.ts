// SPDX-License-Identifier: Apache-2.0

// The rules for filling a planned hire as People can tell them: which hires can be filled, who can
// fill one, and what the form holds. The server checks each again, along with those People cannot
// tell, such as a person who has not started the hire they filled before.

import {
  carriedByFill,
  type HireFill,
  joinedAndLed,
  type List,
  type Person,
  type PersonFeatureTeam,
} from "@fathom/shared";
import { isHire, stateMeaning } from "./people-rows.ts";
import { heldBack } from "./grid-drafts.ts";
import type { CellValue } from "./table-view.ts";

// A fill being entered in a planned hire's details panel: the hire, whether a new or an existing
// person fills it, the values entered by column, and whether it is being saved.
export interface HireFilling {
  hireId: string;
  by: HireFill["by"];
  values: Record<string, CellValue>;
  saving?: boolean;
}

export const newFilling = (hire: Pick<Person, "id">): HireFilling => ({
  hireId: hire.id,
  by: "new person",
  values: {},
});

export const fillQuestion = {
  title: "Stop filling this planned hire?",
  keep: "Keep filling",
};

// Whether a planned hire can be filled as its row stands: approved, not already being filled,
// and no draft adding it, removing it, changing its manager, or rejected.
export function canFill(hire: Person, lists: readonly List[]): boolean {
  if (
    !isHire(hire) ||
    hire.filler !== undefined ||
    heldBack(hire) ||
    hire.draft?.action === "created" ||
    hire.draft?.state === "rejected" ||
    hire.draft?.changed.includes("managerId") === true
  ) {
    return false;
  }
  return stateMeaning(lists, hire.stateId) === "open";
}

// Who may be chosen to fill a hire: people with no draft of their own, who have not left, are not
// filling another hire in a draft, and are not the manager chosen, who cannot report to themself.
export function fillCandidates(
  people: readonly Person[],
  managerId: string | undefined,
  day: string,
): Person[] {
  const filling = new Set(people.map(({ filler }) => filler));
  return people.filter(
    (one) =>
      !isHire(one) &&
      one.draft === undefined &&
      !heldBack(one) &&
      !filling.has(one.id) &&
      one.id !== managerId &&
      !(typeof one.endDate === "string" && one.endDate < day),
  );
}

// Whether a hire reports to a planned manager, whom a person cannot report to.
export const underPlannedManager = (
  hire: Person,
  people: readonly Person[],
): boolean => people.some((one) => one.id === hire.manager?.id && isHire(one));

// Whether someone chosen to fill a hire would change manager.
export const wouldMove = (
  person: Person | undefined,
  managerId: string | undefined,
): boolean =>
  person !== undefined &&
  managerId !== undefined &&
  person.manager?.id !== managerId;

// What a fill says about the manager, when it is not the hire's own.
export const managerChange = (
  hire: Person,
  managerId: string | undefined,
): { managerId?: string | null } =>
  managerId === hire.manager?.id ? {} : { managerId: managerId ?? null };

// The id a fill's person goes by until they're added, or when the reader doesn't see them.
export const newPersonId = "new-person";

// A feature team a fill puts its person on, or has them lead, from a day.
export interface TeamTakenOn {
  team: PersonFeatureTeam;
  from: string;
}

// Whom a fill would make of the hire: someone already in Fathom, or a new person, and when they
// start, if a day is known, and the feature teams they're on today.
export interface FillingPerson {
  id: string;
  startDate: string | null;
  teams: readonly PersonFeatureTeam[];
}

// The feature teams a planned hire's person joins and leads once the fill is approved, each from
// its first day, as the server carries them, judged as if approved today. A team the person is on
// today keeps them as they are, so they don't join it.
export function teamsTakenOn(
  hire: Pick<Person, "teamsCarried">,
  person: FillingPerson,
  day: string,
): { joins: TeamTakenOn[]; leads: TeamTakenOn[] } {
  const teams = hire.teamsCarried ?? [];
  const { joins, leads } = joinedAndLed(
    carriedByFill(
      {
        memberships: teams.flatMap(({ team, memberships }) =>
          memberships.map((record) => ({ teamId: team.id, ...record })),
        ),
        leads: teams.flatMap(({ team, leads: led }) =>
          led.map((record) => ({ teamId: team.id, ...record })),
        ),
      },
      {
        id: person.id,
        startDate: person.startDate,
        teams: person.teams.map(({ id }) => ({
          teamId: id,
          member: true,
          fromDate: day,
        })),
      },
      day,
    ),
    person.id,
  );
  const taken = (days: ReadonlyMap<string, string>) =>
    teams.flatMap(({ team }): TeamTakenOn[] => {
      const from = days.get(team.id);
      return from === undefined ? [] : [{ team, from }];
    });
  return { joins: taken(joins), leads: taken(leads) };
}
