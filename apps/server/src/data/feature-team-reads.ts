// SPDX-License-Identifier: Apache-2.0

// Reading feature teams: the live teams on a day, each person's and planned hire's teams, the records
// their drafts would make, and every team as a reader sees it. Part of the data access layer.

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
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { type Actor, requirePermission, requireView } from "../access.ts";
import { type Draft, drafted, type Recorded } from "./draft-records.ts";
import { draftMakers } from "./draft-makers.ts";
import { type Held, heldByOf, readDrafts, readHeld } from "./drafts.ts";
import {
  datesOf,
  type Everyone,
  isPlannedHire,
  leftBy,
  type Member,
  memberChanges,
  type MemberDay,
  membersOf,
  onTeamTodayOrLater,
} from "./feature-team-rules.ts";
import {
  draftAsSeen,
  draftedOn,
  draftShownTo,
  hireLeadDaySeen,
  type LeadRecord,
  type LeadRun,
  leadRunOf,
  namesSeen,
  peopleAsTodayOn,
  peopleNamed,
  seesTeamField,
  type TeamSight,
  teamSight,
  withoutLeavers,
} from "./feature-team-sight.ts";
import { recordType as hireRecordType } from "./hire-fields.ts";
import { hiresOf } from "./hire-reads.ts";
import { bySubject, inForceOn } from "./in-force.ts";
import { notStarted } from "./people-reads.ts";
import { keyNumberOf, readKeyNumbers } from "./record-keys.ts";
import { readToday } from "./settings.ts";
import { recordType } from "./feature-team-records.ts";

// Whom a membership record is of: its person or its planned hire, since it names exactly one.
export const memberColumn = sql<string>`coalesce(${featureTeamMemberships.personId}, ${featureTeamMemberships.plannedHireId})`;

// Whom a lead record names: its person or its planned hire, or null for no lead.
export const leadColumn = sql<
  string | null
>`coalesce(${featureTeamLeads.leadId}, ${featureTeamLeads.leadPlannedHireId})`;

interface LiveTeams {
  // Each team as recorded: its name, lead, and members on the day asked for.
  teams: Map<string, Recorded>;
  colours: Map<string, string | null>;
  // By team, the day each member on it then joined it, and the day its lead then started to lead it.
  since: Map<string, TeamDays>;
}

