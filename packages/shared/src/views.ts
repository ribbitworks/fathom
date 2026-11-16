// SPDX-License-Identifier: Apache-2.0

// A table's view, its search, filters, sort, breakdown, groupings, frozen columns, the order of its
// columns, those hidden, those hidden at first that it shows, the widths set for them, the unit and
// decimal places each column that offers units is shown in, whether its retired records show, and
// its page's own choices, as the page address holds it and as a saved view keeps it, and the saved
// views themselves. A saved view
// is personal, seen and changed only by its maker, or shared: seen by everyone who opens its page,
// except those it filters, sorts, breaks down, or groups by a column they may not see, and changed
// by its maker and those who may share views on its table.

import { z } from "zod";
import { daySchema } from "./days.ts";
import { numberDigits, numberValueSchema } from "./numbers.ts";

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
// The unit a column is shown in, such as person-weeks, by its key among the units the column offers.
const unit = z.string().regex(/^[a-z-]{1,64}$/);
// The most decimal places a column's numbers show, as far as a number can be typed with.
const places = z.number().int().min(0).max(numberDigits.afterPoint);

// A page's choice, by the name its address gives it, such as Features' `mode`: one value or several.
const choiceValuesLimit = 20;
const choiceValue = z.union([
  z.string().max(textLimit),
  z.array(z.string().max(textLimit)).max(choiceValuesLimit),
]);

// A choice left out is left as the page starts.
export type ViewChoices = Record<string, string | string[] | undefined>;

// A column's filter. A row matches when its value matches any part that is set: for text, when it
// contains the text; for dates, when it falls between from and to, and for numbers, between
// atLeast and atMost, either of which may be left open; for choices, when it holds any of them.
// With `empty`, an empty value matches too; with `notEmpty`, any value that isn't empty does.
export const filterSchema = z.object({
  contains: z.string().max(textLimit).optional(),
  from: daySchema.optional(),
  to: daySchema.optional(),
  atLeast: numberValueSchema.optional(),
  atMost: numberValueSchema.optional(),
  any: z.array(key).max(textLimit).optional(),
  empty: z.boolean().optional(),
  notEmpty: z.boolean().optional(),
});

export type Filter = z.infer<typeof filterSchema>;

const sortLevel = z.string().regex(/^-?[\w-]{1,64}$/);
const columnKey = z.string().regex(/^[\w-]{1,64}$/);
// More than any table has columns, as only a hand-made address reaches.
const columnsLimit = 100;
// More than any page has choices, as only a hand-made address reaches; an address keeps as many as
// it keeps of any part by column.
const choicesLimit = columnsLimit;

// Column keys as an address or saved view holds them: each that does not fit is dropped, as is any
// repeat.
const looseColumnKeys = (limit: number) =>
  z
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
          ].slice(0, limit),
    );

// A value for each column, by key, as an address or saved view holds them: each that does not fit
// is dropped on its own, keeping the others.
const looseByColumn = <Value>(valueSchema: z.ZodType<Value>) =>
  z
    .record(z.string(), z.unknown())
    .optional()
    .catch(undefined)
    .transform((raw) =>
      raw === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(raw)
              .flatMap(([name, value]) => {
                const set = valueSchema.safeParse(value);
                return columnKey.safeParse(name).success && set.success
                  ? [[name, set.data] as const]
                  : [];
              })
              .slice(0, columnsLimit),
          ),
    );

// Column keys as a request sends them, which must fit as a whole.
const columnKeys = (limit: number) =>
  z
    .array(columnKey)
    .max(limit)
    .refine((keys) => new Set(keys).size === keys.length, "Repeated column");

// Which version of each record a table shows: its draft beside its live row, the draft alone, as
// everything will be once approved, or the live record alone, as everything is now.
export const showSchema = z.enum(["both", "drafts", "live"]);

export type Show = z.infer<typeof showSchema>;

// The view: the search, each column's filter by key, the sort as keys, each with a leading "-" when
// descending, the keys of the columns the rows are broken down by, which is set, even when empty,
// while the metrics show, and how many columns, from the first, stay in view while the table
// scrolls sideways, when not the table's own default, the keys of the columns in the order the view
// puts them, when moved from the table's own order, the width set for each column, in pixels, by
// key, for those not left to fit what they hold, and the unit and decimal places each column that
// offers units is shown in, by key, for those not shown as they start. Each filter, sort level,
// breakdown column, width, unit, and number of places that does not fit is dropped on its own,
// keeping the others, as is anything else that does not fit.
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
  breakdown: looseColumnKeys(breakdownLimit),
  grouping: columnKey.optional().catch(undefined),
  thenBy: columnKey.optional().catch(undefined),
  frozen: frozen.optional().catch(undefined),
  order: looseColumnKeys(columnsLimit),
  hidden: looseColumnKeys(columnsLimit),
  shown: looseColumnKeys(columnsLimit),
  widths: looseByColumn(width),
  units: looseByColumn(unit),
  places: looseByColumn(places),
  retired: z.literal(true).optional().catch(undefined),
  choices: looseByColumn(choiceValue),
});

