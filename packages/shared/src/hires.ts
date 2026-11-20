// SPDX-License-Identifier: Apache-2.0

// Planned hires: roles to be filled, kept apart from people but shown beside them.

import { z } from "zod";
import { daySchema, monthSchema } from "./days.ts";
import { draftActionSchema, draftShape, heldBySchema } from "./drafts.ts";
import { meaningSchema } from "./lists.ts";
import { linkValueSchema } from "./links.ts";
import { keyNumberSchema } from "./record-keys.ts";
import {
  hireNameSchema,
  linksSchema,
  notesSchema,
  numbersSchema,
  preferredNameSchema,
  recordIdSchema,
  requestedLinksSchema,
  temporaryIdPrefix,
  requestedNotesSchema,
  requestedNumbersSchema,
  requestedValuesSchema,
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

// What a planned hire is called in menus, notices, the change history, and on the org chart: its
// name, or, while it has none, its position and ID, such as "Software Engineer, TBD-7", or its ID
// alone to those who cannot see positions, for whom no position is given.
export function hireCalled(
  name: string | null,
  shownId: string,
  position: string | undefined,
): string {
  if (name !== null) return name;
  return position === undefined ? shownId : `${position}, ${shownId}`;
}

const day = daySchema;

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
    isManager: z.boolean().optional(),
    // The live values of the added columns the draft changes, as a person's draft has them.
    values: valuesSchema.default({}),
    links: linksSchema.default({}),
    notes: notesSchema.default({}),
    numbers: numbersSchema.default({}),
  }),
  ...draftShape,
});

export type HireDraft = z.infer<typeof hireDraftSchema>;

// A planned hire as the user sees it. Everyone who sees it sees its name, ID, position, manager,
// and the month it is expected; only those who see the hiring plan see the rest, the hire as its
// draft, if any, makes it, and the draft beside.
export const hireSchema = z.object({
  id: z.string(),
  keyNumber: keyNumberSchema,
  name: z.string().nullable(),
  // Exactly one of the two is set: the requisition, or the temporary ID until it has one.
  requisition: z.string().nullable(),
  temporaryId: z.string().nullable(),
  // Left out for readers who cannot see the Positions list's tier.
  positionId: z.string().optional(),
  // A person, or a planned hire marked as a manager. None, too, for readers who cannot see
  // Personal data while the manager has not yet started.
  managerId: z.string().nullable(),
  managerName: z.string().nullable(),
  // Whether other planned hires can be named as reporting to the hire, which is General.
  isManager: z.boolean(),
  // The first month the hire can be allocated: that of its target date, or of its person's start
  // date once filled, or the current month for a hire with no target date.
  expected: monthSchema,
  // Set when the month comes from neither a target date nor a start date, so it moves with the day.
  undated: z.literal(true).optional(),
  targetDate: day.nullable().optional(),
  stateId: z.string().optional(),
  // Its values in the added columns offered on planned hires, each at its column's visibility, as a
  // person's are.
  values: valuesSchema.default({}),
  links: linksSchema.default({}),
  notes: notesSchema.default({}),
  numbers: numbersSchema.default({}),
  // Who the hire's draft fills it with, for those who see the hiring plan: the person, for those
  // who see Personal details, and otherwise null, since they may not have started.
  filler: z.string().nullable().optional(),
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
  isManager: z.boolean().default(false),
  values: requestedValuesSchema.default({}),
  links: z.record(z.uuid(), linkValueSchema).default({}),
  notes: requestedNotesSchema.optional(),
  numbers: requestedNumbersSchema.optional(),
});

export type HireRequest = z.infer<typeof hireRequestSchema>;

// Adds several planned hires together, as one change.
export const hiresRequestSchema = z.object({
  hires: z.array(hireRequestSchema).min(1).max(1000),
});

// Changes some of a hire's details, or moves it to another state. Its manager may be a person or a
// planned hire marked as a manager. Clearing the requisition gives
// the hire a new temporary ID. Columns named in values have their choices replaced, those named in
// links their link, and those named in notes their note, as for a person.
export const hireChangeSchema = z.object({
  name: hireNameSchema.optional(),
  requisition: requisition.optional(),
  positionId: z.uuid().optional(),
  targetDate: day.nullable().optional(),
  stateId: z.uuid().optional(),
  managerId: z.uuid().nullable().optional(),
  isManager: z.boolean().optional(),
  values: requestedValuesSchema.optional(),
  links: requestedLinksSchema.optional(),
  notes: requestedNotesSchema.optional(),
  numbers: requestedNumbersSchema.optional(),
});

export type HireChange = z.infer<typeof hireChangeSchema>;

// Who a fill's person reports to in place of the hire's manager, when another is given: a person,
// or, with null, nobody, which leaves someone already in Fathom with the manager they have.
const fillManagerSchema = z.uuid().nullable().optional();

// Fills a planned hire, as one draft: with a new person, added with the hire's position, manager,
// and values in the columns they share, starting on the day given, or with someone already in
// Fathom, who takes the hire's position and moves to the hire's manager from the day given, or by
// default from today, or their start date if it is later.
export const hireFillSchema = z.discriminatedUnion("by", [
  z.object({
    by: z.literal("new person"),
    preferredName: preferredNameSchema,
    employeeId: recordIdSchema,
    startDate: day.nullable(),
    managerId: fillManagerSchema,
    // What People requires that the hire has no value for.
    values: requestedValuesSchema.default({}),
    links: z.record(z.uuid(), linkValueSchema).default({}),
    notes: requestedNotesSchema.optional(),
    numbers: requestedNumbersSchema.optional(),
  }),
  z.object({
    by: z.literal("existing person"),
    personId: z.uuid(),
    managerFrom: day.optional(),
    managerId: fillManagerSchema,
  }),
]);

export type HireFill = z.infer<typeof hireFillSchema>;
