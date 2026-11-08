// SPDX-License-Identifier: Apache-2.0

// Filtering, searching, and sorting any table, in the browser, over the rows the user has been
// sent, as ADR 0006 sets out. A table describes its columns, each of a kind, and how to read a
// row's value in each; each kind says how its values are searched, sorted, and filtered, so a new
// kind is added in one place. The view a table shows, its search, filters, sort, metrics, frozen
// columns, and columns' widths, is kept in the page address, with the saved view it started from,
// if any.

import {
  columnWidths,
  type Filter,
  folded,
  type Link,
  linkLabel,
  notePlainText,
  searchWords,
  type Show,
  type ViewDefinition,
  viewDefinitionSchema,
} from "@fathom/shared";
import { useState } from "react";
import { z } from "zod";

// What a cell holds: text, a date as YYYY-MM-DD or empty, the identifiers of chosen choices, a web
// link, or null for no link, a note's Markdown, or, for a checkbox, its one choice when checked and
// nothing when not.
export type CellValue = string | string[] | Link | null;

export type Kind = "text" | "date" | "choice" | "link" | "note" | "flag";

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
  // For choice columns: what a filter calls an empty value, when not "Empty".
  emptyLabel?: string;
  // For choice columns: what a filter calls the choices no longer offered, when not "Retired".
  retiredLabel?: string;
  value: (row: Row) => CellValue;
  // For text columns: what an empty cell shows in grey in its place, such as a name made from other
  // details, which sorting, filtering, and searching take as its value.
  standIn?: (row: Row) => string;
}

// A row's value in a column, or, when empty, what stands in for it.
export function valueOrStandIn<Row>(column: TableColumn<Row>, row: Row) {
  const value = column.value(row);
  return value === "" && column.standIn !== undefined
    ? column.standIn(row)
    : value;
}

export interface SortLevel {
  key: string;
  descending: boolean;
}

export interface View {
  search: string;
  // Which version of each record shows: both the draft and the live record, the draft alone, or
  // the live record alone.
  show: Show;
  filters: Record<string, Filter>;
  sort: SortLevel[];
  // The keys of the columns the metrics break the rows down by, set while the metrics show.
  breakdown?: string[] | undefined;
  // Set when a table that groups its rows shows them as one list.
  ungrouped?: true | undefined;
  // How many columns, from the first, stay in view while the table scrolls sideways, when not the
  // table's own default.
  frozen?: number | undefined;
  // The width set for each column, in pixels, by key, for those not left to fit what they hold.
  widths?: Record<string, number> | undefined;
}

export const emptyView: View = {
  search: "",
  show: "both",
  filters: {},
  sort: [],
};

export type { Filter } from "@fathom/shared";

// The view as the address holds it, as a saved view keeps it, and the saved view it started from,
// if any. Anything that does not fit is dropped, keeping the rest.
export const viewSearchSchema = viewDefinitionSchema.extend({
  view: z.uuid().optional().catch(undefined),
});

// The view as read from the address, and as written to it.
export interface ViewSearch extends ViewDefinition {
  view?: string | undefined;
}

export function viewFrom(search: ViewDefinition): View {
  return {
    search: search.search ?? "",
    show: search.show ?? "both",
    filters: search.filters ?? {},
    sort: (search.sort ?? []).map((level) =>
      level.startsWith("-")
        ? { key: level.slice(1), descending: true }
        : { key: level, descending: false },
    ),
    ...(search.breakdown === undefined ? {} : { breakdown: search.breakdown }),
    ...(search.ungrouped === undefined ? {} : { ungrouped: search.ungrouped }),
    ...(search.frozen === undefined ? {} : { frozen: search.frozen }),
    ...(hasWidths(search.widths) ? { widths: search.widths } : {}),
  };
}

const hasWidths = (
  widths: Record<string, number> | undefined,
): widths is Record<string, number> =>
  widths !== undefined && Object.keys(widths).length > 0;

// How far one step from the keyboard or a column's menu widens or narrows a column, in pixels.
export const widthStep = 16;

// A width for a column, in whole pixels, between the least and most a width may be, and no wider
// than `widest`, such as the most a frozen column may take.
export function widthWithin(wanted: number, widest = Infinity): number {
  return Math.round(
    Math.max(columnWidths.least, Math.min(wanted, columnWidths.most, widest)),
  );
}

// The view with a column's width set, or, given none, left to fit what the column holds.
export function withWidth(
  view: View,
  key: string,
  width: number | undefined,
): View {
  const widths = Object.fromEntries([
    ...Object.entries(view.widths ?? {}).filter(([other]) => other !== key),
    ...(width === undefined ? [] : [[key, width] as const]),
  ]);
  return { ...view, widths: hasWidths(widths) ? widths : undefined };
}

