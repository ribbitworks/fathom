// SPDX-License-Identifier: Apache-2.0

// The rules for drafting a change to a feature team, and the refusals of its members, lead, name
// and days, as pure functions of what the data access layer reads.

import {
  type ClassAccess,
  type FeatureTeamChange,
  monthInWords,
  monthOf,
  seesEmployment,
  seesHiringPlan,
} from "@fathom/shared";
import { type Recorded, tidy } from "./draft-records.ts";
import { bySubject, inForceOn, inForceOrLater } from "./in-force.ts";
import { currentOn, notStarted } from "./people-reads.ts";
import { text } from "./reporting.ts";

const chooseFromPeople = "Choose members from People";

export type Person = Recorded & {
  kind: "person";
  preferredName: string;
  started: boolean;
  left: boolean;
};

// A planned hire on feature teams, joining them from the first day of the month it's expected, as
// allocations count it. It has no start or end date, so it is never hidden as not started or left.
// Its name, ID and position's label name it as People does.
export interface PlannedHire {
  kind: "planned-hire";
  preferredName: string;
  name: string | null;
  shownId: string;
  position: string;
  firstDay: string;
  // Whether a date gives the month it's expected, rather than its standing in for the day read.
  dated: boolean;
  filledBy: string | null;
  removing: boolean;
}

export type Member = Person | PlannedHire;

// Everyone a team names, by identifier: people and planned hires, whose identifiers never collide.
export type Everyone = ReadonlyMap<string, Member>;

export const isPlannedHire = (everyone: Everyone, id: string): boolean =>
  everyone.get(id)?.kind === "planned-hire";

// Whether a member is a person whose end date has passed.
export const hasLeft = (member: Member | undefined): boolean =>
  member?.kind === "person" && member.left;

// Whether a member is a person whose start date is still to come.
export const notYetStarted = (member: Member | undefined): boolean =>
  member?.kind === "person" && !member.started;

export const membersOf = (team: Recorded | undefined): string[] =>
  Array.isArray(team?.members) ? team.members.map(String) : [];

export const daysIn = (value: unknown): Record<string, string> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, string>)
    : {};

// The days a team's draft gives members joining or leaving, people's and planned hires', which are
// held apart, since a planned hire's days are General and people's are Feature team dates.
export const datesOf = (
  team: Recorded | undefined,
): Record<string, string> => ({
  ...daysIn(team?.memberFrom),
  ...daysIn(team?.hireFrom),
});

// The day a team's draft changes its lead, held under the lead, a person's or a planned hire's.
export const leadDatesOf = (
  team: Recorded | undefined,
): Record<string, string> => ({
  ...daysIn(team?.leadFrom),
  ...daysIn(team?.hireLeadFrom),
});

// Whether the days a change gives are planned hires' alone, so General: it dates someone, and each
// is a planned hire, as are the live and the new lead of a change of lead it dates. A change dating
// a person, or no one, as a rename does, keeps every day it gives with people's, in Feature team
// dates, so no day it gives says when a person joins, leaves or stops leading.
export function datesOnlyHires(
  memberIds: readonly string[],
  leads: readonly (string | null)[],
  isHire: (id: string) => boolean,
): boolean {
  const dated = [
    ...memberIds,
    ...leads.filter((lead): lead is string => lead !== null),
  ];
  return dated.length > 0 && dated.every(isHire);
}

// The fields holding the days a change gives members and its lead: planned hires' own when it dates
// only them, or people's.
export function dayFields(
  days: readonly [string, string][],
  leadDay: [string, string] | undefined,
  onlyHires: boolean,
): Recorded {
  return {
    ...(days.length === 0
      ? {}
      : {
          [onlyHires ? "hireFrom" : "memberFrom"]: Object.fromEntries(days),
        }),
    ...(leadDay === undefined
      ? {}
      : {
          [onlyHires ? "hireLeadFrom" : "leadFrom"]: Object.fromEntries([
            leadDay,
          ]),
        }),
  };
}

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

// Whether what a fill carries puts its person on a team, or leading one, after their end date.
export const joinsAfterEnd = (
  carried: Pick<CarriedOnFill, "person">,
  endDate: string | null,
): boolean =>
  endDate !== null &&
  carried.person.some(({ member, fromDate }) => member && fromDate > endDate);

