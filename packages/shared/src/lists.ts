// SPDX-License-Identifier: Apache-2.0

// Lists of choices that people define, such as locations or skills, for columns elsewhere to draw
// on. Each list has a name, an optional description, and a visibility: the sensitivity tier of the
// values chosen from it. Its choices are in the order set for them, and lists and choices can each
// be retired.

import { z } from "zod";
import { tierSchema } from "./access.ts";

export const listLengths = {
  name: 40,
  choice: 60,
  description: 500,
} as const;

export const choiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  // Empty when the choice has no description.
  description: z.string(),
  // A retired choice stays on records that have it, but is no longer offered.
  retired: z.boolean(),
});

export type Choice = z.infer<typeof choiceSchema>;

export const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  visibility: tierSchema,
  // A retired list is no longer offered for new values.
  retired: z.boolean(),
  // In order, offered and retired alike.
  choices: z.array(choiceSchema),
});

export type List = z.infer<typeof listSchema>;

// Every list, by name.
export const listsSchema = z.object({ lists: z.array(listSchema) });

const description = z.string().trim().max(listLengths.description).default("");

export const listRequestSchema = z.object({
  name: z.string().trim().min(1).max(listLengths.name),
  description,
  visibility: tierSchema.default("general"),
});

export type ListRequest = z.infer<typeof listRequestSchema>;

export const choiceRequestSchema = z.object({
  label: z.string().trim().min(1).max(listLengths.choice),
  description,
});

export type ChoiceRequest = z.infer<typeof choiceRequestSchema>;

// Adds one choice, or several pasted at once, to the end of a list, all saved together.
export const choicesRequestSchema = z.object({
  choices: z.array(choiceRequestSchema).min(1).max(1000),
});

// Restoring a choice puts it at the end of the list.
export const retiredRequestSchema = z.object({ retired: z.boolean() });

export type RetiredRequest = z.infer<typeof retiredRequestSchema>;

// Moves a choice to just after another in the same list, or to the top when there is none.
export const choiceMoveSchema = z.object({ after: z.uuid().nullable() });