// A table's view as its page's address holds it, the saved view it started from, and how to change
// it, for any page whose route reads its address with viewSearchSchema. `go` sets the address,
// replacing the current entry in its history when asked. A changed view still names the saved view
// it started from, until it is cleared.
export function viewProps(
  search: ViewSearch,
  go: (search: ViewSearch, replace: boolean) => void,
): {
  view: View;
  applied: string | undefined;
  onView: (view: View, replace?: boolean) => void;
  onApply: (view: View, id: string, replace?: boolean) => void;
} {
  return {
    view: viewFrom(search),
    applied: search.view,
    onView: (view, replace = false) => {
      const written = searchFor(view);
      go(
        search.view === undefined || Object.keys(written).length === 0
          ? written
          : { ...written, view: search.view },
        replace,
      );
    },
    onApply: (view, id, replace = false) => {
      go({ ...searchFor(view), view: id }, replace);
    },
  };
}

// The view as the address holds it, leaving out what is not set so the address stays short.
export function searchFor(view: View): ViewDefinition {
  const filters = Object.entries(view.filters).filter(([, filter]) =>
    isActive(filter),
  );
  return {
    ...(view.search.trim() === "" ? {} : { search: view.search }),
    ...(view.show === "both" ? {} : { show: view.show }),
    ...(filters.length === 0 ? {} : { filters: Object.fromEntries(filters) }),
    ...(view.sort.length === 0
      ? {}
      : {
          sort: view.sort.map(
            (level) => `${level.descending ? "-" : ""}${level.key}`,
          ),
        }),
    ...(view.breakdown === undefined ? {} : { breakdown: view.breakdown }),
    ...(view.ungrouped === undefined ? {} : { ungrouped: view.ungrouped }),
    ...(view.frozen === undefined ? {} : { frozen: view.frozen }),
    ...(hasWidths(view.widths) ? { widths: view.widths } : {}),
  };
}

// A value with its keys in order and nothing left undefined, so equal values are written alike.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, part]) => part !== undefined)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, part]) => [key, canonical(part)]),
  );
}

// The view as a saved view keeps it: as the address holds it, without the metrics while they break
// down by nothing, since an empty Metrics panel is nothing to save.
export function savedFor(view: View): ViewDefinition {
  const { breakdown, ...rest } = searchFor(view);
  return breakdown === undefined || breakdown.length === 0
    ? rest
    : { ...rest, breakdown };
}

