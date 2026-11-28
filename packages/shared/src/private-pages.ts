// SPDX-License-Identifier: Apache-2.0

// A person's own pages under Mine, each a table of free rows private to its maker, as readers
// receive them and requests change them.

import { z } from "zod";
import { type Permission, tierSchema } from "./access.ts";
import {
  changedColumnValues,
  givenColumnValues,
  valuesSchema,
} from "./column-values.ts";
import {
  changeSetIdSchema,
  type FieldType,
  fieldRequestSchema,
  fieldTypeSchema,
} from "./people.ts";

export const privatePageLengths = { name: 60 } as const;

// More columns than a page made at once needs, as only a hand-made request reaches.
export const mostColumnsAtOnce = 50;

export const makesPrivatePages: Permission = "private-pages:make";

// The types a page's first column may be, since its value names each row.
export const rowNamingTypes: readonly FieldType[] = ["number", "text", "date"];

// Whether a reader may read a page: its maker, while their role may make private pages. Nobody
// else may, an Administrator included.
export const mayReadPrivatePage = (
  reader: { id: string; permissions: readonly Permission[] },
  page: { userId: string },
): boolean =>
  page.userId === reader.id && reader.permissions.includes(makesPrivatePages);

// Changing a page needs no more than reading it, until pages are shared to be viewed.
export const mayEditPrivatePage = mayReadPrivatePage;

const pageName = z.string().trim().min(1).max(privatePageLengths.name);

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

// A random key's code, made with its page or row; null only for one made before keys were.
const keyCode = z.string().nullable();

// A row of a page with its values, by column, in only the columns its reader sees.
export const privateRowSchema = z.object({
  id: z.string(),
  key: keyCode,
  values: valuesSchema,
  ...givenColumnValues,
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
  key: keyCode,
  // The column naming each row, or null when the reader isn't shown it.
  firstFieldId: z.string().nullable(),
  columns: z.array(privateColumnSchema),
  rows: z.array(privateRowSchema),
});

export type PrivatePage = z.infer<typeof privatePageSchema>;

export const savedPrivatePageSchema = z.object({
  page: privatePageSchema,
  changeSetId: changeSetIdSchema,
});

// A column on a page, as a column on any table is asked for. A choice column draws on a list made
// on Lists, never on a new one, and a page's columns are never offered on planned hires. A page's
// columns don't link to other tables yet.
export const privateColumnRequestSchema = fieldRequestSchema
  .refine(({ newList }) => newList === undefined, "Choose a list from Lists")
  .refine(({ type }) => type !== "record", "A page can't link to a table");

export type PrivateColumnRequest = z.infer<typeof privateColumnRequestSchema>;

// A new page with its columns, the first naming each row.
export const privatePageRequestSchema = z
  .object({
    name: pageName,
    columns: z
      .array(privateColumnRequestSchema)
      .min(1, "Add a column to name each row")
      .max(mostColumnsAtOnce),
  })
  .superRefine(({ columns }, context) => {
    const [first] = columns;
    if (first !== undefined && !rowNamingTypes.includes(first.type)) {
      context.addIssue({
        code: "custom",
        message: "The first column names each row, so choose another type",
        path: ["columns", 0, "type"],
      });
    }
    if (columns.slice(1).some(({ required }) => required)) {
      context.addIssue({
        code: "custom",
        message: "Only the first column is required",
        path: ["columns"],
      });
    }
    const names = columns.map(({ name }) => name.toLowerCase());
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: "custom",
        message: "Give each column its own name",
        path: ["columns"],
      });
    }
  });

export type PrivatePageRequest = z.infer<typeof privatePageRequestSchema>;

export const privatePageRenameSchema = z.object({ name: pageName });

// Where a page moves to among its maker's pages, counting from the first.
export const privatePagePositionSchema = z.object({
  position: z.number().int().min(0),
});

// A new row's values, or a change to a row's: each column named is replaced, and null removes its
// value. A row always holds a value in its first column.
export const privateRowRequestSchema = z.object(changedColumnValues);

export type PrivateRowRequest = z.infer<typeof privateRowRequestSchema>;
