// SPDX-License-Identifier: Apache-2.0

// People, their drafts, and the columns added to the People table, as requests send them and
// readers receive them.

import { z } from "zod";
import { type Permission, tierSchema } from "./access.ts";
import { daySchema, monthSchema } from "./days.ts";
import { type ColumnTable, columnTableSchema } from "./column-tables.ts";
import {
  type ApprovePermission,
  draftActionSchema,
  draftShape,
  heldBySchema,
} from "./drafts.ts";
import { type Link, linkValueSchema } from "./links.ts";
import {
  choiceRequestSchema,
  listLengths,
  mostChoicesAtOnce,
} from "./lists.ts";
import { numberValueSchema } from "./numbers.ts";
import { paletteColourSchema } from "./palette.ts";
import { keyNumberSchema } from "./record-keys.ts";

export {
  type ColumnTable,
  columnTableOf,
  columnTables,
  columnTableSchema,
} from "./column-tables.ts";

export const personLengths = {
  preferredName: 100,
  employeeId: 40,
  teamName: 60,
  column: listLengths.name,
} as const;

// A date without a time, such as 2026-10-31.
const day = daySchema;

// A column chooses from a list, or holds a web link, a note, or a number. A column's type never
// changes.
export const fieldTypeSchema = z.enum(["choice", "link", "note", "number"]);

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
      onPlannedHires: z.boolean(),
    })
    .partial(),
  ...draftShape,
});

export type FieldDraft = z.infer<typeof fieldDraftSchema>;

// A column on the People table. The column decides what it is called and whether a value is
// required; a choice column also decides its list and whether one choice or several can be picked,
// and a web link or note column the visibility of its values. It is as its draft, if any, makes it,
// with the draft beside, or, for a draft that removes it, as it is. A column is offered on planned
// hires too unless it is switched off for them, and is never required on them.
export const fieldSchema = z.object({
  id: z.string(),
  keyNumber: keyNumberSchema,
  name: z.string(),
  type: fieldTypeSchema.default("choice"),
  // Null for a web link or note column.
  listId: z.string().nullable(),
  // Null for a choice column, whose list's visibility is its own.
  visibility: tierSchema.nullable().default(null),
  multiple: z.boolean(),
  required: z.boolean(),
  onPlannedHires: z.boolean().default(true),
  // The table it is on, whose Approvers decide its drafts; one read without it is on People.
  table: columnTableSchema.optional(),
  draft: fieldDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type Field = z.infer<typeof fieldSchema>;

// The most choices one column can hold for one person.
const choicesLimit = 100;

// The chosen choices of each column, by column, in the list's order. A column with nothing chosen
// is left out.
export const valuesSchema = z.record(z.string(), z.array(z.string()));

// Each web link column's link, by column. A column with no link is left out.
export const linksSchema = z.record(
  z.string(),
  z.object({ address: z.string(), text: z.string() }),
);

export type Links = Record<string, Link>;

// Links asked for, by column; null removes a column's link.
export const requestedLinksSchema = z.record(
  z.uuid(),
  linkValueSchema.nullable(),
);

// Each note column's note, as Markdown, by column. A column with no note is left out. The server
// always names them, if only as none.
export const notesSchema = z.record(z.string(), z.string());

export type Notes = Record<string, string>;

// Notes asked for, by column, as Markdown, which the server checks; null or an empty note removes a
// column's note.
export const requestedNotesSchema = z.record(z.uuid(), z.string().nullable());

// Each number column's number, by column. A column with no number is left out.
export const numbersSchema = z.record(z.string(), z.number());

export type Numbers = Record<string, number>;

// Numbers asked for, by column; null removes a column's number.
export const requestedNumbersSchema = z.record(
  z.uuid(),
  numberValueSchema.nullable(),
);

// Choices asked for, by column: each a choice's identifier, at most once.
export const requestedValuesSchema = z.record(
  z.uuid(),
  z
    .array(z.uuid())
    .max(choicesLimit)
    .refine((ids) => new Set(ids).size === ids.length, "Each choice once"),
);

// A new record's values in the columns added to its table, each column named by its identifier.
export const requestedColumnValues = {
  values: requestedValuesSchema.default({}),
  links: z.record(z.uuid(), linkValueSchema).default({}),
  notes: requestedNotesSchema.optional(),
  numbers: requestedNumbersSchema.optional(),
};

// A change to a record's values in the columns added to its table: each column named is replaced.
export const changedColumnValues = {
  values: requestedValuesSchema.optional(),
  links: requestedLinksSchema.optional(),
  notes: requestedNotesSchema.optional(),
  numbers: requestedNumbersSchema.optional(),
};

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
    isManager: z.boolean().optional(),
    stateId: z.string().optional(),
    values: valuesSchema,
    links: linksSchema.default({}),
    notes: notesSchema.optional(),
    numbers: numbersSchema.optional(),
  }),
  // Set, for a role that approves people's or planned hires' drafts, on one holding details the role
  // can't see, such as a fill's, which another approver must decide; trying would tell the role as
  // much.
  holdsUnseen: z.literal(true).optional(),
  ...draftShape,
});