interface TeamDays {
  members: Map<string, string>;
  lead?: LeadRun;
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
  const memberships: {
    teamId: string;
    memberId: string;
    member: boolean;
    fromDate: string;
  }[] = [];
  const leadRecords: (LeadRecord & { teamId: string })[] = [];
  const read = async (chunk?: readonly string[]) => {
    leadRecords.push(
      ...(await reader
        .select({
          teamId: featureTeamLeads.teamId,
          leadId: leadColumn,
          personId: featureTeamLeads.leadId,
          fromDate: featureTeamLeads.fromDate,
        })
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
      ...(await reader
        .select({
          teamId: featureTeamMemberships.teamId,
          memberId: memberColumn,
          member: featureTeamMemberships.member,
          fromDate: featureTeamMemberships.fromDate,
        })
        .from(featureTeamMemberships)
        .where(
          and(
            chunk === undefined
              ? undefined
              : inArray(featureTeamMemberships.teamId, [...chunk]),
            sql`${featureTeamMemberships.fromDate} <= ${day}`,
          ),
        )
        .orderBy(asc(featureTeamMemberships.fromDate))),
    );
  };
  if (ids === undefined) await read();
  else for (const chunk of inChunks([...ids])) await read(chunk);
  // Each member's latest record for a team, as of the day, says whether they are on it, and the
  // record that put them back on it after a leave, the day they joined.
  const latest = new Map<string, Map<string, boolean>>();
  const joined = new Map<string, Map<string, string>>();
  for (const { teamId, memberId, member, fromDate } of memberships) {
    const team = latest.get(teamId) ?? new Map<string, boolean>();
    const days = joined.get(teamId) ?? new Map<string, string>();
    if (!member) days.delete(memberId);
    else if (team.get(memberId) !== true) days.set(memberId, fromDate);
    team.set(memberId, member);
    latest.set(teamId, team);
    joined.set(teamId, days);
  }
  const leads = bySubject(leadRecords, ({ teamId }) => teamId);
  const everyone = await readMembers(
    reader,
    [
      ...memberships.map(({ memberId }) => memberId),
      ...leadRecords.flatMap(({ leadId }) => leadId ?? []),
    ],
    employmentDay,
  );
  const teams = new Map<string, Recorded>();
  const since = new Map<string, TeamDays>();
  for (const row of rows) {
    const onTeam = [...(latest.get(row.id) ?? new Map<string, boolean>())]
      .filter(([, member]) => member)
      .map(([memberId]) => memberId);
    const leadRecordsOn = leads.get(row.id) ?? [];
    const leading = inForceOn(leadRecordsOn, day);
    const leadId = leading?.leadId ?? null;
    const ledSince = leading && leadRunOf(leadRecordsOn, leading);
    since.set(row.id, {
      members: joined.get(row.id) ?? new Map<string, string>(),
      ...(ledSince === undefined ? {} : { lead: ledSince }),
    });
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
    since,
  };
}

// The live teams each person and planned hire is on as of a day, by name, each with its colour, by
// person or planned hire.
export async function readTeamsOfMembers(
  reader: Reader,
  day: string,
): Promise<Map<string, PersonFeatureTeam[]>> {
  const { teams, colours } = await readLiveTeams(reader, day);
  const teamsOf = new Map<string, PersonFeatureTeam[]>();
  for (const [id, team] of teams) {
    for (const memberId of membersOf(team)) {
      teamsOf.set(memberId, [
        ...(teamsOf.get(memberId) ?? []),
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

// Every lead record of the teams any of the people or planned hires given has led or will lead,
// theirs and other leads'.
export async function readLeadsOfTeamsLedBy(
  reader: Reader,
  ids: readonly string[],
): Promise<{ teamId: string; leadId: string | null; fromDate: string }[]> {
  const led = await reader
    .select({ teamId: featureTeamLeads.teamId })
    .from(featureTeamLeads)
    .where(
      or(
        inArray(featureTeamLeads.leadId, [...ids]),
        inArray(featureTeamLeads.leadPlannedHireId, [...ids]),
      ),
    );
  const records = [];
  for (const chunk of inChunks([...new Set(led.map(({ teamId }) => teamId))])) {
    records.push(
      ...(await reader
        .select({
          teamId: featureTeamLeads.teamId,
          leadId: leadColumn,
          fromDate: featureTeamLeads.fromDate,
        })
        .from(featureTeamLeads)
        .where(inArray(featureTeamLeads.teamId, chunk))),
    );
  }
  return records;
}

// Every team's draft, published or not, with its team.
export async function teamDraftsOf(reader: Reader) {
  return [
    ...(await readTeamDrafts(reader)),
    ...[...(await readHeld(reader, recordType, undefined))].map(
      ([teamId, { draft }]): [string, Draft] => [teamId, draft],
    ),
  ].map(([teamId, { fields }]) => ({ teamId, fields }));
}

// The teams the planned hires given are on today or will be, each with those of them on it.
export async function teamsOfHires(
  reader: Reader,
  ids: readonly string[],
  today: string,
): Promise<Map<string, string[]>> {
  const records = [];
  for (const chunk of inChunks([...ids])) {
    records.push(
      ...(await reader
        .select({
          teamId: featureTeamMemberships.teamId,
          hireId: featureTeamMemberships.plannedHireId,
          member: featureTeamMemberships.member,
          fromDate: featureTeamMemberships.fromDate,
        })
        .from(featureTeamMemberships)
        .where(inArray(featureTeamMemberships.plannedHireId, chunk))),
    );
  }
  const teams = new Map<string, string[]>();
  for (const [teamId, ofTeam] of bySubject(records, ({ teamId }) => teamId)) {
    const on = [...bySubject(ofTeam, ({ hireId }) => String(hireId))]
      .filter(([, ofHire]) => onTeamTodayOrLater(ofHire, today))
      .map(([hireId]) => hireId);
    if (on.length > 0) teams.set(teamId, on);
  }
  return teams;
}

// A record approving a team's draft would make: a person or planned hire joining or leaving the team
// from the day the draft gives them, or from today.
export interface DraftedMembership {
  teamId: string;
  memberId: string;
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
  const everyone = await readMembers(
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
  for (const [memberIds, member] of [
    [added, true],
    [removed, false],
  ] as const) {
    for (const memberId of memberIds) {
      const from = dates.get(memberId);
      records.push({ teamId, memberId, member, fromDate: from ?? today });
      if (from !== undefined) {
        days.push({
          teamId,
          memberId,
          from,
          ...(member ? {} : { leaves: true as const }),
        });
      }
    }
  }
  return { records, days };
}

// The people given who are live, with whether each has started and left as of a day, and the planned
// hires given: each one's first day on teams, the first of the month it's expected then, as
// allocations count it, whether it's filled, and whether a draft, published or not, removes it.
export async function readMembers(
  reader: Reader,
  ids: readonly string[],
  day: string,
): Promise<Map<string, Member>> {
  const found = new Map<string, Member>();
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
        kind: "person",
        preferredName: person.preferredName,
        startDate: person.startDate,
        endDate: person.endDate,
        started: !notStarted(person, day),
        left: leftBy(person, day),
      });
    }
  }
  const hires = await hiresOf(
    reader,
    [...new Set(ids)].filter((id) => !found.has(id)),
    day,
  );
  if (hires.size === 0) return found;
  const removing = await removalsDrafted(reader, [...hires.keys()]);
  for (const [id, hire] of hires) {
    found.set(id, {
      kind: "planned-hire",
      preferredName: hire.called,
      firstDay: `${hire.expected}-01`,
      filled: hire.filledBy !== null,
      removing: removing.has(id),
    });
  }
  return found;
}

// The planned hires given that a draft removes, published or not.
async function removalsDrafted(
  reader: Reader,
  ids: readonly string[],
): Promise<Set<string>> {
  const drafts = [
    ...(await readDrafts(reader, hireRecordType, ids)),
    ...[...(await readHeld(reader, hireRecordType, undefined, ids))].map(
      ([id, { draft }]): [string, Draft] => [id, draft],
    ),
  ];
  return new Set(
    drafts.flatMap(([id, draft]) => (draft.action === "deleted" ? [id] : [])),
  );
}

// The month each team disbands from, which depends on when people and planned hires join and leave
// teams and on people's end dates, so only those who see Personal details are told it. A planned
// hire has no end date.
async function readDisbandedMonths(
  reader: Reader,
): Promise<Map<string, string>> {
  const records = await reader
    .select({
      teamId: featureTeamMemberships.teamId,
      memberId: memberColumn,
      member: featureTeamMemberships.member,
      fromDate: featureTeamMemberships.fromDate,
      endDate: people.endDate,
    })
    .from(featureTeamMemberships)
    .leftJoin(people, eq(people.id, featureTeamMemberships.personId));
  const disbanded = new Map<string, string>();
  for (const [teamId, rows] of bySubject(records, ({ teamId }) => teamId)) {
    const month = disbandedMonth([
      ...bySubject(rows, ({ memberId }) => memberId).values(),
    ]);
    if (month !== undefined) disbanded.set(teamId, month);
  }
  return disbanded;
}

// Which of those a team names are planned hires, General as their names on the team are.
function hiresNamed(
  names: Record<string, string>,
  everyone: Everyone,
): Pick<FeatureTeam, "hires"> {
  const hires = Object.keys(names)
    .filter((id) => isPlannedHire(everyone, id))
    .sort();
  return hires.length === 0 ? {} : { hires };
}

// The days the planned hires on a team, as approved, joined it, and the day one leading it started
// to, which every reader sees, since a planned hire's days are General; but the day it took over
// from a person, the day the person stopped leading, only a reader who sees Feature team dates.
function hireDaysOn(
  team: Recorded,
  live: Recorded | undefined,
  since: TeamDays | undefined,
  { everyone, seesDays }: Pick<TeamSight, "everyone" | "seesDays">,
): Pick<FeatureTeam, "hiresFrom" | "hireLeadFrom"> {
  const hires = membersOf(team).flatMap((id): [string, string][] => {
    const day = since?.members.get(id);
    return isPlannedHire(everyone, id) && day !== undefined ? [[id, day]] : [];
  });
  const lead = typeof team.leadId === "string" ? team.leadId : undefined;
  const leadDay =
    lead !== undefined && lead === live?.leadId && isPlannedHire(everyone, lead)
      ? hireLeadDaySeen(since?.lead, seesDays)
      : undefined;
  return {
    ...(hires.length === 0 ? {} : { hiresFrom: Object.fromEntries(hires) }),
    ...(leadDay === undefined ? {} : { hireLeadFrom: leadDay }),
  };
}

// Every feature team on a day, today unless another is given, as the reader's drafts make it, with
// its draft beside, for those who see feature teams. Planned hires on a team are shown to all of
// them, by their placeholder names, as allocations name them. Members and a lead who have not
// started are left out for readers who do not see Personal details, and those who have left for
// everyone. Those who do not see people get teams as approved, with no drafts. Another day needs
// every class of data other dates need. On another day, only teams with members then, or with a
// draft, are listed.
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
      const everyone = await readMembers(
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
          const names = namesSeen(sight, team, before);
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
              names,
              ...hiresNamed(names, everyone),
              ...hireDaysOn(team, before, live.since.get(id), sight),
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
