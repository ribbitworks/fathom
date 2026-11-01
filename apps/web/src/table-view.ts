// SPDX-License-Identifier: Apache-2.0

// Filtering, searching, and sorting any table, in the browser, over the rows the user has been sent,
// as ADR 0006 sets out. A table describes its columns, each of a kind, and how to read a row's value
// in each; each kind says how its values are searched, sorted, and filtered, so a new kind is added
// in one place. The view a table shows, its search, filters, and sort, is kept in the page address.

import { useState } from "react";
import { z } from "zod";

// What a cell holds: text, a date as YYYY-MM-DD or empty, or the identifiers of chosen choices.
export type CellValue = string | string[];

export type Kind = "text" | "date" | "choice";

export interface ColumnChoice {
  id: string;
  label: string;
  // Retired choices are no longer offered, but people may still hold them.
  retired?: boolean;
}

export interface TableColumn<Row> {
  // Unique among the table's columns, and how the address names the column.
  key: string;
  label: string;
  kind: Kind;
  // For choice columns: the choices in their list's order, and whether a cell may hold several.
  choices: readonly ColumnChoice[];
  multiple: boolean;
  value: (row: Row) => CellValue;
}

export interface SortLevel {
  key: string;
  descending: boolean;
}

export interface View {
  search: string;
  filters: Record<string, Filter>;
  sort: SortLevel[];
}

export const emptyView: View = { search: "", filters: {}, sort: [] };

// Limits on what the address may hold, which only a hand-made address reaches.
const textLimit = 200;
const keyLimit = 64;
const levelsLimit = 10;

const key = z.string().min(1).max(keyLimit);
const isoDay = z.iso.date();

// Whether text is a whole date, such as 2026-10-31, that exists.
export function isDay(text: string): boolean {
  return isoDay.safeParse(text).success;
}

// A column's filter. A row matches when its value matches any part that is set: for text, when it
// contains the text; for dates, when it falls between from and to, either of which may be left
// open; for choices, when it holds any of them. With `empty`, an empty value matches too.
const filterSchema = z.object({
  contains: z.string().max(textLimit).optional(),
  from: isoDay.optional(),
  to: isoDay.optional(),
  any: z.array(key).max(textLimit).optional(),
  empty: z.boolean().optional(),
});

export type Filter = z.infer<typeof filterSchema>;

const sortLevel = z.string().regex(/^-?[\w-]{1,64}$/);