export type PersonDraft = z.infer<typeof personDraftSchema>;

// What a row of the People table is: a person, or a planned hire not yet filled.
export const rowKindSchema = z.enum(["person", "planned-hire"]);

export type RowKind = z.infer<typeof rowKindSchema>;

// A feature team a person or planned hire is on, as People names it.
export const personFeatureTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  colour: paletteColourSchema.nullable(),
});

export type PersonFeatureTeam = z.infer<typeof personFeatureTeamSchema>;

// A row of the People table as the user sees it: a person, or a planned hire, as its draft, if any,
// makes it, with the draft beside, or, for a draft that removes it, as it is. A planned hire's
// name, which may be empty, is its preferred name, its requisition or temporary ID its ID, and its
// target date its start date.
export const personSchema = z.object({
  id: z.string(),
  // A person's key number, or a planned hire's for its row.
  keyNumber: keyNumberSchema,
  // Left out for a person.
  kind: rowKindSchema.optional(),
  preferredName: z.string(),
  employeeId: z.string(),
  // A choice in the built-in hiring states list: a planned hire's state, or, for a person, the
  // first choice meaning Hired. Left out for users who cannot see the list's tier.
  stateId: z.string().optional(),
  // The first month a planned hire can be allocated.
  expected: monthSchema.optional(),
  // Set when the expected month comes from no date, so it moves with the day.
  undated: z.literal(true).optional(),
  // A choice in the built-in Positions list, left out for users who cannot see the list's tier.
  positionId: z.string().optional(),
  // Left out for users who cannot see Personal details; null when not set.
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  // Who the person reports to now, which is General, and since when, which is Personal and left
  // out like the dates. Users who see only General details see the live manager, never a draft's;
  // those who see Personal details see the manager as drafted.
  manager: z
    .object({ id: z.string(), preferredName: z.string() })
    .nullable()
    .optional(),
  managerFrom: day.nullable().optional(),
  // Set, for users who see Personal details, when the manager's end date has passed.
  managerLeft: z.boolean().optional(),
  // The name of the manager's team, the team the person is on; null while it has none, when it is
  // shown by its manager's name.
  team: z.string().nullable().optional(),
  // The name of the person's own team, the people who report to them.
  teamName: z.string().nullable().optional(),
  // Whether others can be named as reporting to the person, which is General.
  isManager: z.boolean().optional(),
  // The feature teams the person or planned hire is on, live, on the day shown, by name. Left out for
  // users who cannot see feature teams.
  featureTeams: z.array(personFeatureTeamSchema).optional(),
  values: valuesSchema,
  links: linksSchema.default({}),
  notes: notesSchema.optional(),
  numbers: numbersSchema.optional(),
  // For a planned hire, who its draft fills it with, as a planned hire has it.
  filler: z.string().nullable().optional(),
  draft: personDraftSchema.optional(),
  heldBy: heldBySchema,
});

export type Person = z.infer<typeof personSchema>;

// Everyone the user may see, by preferred name, with the added columns whose values they may see,
// the order of the columns they see: built-in ones by name, such as "employeeId", and added ones
// by identifier.
// The People table's added columns as their drafts make them, and their order, without the people.
export const peopleColumnsSchema = z.object({
  fields: z.array(fieldSchema),
  order: z.array(z.string()),
});

