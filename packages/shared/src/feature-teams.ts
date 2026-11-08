// SPDX-License-Identifier: Apache-2.0

// Feature teams: the people working on a set of related features, apart from reporting lines, as
// the Decisions Log sets out, seen and changed on the org chart. A team's name, lead, and members
// are General, so everyone who sees the org chart sees them; the days members join and leave are
// Restricted. Members are people the reader sees, so someone who has not started is left out for
// readers who do not see Restricted details. Every change is a draft, a team's name, lead, and
// member changes making one draft; its colour is how the chart is drawn, so it changes at once.

import { z } from "zod";
import { addDays, addMonths } from "./cycles.ts";
import { daySchema, isFirstOfMonth, monthOf, monthSchema } from "./days.ts";
import { draftActionSchema, draftShape, heldBySchema } from "./drafts.ts";
import { paletteColourSchema } from "./palette.ts";

// At most as many members as a team could hold.
export const featureTeamLengths = { name: 60, members: 500 } as const;

const name = z.string().trim().min(1).max(featureTeamLengths.name);
// Members are named by their person's identifier.
const members = z
  .array(z.uuid())
  .max(featureTeamLengths.members)
  .refine((ids) => new Set(ids).size === ids.length, "Each member once");

// A team's draft, as the reader may see it: whether it adds, changes, or removes the team, the
// fields it changes, and their live values, which a draft adding the team has none of.
export const featureTeamDraftSchema = z.object({
  action: draftActionSchema,
  changed: z.array(z.string()),
  live: z.object({
    name: z.string().optional(),
    leadId: z.string().nullable().optional(),
    members: z.array(z.string()).optional(),
  }),
  // The days the draft gives members joining or leaving, by person, for readers who see Restricted
  // details.
  days: z.record(z.string(), daySchema).optional(),
  // The day the draft's change of lead takes effect, for readers who see Restricted details.
  leadDay: daySchema.optional(),
  ...draftShape,
});

export type FeatureTeamDraft = z.infer<typeof featureTeamDraftSchema>;

// A feature team as the reader sees it, as its draft, if any, makes it, with the draft beside.
export const featureTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  leadId: z.string().nullable(),
  // The colour of its cards on the feature team chart; null unless it has one the palette has.
  colour: paletteColourSchema.nullable(),
  // Its members the reader sees, by person.
  members: z.array(z.string()),
  // The name of each person on the team, drafted or live, whom the reader sees, by person.
  names: z.record(z.string(), z.string()),
  // The month from which it has no members, past or planned, if there is one.
  disbandedFrom: monthSchema.optional(),
  draft: featureTeamDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type FeatureTeam = z.infer<typeof featureTeamSchema>;

export const featureTeamsSchema = z.object({
  teams: z.array(featureTeamSchema),
});

export type FeatureTeams = z.infer<typeof featureTeamsSchema>;

// A record of someone joining or leaving a team, with their end date, if it counts.
export interface MembershipRecord {
  member: boolean;
  fromDate: string;
  endDate: string | null;
}

// The first day someone is off a team, from their records, earliest first: the day they leave or
// the day after their end date, whichever comes first; undefined while nothing takes them off it.
function firstDayOff(records: readonly MembershipRecord[]): string | undefined {
  const latest = records.at(-1);
  if (latest === undefined) return undefined;
  const afterEnd =
    latest.endDate === null ? undefined : addDays(latest.endDate, 1);
  if (latest.member) return afterEnd;
  return afterEnd !== undefined && afterEnd < latest.fromDate
    ? afterEnd
    : latest.fromDate;
}

// The month a team disbands from, given each member's records: the first whole month with none of
// them on it from then on, past or planned; undefined if someone stays, or it has had no members.
export function disbandedMonth(
  people: readonly (readonly MembershipRecord[])[],
): string | undefined {
  let lastOff: string | undefined;
  for (const records of people) {
    const off = firstDayOff(records);
    if (off === undefined) return undefined;
    if (lastOff === undefined || off > lastOff) lastOff = off;
  }
  if (lastOff === undefined) return undefined;
  return monthOf(isFirstOfMonth(lastOff) ? lastOff : addMonths(lastOff, 1));
}

// Asks for the teams as of a day, or as they are today with their drafts when none is given.
export const featureTeamsQuerySchema = z.object({
  on: daySchema.optional(),
});

// Adds a feature team, with its members and lead, who is one of them; members join from the day
// given, today or later, or earlier for those who may change Restricted details, or from today.
export const featureTeamRequestSchema = z.object({
  name,
  leadId: z.uuid().nullable().default(null),
  members: members.default([]),
  from: daySchema.optional(),
});

export type FeatureTeamRequest = z.infer<typeof featureTeamRequestSchema>;

// Changes a feature team: renames it, chooses its lead or none, and adds and removes members, who
// join or leave, and the lead changes, from the day given, today or later, or earlier for those who
// may change Restricted details, or from today.
export const featureTeamChangeSchema = z.object({
  name: name.optional(),
  leadId: z.uuid().nullable().optional(),
  add: members.optional(),
  remove: members.optional(),
  from: daySchema.optional(),
});

export type FeatureTeamChange = z.infer<typeof featureTeamChangeSchema>;

// A feature team's colour, chosen on the chart, or null for none. It is not part of any draft, so it
// changes at once.
export const featureTeamColourSchema = z.object({
  colour: paletteColourSchema.nullable(),
});
