// SPDX-License-Identifier: Apache-2.0

// People and the columns people add to the People table. Every person has a preferred name and an
// Employee ID, which are General, and may have start and end dates, which are Restricted. Each
// column draws on a list, and its values are choices from that list, as sensitive as the list's
// visibility. What a user receives leaves out what their roles do not let them see.

import { z } from "zod";
import { listLengths } from "./lists.ts";

export const personLengths = {
  preferredName: 100,
  employeeId: 40,
  column: listLengths.name,
} as const;

// A date without a time, such as 2026-10-31.
const day = z.iso.date();

// A column on the People table, drawing on a list. The column decides what it is called, whether
// one choice or several can be picked, and whether a value is required.
export const fieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  listId: z.string(),
  multiple: z.boolean(),
  required: z.boolean(),
});

export type Field = z.infer<typeof fieldSchema>;

// The most choices one column can hold for one person.
const choicesLimit = 100;

// The chosen choices of each column, by column, in the list's order. A column with nothing chosen
// is left out.
const valuesSchema = z.record(z.string(), z.array(z.string()));

// Choices asked for, by column: each a choice's identifier, at most once.
const requestedValuesSchema = z.record(
  z.uuid(),
  z
    .array(z.uuid())
    .max(choicesLimit)
    .refine((ids) => new Set(ids).size === ids.length, "Each choice once"),
);

export const personSchema = z.object({
  id: z.string(),
  preferredName: z.string(),
  employeeId: z.string(),
  // Left out for users who cannot see Restricted details; null when not set.
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  values: valuesSchema,
});

export type Person = z.infer<typeof personSchema>;

// Everyone the user may see, by preferred name, with the added columns whose values they may see,
// and the order of the columns they see: built-in ones by name, such as "employeeId", and added ones
// by identifier.
export const peopleSchema = z.object({
  people: z.array(personSchema),
  fields: z.array(fieldSchema),
  order: z.array(z.string()),
});

const preferredName = z.string().trim().min(1).max(personLengths.preferredName);
const employeeId = z.string().trim().min(1).max(personLengths.employeeId);

export const personRequestSchema = z.object({
  preferredName,
  employeeId,
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  values: requestedValuesSchema.default({}),
});

export type PersonRequest = z.infer<typeof personRequestSchema>;

// Adds one person, or several pasted at once, all saved together.
export const peopleRequestSchema = z.object({
  people: z.array(personRequestSchema).min(1).max(1000),
});

// Changes some of a person's details; columns named in values have their choices replaced.
export const personChangeSchema = z.object({
  preferredName: preferredName.optional(),
  employeeId: employeeId.optional(),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  values: requestedValuesSchema.optional(),
});

export type PersonChange = z.infer<typeof personChangeSchema>;

export const fieldRequestSchema = z.object({
  name: z.string().trim().min(1).max(personLengths.column),
  listId: z.uuid(),
  multiple: z.boolean().default(false),
  required: z.boolean().default(false),
});

export type FieldRequest = z.infer<typeof fieldRequestSchema>;

// The key of a column on the People table: a built-in column's name, or an added column's identifier.
export const columnKeySchema = z.string().min(1).max(64);

// Moves a column to just after another, or to the start when there is none.
export const fieldMoveSchema = z.object({ after: columnKeySchema.nullable() });

// The change set a change was saved in, which undoing it names; null when nothing changed.
export const changeSetIdSchema = z.uuid().nullable();

export const savedSchema = z.object({ changeSetId: changeSetIdSchema });

export type Saved = z.infer<typeof savedSchema>;
