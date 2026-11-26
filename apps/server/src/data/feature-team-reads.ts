// SPDX-License-Identifier: Apache-2.0

// Reading feature teams: the live teams on a day, each person's teams, the records their drafts
// would make, and every team as a reader sees it. Part of the data access layer.

import {
  type Database,
  featureTeamLeads,
  featureTeamMemberships,
  featureTeams,
  inChunks,
  people,
  type Reader,
} from "@fathom/db";
import {
  byName,
  disbandedMonth,
  type FeatureTeam,
  type FeatureTeams,
  knownColour,
  type PersonFeatureTeam,
} from "@fathom/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { type Actor, requirePermission, requireView } from "../access.ts";
import { type Draft, drafted, type Recorded } from "./draft-records.ts";
import { draftMakers } from "./draft-makers.ts";
import { type Held, heldByOf, readDrafts, readHeld } from "./drafts.ts";
import {
  datesOf,
  leftBy,
  memberChanges,
  type MemberDay,
  membersOf,
  type Person,
  peopleRows,
} from "./feature-team-rules.ts";
import {
  draftAsSeen,
  draftedOn,
  draftShownTo,
  namesSeen,
  peopleAsTodayOn,
  peopleNamed,
  seesTeamField,
  teamSight,
  withoutLeavers,
} from "./feature-team-sight.ts";
import { bySubject, inForceOn } from "./in-force.ts";
import { notStarted } from "./people-reads.ts";
import { keyNumberOf, readKeyNumbers } from "./record-keys.ts";
import { readToday } from "./settings.ts";
import { recordType } from "./feature-team-records.ts";

interface LiveTeams {
  // Each team as recorded: its name, lead, and members on the day asked for.
  teams: Map<string, Recorded>;
  colours: Map<string, string | null>;
}

// The live teams given, or every team, with their members and lead as of a day, leaving out those
// who have left by the day their employment is judged on, which is that same day unless the reader
// is shown people as they are today. A lead who is not a member on the day is no lead.
export async function readLiveTeams(
  reader: Reader,
  day: string,
  {
    ids,
    employmentDay = day,
  }: { ids?: readonly string[]; employmentDay?: string } = {},
): Promise<LiveTeams> {
  const rows: (typeof featureTeams.$inferSelect)[] = [];
  const memberships: (typeof featureTeamMemberships.$inferSelect & {
    personId: string;
  })[] = [];
  const leadRecords: (typeof featureTeamLeads.$inferSelect)[] = [];
  const read = async (chunk?: readonly string[]) => {
    leadRecords.push(
      ...(await reader
        .select()
        .from(featureTeamLeads)
        .where(
          and(
            chunk === undefined
              ? undefined
              : inArray(featureTeamLeads.teamId, [...chunk]),
            sql`${featureTeamLeads.fromDate} <= ${day}`,
          ),
        )),
    );
    rows.push(
      ...(await reader
        .select()
        .from(featureTeams)
        .where(
          chunk === undefined
            ? undefined
            : inArray(featureTeams.id, [...chunk]),
        )),
    );
    memberships.push(
      ...peopleRows(
        await reader
          .select()
          .from(featureTeamMemberships)
          .where(
            and(
              chunk === undefined
                ? undefined
                : inArray(featureTeamMemberships.teamId, [...chunk]),
              sql`${featureTeamMemberships.fromDate} <= ${day}`,
            ),
          )
          .orderBy(asc(featureTeamMemberships.fromDate)),
      ),
    );
  };
  if (ids === undefined) await read();
  else for (const chunk of inChunks([...ids])) await read(chunk);
  // Each person's latest record for a team, as of the day, says whether they are on it.
  const latest = new Map<string, Map<string, boolean>>();
  for (const { teamId, personId, member } of memberships) {
    const team = latest.get(teamId) ?? new Map<string, boolean>();
    team.set(personId, member);
    latest.set(teamId, team);
  }
  const leads = bySubject(leadRecords, ({ teamId }) => teamId);
  const everyone = await peopleOf(
    reader,
    [
      ...memberships.map(({ personId }) => personId),
      ...leadRecords.flatMap(({ leadId }) => leadId ?? []),
    ],
    employmentDay,
  );
  const teams = new Map<string, Recorded>();
  for (const row of rows) {
    const onTeam = [...(latest.get(row.id) ?? new Map<string, boolean>())]
      .filter(([, member]) => member)
      .map(([personId]) => personId);
    const leadId = inForceOn(leads.get(row.id) ?? [], day)?.leadId ?? null;
    teams.set(
      row.id,
      withoutLeavers(
        {
          name: row.name,
          leadId: leadId !== null && onTeam.includes(leadId) ? leadId : null,
          members: onTeam.sort(),
        },
        everyone,
      ),
    );
  }
  return {
    teams,
    colours: new Map(rows.map(({ id, colour }) => [id, colour])),
  };
}

