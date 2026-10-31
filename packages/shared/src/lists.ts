// SPDX-License-Identifier: Apache-2.0

// The lists of choices offered for some of a person's details, such as their site or position,
// which the Workforce Administrator maintains.

import { z } from "zod";
import { changeStampSchema } from "./changes.ts";

export const listNameSchema = z.enum([
  "sites",
  "positions",
  "levels",
  "team-roles",
]);

export type ListName = z.infer<typeof listNameSchema>;

export const listItemLabelLength = { maximum: 100 } as const;
export const listItemDescriptionLength = { maximum: 500 } as const;

export const listItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  // Empty when the choice has no description.
  description: z.string(),
  created: changeStampSchema,
  changed: changeStampSchema,
});

export type ListItem = z.infer<typeof listItemSchema>;

// Every list, in the order above, each with its items in natural order, so "P10" follows "P9".
export const listsSchema = z.object({
  lists: z.array(
    z.object({ name: listNameSchema, items: z.array(listItemSchema) }),
  ),
});

export type Lists = z.infer<typeof listsSchema>["lists"];

export const listItemRequestSchema = z.object({
  label: z.string().trim().min(1).max(listItemLabelLength.maximum),
  // Optional, so a choice can be added by name alone.
  description: z
    .string()
    .trim()
    .max(listItemDescriptionLength.maximum)
    .default(""),
});

export type ListItemRequest = z.infer<typeof listItemRequestSchema>;
