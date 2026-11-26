// SPDX-License-Identifier: Apache-2.0

// The rules for drafting a change to a feature team, and the refusals of its members, lead, name
// and days, as pure functions of what the data access layer reads.

import {
  type ClassAccess,
  type FeatureTeamChange,
  seesEmployment,
} from "@fathom/shared";
import { type Recorded, tidy } from "./draft-records.ts";
import { inForceOn, inForceOrLater } from "./in-force.ts";
import { currentOn, notStarted } from "./people-reads.ts";
import { text } from "./reporting.ts";

const chooseFromPeople = "Choose members from People";

export type Person = Recorded & {
  kind: "person";
  preferredName: string;
  started: boolean;
  left: boolean;
};

// A planned hire on feature teams, named as allocations name it. It has no start or end date, so it
// is never hidden as not started or left.
export interface PlannedHire {
  kind: "planned-hire";
  preferredName: string;
}

export type Member = Person | PlannedHire;

// Everyone a team names, by identifier: people and planned hires, whose identifiers never collide.
export type Everyone = ReadonlyMap<string, Member>;

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

export const datesOf = (team: Recorded | undefined): Record<string, string> =>
  daysIn(team?.memberFrom);

export const leadDatesOf = (
  team: Recorded | undefined,
): Record<string, string> => daysIn(team?.leadFrom);

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

// What is wrong with the members and lead a team is to have: members added who are not live people,
// or who have left, or whom the actor may not see, as People hides them, or a lead who is not one of
// the members; undefined when nothing is.
export function membersRefusal(
  access: ClassAccess,
  added: readonly string[],
  members: readonly string[],
  leadId: unknown,
  everyone: Everyone,
): string | undefined {
  const seesPeople = seesEmployment(access);
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
  }
  return typeof leadId === "string" && !members.includes(leadId)
    ? "The feature lead must be one of the members"
    : undefined;
}

// A person or planned hire joining or leaving a team from a day, or becoming its lead.
export interface MemberDay {
  teamId: string;
  memberId: string;
  from: string;
}

// A record of a person or planned hire joining or leaving a team from a day.
export interface MemberRecord {
  teamId: string;
  memberId: string;
  fromDate: string;
}

export type DayRefusal = (day: MemberDay) => string;
type OrderRefusal = (day: MemberDay, last: string) => string;

export interface DayRefusals {
  outOfOrder: OrderRefusal;
  beforeStart: DayRefusal;
  afterEnd: DayRefusal;
}

// Only those who see the exact days choose another day, so they are told them.
export const draftingRefusals: DayRefusals = {
  outOfOrder: (_, last) =>
    `This person last joined or left this team on ${last}. Choose a later date.`,
  beforeStart: () =>
    "Someone can't join or leave a team before their start date",
  afterEnd: () => "Someone can't join or leave a team after their end date",
};

// Why a day falls outside someone's employment, or undefined when it does not.
export function employmentDayRefusal(
  day: MemberDay,
  everyone: Everyone,
  refusals: DayRefusals,
): string | undefined {
  const person = { ...everyone.get(day.memberId) };
  if (notStarted(person, day.from)) return refusals.beforeStart(day);
  if (leftBy(person, day.from)) return refusals.afterEnd(day);
  return undefined;
}

// Why one of the days would never take effect, or undefined when each can: each must be after the
// person's latest record on that team, and between their start and end dates.
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
      return refusals.outOfOrder(day, last);
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
}

// A team's draft with a change made, from the day given, or from today when none is: the team as it
// is live, before, and as its draft makes it now. Adding someone the draft already adds, or removing
// someone it already removes, moves their change to the day given.
export function nextTeamDraft(
  { before, team }: { before: Recorded | undefined; team: Recorded },
  change: FeatureTeamChange,
  { from, today }: { from: string | undefined; today: string },
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
  // A day is kept for each member a draft adds or removes, so approving it records when; a change
  // taken back leaves none.
  const days = new Map(Object.entries(datesOf(team)));
  for (const memberId of dayPeople) {
    if (from === undefined) days.delete(memberId);
    else days.set(memberId, from);
  }
  const dates = new Map(
    [...days].filter(
      ([memberId]) =>
        members.includes(memberId) !== wasMembers.includes(memberId),
    ),
  );
  // A change of lead keeps its own day, set only by the edit that changes the lead, and held
  // under the new lead, or the old one when none replaces them.
  const wasLead = text(before?.leadId);
  const setsLead = change.leadId !== undefined || leadId !== text(team.leadId);
  const [keptLeadDay] = Object.values(leadDatesOf(team));
  const leadDay = setsLead ? from : keptLeadDay;
  return {
    after: tidy({
      name: change.name ?? team.name,
      leadId,
      members,
      ...(dates.size === 0 ? {} : { memberFrom: Object.fromEntries(dates) }),
      ...(leadId === wasLead || leadDay === undefined
        ? {}
        : { leadFrom: { [String(leadId ?? wasLead)]: leadDay } }),
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
  };
}
