// SPDX-License-Identifier: Apache-2.0

// The org chart: today's reporting lines as approved, with each person's draft of their manager,
// position and team's name beside, and the whole chart as drafts make it. It holds everyone current
// today, and any manager they still report to whose end date has passed. Each person comes with
// General details only, and a draft's manager and dates, which are Personal, only to readers who
// see Personal details, and a drafted position only to readers who see the Positions list.
// Planned hires join it as placeholders, to every reader, and their drafts only to readers who see
// the hiring plan.
// Whether a manager has left follows from their end date, which is Personal, so only readers who
// see Personal details are told, and see the people above them. Other readers see such a manager
// only as People names them, by name and team, at the top of their part of the chart.

import { z } from "zod";
import { daySchema, monthSchema } from "./days.ts";
import { draftStateSchema, heldBySchema } from "./drafts.ts";
import { paletteColourSchema } from "./palette.ts";

// What a person's draft changes on the chart, as the reader may see it: their manager, or none,
// their position, by its label, and the name of the team they lead, or none, each left out when the
// draft keeps it as it is.
export const orgChartDraftSchema = z.object({
  managerId: z.string().nullable().optional(),
  // The day a person's drafted manager takes effect from, given with the manager.
  managerFrom: daySchema.optional(),
  position: z.string().optional(),
  teamName: z.string().nullable().optional(),
  state: draftStateSchema,
  // Whether the draft holds the reader's own changes, not yet published.
  unpublished: z.boolean(),
});

export type OrgChartDraft = z.infer<typeof orgChartDraftSchema>;

// A card on the chart: a person, or a planned hire's placeholder, named as its People row is, under
// its manager, a person or a planned manager. A placeholder opens nothing and leads no named team.
export const orgChartPersonSchema = z.object({
  id: z.string(),
  preferredName: z.string(),
  // Null for a manager who has left, to readers who do not see Personal details, and for everyone
  // to readers who do not see people.
  employeeId: z.string().nullable(),
  position: z.string().nullable(),
  // The name of the team the person leads; null unless they lead one with a name.
  teamName: z.string().nullable(),
  // The colour of the team the person leads; null unless it has one the palette still has.
  teamColour: paletteColourSchema.nullable(),
  managerId: z.string().nullable(),
  left: z.boolean().optional(),
  // Set for a planned hire: the month it is expected, never the day, and, for one with no name of
  // its own, whose name is made from its position and ID, that ID, which its card shows in place of
  // the made name, with the position under it, so the card's name fits.
  planned: z
    .object({ expected: monthSchema, shownId: z.string().optional() })
    .optional(),
  draft: orgChartDraftSchema.optional(),
  // Who holds the person by having unpublished changes to them, when it is someone other than the
  // reader, to readers who are sent drafts.
  heldBy: heldBySchema,
});

export type OrgChartPerson = z.infer<typeof orgChartPersonSchema>;

export const orgChartSchema = z.object({
  people: z.array(orgChartPersonSchema),
  // The chart as it will be once the drafts are approved, with rejected drafts taken back, as the
  // reader may see it: people added and removed, and their details, dates, managers and team names
  // changed, each as People shows them to the reader. Someone a draft adds carries the draft's state,
  // since they are on no other chart.
  drafted: z.array(orgChartPersonSchema),
});

export type OrgChart = z.infer<typeof orgChartSchema>;

// A team's colour, chosen on the chart, or null for none. It is not part of any draft, so it
// changes at once.
export const teamColourRequestSchema = z.object({
  colour: paletteColourSchema.nullable(),
});

export type TeamColourRequest = z.infer<typeof teamColourRequestSchema>;