export const peopleSchema = peopleColumnsSchema.extend({
  people: z.array(personSchema),
  // Set for users who cannot see the Positions list's tier, who see no Position column.
  positionHidden: z.literal(true).optional(),
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

export const preferredNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(personLengths.preferredName);

// A planned hire's name, any label that identifies it, or null for none.
export const hireNameSchema = preferredNameSchema.nullable();
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
  isManager: z.boolean().optional(),
};

export const personRequestSchema = z.object({
  preferredName: preferredNameSchema,
  employeeId,
  positionId: z.uuid(),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  // A hiring state meaning Hired, or Left for someone whose end date has passed; with none, the
  // first state of their meaning.
  stateId: z.uuid().optional(),
  ...reporting,
  ...requestedColumnValues,
});

export type PersonRequest = z.infer<typeof personRequestSchema>;

// Adds one person, or several pasted at once, all saved together.
export const peopleRequestSchema = z.object({
  people: z.array(personRequestSchema).min(1).max(1000),
});

// Changes some of a person's details; columns named in values have their choices replaced, those
// named in links their link, and those named in notes their note.
export const personChangeSchema = z.object({
  preferredName: preferredNameSchema.optional(),
  employeeId: employeeId.optional(),
  positionId: z.uuid().optional(),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  stateId: z.uuid().optional(),
  ...reporting,
  ...changedColumnValues,
});

export type PersonChange = z.infer<typeof personChangeSchema>;

const heldAlone = {
  link: { kind: "web link", value: "link" },
  note: { kind: "note", value: "note" },
  number: { kind: "number", value: "number" },
};

// What sets each table apart: its name, what reading it needs, what adding, changing and removing
// its columns needs, which is editing its records and seeing people, whose sight General lists and
// columns take, which Approve decides its columns' drafts, that of its records' area, whether
// planned hires are offered its added columns, whether they must be General, and whether a column
// may draft a new General list with it, for a table whose editors don't make lists on Lists.
export const columnTablePolicies: Readonly<
  Record<
    ColumnTable,
    {
      name: string;
      viewNeeds: Permission;
      editNeeds: readonly Permission[];
      approveNeeds: ApprovePermission;
      onPlannedHires: boolean;
      generalOnly: boolean;
      newLists: boolean;
    }
  >
> = {
  people: {
    name: "People",
    viewNeeds: "people:view",
    editNeeds: ["people:edit", "people:view"],
    approveNeeds: "people:approve",
    onPlannedHires: true,
    generalOnly: false,
    newLists: false,
  },
  features: {
    name: "Features",
    viewNeeds: "features:view",
    editNeeds: ["features:edit", "people:view"],
    approveNeeds: "features:approve",
    onPlannedHires: false,
    generalOnly: true,
    newLists: true,
  },
  activities: {
    name: "Activities",
    viewNeeds: "features:view",
    editNeeds: ["features:edit", "people:view"],
    approveNeeds: "features:approve",
    onPlannedHires: false,
    generalOnly: true,
    newLists: true,
  },
};

// Whether permissions let a role add, change and remove a table's columns.
export const editsColumnsOf = (
  permissions: readonly string[],
  table: ColumnTable,
): boolean =>
  // The table is always one of the fixed tables.
  // eslint-disable-next-line security/detect-object-injection
  columnTablePolicies[table].editNeeds.every((need) =>
    permissions.includes(need),
  );

// A General list drafted with the column that draws on it, and its choices, in order, approved with
// the column; offered only on the plan's tables, whose editors don't make lists on Lists.
export const newListSchema = z.object({
  name: z.string().trim().min(1).max(listLengths.name),
  choices: z
    .array(choiceRequestSchema.pick({ label: true, description: true }))
    .min(1)
    .max(mostChoicesAtOnce)
    .refine(
      (choices) =>
        new Set(choices.map(({ label }) => label.toLowerCase())).size ===
        choices.length,
      "A choice is in the list twice",
    ),
});

export type NewList = z.infer<typeof newListSchema>;

// A choice column names its list, or a new one, and takes its visibility from it; a web link, note,
// or number column names its visibility, no list, and takes one value.
export const fieldRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(personLengths.column),
    type: fieldTypeSchema.default("choice"),
    listId: z.uuid().optional(),
    newList: newListSchema.optional(),
    visibility: tierSchema.optional(),
    multiple: z.boolean().default(false),
    required: z.boolean().default(false),
    onPlannedHires: z.boolean().default(true),
  })
  .superRefine((request, context) => {
    const issue = (message: string) => {
      context.addIssue({ code: "custom", message });
    };
    if (request.type === "choice") {
      if (request.listId === undefined && request.newList === undefined) {
        issue("Choose a list");
      }
      if (request.listId !== undefined && request.newList !== undefined) {
        issue("Choose a list or a new one, not both");
      }
    } else {
      const { kind, value } = heldAlone[request.type];
      if (request.visibility === undefined) issue("Choose a visibility");
      if (request.listId !== undefined || request.newList !== undefined) {
        issue(`A ${kind} column has no list`);
      }
      if (request.multiple) issue(`A ${kind} column holds one ${value}`);
    }
  })
  .transform((request) =>
    request.type === "choice" ? { ...request, visibility: undefined } : request,
  );

export type FieldRequest = z.infer<typeof fieldRequestSchema>;

// The change set a change was saved in, which undoing it names; null when nothing changed.
export const changeSetIdSchema = z.uuid().nullable();

export const savedSchema = z.object({ changeSetId: changeSetIdSchema });

export type Saved = z.infer<typeof savedSchema>;
