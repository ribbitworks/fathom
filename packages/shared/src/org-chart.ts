// SPDX-License-Identifier: Apache-2.0

// The org chart: today's reporting lines as approved, never as drafted. It holds everyone current
// today, and any manager they still report to whose end date has passed. Each person comes with
// General details only. Whether a manager has left follows from their end date, which is
// Restricted, so only readers who see Restricted details are told, and see the people above them.
// Other readers see such a manager only as People names them, by name and team, at the top of their
// part of the chart.

import { z } from "zod";
import { paletteColourSchema } from "./palette.ts";

export const orgChartPersonSchema = z.object({
  id: z.string(),
  preferredName: z.string(),
  // Null for a manager who has left, to readers who do not see Restricted details.
  employeeId: z.string().nullable(),
  position: z.string().nullable(),
  // The name of the team the person leads; null unless they lead one with a name.
  teamName: z.string().nullable(),
  // The colour of the team the person leads; null unless it has one the palette still has.
  teamColour: paletteColourSchema.nullable(),
  managerId: z.string().nullable(),
  left: z.boolean().optional(),
});

export type OrgChartPerson = z.infer<typeof orgChartPersonSchema>;

export const orgChartSchema = z.object({
  people: z.array(orgChartPersonSchema),
});

export type OrgChart = z.infer<typeof orgChartSchema>;

// A team's colour, chosen on the chart, or null for none. It is not part of any draft, so it
// changes at once.
export const teamColourRequestSchema = z.object({
  colour: paletteColourSchema.nullable(),
});

export type TeamColourRequest = z.infer<typeof teamColourRequestSchema>;
