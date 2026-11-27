// SPDX-License-Identifier: Apache-2.0

// A fictional organization's feature teams, first formed and then grown over two years.

import { addDays, addMonths, monthOf } from "@fathom/shared";
import { fictionalId } from "./fictional-id.ts";
import {
  featureTeamMembers,
  fillingHires,
  firstUnnamed,
  lastOnNoTeam,
} from "./left-as-they-are.ts";
import type {
  FictionalFeatureTeam,
  FictionalHire,
  FictionalPerson,
} from "./types.ts";

// The feature teams, as the organization's feature teams list says, from people current on the
// reference date, oldest starters first, so the same people lead them on every run.
const featureTeamJoinedDaysAgo = 300;
const featureTeamLeftDaysAgo = 153;

const featureTeamPlans: readonly {
  name: string;
  colour: string | null;
  size: number;
  lead: boolean;
}[] = [
  { name: "Payments core", colour: "teal", size: 5, lead: true },
  { name: "Search", colour: "indigo", size: 4, lead: true },
  { name: "Platform reliability", colour: null, size: 3, lead: false },
  { name: "Mobile apps", colour: "orange", size: 4, lead: true },
];

export function featureTeamsFor(
  people: readonly FictionalPerson[],
  referenceDate: string,
): FictionalFeatureTeam[] {
  const current = people
    .filter(
      ({ startDate, endDate }) =>
        String(startDate) <= referenceDate && endDate === null,
    )
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  const joined = addDays(referenceDate, -featureTeamJoinedDaysAgo);
  let next = 0;
  return featureTeamPlans.map((plan, index) => {
    const members = current.slice(next, next + plan.size);
    next += plan.size - (index === 0 ? 1 : 0);
    const memberships = members.map(({ id, startDate }) => ({
      personId: id,
      member: true,
      fromDate: String(startDate) > joined ? String(startDate) : joined,
    }));
    // The last team had one more member, who left it.
    const leaver = current.at(next + plan.size);
    if (index === featureTeamPlans.length - 1 && leaver !== undefined) {
      memberships.push(
        { personId: leaver.id, member: true, fromDate: joined },
        {
          personId: leaver.id,
          member: false,
          fromDate: addDays(referenceDate, -featureTeamLeftDaysAgo),
        },
      );
    }
    return {
      id: fictionalId(`feature-team:${plan.name}`),
      name: plan.name,
      leadId: plan.lead ? (members[0]?.id ?? null) : null,
      colour: plan.colour,
      memberships,
    };
  });
}

// Feature teams added after the first, with joins spread over two years so their history shows.
const grownTeams: readonly {
  name: string;
  colour: string | null;
  size: number;
  leadChange?: boolean;
  joining?: boolean;
}[] = [
  { name: "Field tools", colour: "grape", size: 12 },
  { name: "Data pipeline", colour: "lime", size: 12, leadChange: true },
  { name: "Identity", colour: "pink", size: 11 },
  { name: "Integrations", colour: "green", size: 10, joining: true },
];

// How many join the third and fourth teams, after their first members.
const grownMembers = 3;
const grownTeamsJoinedDaysAgo = 700;
const newestJoinDaysAgo = 30;
const joinSpacingDays = 53;
const leadChangedDaysAgo = 200;
const movedDaysAgo = 120;
const joiningInDays = 30;
// One in this many joining a grown team after the first moved there from the team before it.
const movedEvery = 9;

