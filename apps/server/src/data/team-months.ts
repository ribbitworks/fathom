// SPDX-License-Identifier: Apache-2.0

// Who was on which feature team, month by month, approved and as drafted, people and planned hires,
// for the monthly grid on Feature assignments. Part of the data access layer.

import {
  type Database,
  featureTeamMemberships,
  featureTeams,
  people,
  plannedHires,
} from "@fathom/db";
import {
  dayReadingMonth,
  knownColour,
  type MonthRange,
  monthsBetween,
  seesView,
  type TeamMonths,
  bySubject,
  currentRecordOn,
  inForceOn,
} from "@fathom/shared";
import { isNull } from "drizzle-orm";
import { type Actor, requirePermission, requireView } from "../access.ts";
import {
  type DraftedTeam,
  memberColumn,
  readDraftedMemberships,
} from "./feature-team-reads.ts";
import { expectedMonth } from "./hire-fields.ts";
import { currentOn, employedMonths, type Employment } from "./people-reads.ts";
import { type LineRow, readLines } from "./reporting.ts";
import { readToday } from "./settings.ts";

function employedIn(person: Employment, month: string): boolean {
  const { first, last } = employedMonths(person);
  return (
    (first === undefined || first <= month) &&
    (last === undefined || last >= month)
  );
}

// A record of a person or planned hire joining or leaving a team from a day, approved or drafted.
interface MembershipRecord {
  teamId: string;
  memberId: string;
  member: boolean;
  fromDate: string;
}

type Membership = Omit<MembershipRecord, "memberId">;

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
  drafted: readonly MembershipRecord[],
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

// Read in one transaction, so the grid is made from one moment's data.
export interface TeamMonthsRead {
  readonly rows: readonly (Employment & {
    id: string;
    preferredName: string;
  })[];
  // The planned hires not yet filled, each on teams from the first day of the month it's expected.
  readonly hires: readonly { id: string; firstDay: string }[];
  readonly lines: ReadonlyMap<
    string,
    readonly Pick<LineRow, "managerId" | "fromDate">[]
  >;
  readonly teams: readonly {
    id: string;
    name: string;
    colour: string | null;
  }[];
  readonly memberships: readonly MembershipRecord[];
  readonly drafts: {
    readonly teams: readonly DraftedTeam[];
    readonly records: readonly MembershipRecord[];
  };
}

export async function readTeamMonths(
  database: Database,
  actor: Actor,
  { from, to }: MonthRange,
): Promise<TeamMonths> {
  requirePermission(actor, "feature-teams:view");
  requireView(actor, "featureAssignments");
  const today = await readToday(database);
  const read: TeamMonthsRead = await database.transaction(
    async (transaction) => ({
      // Drafts show only to readers who see people, as feature teams' drafts do everywhere.
      drafts: actor.permissions.includes("people:view")
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
      hires: (
        await transaction
          .select({ id: plannedHires.id, targetDate: plannedHires.targetDate })
          .from(plannedHires)
          .where(isNull(plannedHires.filledBy))
      ).map(({ id, targetDate }) => ({
        id,
        firstDay: `${expectedMonth({ fillerStart: null, targetDate }, today)}-01`,
      })),
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
          memberId: memberColumn,
          member: featureTeamMemberships.member,
          fromDate: featureTeamMemberships.fromDate,
        })
        .from(featureTeamMemberships),
    }),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  return teamMonthsFrom(read, {
    months: monthsBetween(from, to),
    today,
    byManager: seesView("groupingByManager", actor),
    seesPeople: actor.permissions.includes("people:view"),
  });
}

export function teamMonthsFrom(
  { rows, hires, lines, teams, memberships, drafts }: TeamMonthsRead,
  {
    months,
    today,
    byManager,
    seesPeople,
  }: {
    months: readonly string[];
    today: string;
    byManager: boolean;
    seesPeople: boolean;
  },
): TeamMonths {
  const nameOf = new Map(rows.map((row) => [row.id, row.preferredName]));
  const recordsOf = bySubject(memberships, ({ memberId }) => memberId);
  const draftedOf = bySubject(drafts.records, ({ memberId }) => memberId);
  const removed = new Set(
    drafts.teams
      .filter(({ action }) => action === "deleted")
      .map(({ teamId }) => teamId),
  );
  const shown = rows.filter((person) =>
    months.some((month) => employedIn(person, month)),
  );
  const managerOn = (personId: string, day: string) => {
    const managerId =
      currentRecordOn(lines.get(personId) ?? [], day)?.managerId ?? null;
    // A reporting line always names a person who exists.
    return managerId === null
      ? null
      : { id: managerId, name: nameOf.get(managerId) as string };
  };
  const draftedBy = new Set<string>();
  // A member's teams in each month they are employed in, or a planned hire is expected by, approved
  // and as drafted.
  const monthsOf = (id: string, employment: Employment) => {
    const records = recordsOf.get(id) ?? [];
    const byTeam = bySubject(records, ({ teamId }) => teamId);
    const draftedRecords = draftedOf.get(id) ?? [];
    const byTeamDrafted =
      draftedRecords.length === 0 &&
      !records.some(({ teamId }) => removed.has(teamId))
        ? undefined
        : withDrafted(records, draftedRecords, removed);
    const shownMonths = months.flatMap((month) => {
      const day = dayReadingMonth(month, today);
      return currentOn(employment, day) ? [{ month, day }] : [];
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
      teams: Object.fromEntries(approved),
      ...(drafted === undefined ? {} : { drafted }),
    };
  };
  const shownPeople = shown.map((person) => {
    const outside = months.filter((month) => !employedIn(person, month));
    const { teams: approved, ...drafted } = monthsOf(person.id, person);
    return {
      id: person.id,
      preferredName: person.preferredName,
      manager: managerOn(person.id, today),
      // Later months' managers are future reorganizations, so only those who group by manager get
      // each month's.
      ...(byManager
        ? {
            managers: Object.fromEntries(
              months.map((month) => [
                month,
                managerOn(person.id, dayReadingMonth(month, today)),
              ]),
            ),
          }
        : {}),
      teams: approved,
      ...(outside.length > 0 ? { outside } : {}),
      ...drafted,
    };
  });
  // Planned hires are shown as placeholders only to those who see people; others see those on a
  // team, or drafted onto one, as they see a team's members.
  const shownHires = hires
    .map(({ id, firstDay }) => ({
      id,
      ...monthsOf(id, { startDate: firstDay, endDate: null }),
    }))
    .filter(
      ({ teams: onTeams, drafted }) =>
        seesPeople || Object.keys(onTeams).length > 0 || drafted !== undefined,
    );
  const added = drafts.teams.filter(
    ({ teamId, action }) => action === "created" && draftedBy.has(teamId),
  );
  return {
    months: [...months],
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
    hires: shownHires,
    drafts: drafts.teams
      .filter(({ teamId }) => draftedBy.has(teamId))
      .map(({ teamId, action, state, unpublished }) => ({
        teamId,
        action,
        state,
        ...(unpublished ? { unpublished } : {}),
      })),
  };
}
