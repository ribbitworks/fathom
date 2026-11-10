// SPDX-License-Identifier: Apache-2.0

// Who was on which feature team, month by month, as approved, for the monthly grid, and, for readers
// who see drafts, as the team drafts they see would make it. Part of the data access layer. Each
// month is read as of its first day, or today during the current month, so a draft's exact days
// show only as the months they fall in. Readers who do not see Restricted details see only people
// current today, on every month, so no month reveals who has yet to start or an end date still to
// come. Readers who do see them see everyone employed during the months asked for, and which of
// those months fall outside their employment.

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
import {
  type DraftedMembership,
  readDraftedMemberships,
} from "./feature-teams.ts";
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

interface Membership {
  teamId: string;
  member: boolean;
  fromDate: string;
}

// The identifiers of the teams someone is on on a day, from their records by team, sorted.
const teamsOn = (byTeam: ReadonlyMap<string, Membership[]>, day: string) =>
  [...byTeam]
    .filter(([, records]) => inForceOn(records, day)?.member === true)
    .map(([teamId]) => teamId)
    .sort();

// Someone's records with a draft's after them, so a draft's record on the same day as an approved
// one is the one in force, leaving out the teams drafts remove.
function withDrafted(
  records: readonly Membership[],
  drafted: readonly DraftedMembership[],
  removed: ReadonlySet<string>,
): Map<string, Membership[]> {
  return bySubject(
    [...records, ...drafted].filter(({ teamId }) => !removed.has(teamId)),
    ({ teamId }) => teamId,
  );
}

// The months whose teams drafts change, with the teams then, and the teams whose drafts change
// them; undefined when they change none.
function draftedMonths(
  shownMonths: readonly { month: string; day: string }[],
  approved: ReadonlyMap<string, string[]>,
  byTeamDrafted: ReadonlyMap<string, Membership[]>,
): { teams: Record<string, string[]>; by: string[] } | undefined {
  const changedBy = new Set<string>();
  const teams = Object.fromEntries(
    shownMonths.flatMap(({ month, day }): [string, string[]][] => {
      const was = approved.get(month) ?? [];
      const now = teamsOn(byTeamDrafted, day);
      const changed = [
        ...was.filter((teamId) => !now.includes(teamId)),
        ...now.filter((teamId) => !was.includes(teamId)),
      ];
      for (const teamId of changed) changedBy.add(teamId);
      return changed.length === 0 ? [] : [[month, now]];
    }),
  );
  return changedBy.size === 0
    ? undefined
    : { teams, by: [...changedBy].sort() };
}

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
  // Drafts are details of people, so only those who see people see them.
  const seesDrafts = seesPeople;
  const { rows, lines, teams, memberships, drafts } =
    await database.transaction(
      async (transaction) => ({
        drafts: seesDrafts
          ? await readDraftedMemberships(transaction, actor.user.id, today)
          : { teams: [], records: [] },
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
  const draftedOf = bySubject(drafts.records, ({ personId }) => personId);
  const removed = new Set(
    drafts.teams
      .filter(({ action }) => action === "deleted")
      .map(({ teamId }) => teamId),
  );
  const shown = rows.filter((person) =>
    restricted
      ? months.some((month) => employedIn(person, month))
      : currentOn(person, today),
  );
  const draftedBy = new Set<string>();
  const shownPeople = shown.map((person) => {
    const records = recordsOf.get(person.id) ?? [];
    const byTeam = bySubject(records, ({ teamId }) => teamId);
    const draftedRecords = draftedOf.get(person.id) ?? [];
    const byTeamDrafted =
      draftedRecords.length === 0 &&
      !records.some(({ teamId }) => removed.has(teamId))
        ? undefined
        : withDrafted(records, draftedRecords, removed);
    const managerId = seesPeople
      ? (currentRecordOn(lines.get(person.id) ?? [], today)?.managerId ?? null)
      : null;
    const outside = months.filter((month) => !employedIn(person, month));
    const shownMonths = months.flatMap((month) => {
      const day = dayReadingMonth(month, today);
      return currentOn(person, restricted ? day : today)
        ? [{ month, day }]
        : [];
    });
    const teamsIn = (of: ReadonlyMap<string, Membership[]>) =>
      shownMonths.flatMap(({ month, day }): [string, string[]][] => {
        const onTeams = teamsOn(of, day);
        return onTeams.length === 0 ? [] : [[month, onTeams]];
      });
    const approved = new Map(teamsIn(byTeam));
    const drafted =
      byTeamDrafted === undefined
        ? undefined
        : draftedMonths(shownMonths, approved, byTeamDrafted);
    for (const teamId of drafted?.by ?? []) draftedBy.add(teamId);
    return {
      id: person.id,
      preferredName: person.preferredName,
      // A reporting line always names a person who exists.
      manager:
        managerId === null
          ? null
          : { id: managerId, name: nameOf.get(managerId) as string },
      teams: Object.fromEntries(approved),
      ...(restricted && outside.length > 0 ? { outside } : {}),
      ...(drafted === undefined ? {} : { drafted }),
    };
  });
  const added = drafts.teams.filter(
    ({ teamId, action }) => action === "created" && draftedBy.has(teamId),
  );
  return {
    months,
    teams: [
      ...teams.map(({ id, name, colour }) => ({
        id,
        name,
        colour: knownColour(colour),
      })),
      ...added.map(({ teamId, name }) => ({
        id: teamId,
        name,
        colour: null,
      })),
    ],
    people: shownPeople,
    ...(seesDrafts
      ? {
          drafts: drafts.teams
            .filter(({ teamId }) => draftedBy.has(teamId))
            .map(({ teamId, action, state, unpublished }) => ({
              teamId,
              action,
              state,
              ...(unpublished ? { unpublished } : {}),
            })),
        }
      : {}),
  };
}
