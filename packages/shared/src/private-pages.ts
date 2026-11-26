// SPDX-License-Identifier: Apache-2.0

// A person's own pages under Mine, each a table of free rows private to its maker, as readers
// receive them.

import { z } from "zod";
import { type Permission, tierSchema } from "./access.ts";
import {
  fieldTypeSchema,
  linksSchema,
  notesSchema,
  numbersSchema,
  valuesSchema,
} from "./people.ts";

export const makesPrivatePages: Permission = "private-pages:make";

// Whether a reader may read a page: its maker, while their role may make private pages. Nobody
// else may, an Administrator included.
export const mayReadPrivatePage = (
  reader: { id: string; permissions: readonly Permission[] },
  page: { userId: string },
): boolean =>
  page.userId === reader.id && reader.permissions.includes(makesPrivatePages);

// A page's column, as its maker sees it.
export const privateColumnSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: fieldTypeSchema,
  listId: z.string().nullable(),
  visibility: tierSchema.nullable(),
  multiple: z.boolean(),
});

export type PrivateColumn = z.infer<typeof privateColumnSchema>;

// A row of a page with its values, by column, in only the columns its reader sees.
export const privateRowSchema = z.object({
  id: z.string(),
  values: valuesSchema,
  links: linksSchema,
  notes: notesSchema,
  numbers: numbersSchema,
});

export type PrivateRow = z.infer<typeof privateRowSchema>;

// A page under Mine, in its maker's order.
export const listedPrivatePageSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
});

export type ListedPrivatePage = z.infer<typeof listedPrivatePageSchema>;

// A page with its columns, in order, and its rows, in the order they were added.
export const privatePageSchema = listedPrivatePageSchema.extend({
  // The column naming each row, or null when the reader isn't shown it.
  firstFieldId: z.string().nullable(),
  columns: z.array(privateColumnSchema),
  rows: z.array(privateRowSchema),
});

export type PrivatePage = z.infer<typeof privatePageSchema>;
