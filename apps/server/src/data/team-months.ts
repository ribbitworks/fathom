// SPDX-License-Identifier: Apache-2.0

// Who was on which feature team, month by month, as approved, for the monthly grid. Part of the data
// access layer. Each month is read as of its first day, or today during the current month. Readers
// who do not see Restricted details see only people current today, on every month, so no month
// reveals who has yet to start or an end date still to come. Readers who do see them see everyone
// employed during the months asked for, and which of those months fall outside their employment.

import {
  type Database,
  featureTeamMemberships,
  featureTeams,
  people,
} from "@fathom/db";
import {
  dayReadingMonth,
  knownColour,
  type MonthRange,
  monthOf,
  monthsBetween,
  type TeamMonths,
} from "@fathom/shared";
import {
  type Actor,
  requirePermission,
  seesRestrictedDetails,
} from "../access.ts";
import { bySubject, currentRecordOn, inForceOn } from "./in-force.ts";
import { currentOn } from "./people.ts";
import { readLines } from "./reporting.ts";
import { readToday } from "./settings.ts";

interface Employment {
  startDate: string | null;
  endDate: string | null;
}

const employedIn = ({ startDate, endDate }: Employment, month: string) =>
  (startDate === null || monthOf(startDate) <= month) &&
  (endDate === null || monthOf(endDate) >= month);

export async function readTeamMonths(
  database: Database,
  actor: Actor,
  { from, to }: MonthRange,
): Promise<TeamMonths> {
  requirePermission(actor, "org-chart:view");
  const restricted = seesRestrictedDetails(actor);
  const seesPeople = actor.permissions.includes("people:view");
  const today = await readToday(database);
  const months = monthsBetween(from, to);
  const { rows, lines, teams, memberships } = await database.transaction(
    async (transaction) => ({
      rows: await transaction
        .select({
          id: people.id,
          preferredName: people.preferredName,
          startDate: people.startDate,
          endDate: people.endDate,
        })
        .from(people),
      lines: await readLines(transaction),
      teams: await transaction
        .select({
          id: featureTeams.id,
          name: featureTeams.name,
          colour: featureTeams.colour,
        })
        .from(featureTeams),
      memberships: await transaction
        .select({
          teamId: featureTeamMemberships.teamId,
          personId: featureTeamMemberships.personId,
          member: featureTeamMemberships.member,
          fromDate: featureTeamMemberships.fromDate,
        })
        .from(featureTeamMemberships),
    }),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  const nameOf = new Map(rows.map((row) => [row.id, row.preferredName]));
  const recordsOf = bySubject(memberships, ({ personId }) => personId);
  const shown = rows.filter((person) =>
    restricted
      ? months.some((month) => employedIn(person, month))
      : currentOn(person, today),
  );
  return {
    months,
    teams: teams.map(({ id, name, colour }) => ({
      id,
      name,
      colour: knownColour(colour),
    })),
    people: shown.map((person) => {
      const byTeam = [
        ...bySubject(
          recordsOf.get(person.id) ?? [],
          ({ teamId }) => teamId,
        ).entries(),
      ];
      const managerId = seesPeople
        ? (currentRecordOn(lines.get(person.id) ?? [], today)?.managerId ??
          null)
        : null;
      const outside = months.filter((month) => !employedIn(person, month));
      return {
        id: person.id,
        preferredName: person.preferredName,
        // A reporting line always names a person who exists.
        manager:
          managerId === null
            ? null
            : { id: managerId, name: nameOf.get(managerId) as string },
        teams: Object.fromEntries(
          months.flatMap((month): [string, string[]][] => {
            const day = dayReadingMonth(month, today);
            if (!currentOn(person, restricted ? day : today)) return [];
            const onTeams = byTeam
              .filter(([, records]) => inForceOn(records, day)?.member === true)
              .map(([teamId]) => teamId);
            return onTeams.length === 0 ? [] : [[month, onTeams]];
          }),
        ),
        ...(restricted && outside.length > 0 ? { outside } : {}),
      };
    }),
  };
}
