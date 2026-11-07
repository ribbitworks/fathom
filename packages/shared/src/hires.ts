// SPDX-License-Identifier: Apache-2.0

// Planned hires: roles to be filled, kept apart from people but shown beside them, as the Decisions
// Log sets out. Each hire not yet filled is a placeholder that everyone who sees people sees: its
// name, ID, position, manager, and the month it is expected. Its state and target date are
// Confidential. What a user receives leaves out what their role does not let them see.

import { z } from "zod";
import { daySchema } from "./days.ts";
import { draftActionSchema, draftShape, heldBySchema } from "./drafts.ts";
import { meaningSchema } from "./lists.ts";
import { linkValueSchema } from "./links.ts";
import {
  hireNameSchema,
  linksSchema,
  notesSchema,
  recordIdSchema,
  requestedLinksSchema,
  requestedNotesSchema,
  requestedValuesSchema,
  temporaryIdPrefix,
  valuesSchema,
} from "./people.ts";

// The meanings a planned hire's state can have: Proposed, the headcount not yet approved, and Open,
// approved. The hiring states list's other meanings, Hired and Left, are people's states.
export const hiringMeaningSchema = meaningSchema.extract(["proposed", "open"]);

export type HiringMeaning = z.infer<typeof hiringMeaningSchema>;

// A hire with no requisition yet is known by a temporary ID: the prefix and its number, such as
// TBD-7.
export const temporaryId = (number: number): string =>
  `${temporaryIdPrefix}${String(number)}`;

const day = daySchema;
// A month, such as 2026-10.
const month = z.string().regex(/^\d{4}-\d{2}$/);

// A hire's draft, as the user may see it: whether it adds, changes, or removes the hire, the fields it
// changes, and their live values, which a draft adding the hire has none of.
export const hireDraftSchema = z.object({
  action: draftActionSchema,
  changed: z.array(z.string()),
  live: z.object({
    name: z.string().nullable().optional(),
    // The live ID: its requisition, or, while it has none, its temporary ID.
    requisition: z.string().nullable().optional(),
    temporaryId: z.string().nullable().optional(),
    positionId: z.string().optional(),
    targetDate: day.nullable().optional(),
    stateId: z.string().optional(),
    managerId: z.string().nullable().optional(),
    // The live values of the added columns the draft changes, as a person's draft has them.
    values: valuesSchema.default({}),
    links: linksSchema.default({}),
    notes: notesSchema.default({}),
  }),
  ...draftShape,
});

export type HireDraft = z.infer<typeof hireDraftSchema>;

// A planned hire as the user sees it. Everyone who sees it sees its name, ID, position, manager,
// and the month it is expected; only those who see Confidential data see the rest, the hire as its
// draft, if any, makes it, and the draft beside.
export const hireSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  // Exactly one of the two is set: the requisition, or the temporary ID until it has one.
  requisition: z.string().nullable(),
  temporaryId: z.string().nullable(),
  // Left out for readers who cannot see the Positions list's tier.
  positionId: z.string().optional(),
  // None, too, for readers who cannot see Restricted data while the manager has not yet started.
  managerId: z.string().nullable(),
  managerName: z.string().nullable(),
  // The first month the hire can be allocated: that of its target date, or of its person's start
  // date once filled, or the current month for a hire with no target date.
  expected: month,
  targetDate: day.nullable().optional(),
  stateId: z.string().optional(),
  // Its values in the added columns offered on planned hires, each at its column's visibility, as a
  // person's are.
  values: valuesSchema.default({}),
  links: linksSchema.default({}),
  notes: notesSchema.default({}),
  draft: hireDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type Hire = z.infer<typeof hireSchema>;

// The hires the user may see: the whole hiring plan, or only the placeholders, with whether it is
// the whole plan.
export const hiresSchema = z.object({
  hires: z.array(hireSchema),
  wholePlan: z.boolean(),
});

export type Hires = z.infer<typeof hiresSchema>;

// A requisition, or null for a temporary ID.
const requisition = recordIdSchema.nullable();

// Adds a planned hire, in the hiring states list's first state meaning Proposed unless another is
// given.
export const hireRequestSchema = z.object({
  name: hireNameSchema.default(null),
  requisition: requisition.default(null),
  positionId: z.uuid(),
  targetDate: day.nullable().default(null),
  stateId: z.uuid().optional(),
  managerId: z.uuid().nullable().default(null),
  values: requestedValuesSchema.default({}),
  links: z.record(z.uuid(), linkValueSchema).default({}),
  notes: requestedNotesSchema.optional(),
});

export type HireRequest = z.infer<typeof hireRequestSchema>;

// Adds several planned hires together, as one change.
export const hiresRequestSchema = z.object({
  hires: z.array(hireRequestSchema).min(1).max(1000),
});

// Changes some of a hire's details, or moves it to another state. Clearing the requisition gives
// the hire a new temporary ID. Columns named in values have their choices replaced, those named in
// links their link, and those named in notes their note, as for a person.
export const hireChangeSchema = z.object({
  name: hireNameSchema.optional(),
  requisition: requisition.optional(),
  positionId: z.uuid().optional(),
  targetDate: day.nullable().optional(),
  stateId: z.uuid().optional(),
  managerId: z.uuid().nullable().optional(),
  values: requestedValuesSchema.optional(),
  links: requestedLinksSchema.optional(),
  notes: requestedNotesSchema.optional(),
});

export type HireChange = z.infer<typeof hireChangeSchema>;