// The teams whose drafts a fill of the hire waits on: each draft, published or not, that names the
// hire as a member or its lead, or is of a team the hire is on or leads today or later, since
// approving it would change what the fill carries, or act on a place the person then holds.
export function teamDraftsBlockingFill(
  drafts: readonly { teamId: string; fields: Recorded }[],
  hireTeams: readonly string[],
  hireId: string,
): string[] {
  return drafts
    .filter(
      ({ teamId, fields }) =>
        hireTeams.includes(teamId) ||
        fields.leadId === hireId ||
        membersOf(fields).includes(hireId),
    )
    .map(({ teamId }) => teamId);
}

// The lead records a fill writes for its person: each team's carried lead, kept only on the days the
// person is on the team, by the records carried to them or else by their own, with no lead on the
// days they are off it, so a lead is always a member. Another lead's days are left to them.
export function leadsWhileOn(
  leads: Pick<CarriedOnFill, "person">,
  memberships: Pick<CarriedOnFill, "person">,
  personRows: readonly HireOnTeam[],
  person: string,
): { teamId: string; fromDate: string; leadId: string | null }[] {
  const carried = bySubject(memberships.person, (row) => row.teamId);
  const own = bySubject(personRows, (row) => row.teamId);
  const written: { teamId: string; fromDate: string; leadId: string | null }[] =
    [];
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

// Who joins and who leaves from one team to another.
export function memberChanges(
  before: Recorded | undefined,
  after: Recorded | undefined,
): { added: string[]; removed: string[] } {
  const was = membersOf(before);
  const will = membersOf(after);
  return {
    added: will.filter((one) => !was.includes(one)),
    removed: was.filter((one) => !will.includes(one)),
  };
}

// Whether someone's end date has passed by a day.
export const leftBy = (person: Recorded, day: string): boolean =>
  !notStarted(person, day) && !currentOn(person, day);

// Whether another team has a name, ignoring letter case.
export function nameIsTaken(
  names: readonly [string, string][],
  name: string,
  except: string,
): boolean {
  const lowered = name.trim().toLowerCase();
  return names.some(
    ([id, other]) => id !== except && other.trim().toLowerCase() === lowered,
  );
}

// Why a planned hire can't join or lead a team: it is filled, so its person takes its place, or a
// draft removes it; undefined when it can. A reader told neither why is told only that it can't: one
// who doesn't see Personal details isn't shown a fill before its person starts, and one who doesn't
// see the hiring plan isn't shown its drafts.
export function plannedHireRefusal(
  hire: PlannedHire,
  sees: { fill: boolean; drafts: boolean },
): string | undefined {
  const cantJoin = "This planned hire can't join or lead a team.";
  if (hire.filledBy !== null) {
    return sees.fill
      ? "This planned hire has been filled. Choose the person who filled it."
      : cantJoin;
  }
  if (!hire.removing) return undefined;
  return sees.drafts
    ? "This planned hire is drafted to be removed, so it can't join or lead a team."
    : cantJoin;
}

// What is wrong with the members and lead a team is to have: members added who are not live people
// or planned hires, or who have left, or whom the actor may not see, as People hides them, planned
// hires that can't join, or a lead who is not one of the members or is a planned hire that can't
// lead; undefined when nothing is.
export function membersRefusal(
  access: ClassAccess,
  added: readonly string[],
  members: readonly string[],
  leadId: unknown,
  everyone: Everyone,
): string | undefined {
  const seesPeople = seesEmployment(access);
  const sees = { fill: seesPeople, drafts: seesHiringPlan(access) };
  for (const memberId of added) {
    const member = everyone.get(memberId);
    // Someone hidden from the actor is not there for them, as People hides them.
    if (
      member === undefined ||
      (!seesPeople && (notYetStarted(member) || hasLeft(member)))
    ) {
      return chooseFromPeople;
    }
    if (hasLeft(member)) return "Someone who has left can't join a team";
    const refusal =
      member.kind === "planned-hire"
        ? plannedHireRefusal(member, sees)
        : undefined;
    if (refusal !== undefined) return refusal;
  }
  if (typeof leadId !== "string") return undefined;
  if (!members.includes(leadId)) {
    return "The feature lead must be one of the members";
  }
  const lead = everyone.get(leadId);
  return lead?.kind === "planned-hire"
    ? plannedHireRefusal(lead, sees)
    : undefined;
}

// A person or planned hire joining or leaving a team from a day, or becoming its lead.
export interface MemberDay {
  teamId: string;
  memberId: string;
  from: string;
  leaves?: true;
}

// A record of a person or planned hire joining or leaving a team from a day.
export interface MemberRecord {
  teamId: string;
  memberId: string;
  fromDate: string;
}

export type DayRefusal = (day: MemberDay) => string;
type OrderRefusal = (
  day: MemberDay,
  last: string,
  kind: Member["kind"],
) => string;

export interface DayRefusals {
  outOfOrder: OrderRefusal;
  beforeStart: DayRefusal;
  afterEnd: DayRefusal;
  // Given the month the planned hire is expected, which is General.
  beforeExpected: (day: MemberDay, month: string) => string;
}

const whoOf = (kind: Member["kind"]) =>
  kind === "planned-hire" ? "This planned hire" : "This person";

// Only those who see the exact days choose another day, so they are told them.
export const draftingRefusals: DayRefusals = {
  outOfOrder: (_, last, kind) =>
    `${whoOf(kind)} last joined or left this team on ${last}. Choose a later date.`,
  beforeStart: () =>
    "Someone can't join or leave a team before their start date",
  afterEnd: () => "Someone can't join or leave a team after their end date",
  beforeExpected: (_, month) =>
    `This planned hire is expected in ${month}. Choose a day from then on.`,
};

// Why a day falls outside someone's employment, or a planned hire joins before the month it's
// expected, or undefined when it does not. A planned hire may leave earlier, as when its target date
// moved later after it joined.
export function employmentDayRefusal(
  day: MemberDay,
  everyone: Everyone,
  refusals: DayRefusals,
): string | undefined {
  const member = everyone.get(day.memberId);
  if (member?.kind === "planned-hire") {
    return day.leaves !== true && day.from < member.firstDay
      ? refusals.beforeExpected(day, monthInWords(monthOf(member.firstDay)))
      : undefined;
  }
  const person = { ...member };
  if (notStarted(person, day.from)) return refusals.beforeStart(day);
  if (leftBy(person, day.from)) return refusals.afterEnd(day);
  return undefined;
}

// Why a planned hire can't join or leave a team on one of the days, before the month it's expected,
// or undefined when each can. People's days are left alone, since only a day chosen is checked
// against their dates.
export function plannedHireDaysRefusal(
  days: readonly MemberDay[],
  everyone: Everyone,
  refusals: DayRefusals,
): string | undefined {
  return days
    .filter(({ memberId }) => isPlannedHire(everyone, memberId))
    .map((day) => employmentDayRefusal(day, everyone, refusals))
    .find((refusal) => refusal !== undefined);
}

// Why one of the days would never take effect, or undefined when each can: each must be after the
// member's latest record on that team, and between a person's start and end dates, or from the
// month a planned hire is expected.
export function daysRefusal(
  days: readonly MemberDay[],
  records: readonly MemberRecord[],
  everyone: Everyone,
  refusals: DayRefusals,
): string | undefined {
  const key = (teamId: string, memberId: string) => `${teamId} ${memberId}`;
  const latest = new Map<string, string>();
  for (const { teamId, memberId, fromDate } of records) {
    const last = latest.get(key(teamId, memberId));
    if (last === undefined || fromDate > last) {
      latest.set(key(teamId, memberId), fromDate);
    }
  }
  for (const day of days) {
    const last = latest.get(key(day.teamId, day.memberId));
    if (last !== undefined && day.from <= last) {
      return refusals.outOfOrder(
        day,
        last,
        everyone.get(day.memberId)?.kind ?? "person",
      );
    }
    const refusal = employmentDayRefusal(day, everyone, refusals);
    if (refusal !== undefined) return refusal;
  }
  return undefined;
}

// Why a team's lead can't change from a day, which must be after the team's latest change of lead.
export function leadDayRefusal(
  from: string,
  leadDates: readonly string[],
): string | undefined {
  const last = [...leadDates].sort().at(-1);
  return last !== undefined && from <= last
    ? `This team's lead last changed on ${last}. Choose a later date.`
    : undefined;
}

// Why someone can't lead a team from a day they are not on it: by the day they join in the draft,
// when they do, or otherwise by their records on the team.
export function leadOffTeamRefusal(
  records: readonly { member: boolean; fromDate: string }[],
  from: string,
  joinsOn: string | undefined,
): string | undefined {
  const earliestFirst = [...records].sort((one, other) =>
    one.fromDate.localeCompare(other.fromDate),
  );
  const onTeam =
    joinsOn === undefined
      ? inForceOn(earliestFirst, from)?.member === true
      : joinsOn <= from;
  return onTeam ? undefined : "Choose a day when the new lead is on this team";
}

// A team's draft once a change is made to it, with what drafting must check before keeping it.
export interface NextTeamDraft {
  after: Recorded;
  added: string[];
  members: string[];
  leadId: string | null;
  // Those whose change the draft makes, moves to another day, or takes back.
  dayPeople: string[];
  // Those of dayPeople the draft keeps a day for.
  dated: string[];
  leadChanges: boolean;
  // The day the lead joins in this draft, when the draft adds them.
  leadJoinsOn: string | undefined;
  // Whether the days the change gives are planned hires' alone, as datesOnlyHires sets out.
  datesOnlyHires: boolean;
}

// A team's draft with a change made, from the day given, or from today when none is: the team as it
// is live, before, and as its draft makes it now. Adding someone the draft already adds, or removing
// someone it already removes, moves their change to the day given.
export function nextTeamDraft(
  { before, team }: { before: Recorded | undefined; team: Recorded },
  change: FeatureTeamChange,
  {
    from,
    today,
    isHire = () => false,
  }: {
    from: string | undefined;
    today: string;
    isHire?: (id: string) => boolean;
  },
): NextTeamDraft {
  const current = membersOf(team);
  // A lead chosen from outside the team joins it, so the lead is always a member.
  const asked = [
    ...(change.add ?? []),
    ...(typeof change.leadId === "string" ? [change.leadId] : []),
  ];
  const added = [...new Set(asked)].filter((one) => !current.includes(one));
  const removed = (change.remove ?? []).filter((one) => current.includes(one));
  const wasMembers = membersOf(before);
  const redated = [
    ...(change.add ?? []).filter(
      (one) => current.includes(one) && !wasMembers.includes(one),
    ),
    ...(change.remove ?? []).filter(
      (one) => !current.includes(one) && wasMembers.includes(one),
    ),
  ];
  const members = [
    ...current.filter((one) => !removed.includes(one)),
    ...added,
  ].sort();
  // A lead who leaves the team leaves it with no lead, unless another is chosen.
  const leadId =
    change.leadId !== undefined
      ? change.leadId
      : removed.includes(String(team.leadId))
        ? null
        : text(team.leadId);
  const dayPeople = [...added, ...removed, ...redated];
  const wasLead = text(before?.leadId);
  const setsLead = change.leadId !== undefined || leadId !== text(team.leadId);
  const onlyHires = datesOnlyHires(
    dayPeople,
    setsLead && leadId !== wasLead ? [wasLead, leadId] : [],
    isHire,
  );
  // A day is kept for each member a draft adds or removes, so approving it records when, where the
  // change that gave it held it; a change taken back leaves none.
  const personDays = new Map(Object.entries(daysIn(team.memberFrom)));
  const hireDays = new Map(Object.entries(daysIn(team.hireFrom)));
  for (const memberId of dayPeople) {
    personDays.delete(memberId);
    hireDays.delete(memberId);
    if (from !== undefined) {
      (onlyHires ? hireDays : personDays).set(memberId, from);
    }
  }
  const changesMember = ([memberId]: [string, string]) =>
    members.includes(memberId) !== wasMembers.includes(memberId);
  const keptPersonDays = [...personDays].filter(changesMember);
  const keptHireDays = [...hireDays].filter(changesMember);
  const dates = new Map([...keptPersonDays, ...keptHireDays]);
  // A change of lead keeps its own day, set only by the edit that changes the lead, and held
  // under the new lead, or the old one when none replaces them.
  const [keptLeadDay] = Object.values(leadDatesOf(team));
  const leadDay = setsLead ? from : keptLeadDay;
  const leadByHires = setsLead
    ? onlyHires
    : Object.keys(daysIn(team.hireLeadFrom)).length > 0;
  return {
    after: tidy({
      name: change.name ?? team.name,
      leadId,
      members,
      ...dayFields(keptPersonDays, undefined, false),
      ...dayFields(keptHireDays, undefined, true),
      ...(leadId === wasLead || leadDay === undefined
        ? {}
        : dayFields([], [String(leadId ?? wasLead), leadDay], leadByHires)),
    }),
    added,
    members,
    leadId,
    dayPeople,
    dated: dayPeople.filter((memberId) => dates.has(memberId)),
    leadChanges: setsLead && leadId !== wasLead,
    leadJoinsOn:
      leadId === null || wasMembers.includes(leadId)
        ? undefined
        : (dates.get(leadId) ?? today),
    datesOnlyHires: onlyHires,
  };
}
