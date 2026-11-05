// SPDX-License-Identifier: Apache-2.0

// People and the columns people add to the People table. Every person has a preferred name, an
// Employee ID, and a position, which are General, and may have start and end dates, which are
// Restricted. A choice column draws on a list, and its values are choices from that list, as
// sensitive as the list's visibility; a web link column holds one link for each person, as sensitive
// as the column's own visibility. What a user receives leaves out what their roles do not let them
// see.

import { z } from "zod";
import { tierSchema } from "./access.ts";
import { daySchema } from "./days.ts";
import { draftActionSchema, draftShape, heldBySchema } from "./drafts.ts";
import { type Link, linkValueSchema } from "./links.ts";
import { listLengths } from "./lists.ts";
import { savedViewSchema } from "./views.ts";

export const personLengths = {
  preferredName: 100,
  employeeId: 40,
  teamName: 60,
  column: listLengths.name,
} as const;

// A date without a time, such as 2026-10-31.
const day = daySchema;

// A column chooses from a list, or holds a web link. A column's type never changes.
export const fieldTypeSchema = z.enum(["choice", "link"]);

export type FieldType = z.infer<typeof fieldTypeSchema>;

// A column's draft: whether it adds, changes, or removes the column, the settings it changes, and
// their live values, which a draft that adds the column has none of.
export const fieldDraftSchema = z.object({
  action: draftActionSchema,
  changed: z.array(z.string()),
  live: z
    .object({
      name: z.string(),
      listId: z.string().nullable(),
      visibility: tierSchema.nullable(),
      multiple: z.boolean(),
      required: z.boolean(),
    })
    .partial(),
  ...draftShape,
});

export type FieldDraft = z.infer<typeof fieldDraftSchema>;

// A column on the People table. The column decides what it is called and whether a value is
// required; a choice column also decides its list and whether one choice or several can be picked,
// and a web link column the visibility of its links. It is as its draft, if any, makes it, with the
// draft beside, or, for a draft that removes it, as it is.
export const fieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: fieldTypeSchema.default("choice"),
  // Null for a web link column.
  listId: z.string().nullable(),
  // Null for a choice column, whose list's visibility is its own.
  visibility: tierSchema.nullable().default(null),
  multiple: z.boolean(),
  required: z.boolean(),
  draft: fieldDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type Field = z.infer<typeof fieldSchema>;

// The most choices one column can hold for one person.
const choicesLimit = 100;

// The chosen choices of each column, by column, in the list's order. A column with nothing chosen
// is left out.
const valuesSchema = z.record(z.string(), z.array(z.string()));

// Each web link column's link, by column. A column with no link is left out.
const linksSchema = z.record(
  z.string(),
  z.object({ address: z.string(), text: z.string() }),
);

export type Links = Record<string, Link>;

// Links asked for, by column; null removes a column's link.
const requestedLinksSchema = z.record(z.uuid(), linkValueSchema.nullable());

// Choices asked for, by column: each a choice's identifier, at most once.
const requestedValuesSchema = z.record(
  z.uuid(),
  z
    .array(z.uuid())
    .max(choicesLimit)
    .refine((ids) => new Set(ids).size === ids.length, "Each choice once"),
);

// A person's draft, as the user may see it: whether it adds, changes, or removes them, the columns
// it changes, by key, and their live values, which a draft that adds someone has none of. Columns
// the user may not see are left out, and so is a draft that changes only those. A rejected draft's
// reason is as sensitive as the most sensitive value in the draft, and is left out for users who
// may not see it.
export const personDraftSchema = z.object({
  action: draftActionSchema,
  changed: z.array(z.string()),
  live: z.object({
    preferredName: z.string().optional(),
    employeeId: z.string().optional(),
    positionId: z.string().optional(),
    startDate: day.nullable().optional(),
    endDate: day.nullable().optional(),
    managerId: z.string().nullable().optional(),
    managerFrom: day.nullable().optional(),
    teamName: z.string().nullable().optional(),
    values: valuesSchema,
    links: linksSchema.default({}),
  }),
  ...draftShape,
});

export type PersonDraft = z.infer<typeof personDraftSchema>;