// Grows the teams after people's end dates are set, from current people who manage no one, after
// those the seed data's drafts name, apart from those filling hires and the person a draft adds to a
// team, so nothing worked out before changes.
export function growFeatureTeams(
  people: readonly FictionalPerson[],
  hires: readonly FictionalHire[],
  featureTeams: FictionalFeatureTeam[],
  referenceDate: string,
): void {
  const onTeams = featureTeamMembers(featureTeams);
  const filling = fillingHires(hires);
  const joining = lastOnNoTeam(people, featureTeams, referenceDate);
  const free = people
    .slice(firstUnnamed)
    .filter(
      (person) =>
        person !== joining &&
        person.endDate === null &&
        String(person.startDate) <= referenceDate &&
        !person.isManager &&
        !onTeams.has(person.id) &&
        !filling.has(person.id),
    );
  let next = 0;
  const take = (count: number) => {
    const taken = free.slice(next, next + count);
    next += count;
    return taken;
  };
  const later = (person: FictionalPerson, day: string) =>
    String(person.startDate) > day ? String(person.startDate) : day;
  // Joined some time in the last two years, or when they started, if later.
  const joinedDay = (person: FictionalPerson, turn: number) =>
    later(
      person,
      addDays(
        referenceDate,
        -(
          newestJoinDaysAgo +
          ((turn * joinSpacingDays) % grownTeamsJoinedDaysAgo)
        ),
      ),
    );
  featureTeams.slice(2).forEach((team, index) => {
    for (const [turn, person] of take(grownMembers).entries()) {
      team.memberships.push({
        personId: person.id,
        member: true,
        fromDate: joinedDay(person, turn + index * grownMembers),
      });
    }
  });
  const earliest = addDays(referenceDate, -grownTeamsJoinedDaysAgo);
  const fromStart = (person: FictionalPerson) => later(person, earliest);
  const until = addDays(referenceDate, -leadChangedDaysAgo);
  const grown = grownTeams.map((plan, index): FictionalFeatureTeam => {
    const members = take(plan.size);
    // The earliest starters lead, from the team's start: one before the other where it changed.
    const [first, second] = [...members].sort((a, b) =>
      String(a.startDate).localeCompare(String(b.startDate)),
    );
    const changed =
      plan.leadChange === true &&
      first !== undefined &&
      second !== undefined &&
      fromStart(second) < until;
    const leads = new Set([first, ...(changed ? [second] : [])]);
    const memberships = members.map((person, turn) => ({
      personId: person.id,
      member: true,
      fromDate: leads.has(person)
        ? fromStart(person)
        : joinedDay(person, turn + index),
    }));
    return {
      id: fictionalId(`feature-team:${plan.name}`),
      name: plan.name,
      leadId: (changed ? second : first)?.id ?? null,
      colour: plan.colour,
      memberships,
      ...(changed ? { formerLead: { personId: first.id, until } } : {}),
    };
  });
  // Some moved from the team before, leaving it the day they joined; they had been on it from its
  // start, or from when they started, if later.
  const moved = addDays(referenceDate, -movedDaysAgo);
  grown.forEach((team, index) => {
    const before = index === 0 ? undefined : grown.at(index - 1);
    if (before === undefined) return;
    team.memberships.forEach((membership, turn) => {
      if (turn % movedEvery !== movedEvery - 1) return;
      const person = people.find(({ id }) => id === membership.personId);
      const leads = [team.leadId, team.formerLead?.personId];
      if (
        person === undefined ||
        leads.includes(person.id) ||
        fromStart(person) >= moved
      ) {
        return;
      }
      before.memberships.push(
        { personId: person.id, member: true, fromDate: fromStart(person) },
        { personId: person.id, member: false, fromDate: moved },
      );
      membership.fromDate = moved;
    });
  });
  const [planned] = take(1);
  const joiningTeam = grown.at(
    grownTeams.findIndex(({ joining: ahead }) => ahead === true),
  );
  if (planned !== undefined && joiningTeam !== undefined) {
    joiningTeam.memberships.push({
      personId: planned.id,
      member: true,
      fromDate: addDays(referenceDate, joiningInDays),
    });
  }
  // An organization too small to fill a team adds none.
  featureTeams.push(
    ...grown.filter(({ memberships }) => memberships.length > 0),
  );
}

// The team two planned hires join: the late open hire from the first day of the month it was
// expected, and the planned manager, which has no target date, joining and leading it from the first
// day of the month this many months ahead, so the chart shows a hire heading a team then.
const hiresTeam = "Field tools";
const lateHire = "REQ-2053";
const hireLeadsInMonths = 3;

const firstOfMonth = (day: string) => `${monthOf(day)}-01`;

// Puts two planned hires on a grown team, which no draft the seed data makes changes, so filling one
// of them carries the team; an organization too small for the team, or the hires, puts none.
export function hiresOnTeams(
  hires: readonly FictionalHire[],
  featureTeams: readonly FictionalFeatureTeam[],
  referenceDate: string,
): void {
  const team = featureTeams.find(({ name }) => name === hiresTeam);
  const late = hires.find(({ requisition }) => requisition === lateHire);
  const planned = hires.find(
    ({ isManager, managerId, filledBy }) =>
      isManager && managerId === null && filledBy === null,
  );
  if (team === undefined || late === undefined || planned === undefined) {
    return;
  }
  team.hires = [
    {
      plannedHireId: late.id,
      fromDate: firstOfMonth(String(late.targetDate)),
      leads: false,
    },
    {
      plannedHireId: planned.id,
      fromDate: firstOfMonth(addMonths(referenceDate, hireLeadsInMonths)),
      leads: true,
    },
  ];
}
