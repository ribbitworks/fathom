// SPDX-License-Identifier: Apache-2.0

// What filling a planned hire carries to its person's feature teams and leads, shared by the server
// and the fill form.

import { bySubject, inForceOn, inForceOrLater } from "./in-force.ts";

// Whether someone is on a team today or will be, by their records on it: the one in force today
// has them on it, or a later one does.
export function onTeamTodayOrLater(
  records: readonly { member: boolean; fromDate: string }[],
  today: string,
): boolean {
  const earliestFirst = [...records].sort((one, other) =>
    one.fromDate.localeCompare(other.fromDate),
  );
  return earliestFirst.some(
    (record) => record.member && inForceOrLater(record, earliestFirst, today),
  );
}

// A record of a planned hire on a team from a day: as a member, joining or leaving, or as its lead,
// leading or, as another lead's record, no longer.
export interface HireOnTeam {
  teamId: string;
  member: boolean;
  fromDate: string;
}

export interface CarriedOnFill {
  // The records the person takes, on the teams the hire is on or leads today or later.
  person: (HireOnTeam & { memberId: string })[];
  // For each team carried, the day the hire's records end, from which the person takes its place,
  // and whether the hire is on the team, or leads it, just before.
  ended: { teamId: string; fromDate: string; wasOn: boolean }[];
}

// What filling a planned hire carries to its person, for memberships and leads alike: each of the
// hire's records in force today or later, from the latest of its own day, the person's start date
// and today, so no day before the fill is approved changes, the latest of those moved to one day
// winning. Each team's records start where the hire is first on it, and the hire's own records end
// from that day. On a team the person is on today or later by their own records, theirs stay and
// nothing is carried to them, though the hire's still end.
export function carriedOnFill(
  hireRows: readonly HireOnTeam[],
  person: string,
  startDate: string | null,
  today: string,
  personRows: readonly HireOnTeam[] = [],
): CarriedOnFill {
  const carried: CarriedOnFill = { person: [], ended: [] };
  const earliest = startDate !== null && startDate > today ? startDate : today;
  const ownTeams = bySubject(personRows, (row) => row.teamId);
  for (const [teamId, records] of bySubject(hireRows, (row) => row.teamId)) {
    // Records come earliest first, so a later one moved to the same day replaces an earlier one.
    const byDay = new Map<string, boolean>();
    for (const record of records) {
      if (!inForceOrLater(record, records, today)) continue;
      const day = record.fromDate < earliest ? earliest : record.fromDate;
      byDay.set(day, record.member);
    }
    const days = [...byDay];
    const firstOn = days.findIndex(([, member]) => member);
    if (firstOn === -1) continue;
    const kept = days.slice(firstOn);
    const [from] = kept[0] as [string, boolean];
    if (!onTeamTodayOrLater(ownTeams.get(teamId) ?? [], today)) {
      carried.person.push(
        ...kept.map(([fromDate, member]) => ({
          teamId,
          memberId: person,
          member,
          fromDate,
        })),
      );
    }
    carried.ended.push({
      teamId,
      fromDate: from,
      wasOn:
        records.findLast((record) => record.fromDate < from)?.member === true,
    });
  }
  return carried;
}

// The lead records a fill writes for its person: each team's carried lead, kept only on the days the
// person is on the team, by the records carried to them or else by their own, with no lead on the
// days they are off it, so a lead is always a member. Another lead's days are left to them.
export function leadsWhileOn(
  leads: Pick<CarriedOnFill, "person">,
  memberships: Pick<CarriedOnFill, "person">,
  personRows: readonly HireOnTeam[],
  person: string,
): LeadWritten[] {
  const carried = bySubject(memberships.person, (row) => row.teamId);
  const own = bySubject(personRows, (row) => row.teamId);
  const written: LeadWritten[] = [];
  for (const [teamId, leadRecords] of bySubject(
    leads.person,
    (row) => row.teamId,
  )) {
    const onTeam = carried.get(teamId) ?? own.get(teamId) ?? [];
    const from = (leadRecords[0] as HireOnTeam).fromDate;
    const days = [
      ...new Set(
        [...leadRecords, ...onTeam]
          .map(({ fromDate }) => fromDate)
          .filter((day) => day >= from),
      ),
    ].sort();
    let was: string | null | undefined;
    for (const day of days) {
      const leads = inForceOn(leadRecords, day)?.member === true;
      const on = inForceOn(onTeam, day)?.member === true;
      const now = leads ? (on ? person : null) : undefined;
      if (now !== undefined && now !== was) {
        written.push({ teamId, fromDate: day, leadId: now });
      }
      was = now;
    }
  }
  return written;
}

// A lead record a fill writes for its person: them leading the team from a day, or no lead.
export interface LeadWritten {
  teamId: string;
  fromDate: string;
  leadId: string | null;
}

// What a fill carries, for memberships and leads: the person's membership records and the hire's
// that end, the hire's lead records that end, and the lead records written for the person.
export interface Carried {
  memberships: CarriedOnFill;
  leadsEnded: CarriedOnFill["ended"];
  leads: LeadWritten[];
}

// What filling a hire, by its records on teams and those of the teams it leads, carries to a person,
// by their start date and their own records on teams.
export function carriedByFill(
  hire: { memberships: readonly HireOnTeam[]; leads: readonly HireOnTeam[] },
  person: {
    id: string;
    startDate: string | null;
    teams: readonly HireOnTeam[];
  },
  today: string,
): Carried {
  const memberships = carriedOnFill(
    hire.memberships,
    person.id,
    person.startDate,
    today,
    person.teams,
  );
  const leads = carriedOnFill(hire.leads, person.id, person.startDate, today);
  return {
    memberships,
    leadsEnded: leads.ended,
    leads: leadsWhileOn(leads, memberships, person.teams, person.id),
  };
}

// The teams a fill puts its person on, and those it has them lead, each from the first day it does,
// by team. A team's carried records start with the person on it.
export function joinedAndLed(
  { memberships, leads }: Carried,
  person: string,
): { joins: Map<string, string>; leads: Map<string, string> } {
  const firstDays = (
    records: readonly { teamId: string; fromDate: string }[],
  ) =>
    new Map(
      [...bySubject(records, ({ teamId }) => teamId)].map(
        ([teamId, ofTeam]) => [
          teamId,
          (ofTeam[0] as { fromDate: string }).fromDate,
        ],
      ),
    );
  return {
    joins: firstDays(memberships.person),
    leads: firstDays(leads.filter(({ leadId }) => leadId === person)),
  };
}
