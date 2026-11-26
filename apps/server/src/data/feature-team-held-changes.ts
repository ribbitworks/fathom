// SPDX-License-Identifier: Apache-2.0

// The rules for taking a change of someone's teams from a day or a month, beside what a team's draft
// and its approved records already hold, as pure functions of what the data access layer reads.

import { type FeatureTeamChange, monthOf } from "@fathom/shared";
import type { Recorded } from "./draft-records.ts";
import {
  datesOf,
  type DayRefusals,
  draftingRefusals,
  type Everyone,
  hasLeft,
  membersOf,
} from "./feature-team-rules.ts";

// Refusals for a change of someone's teams from a month, naming the person and the team, by month
// alone, as the monthly grid shows them.
export function monthRefusals(
  personName: string,
  teamName: string,
): DayRefusals {
  return {
    ...draftingRefusals,
    outOfOrder: () =>
      `${personName} has an approved change on ${teamName} in this month or later, so this month can't change here.`,
    beforeExpected: (_, month) =>
      `This planned hire is expected in ${month}. Choose a month from then on.`,
  };
}

// How a change from a day is spoken of: by its month, as the monthly grid and readers who plan by
// month see it, or by its date.
export type Period = "month" | "date";

const samePeriod = (period: Period, one: string, other: string) =>
  period === "month" ? monthOf(one) === monthOf(other) : one === other;

export type HeldTeamChange = { changes: boolean } | { refusal: string };

// Whether a change of someone's team from a day changes anything, or why the team's draft can't
// hold it beside what it holds already, since it holds one change for each person: one the approved
// records make before the day and after today, or one the draft makes from another month or date.
export function heldTeamChange(
  {
    before,
    team,
  }: { before: Recorded | undefined; team: Recorded | undefined },
  personId: string,
  { member, liveOnDay }: { member: boolean; liveOnDay: boolean },
  { day, today, period }: { day: string; today: string; period: Period },
  { personName, teamName }: { personName: string; teamName: string },
): HeldTeamChange {
  // A team its draft removes is refused when the change is drafted.
  if (team === undefined) return { changes: true };
  const live = membersOf(before).includes(personId);
  const drafted = membersOf(team).includes(personId);
  if (drafted === live) {
    if (member !== live) return { changes: true };
    if (member === liveOnDay) return { changes: false };
    return {
      refusal: `${personName} has an approved change on ${teamName} before this ${period}. This ${period} can change once it takes effect.`,
    };
  }
  if (member === drafted) return { changes: true };
  const draftDay =
    new Map(Object.entries(datesOf(team))).get(personId) ?? today;
  return samePeriod(period, draftDay, day)
    ? { changes: true }
    : {
        refusal: `The draft of ${teamName} already changes ${personName} from another ${period}. Approve or discard that draft first.`,
      };
}

export type HeldChange = { change: FeatureTeamChange } | { refusal: string };

// A change of a team's members from another day than today, by date, without those it changes
// nothing about, or why the team's draft can't hold it, as heldTeamChange sets out. Someone who has
// left, or is neither a person nor a planned hire, is kept for drafting to refuse, so no refusal
// names them wrongly.
export function heldChange(
  now: { before: Recorded | undefined; team: Recorded },
  change: FeatureTeamChange,
  { everyone, onDay }: { everyone: Everyone; onDay: readonly string[] },
  when: { day: string; today: string },
): HeldChange {
  const kept = { add: [] as string[], remove: [] as string[] };
  for (const [personIds, member, into] of [
    [change.add ?? [], true, kept.add],
    [change.remove ?? [], false, kept.remove],
  ] as const) {
    for (const personId of personIds) {
      const person = everyone.get(personId);
      if (person === undefined || hasLeft(person)) {
        into.push(personId);
        continue;
      }
      const held = heldTeamChange(
        now,
        personId,
        { member, liveOnDay: onDay.includes(personId) },
        { ...when, period: "date" },
        { personName: person.preferredName, teamName: String(now.team.name) },
      );
      if ("refusal" in held) return held;
      if (held.changes) into.push(personId);
    }
  }
  return {
    change: {
      ...change,
      ...(change.add === undefined ? {} : { add: kept.add }),
      ...(change.remove === undefined ? {} : { remove: kept.remove }),
    },
  };
}