// The live teams each person is on as of a day, by name, each with its colour, by person.
export async function readTeamsOfPeople(
  reader: Reader,
  day: string,
): Promise<Map<string, PersonFeatureTeam[]>> {
  const { teams, colours } = await readLiveTeams(reader, day);
  const teamsOf = new Map<string, PersonFeatureTeam[]>();
  for (const [id, team] of teams) {
    for (const personId of membersOf(team)) {
      teamsOf.set(personId, [
        ...(teamsOf.get(personId) ?? []),
        { id, name: String(team.name), colour: knownColour(colours.get(id)) },
      ]);
    }
  }
  for (const held of teamsOf.values()) held.sort(byName);
  return teamsOf;
}

export const readTeamDrafts = (
  reader: Reader,
  ids?: readonly string[],
  viewer?: string,
) => readDrafts(reader, recordType, ids, viewer);

// A record approving a team's draft would make: someone joining or leaving the team from the day the
// draft gives them, or from today.
export interface DraftedMembership {
  teamId: string;
  personId: string;
  member: boolean;
  fromDate: string;
}

export interface DraftedTeam {
  teamId: string;
  name: string;
  action: Draft["action"];
  state: Draft["state"];
  unpublished: boolean;
}

// The team drafts a viewer sees, and the membership records approving them would make, judged
// against the teams as they are today, as a draft is made. Approving a team's removal takes its
// past records with it.
export async function readDraftedMemberships(
  reader: Reader,
  viewer: string,
  today: string,
): Promise<{ teams: DraftedTeam[]; records: DraftedMembership[] }> {
  const draftsNow = await readTeamDrafts(reader, undefined, viewer);
  const live = await readLiveTeams(reader, today, {
    ids: [...draftsNow.keys()],
  });
  const versions = [...draftsNow].map(([teamId, draft]) => {
    const before = live.teams.get(teamId);
    return { teamId, draft, before, after: drafted(before, draft) };
  });
  const everyone = await peopleOf(
    reader,
    versions.flatMap(({ after }) => peopleNamed(after)),
    today,
  );
  const teams: DraftedTeam[] = [];
  const records: DraftedMembership[] = [];
  for (const { teamId, draft, before, after } of versions) {
    // A draft adds a team, or changes or removes a live one.
    const named = (after ?? before) as Recorded;
    teams.push({
      teamId,
      name: String(named.name),
      action: draft.action,
      state: draft.state,
      unpublished: draft.unpublished === true,
    });
    if (after === undefined) continue;
    records.push(
      ...membershipChanges(
        teamId,
        before,
        withoutLeavers(after, everyone),
        today,
      ).records,
    );
  }
  return { teams, records };
}

// The records approving a team's draft makes: each member it adds joins, and each it removes
// leaves, from the day the draft gives them, or from today, with the days it gives.
export function membershipChanges(
  teamId: string,
  before: Recorded | undefined,
  team: Recorded,
  today: string,
): { records: DraftedMembership[]; days: MemberDay[] } {
  const { added, removed } = memberChanges(before, team);
  const dates = new Map(Object.entries(datesOf(team)));
  const records: DraftedMembership[] = [];
  const days: MemberDay[] = [];
  for (const [personIds, member] of [
    [added, true],
    [removed, false],
  ] as const) {
    for (const personId of personIds) {
      const from = dates.get(personId);
      records.push({ teamId, personId, member, fromDate: from ?? today });
      if (from !== undefined) days.push({ teamId, personId, from });
    }
  }
  return { records, days };
}

// The people given who are live, with whether each has started and left as of a day.
export async function peopleOf(
  reader: Reader,
  ids: readonly string[],
  day: string,
): Promise<Map<string, Person>> {
  const found = new Map<string, Person>();
  for (const chunk of inChunks([...new Set(ids)])) {
    for (const person of await reader
      .select({
        id: people.id,
        preferredName: people.preferredName,
        startDate: people.startDate,
        endDate: people.endDate,
      })
      .from(people)
      .where(inArray(people.id, chunk))) {
      found.set(person.id, {
        preferredName: person.preferredName,
        startDate: person.startDate,
        endDate: person.endDate,
        started: !notStarted(person, day),
        left: leftBy(person, day),
      });
    }
  }
  return found;
}