// A person as the user sees them: as their draft, if any, makes them, with the draft beside, or,
// for a draft that removes them, as they are.
export const personSchema = z.object({
  id: z.string(),
  preferredName: z.string(),
  employeeId: z.string(),
  // A choice in the built-in Positions list.
  positionId: z.string(),
  // Left out for users who cannot see Restricted details; null when not set.
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  // Who the person reports to now, which is General, and since when, which is Restricted and left
  // out like the dates. Users who see only General details see the live manager, never a draft's;
  // those who see Restricted details see the manager as drafted.
  manager: z
    .object({ id: z.string(), preferredName: z.string() })
    .nullable()
    .optional(),
  managerFrom: day.nullable().optional(),
  // Set, for users who see Restricted details, when the manager's end date has passed.
  managerLeft: z.boolean().optional(),
  // The name of the manager's team, the team the person is on; null while it has none, when it is
  // shown by its manager's name.
  team: z.string().nullable().optional(),
  // The name of the person's own team, the people who report to them.
  teamName: z.string().nullable().optional(),
  values: valuesSchema,
  links: linksSchema.default({}),
  draft: personDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type Person = z.infer<typeof personSchema>;

// A draft of the order of the People table's columns, holding the whole order, with the live order
// beside.
export const columnOrderDraftSchema = z.object({
  live: z.array(z.string()),
  // The columns only drafted to be added that the draft places, whose drafts approving it approves.
  uses: z.array(z.string()).optional(),
  ...draftShape,
});

export type ColumnOrderDraft = z.infer<typeof columnOrderDraftSchema>;

// Everyone the user may see, by preferred name, with the added columns whose values they may see,
// the order of the columns they see: built-in ones by name, such as "employeeId", and added ones
// by identifier, and the saved views of the People table they may see, by name.
export const peopleSchema = z.object({
  people: z.array(personSchema),
  fields: z.array(fieldSchema),
  // In order, as a draft of the order makes it.
  order: z.array(z.string()),
  orderDraft: columnOrderDraftSchema.optional(),
  // Who holds the order of the columns, as heldBy does a person.
  orderHeldBy: heldBySchema,
  views: z.array(savedViewSchema),
});

// The prefix of planned hires' temporary IDs, such as TBD-7, which no ID typed in starts with,
// ignoring letter case, so it never matches one.
export const temporaryIdPrefix = "TBD-";

// An ID in the ID column: a person's Employee ID or a planned hire's requisition.
export const recordIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(personLengths.employeeId)
  .refine(
    (id) => !id.toLowerCase().startsWith(temporaryIdPrefix.toLowerCase()),
    `An ID cannot start with ${temporaryIdPrefix}, which temporary IDs use`,
  );

const preferredName = z.string().trim().min(1).max(personLengths.preferredName);
const employeeId = recordIdSchema;
// An empty name removes it.
const teamName = z
  .string()
  .trim()
  .max(personLengths.teamName)
  .transform((name) => (name === "" ? null : name))
  .nullable();
// A new manager, or null for none, from the date given, or from today, or the person's start date
// if it is later.
const reporting = {
  managerId: z.uuid().nullable().optional(),
  managerFrom: day.optional(),
  teamName: teamName.optional(),
};

export const personRequestSchema = z.object({
  preferredName,
  employeeId,
  positionId: z.uuid(),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  ...reporting,
  values: requestedValuesSchema.default({}),
  links: z.record(z.uuid(), linkValueSchema).default({}),
});

export type PersonRequest = z.infer<typeof personRequestSchema>;

// Adds one person, or several pasted at once, all saved together.
export const peopleRequestSchema = z.object({
  people: z.array(personRequestSchema).min(1).max(1000),
});

// Changes some of a person's details; columns named in values have their choices replaced, and
// those named in links their link.
export const personChangeSchema = z.object({
  preferredName: preferredName.optional(),
  employeeId: employeeId.optional(),
  positionId: z.uuid().optional(),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  ...reporting,
  values: requestedValuesSchema.optional(),
  links: requestedLinksSchema.optional(),
});

export type PersonChange = z.infer<typeof personChangeSchema>;

// A choice column names its list, and takes its visibility from it; a web link column names its
// visibility, no list, and takes one link.
export const fieldRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(personLengths.column),
    type: fieldTypeSchema.default("choice"),
    listId: z.uuid().optional(),
    visibility: tierSchema.optional(),
    multiple: z.boolean().default(false),
    required: z.boolean().default(false),
  })
  .superRefine((request, context) => {
    const issue = (message: string) => {
      context.addIssue({ code: "custom", message });
    };
    if (request.type === "choice") {
      if (request.listId === undefined) issue("Choose a list");
    } else {
      if (request.visibility === undefined) issue("Choose a visibility");
      if (request.listId !== undefined) issue("A web link column has no list");
      if (request.multiple) issue("A web link column holds one link");
    }
  })
  .transform((request) =>
    request.type === "choice" ? { ...request, visibility: undefined } : request,
  );

export type FieldRequest = z.infer<typeof fieldRequestSchema>;

// The key of a column on the People table: a built-in column's name, or an added column's
// identifier.
export const columnKeySchema = z.string().min(1).max(64);

// Moves a column to just after another, or to the start when there is none.
export const fieldMoveSchema = z.object({ after: columnKeySchema.nullable() });

// The change set a change was saved in, which undoing it names; null when nothing changed.
export const changeSetIdSchema = z.uuid().nullable();

export const savedSchema = z.object({ changeSetId: changeSetIdSchema });

export type Saved = z.infer<typeof savedSchema>;