// Whether two views show the same rows in the same order, with the same metrics, which is whether
// saving either would keep the same.
export function sameView(first: View, second: View): boolean {
  return (
    JSON.stringify(canonical(savedFor(first))) ===
    JSON.stringify(canonical(savedFor(second)))
  );
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

// Whether the view sorts the rows, or sets which columns are frozen or how wide they are, which the
// Views menu names and Clear all clears with the filters.
export function setsApart(view: View): boolean {
  return (
    view.sort.length > 0 ||
    view.ungrouped === true ||
    view.frozen !== undefined ||
    view.widths !== undefined
  );
}

// Whether the view hides any rows, rather than only sorting them.
export function narrows(view: View): boolean {
  return (
    view.search.trim() !== "" ||
    Object.values(view.filters).some((filter) => isActive(filter))
  );
}

// The view with only the filters, sorts, and breakdown on columns the table has, and the filters it
// offers that are not columns, leaving out those on columns the user may not see, such as in a link
// from someone who may, and with its frozen columns and the widths of the columns the table has.
// The breakdown keeps only the columns the metrics offer, when given.
export function knownView(
  view: View,
  columns: readonly { key: string }[],
  filterOnly: readonly { key: string }[] = [],
  countable: readonly { key: string }[] = columns,
): View {
  const known = new Set(columns.map((column) => column.key));
  const counted = new Set(countable.map((column) => column.key));
  const filtered = new Set([
    ...known,
    ...filterOnly.map((column) => column.key),
  ]);
  return {
    search: view.search,
    show: view.show,
    filters: Object.fromEntries(
      Object.entries(view.filters).filter(([key]) => filtered.has(key)),
    ),
    sort: view.sort.filter((level) => known.has(level.key)),
    ...(view.breakdown === undefined
      ? {}
      : {
          breakdown: view.breakdown.filter(
            (key) => known.has(key) && counted.has(key),
          ),
        }),
    ...(view.ungrouped === undefined ? {} : { ungrouped: view.ungrouped }),
    ...(view.frozen === undefined ? {} : { frozen: view.frozen }),
    ...widthsOf(view.widths, known),
  };
}

function widthsOf(
  widths: Record<string, number> | undefined,
  known: ReadonlySet<string>,
): { widths?: Record<string, number> } {
  const kept = Object.fromEntries(
    Object.entries(widths ?? {}).filter(([key]) => known.has(key)),
  );
  return hasWidths(kept) ? { widths: kept } : {};
}

// Text folded for matching, shared with the server so searches match alike everywhere.
export { folded };

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

const month = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// A month, such as 2027-03, as people read it, such as Mar 2027.
export function formatMonth(value: string): string {
  return month.format(new Date(`${value}-01T00:00:00Z`));
}

// Each kind's values are of one type: text and dates are strings, choices are lists, and links are
// links or null.
const asText = (value: CellValue) => value as string;
const asChoices = (value: CellValue) => value as string[];
const asLink = (value: CellValue) => value as Link | null;

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

// A note is searched, sorted, and filtered by its words, without their formatting.
const noteRules: Rules = {
  isEmpty: (value) => asText(value).trim() === "",
  words: (_column, value) => notePlainText(asText(value)),
  compare: (_column, a, b) =>
    collator.compare(notePlainText(asText(a)), notePlainText(asText(b))),
  matches: (value, filter) =>
    textRules.matches(notePlainText(asText(value)), filter),
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

// A link is searched and filtered by its text and its address, and sorted by what it shows.
const linkRules: Rules = {
  isEmpty: (value) => asLink(value) === null,
  words: (_column, value) => {
    const link = asLink(value);
    return link === null ? "" : `${link.text} ${link.address}`;
  },
  compare: (_column, a, b) =>
    collator.compare(
      linkLabel(asLink(a) as Link),
      linkLabel(asLink(b) as Link),
    ),
  matches: (value, filter) => {
    const contains = folded((filter.contains ?? "").trim());
    const link = asLink(value) as Link;
    return (
      contains !== "" &&
      (folded(link.text).includes(contains) ||
        folded(link.address).includes(contains))
    );
  },
};

// A checkbox is never empty, so it sorts either way: checked or not, filtered by its one choice or
// by the empty choice, which names the unchecked.
const checked = (value: CellValue) => asChoices(value).length > 0;

const flagRules: Rules = {
  isEmpty: () => false,
  words: (column, value) =>
    checked(value) ? choiceRules.words(column, value) : "",
  compare: (_column, a, b) => Number(checked(b)) - Number(checked(a)),
  matches: (value, filter) =>
    checked(value)
      ? asChoices(value).some((id) => (filter.any ?? []).includes(id))
      : filter.empty === true,
};

const rules: Record<Kind, Rules> = {
  text: textRules,
  date: dateRules,
  choice: choiceRules,
  link: linkRules,
  note: noteRules,
  flag: flagRules,
};

const rulesFor = (column: TableColumn<never>) => rules[column.kind];

// Whether a value counts as empty in its column.
export const isEmptyIn = (column: TableColumn<never>, value: CellValue) =>
  rulesFor(column).isEmpty(value);

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
// the table does not have, such as ones the user may not see, are left out. Filters that are not
// columns filter the rows too, but are neither searched nor sorted on.
export function applyView<Row>(
  rows: readonly Row[],
  columns: readonly TableColumn<Row>[],
  view: View,
  filterOnly: readonly TableColumn<Row>[] = [],
): Row[] {
  const byKey = new Map(
    columns.map((column) => [column.key, column as TableColumn<never>]),
  );
  const filterable = new Map([
    ...byKey,
    ...filterOnly.map(
      (column) => [column.key, column as TableColumn<never>] as const,
    ),
  ]);
  const filters = Object.entries(view.filters).flatMap(([key, filter]) => {
    const column = filterable.get(key);
    return column && isActive(filter) ? [{ column, filter }] : [];
  });
  const words = searchWords(view.search);
  const levels = view.sort.flatMap((level) => {
    const column = byKey.get(level.key);
    return column ? [{ column, descending: level.descending }] : [];
  });
  const read = (column: TableColumn<never>, row: Row) =>
    valueOrStandIn(column, row as never);

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

// The rows to show, kept where they were when the view last changed, so editing a row never moves
// it or hides it. Rows since deleted drop out. Rows added since come at the end: those the user
// added, in the order they added them, which stay whether or not they match, then others, in the
// order given, only if the view shows them. The view's rows are taken afresh whenever the view
// changes; between changes, `apply` runs only on rows added since.
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
  const addedOrder = [...added];
  return [
    ...current.shown.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [row];
    }),
    ...since
      .filter((row) => added.has(idOf(row)))
      .sort(
        (a, b) => addedOrder.indexOf(idOf(a)) - addedOrder.indexOf(idOf(b)),
      ),
    ...since.filter((row) => !added.has(idOf(row)) && matching.has(idOf(row))),
  ];
}
