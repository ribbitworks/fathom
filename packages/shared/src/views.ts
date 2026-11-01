// SPDX-License-Identifier: Apache-2.0

// A table's view, its search, filters, and sort, as the page address holds it and as a saved view
// keeps it, and the saved views themselves. Saved views are shared: everyone who sees a table sees
// its saved views, except those that filter or sort on a column they may not see. Their maker, and
// those who may change planning configuration, may change them.

import { z } from "zod";

export const viewLengths = { name: 80 } as const;

// Limits on what a view may hold, which only a hand-made address or request reaches. The history
// pages' searches share the limit on text.
export const textLimit = 200;
const keyLimit = 64;
const filtersLimit = 100;
const levelsLimit = 10;

const key = z.string().min(1).max(keyLimit);

// A column's filter. A row matches when its value matches any part that is set: for text, when it
// contains the text; for dates, when it falls between from and to, either of which may be left
// open; for choices, when it holds any of them. With `empty`, an empty value matches too.
export const filterSchema = z.object({
  contains: z.string().max(textLimit).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  any: z.array(key).max(textLimit).optional(),
  empty: z.boolean().optional(),
});

export type Filter = z.infer<typeof filterSchema>;

const sortLevel = z.string().regex(/^-?[\w-]{1,64}$/);

// The view: the search, each column's filter by key, and the sort as keys, each with a leading "-"
// when descending. Each filter and sort level that does not fit is dropped on its own, keeping the
// others, as is anything else that does not fit.
export const viewDefinitionSchema = z.object({
  search: z.string().max(textLimit).optional().catch(undefined),
  filters: z
    .record(z.string(), z.unknown())
    .optional()
    .catch(undefined)
    .transform((raw) =>
      raw === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(raw)
              .flatMap(([name, value]) => {
                const filter = filterSchema.safeParse(value);
                return key.safeParse(name).success && filter.success
                  ? [[name, filter.data] as const]
                  : [];
              })
              .slice(0, filtersLimit),
          ),
    ),
  sort: z
    .array(z.unknown())
    .optional()
    .catch(undefined)
    .transform((raw) =>
      raw
        ?.filter((level): level is string => sortLevel.safeParse(level).success)
        .slice(0, levelsLimit),
    ),
});

// The view as read from the address or a saved view, and as written to them.
export interface ViewDefinition {
  search?: string | undefined;
  filters?: Record<string, Filter> | undefined;
  sort?: string[] | undefined;
}

// A view as a request sends it, which must fit as a whole, since a page sends only views it made.
const strictDefinitionSchema = z.object({
  search: z.string().max(textLimit).optional(),
  filters: z
    .record(key, filterSchema)
    .refine(
      (filters) => Object.keys(filters).length <= filtersLimit,
      "Too many filters",
    )
    .optional(),
  sort: z.array(sortLevel).max(levelsLimit).optional(),
});

// The key of the People table's filter on drafts, which filters people by whether they have a
// draft, waiting or rejected, but is not a column, so is neither searched nor sorted on.
export const draftFilterKey = "draft";

// The keys of the columns a view filters or sorts on, and of any filter that is not a column.
export function viewColumnKeys(definition: ViewDefinition): string[] {
  return [
    ...new Set([
      ...Object.keys(definition.filters ?? {}),
      ...(definition.sort ?? []).map((level) => level.replace(/^-/, "")),
    ]),
  ];
}

// A saved view as a user receives it, with whether they may rename, update, or delete it.
export const savedViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  definition: strictDefinitionSchema,
  canChange: z.boolean(),
});

export type SavedView = z.infer<typeof savedViewSchema>;

const viewName = z.string().trim().min(1).max(viewLengths.name);

export const savedViewRequestSchema = z.object({
  name: viewName,
  definition: strictDefinitionSchema,
});

export interface SavedViewRequest {
  name: string;
  definition: ViewDefinition;
}

// Renames a saved view, saves a new view over it, or both.
export const savedViewChangeSchema = z.object({
  name: viewName.optional(),
  definition: strictDefinitionSchema.optional(),
});

export interface SavedViewChange {
  name?: string | undefined;
  definition?: ViewDefinition | undefined;
}