// The view as the address holds it: the search, each column's filter by key, and the sort as keys,
// each with a leading "-" when descending. Each filter and sort level that does not fit is dropped
// on its own, keeping the others, as is anything else that does not fit.
export const viewSearchSchema = z.object({
  search: z.string().max(textLimit).optional().catch(undefined),
  filters: z
    .record(z.string(), z.unknown())
    .optional()
    .catch(undefined)
    .transform((raw) =>
      raw === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(raw).flatMap(([name, value]) => {
              const filter = filterSchema.safeParse(value);
              return key.safeParse(name).success && filter.success
                ? [[name, filter.data]]
                : [];
            }),
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

// The view as read from the address, and as written to it.
export interface ViewSearch {
  search?: string | undefined;
  filters?: Record<string, Filter> | undefined;
  sort?: string[] | undefined;
}

export function viewFrom(search: ViewSearch): View {
  return {
    search: search.search ?? "",
    filters: search.filters ?? {},
    sort: (search.sort ?? []).map((level) =>
      level.startsWith("-")
        ? { key: level.slice(1), descending: true }
        : { key: level, descending: false },
    ),
  };
}

// A table's view as its page's address holds it, and how to change it, for any page whose route
// reads its address with viewSearchSchema. `go` sets the address, replacing the current entry in its
// history when asked.
export function viewProps(
  search: ViewSearch,
  go: (search: ViewSearch, replace: boolean) => void,
): { view: View; onView: (view: View, replace?: boolean) => void } {
  return {
    view: viewFrom(search),
    onView: (view, replace = false) => {
      go(searchFor(view), replace);
    },
  };
}

// The view as the address holds it, leaving out what is not set so the address stays short.
export function searchFor(view: View): ViewSearch {
  const filters = Object.entries(view.filters).filter(([, filter]) =>
    isActive(filter),
  );
  return {
    ...(view.search.trim() === "" ? {} : { search: view.search }),
    ...(filters.length === 0 ? {} : { filters: Object.fromEntries(filters) }),
    ...(view.sort.length === 0
      ? {}
      : {
          sort: view.sort.map(
            (level) => `${level.descending ? "-" : ""}${level.key}`,
          ),
        }),
  };
}

// Whether a filter limits anything.
export function isActive(filter: Filter | undefined): boolean {
  if (filter === undefined) return false;
  return (
    (filter.contains ?? "").trim() !== "" ||
    filter.from !== undefined ||
    filter.to !== undefined ||
    (filter.any ?? []).length > 0 ||
    filter.empty === true
  );
}

// Whether the view hides any rows, rather than only sorting them.
export function narrows(view: View): boolean {
  return (
    view.search.trim() !== "" ||
    Object.values(view.filters).some((filter) => isActive(filter))
  );
}

// The view with only the filters and sorts on columns the table has, leaving out those on columns the
// user may not see, such as in a link from someone who may.
export function knownView(
  view: View,
  columns: readonly { key: string }[],
): View {
  const known = new Set(columns.map((column) => column.key));
  return {
    search: view.search,
    filters: Object.fromEntries(
      Object.entries(view.filters).filter(([key]) => known.has(key)),
    ),
    sort: view.sort.filter((level) => known.has(level.key)),
  };
}

// Text folded for matching, so letter case and accents do not matter.
export function folded(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const day = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// A date as people read it, with its year.
export function formatDay(value: string): string {
  return day.format(new Date(`${value}T00:00:00Z`));
}

// Each kind's values are of one type: text and dates are strings, and choices are lists.
const asText = (value: CellValue) => value as string;
const asChoices = (value: CellValue) => value as string[];

interface Rules {
  isEmpty: (value: CellValue) => boolean;
  // The text a search looks in.
  words: (column: TableColumn<never>, value: CellValue) => string;
  // How two values that are not empty sort, ascending.
  compare: (column: TableColumn<never>, a: CellValue, b: CellValue) => number;
  // Whether a value that is not empty matches what the filter sets, other than `empty`.
  matches: (value: CellValue, filter: Filter) => boolean;
}

const textRules: Rules = {
  isEmpty: (value) => asText(value).trim() === "",
  words: (_column, value) => asText(value),
  compare: (_column, a, b) => collator.compare(asText(a), asText(b)),
  matches: (value, filter) => {
    const contains = folded((filter.contains ?? "").trim());
    return contains !== "" && folded(asText(value)).includes(contains);
  },
};

const dateRules: Rules = {
  isEmpty: (value) => asText(value) === "",
  words: (_column, value) =>
    asText(value) === "" ? "" : `${asText(value)} ${formatDay(asText(value))}`,
  compare: (_column, a, b) => asText(a).localeCompare(asText(b)),
  matches: (value, { from, to }) =>
    (from !== undefined || to !== undefined) &&
    (from === undefined || asText(value) >= from) &&
    (to === undefined || asText(value) <= to),
};

// Where each chosen choice comes in its list, so choices sort in their list's order.
const places = (column: TableColumn<never>, value: CellValue) =>
  asChoices(value).map((id) =>
    column.choices.findIndex((choice) => choice.id === id),
  );

const choiceRules: Rules = {
  isEmpty: (value) => asChoices(value).length === 0,
  words: (column, value) =>
    asChoices(value)
      .map((id) => column.choices.find((choice) => choice.id === id)?.label)
      .join(" "),
  compare: (column, a, b) => {
    const first = places(column, a);
    const second = places(column, b);
    // The first choice where they differ decides, or else the one with fewer comes first.
    const at = first.findIndex(
      (place, index) => index < second.length && place !== second.at(index),
    );
    return at === -1
      ? first.length - second.length
      : Number(first.at(at)) - Number(second.at(at));
  },
  matches: (value, filter) =>
    asChoices(value).some((id) => (filter.any ?? []).includes(id)),
};

const rules: Record<Kind, Rules> = {
  text: textRules,
  date: dateRules,
  choice: choiceRules,
};

const rulesFor = (column: TableColumn<never>) => rules[column.kind];

// Whether a value matches a column's filter.
function matchesFilter(
  column: TableColumn<never>,
  value: CellValue,
  filter: Filter,
): boolean {
  const kind = rulesFor(column);
  if (kind.isEmpty(value)) return filter.empty === true;
  return kind.matches(value, filter);
}

// The rows the view shows, in its order: those matching every filter and every word searched for,
// sorted by each level in turn and otherwise left in the order given. Filters and sorts on columns
// the table does not have, such as ones the user may not see, are left out.
export function applyView<Row>(
  rows: readonly Row[],
  columns: readonly TableColumn<Row>[],
  view: View,
): Row[] {
  const byKey = new Map(
    columns.map((column) => [column.key, column as TableColumn<never>]),
  );
  const filters = Object.entries(view.filters).flatMap(([key, filter]) => {
    const column = byKey.get(key);
    return column && isActive(filter) ? [{ column, filter }] : [];
  });
  const words = folded(view.search).split(/\s+/).filter(Boolean);
  const levels = view.sort.flatMap((level) => {
    const column = byKey.get(level.key);
    return column ? [{ column, descending: level.descending }] : [];
  });
  const read = (column: TableColumn<never>, row: Row) =>
    column.value(row as never);

  const shown = rows.filter((row) => {
    const filtered = filters.every(({ column, filter }) =>
      matchesFilter(column, read(column, row), filter),
    );
    if (!filtered || words.length === 0) return filtered;
    const cells = [...byKey.values()].map((column) =>
      folded(rulesFor(column).words(column, read(column, row))),
    );
    return words.every((word) => cells.some((cell) => cell.includes(word)));
  });

  return shown
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const { column, descending } of levels) {
        const kind = rulesFor(column);
        const first = read(column, a.row);
        const second = read(column, b.row);
        // Empty values come last, whichever way the column sorts.
        const empties =
          Number(kind.isEmpty(first)) - Number(kind.isEmpty(second));
        if (empties !== 0) return empties;
        if (kind.isEmpty(first)) continue;
        const order = kind.compare(column, first, second);
        if (order !== 0) return descending ? -order : order;
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

interface Snapshot {
  view: string;
  // The rows shown when the view last changed, in order, and every row there was then.
  shown: string[];
  known: Set<string>;
}

// The rows to show, kept where they were when the view last changed, so editing a row never moves it
// or hides it. Rows since deleted drop out. Rows added since come at the end, in the order given:
// those the user added, which stay whether or not they match, and others only if the view shows
// them. The view's rows are taken afresh whenever the view changes; between changes, `apply` runs
// only on rows added since.
export function useSteadyOrder<Row>(
  all: readonly Row[],
  view: View,
  apply: (rows: readonly Row[]) => Row[],
  idOf: (row: Row) => string,
  added: ReadonlySet<string>,
): Row[] {
  const take = (): Snapshot => ({
    view: JSON.stringify(view),
    shown: apply(all).map(idOf),
    known: new Set(all.map(idOf)),
  });
  const [snapshot, setSnapshot] = useState(take);
  let current = snapshot;
  if (snapshot.view !== JSON.stringify(view)) {
    current = take();
    setSnapshot(current);
  }
  const byId = new Map(all.map((row) => [idOf(row), row]));
  const since = all.filter((row) => !current.known.has(idOf(row)));
  const matching = new Set(since.length === 0 ? [] : apply(since).map(idOf));
  return [
    ...current.shown.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [row];
    }),
    ...since.filter((row) => added.has(idOf(row)) || matching.has(idOf(row))),
  ];
}
