// SPDX-License-Identifier: Apache-2.0

// A table's view, its search, filters, sort, breakdown, frozen columns, and the widths set for its
// columns, as the page address holds it and as a saved view keeps it, and the saved views
// themselves. Saved views are shared: everyone who sees a table sees its saved views, except those
// that filter, sort, or break down by a column they may not see. Their maker, and those who may
// change planning configuration, may change them.

import { z } from "zod";
import { daySchema } from "./days.ts";

export const viewLengths = { name: 80 } as const;

// Limits on what a view may hold, which only a hand-made address or request reaches. The history
// pages' searches share the limit on text.
export const textLimit = 200;
const keyLimit = 64;
const filtersLimit = 100;
const levelsLimit = 10;
// A breakdown counts the rows by one column, or by two crossed.
export const breakdownLimit = 2;
// More frozen columns than any table has, as only a hand-made address reaches.
const frozenLimit = 100;
// The least and most a column's width may be set to, in pixels: room for its header's marks, and
// several screens across.
export const columnWidths = { least: 64, most: 1600 } as const;

const key = z.string().min(1).max(keyLimit);
const frozen = z.number().int().min(0).max(frozenLimit);
const width = z.number().int().min(columnWidths.least).max(columnWidths.most);

// A column's filter. A row matches when its value matches any part that is set: for text, when it
// contains the text; for dates, when it falls between from and to, either of which may be left
// open; for choices, when it holds any of them. With `empty`, an empty value matches too.
export const filterSchema = z.object({
  contains: z.string().max(textLimit).optional(),
  from: daySchema.optional(),
  to: daySchema.optional(),
  any: z.array(key).max(textLimit).optional(),
  empty: z.boolean().optional(),
});

export type Filter = z.infer<typeof filterSchema>;

const sortLevel = z.string().regex(/^-?[\w-]{1,64}$/);
const columnKey = z.string().regex(/^[\w-]{1,64}$/);
// More widths than any table has columns, as only a hand-made address reaches.
const widthsLimit = 100;

// Which version of each record a table shows: its draft beside its live row, the draft alone, as
// everything will be once approved, or the live record alone, as everything is now.
export const showSchema = z.enum(["both", "drafts", "live"]);

export type Show = z.infer<typeof showSchema>;

// The view: the search, each column's filter by key, the sort as keys, each with a leading "-" when
// descending, the keys of the columns the rows are broken down by, which is set, even when empty,
// while the metrics show, and how many columns, from the first, stay in view while the table
// scrolls sideways, when not the table's own default, and the width set for each column, in pixels,
// by key, for those not left to fit what they hold. Each filter, sort level, breakdown column, and
// width that does not fit is dropped on its own, keeping the others, as is anything else that does
// not fit.
export const viewDefinitionSchema = z.object({
  search: z.string().max(textLimit).optional().catch(undefined),
  show: showSchema.optional().catch(undefined),
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
  breakdown: z
    .array(z.unknown())
    .optional()
    .catch(undefined)
    .transform((raw) =>
      raw === undefined
        ? undefined
        : [
            ...new Set(
              raw.filter(
                (name): name is string => columnKey.safeParse(name).success,
              ),
            ),
          ].slice(0, breakdownLimit),
    ),
  ungrouped: z.literal(true).optional().catch(undefined),
  frozen: frozen.optional().catch(undefined),
  widths: z
    .record(z.string(), z.unknown())
    .optional()
    .catch(undefined)
    .transform((raw) =>
      raw === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(raw)
              .flatMap(([name, value]) => {
                const set = width.safeParse(value);
                return columnKey.safeParse(name).success && set.success
                  ? [[name, set.data] as const]
                  : [];
              })
              .slice(0, widthsLimit),
          ),
    ),
});

// The view as read from the address or a saved view, and as written to them.
export interface ViewDefinition {
  search?: string | undefined;
  show?: Show | undefined;
  filters?: Record<string, Filter> | undefined;
  sort?: string[] | undefined;
  breakdown?: string[] | undefined;
  ungrouped?: true | undefined;
  frozen?: number | undefined;
  widths?: Record<string, number> | undefined;
}

// A view as a request sends it, which must fit as a whole, since a page sends only views it made.
const strictDefinitionSchema = z.object({
  search: z.string().max(textLimit).optional(),
  show: showSchema.optional(),
  filters: z
    .record(key, filterSchema)
    .refine(
      (filters) => Object.keys(filters).length <= filtersLimit,
      "Too many filters",
    )
    .optional(),
  sort: z.array(sortLevel).max(levelsLimit).optional(),
  breakdown: z
    .array(columnKey)
    .max(breakdownLimit)
    .refine((keys) => new Set(keys).size === keys.length, "Repeated column")
    .optional(),
  ungrouped: z.literal(true).optional(),
  frozen: frozen.optional(),
  widths: z
    .record(columnKey, width)
    .refine(
      (widths) => Object.keys(widths).length <= widthsLimit,
      "Too many widths",
    )
    .optional(),
});

// The key of the People table's filter on drafts, which filters people by whether they have a
// draft, waiting or rejected, but is not a column, so is neither searched nor sorted on.
export const draftFilterKey = "draft";

// The keys of the columns a view filters, sorts, or breaks down on, and of any filter that is not a
// column.
export function viewColumnKeys(definition: ViewDefinition): string[] {
  return [
    ...new Set([
      ...Object.keys(definition.filters ?? {}),
      ...(definition.sort ?? []).map((level) => level.replace(/^-/, "")),
      ...(definition.breakdown ?? []),
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