// The month each team disbands from, which depends on when people join and leave teams and on end
// dates, so only those who see Personal details are told it.
async function readDisbandedMonths(
  reader: Reader,
): Promise<Map<string, string>> {
  const records = peopleRows(
    await reader
      .select({
        teamId: featureTeamMemberships.teamId,
        personId: featureTeamMemberships.personId,
        member: featureTeamMemberships.member,
        fromDate: featureTeamMemberships.fromDate,
        startDate: people.startDate,
        endDate: people.endDate,
      })
      .from(featureTeamMemberships)
      .innerJoin(people, eq(people.id, featureTeamMemberships.personId)),
  );
  const disbanded = new Map<string, string>();
  for (const [teamId, rows] of bySubject(records, ({ teamId }) => teamId)) {
    const month = disbandedMonth([
      ...bySubject(rows, ({ personId }) => personId).values(),
    ]);
    if (month !== undefined) disbanded.set(teamId, month);
  }
  return disbanded;
}

// Every feature team on a day, today unless another is given, as the reader's drafts make it, with
// its draft beside, for those who see feature teams. Members and a lead who have not started are
// left out for readers who do not see Personal details, and those who have left for everyone.
// Those who do not see people get teams as approved, with no drafts. Another day needs every class
// of data other dates need. On another day, only teams with members then, or with a draft, are
// listed.
export async function readFeatureTeams(
  database: Database,
  actor: Actor,
  on?: string,
): Promise<FeatureTeams> {
  requirePermission(actor, "feature-teams:view");
  const today = await readToday(database);
  if (on !== undefined && on !== today) {
    requireView(actor, "orgChartOtherDates");
  }
  const day = on ?? today;
  const employmentDay = peopleAsTodayOn(actor, day, today) ? today : day;
  const seesDrafts = actor.permissions.includes("people:view");
  return database.transaction(
    async (transaction) => {
      const live = await readLiveTeams(transaction, day, { employmentDay });
      const draftsNow = seesDrafts
        ? new Map(
            [
              ...(await readTeamDrafts(transaction, undefined, actor.user.id)),
            ].filter(([, draft]) => draftShownTo(actor, draft)),
          )
        : new Map<string, Draft>();
      const liveToday =
        day === today
          ? live
          : await readLiveTeams(transaction, today, {
              ids: [...draftsNow.keys()],
            });
      const held = seesDrafts
        ? await readHeld(transaction, recordType, actor.user.id)
        : new Map<string, Held>();
      const makers = await draftMakers(
        transaction,
        recordType,
        [...draftsNow.keys()],
        seesTeamField(actor),
        actor,
      );
      const ids = [
        ...live.teams.keys(),
        ...[...draftsNow.keys()].filter((id) => !live.teams.has(id)),
      ];
      const versions = ids.map((id) => {
        const before = live.teams.get(id);
        const teamToday = liveToday.teams.get(id);
        const draft = draftsNow.get(id);
        const after = draftedOn(before, teamToday, draft);
        return { id, before, teamToday, draft, after, team: after ?? before };
      });
      const everyone = await peopleOf(
        transaction,
        versions.flatMap(({ team, before, teamToday }) => [
          ...peopleNamed(team),
          ...peopleNamed(before),
          ...peopleNamed(teamToday),
        ]),
        employmentDay,
      );
      const sight = teamSight(actor, everyone, { day, today });
      const { shown } = sight;
      // Disbanded months are worked out from the days members leave.
      const disbanded =
        sight.seesPeople && sight.seesDays
          ? await readDisbandedMonths(transaction)
          : new Map<string, string>();
      const keys = await readKeyNumbers(transaction, "team");
      const teams = versions.flatMap(
        ({ id, before, teamToday, draft, after, team }): FeatureTeam[] => {
          // A draft changing a team that is not live, as when seed data is removed, makes none.
          if (team === undefined) return [];
          const members = membersOf(team).filter(shown);
          const withDraft = draftAsSeen(
            sight,
            { before, teamToday, after, team },
            draft,
            makers.get(id),
          );
          if (on !== undefined && members.length === 0 && !withDraft.draft) {
            return [];
          }
          return [
            {
              id,
              keyNumber: keyNumberOf(keys, id),
              name: String(team.name),
              leadId: shown(team.leadId) ? team.leadId : null,
              colour: knownColour(live.colours.get(id)),
              members,
              names: namesSeen(sight, team, before),
              ...(disbanded.has(id)
                ? { disbandedFrom: disbanded.get(id) }
                : {}),
              ...withDraft,
              ...heldByOf(held, id),
            },
          ];
        },
      );
      teams.sort(byName);
      return { teams };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