// The view as read from the address or a saved view, and as written to them.
export interface ViewDefinition {
  search?: string | undefined;
  show?: Show | undefined;
  filters?: Record<string, Filter> | undefined;
  sort?: string[] | undefined;
  breakdown?: string[] | undefined;
  grouping?: string | undefined;
  // The grouping of the rows under each of the first grouping's headings.
  thenBy?: string | undefined;
  frozen?: number | undefined;
  order?: string[] | undefined;
  hidden?: string[] | undefined;
  // The columns a table hides until asked that the view shows.
  shown?: string[] | undefined;
  widths?: Record<string, number> | undefined;
  units?: Record<string, string> | undefined;
  places?: Record<string, number> | undefined;
  retired?: true | undefined;
  choices?: ViewChoices | undefined;
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
  breakdown: columnKeys(breakdownLimit).optional(),
  grouping: columnKey.optional(),
  thenBy: columnKey.optional(),
  frozen: frozen.optional(),
  order: columnKeys(columnsLimit).optional(),
  hidden: columnKeys(columnsLimit).optional(),
  shown: columnKeys(columnsLimit).optional(),
  widths: z
    .record(columnKey, width)
    .refine(
      (widths) => Object.keys(widths).length <= columnsLimit,
      "Too many widths",
    )
    .optional(),
  units: z
    .record(columnKey, unit)
    .refine(
      (units) => Object.keys(units).length <= columnsLimit,
      "Too many units",
    )
    .optional(),
  places: z
    .record(columnKey, places)
    .refine(
      (byColumn) => Object.keys(byColumn).length <= columnsLimit,
      "Too many places",
    )
    .optional(),
  retired: z.literal(true).optional(),
  // Checked against the view's table where it is saved.
  choices: z
    .record(columnKey, choiceValue.optional())
    .refine(
      (choices) => Object.keys(choices).length <= choicesLimit,
      "Too many choices",
    )
    .optional(),
});

// The key of the People table's filter on drafts, which filters people by whether they have a
// draft, waiting or rejected, but is not a column, so is neither searched nor sorted on.
export const draftFilterKey = "draft";

// The keys wanted, put into the places those keys hold in the current order, every other key staying
// where it is; a key the current order does not name goes at the end.
export function inPlacesOf(
  current: readonly string[],
  wanted: readonly string[],
): string[] {
  const placed = wanted.filter((key) => current.includes(key));
  let next = 0;
  return [
    ...current.map((key) =>
      wanted.includes(key) ? (placed[next++] as string) : key,
    ),
    ...wanted.filter((key) => !current.includes(key)),
  ];
}

// The keys of the groupings a view names, the first, then the one under it.
export const viewGroupings = (definition: ViewDefinition): string[] =>
  [definition.grouping, definition.thenBy].filter(
    (key): key is string => key !== undefined,
  );

// The keys of the columns a view filters, sorts, breaks down, or groups by, and of any filter that
// is not a column.
export function viewColumnKeys(definition: ViewDefinition): string[] {
  return [
    ...new Set([
      ...Object.keys(definition.filters ?? {}),
      ...(definition.sort ?? []).map((level) => level.replace(/^-/, "")),
      ...(definition.breakdown ?? []),
      ...viewGroupings(definition),
    ]),
  ];
}

export const viewScopeSchema = z.enum(["personal", "shared"]);

export type ViewScope = z.infer<typeof viewScopeSchema>;

// A saved view as a user receives it, with whether they may rename, update, or delete it, and
// whether they may share it or take it back.
export const savedViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: viewScopeSchema,
  definition: strictDefinitionSchema,
  canChange: z.boolean(),
  canShare: z.boolean(),
});

export type SavedView = z.infer<typeof savedViewSchema>;

// A personal view its maker can no longer apply, since it uses columns, or groupings, their role
// can't see now: sent by name, with what is missing, to be renamed or deleted, never its definition.
export const unusableViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  missing: z.object({
    columns: z.array(z.string()),
    groupings: z.array(z.string()),
  }),
});

export type UnusableView = z.infer<typeof unusableViewSchema>;

export const listedViewSchema = z.union([savedViewSchema, unusableViewSchema]);

export type ListedView = z.infer<typeof listedViewSchema>;

const viewName = z.string().trim().min(1).max(viewLengths.name);

export const savedViewRequestSchema = z.object({
  name: viewName,
  scope: viewScopeSchema,
  definition: strictDefinitionSchema,
});

export interface SavedViewRequest {
  name: string;
  scope: ViewScope;
  definition: ViewDefinition;
}

// Renames a saved view, saves a new view over it, shares it or takes it back, or any of these.
export const savedViewChangeSchema = z.object({
  name: viewName.optional(),
  scope: viewScopeSchema.optional(),
  definition: strictDefinitionSchema.optional(),
});

export interface SavedViewChange {
  name?: string | undefined;
  scope?: ViewScope | undefined;
  definition?: ViewDefinition | undefined;
}
