// SPDX-License-Identifier: Apache-2.0

// A person's timeline: the days something about them changed, or will, each with its changes in the
// order a day lists them.

import { z } from "zod";
import { daySchema } from "./days.ts";

// What a change is about, in the order a day lists them.
export const timelineFieldSchema = z.enum([
  "filled",
  "start",
  "manager",
  "featureTeams",
  "leads",
  "end",
]);

export type TimelineField = z.infer<typeof timelineFieldSchema>;

// A record a change names: a planned hire filled, a manager or a feature team.
export const timelineRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  // A planned hire's key number, which its link opens it by.
  keyNumber: z.number().int().optional(),
});

export type TimelineRecord = z.infer<typeof timelineRecordSchema>;

// One change: a value that becomes another, a first value, a part of a list added or removed, or
// Start or End alone. A value of null is none, such as no manager.
export const timelineChangeSchema = z.object({
  field: timelineFieldSchema,
  value: timelineRecordSchema.nullable().optional(),
  // What it was before; absent for a first value or a list's part.
  was: timelineRecordSchema.nullable().optional(),
  part: z.enum(["added", "removed"]).optional(),
  // How many others the same change was made for that day, such as a reorganization's.
  others: z.number().int().min(1).optional(),
});

export type TimelineChange = z.infer<typeof timelineChangeSchema>;

export const timelineDaySchema = z.object({
  day: daySchema,
  changes: z.array(timelineChangeSchema).min(1),
});

export type TimelineDay = z.infer<typeof timelineDaySchema>;

// A person's days, earliest first.
export const timelineSchema = z.object({ days: z.array(timelineDaySchema) });

export type Timeline = z.infer<typeof timelineSchema>;
