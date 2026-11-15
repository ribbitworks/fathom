// SPDX-License-Identifier: Apache-2.0

// Filtering, searching, and sorting any table, in the browser, over the rows the user has been
// sent, as ADR 0006 sets out. A table describes its columns, each of a kind, and how to read a
// row's value in each; each kind says how its values are searched, sorted, and filtered, so a new
// kind is added in one place. The view a table shows, its search, filters, sort, metrics, frozen
// columns, and columns' widths and units, is kept in the page address, with the saved view it
// started from, if any.

import {
  columnWidths,
  type Filter,
  folded,
  type Link,
  linkLabel,
  notePlainText,
  searchWords,
  type Show,
  type Tier,
  type ViewChoices,
  type ViewDefinition,
  inPlacesOf,
  viewDefinitionSchema,
} from "@fathom/shared";
import { useState } from "react";
import { z } from "zod";
import { frozenByDefault } from "./frozen-columns.ts";
import { decimal } from "./numbers.ts";

// What a cell holds: text, a date as YYYY-MM-DD or empty, a number as typed or empty, the
// identifiers of chosen choices, a web link, or null for no link, a note's Markdown, or, for a
// checkbox, its one choice when checked and nothing when not.
export type CellValue = string | string[] | Link | null;

export type Kind =
  "text" | "date" | "month" | "number" | "choice" | "link" | "note" | "flag";

export interface ColumnChoice {
  id: string;
  label: string;
  // Retired choices are no longer offered, but people may still hold them.
  retired?: boolean;
}

// A unit a column's numbers may be shown in: its key, as the view names it; its name in the column's
// menu, such as Person-weeks; and the code its cells show, such as PW, with the words it stands for,
// such as person-weeks, and for one, such as person-week.
export interface ColumnUnit {
  key: string;
  label: string;
  code: string;
  name: string;
  one: string;
}

// An amount of a unit in words, such as 2.5 person-weeks or 1 person-week, given the amount as
// shown.
export const unitAmountWords = (
  shown: string,
  amount: number,
  unit: ColumnUnit,
) => `${shown} ${amount === 1 ? unit.one : unit.name}`;

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
  // For number columns: the unit the numbers are in, which each cell names by its code, and the most
  // decimal places shown, each number rounded up to them, as estimates are.
  unit?: ColumnUnit | undefined;
  places?: number | undefined;
  // For text columns: what an empty cell shows in grey in its place, such as a name made from other
  // details, which sorting, filtering, and searching take as its value.
  standIn?: (row: Row) => string;
  // The class of data the column's values belong to, which its heading marks unless General.
  dataClass?: Tier | undefined;
}

// What a field editing a column's value is called: its label, and its unit's words, if any.
export const fieldLabel = ({
  label,
  unit,
}: Pick<TableColumn<never>, "label" | "unit">): string =>
  unit === undefined ? label : `${label} in ${unit.name}`;

// A row's value in a column, or, when empty, what stands in for it.
export function valueOrStandIn<Row>(
  column: Pick<TableColumn<Row>, "value" | "standIn">,
  row: Row,
) {
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
  // Which of a table's groupings the rows are under, when not its first, or notGrouped for one list.
  grouping?: string | undefined;
  // How many columns, from the first, stay in view while the table scrolls sideways, when not the
  // table's own default.
  frozen?: number | undefined;
  // The keys of the columns in the order the view puts them, when moved from the table's own.
  order?: string[] | undefined;
  // The keys of the columns the table leaves out, which keep their filters, sorts and places.
  hidden?: string[] | undefined;
  // The width set for each column, in pixels, by key, for those not left to fit what they hold.
  widths?: Record<string, number> | undefined;
  // The unit each column that offers units is shown in, by key, for those not in their first, and
  // the decimal places, for those not shown to as many as they start with.
  units?: Record<string, string> | undefined;
  places?: Record<string, number> | undefined;
  // Set when the table's retired records show too, for a table that has them.
  retired?: true | undefined;
  // The page's own choices kept in the view, by the names its address gives them, such as
  // Features' `mode`.
  choices?: ViewChoices | undefined;
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
    ...(search.grouping === undefined ? {} : { grouping: search.grouping }),
    ...(search.frozen === undefined ? {} : { frozen: search.frozen }),
    ...(hasKeys(search.order) ? { order: search.order } : {}),
    ...(hasKeys(search.hidden) ? { hidden: search.hidden } : {}),
    ...(hasEntries(search.widths) ? { widths: search.widths } : {}),
    ...(hasEntries(search.units) ? { units: search.units } : {}),
    ...(hasEntries(search.places) ? { places: search.places } : {}),
    ...(search.retired === true ? { retired: true } : {}),
    ...(hasEntries(search.choices) ? { choices: search.choices } : {}),
  };
}

const hasKeys = (keys: readonly string[] | undefined): keys is string[] =>
  keys !== undefined && keys.length > 0;

const hasEntries = <Value>(
  byColumn: Record<string, Value> | undefined,
): byColumn is Record<string, Value> =>
  byColumn !== undefined && Object.keys(byColumn).length > 0;

// A value for each column with one column's set, or, given none, taken out; none once none is left.
function withEntry<Value>(
  byColumn: Record<string, Value> | undefined,
  key: string,
  value: Value | undefined,
): Record<string, Value> | undefined {
  const entries = Object.fromEntries([
    ...Object.entries(byColumn ?? {}).filter(([other]) => other !== key),
    ...(value === undefined ? [] : [[key, value] as const]),
  ]);
  return hasEntries(entries) ? entries : undefined;
}

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
  return { ...view, widths: withEntry(view.widths, key, width) };
}

// The view with only the filters whose keys it keeps.
export const withoutFilters = (
  view: View,
  keep: (key: string) => boolean,
): View => ({
  ...view,
  filters: Object.fromEntries(
    Object.entries(view.filters).filter(([key]) => keep(key)),
  ),
});

// The view with a column's numbers shown to a number of decimal places, or, given none, to as many
// as it starts with.
export function withPlaces(
  view: View,
  key: string,
  places: number | undefined,
): View {
  return { ...view, places: withEntry(view.places, key, places) };
}

// The view with a column shown in a unit, or, given none, in its first.
export function withUnit(
  view: View,
  key: string,
  unit: string | undefined,
): View {
  return { ...view, units: withEntry(view.units, key, unit) };
}

const isChoiceValue = (value: unknown): value is string | string[] =>
  typeof value === "string" ||
  (Array.isArray(value) && value.every((each) => typeof each === "string"));

// A table's view as its page's address holds it, the saved view it started from, and how to change
// it, for any page whose route reads its address with viewSearchSchema. `go` sets the address,
// replacing the current entry in its history when asked. A changed view still names the saved view
// it started from, until it is cleared.
export function viewProps<Search extends ViewSearch>(
  search: Search,
  go: (search: ViewSearch & Record<string, unknown>, replace: boolean) => void,
  // The page's own choices, each kept in the address under its own name, as before it was kept in
  // a view, so old links still open as they did.
  choiceKeys: readonly (keyof Search & string)[] = [],
): {
  view: View;
  applied: string | undefined;
  onView: (view: View, replace?: boolean) => void;
  onApply: (view: View, id: string, replace?: boolean) => void;
} {
  const choices = Object.fromEntries(
    choiceKeys.flatMap((key) => {
      // The key is always one of the page's own choices.
      // eslint-disable-next-line security/detect-object-injection
      const value = search[key];
      return isChoiceValue(value) ? [[key, value]] : [];
    }),
  );
  // The view as the address holds it, each choice under its own name.
  const addressFor = (view: View) => {
    const { choices: kept, ...written } = searchFor(view);
    return { ...written, ...kept };
  };
  return {
    view: viewFrom({ ...search, choices }),
    applied: search.view,
    onView: (view, replace = false) => {
      const written = addressFor(view);
      go(
        search.view === undefined || Object.keys(written).length === 0
          ? written
          : { ...written, view: search.view },
        replace,
      );
    },
    onApply: (view, id, replace = false) => {
      go({ ...addressFor(view), view: id }, replace);
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
    ...(view.grouping === undefined ? {} : { grouping: view.grouping }),
    ...(view.frozen === undefined ? {} : { frozen: view.frozen }),
    ...(hasKeys(view.order) ? { order: view.order } : {}),
    ...(hasKeys(view.hidden) ? { hidden: view.hidden } : {}),
    ...(hasEntries(view.widths) ? { widths: view.widths } : {}),
    ...(hasEntries(view.units) ? { units: view.units } : {}),
    ...(hasEntries(view.places) ? { places: view.places } : {}),
    ...(view.retired === true ? { retired: true } : {}),
    ...(hasEntries(view.choices) ? { choices: view.choices } : {}),
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
    filter.atLeast !== undefined ||
    filter.atMost !== undefined ||
    (filter.any ?? []).length > 0 ||
    filter.empty === true ||
    filter.notEmpty === true
  );
}

// What a view's grouping is when the rows show as one list.
export const notGrouped = "none";
export const notGroupedLabel = "None";

// The grouping a view puts the rows under: the one it names, or else the table's first, or none for
// a table whose rows are in one list until a grouping is chosen.
export function activeGrouping<Grouping extends { key: string }>(
  view: Pick<View, "grouping">,
  groupings: readonly Grouping[] | undefined,
  ungrouped = false,
): Grouping | undefined {
  if (view.grouping === notGrouped) return undefined;
  return (
    groupings?.find(({ key }) => key === view.grouping) ??
    (ungrouped ? undefined : groupings?.at(0))
  );
}

// Whether the view sorts the rows, or sets which columns are frozen, their order, which are hidden,
// how wide they are, the units and decimal places they are shown in, whether retired records show,
// or the page's own choices, which the Views menu names and Clear all clears with the filters.
export function setsApart(view: View): boolean {
  return (
    view.sort.length > 0 ||
    view.choices !== undefined ||
    view.grouping !== undefined ||
    view.frozen !== undefined ||
    view.order !== undefined ||
    view.hidden !== undefined ||
    view.widths !== undefined ||
    view.units !== undefined ||
    view.places !== undefined ||
    view.retired !== undefined
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
// from someone who may, and with its grouping, frozen columns, retired records and the page's
// choices, and the hidden columns, widths, units, and decimal places of the columns the table has.
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
    ...(view.grouping === undefined ? {} : { grouping: view.grouping }),
    ...(view.frozen === undefined ? {} : { frozen: view.frozen }),
    ...(view.retired === true ? { retired: true as const } : {}),
    ...(view.choices === undefined ? {} : { choices: view.choices }),
    ...orderOf(view.order, known),
    ...knownHidden(view.hidden, known),
    ...knownEntries("widths", view.widths, known),
    ...knownEntries("units", view.units, known),
    ...knownEntries("places", view.places, known),
  };
}

// The order as asked while it places any column the table has now, keeping the places of columns the
// Draft menu's choice leaves out for now.
function orderOf(
  order: string[] | undefined,
  known: ReadonlySet<string>,
): { order?: string[] } {
  return order?.some((key) => known.has(key)) === true ? { order } : {};
}

// The hidden columns while they name any column the table has, keeping those the Draft menu's
// choice leaves out for now, as the order does.
function knownHidden(
  hidden: string[] | undefined,
  known: ReadonlySet<string>,
): { hidden?: string[] } {
  return hidden?.some((key) => known.has(key)) === true ? { hidden } : {};
}

export const shownColumnsOf = <Column extends { key: string }>(
  view: Pick<View, "hidden">,
  columns: readonly Column[],
): Column[] => columns.filter(({ key }) => view.hidden?.includes(key) !== true);
export const hiddenColumnsOf = <Column extends { key: string }>(
  view: Pick<View, "hidden">,
  columns: readonly Column[],
): Column[] => columns.filter(({ key }) => view.hidden?.includes(key) === true);

// The view with a column that is never hidden shown, such as the one naming each record.
export function alwaysShowing(view: View, key: string): View {
  const hidden = (view.hidden ?? []).filter((other) => other !== key);
  return { ...view, hidden: hidden.length === 0 ? undefined : hidden };
}

// The view with columns hidden, or shown again, given the keys of the table's columns in the view's
// order. Frozen columns count the columns shown, so a frozen column hidden leaves one fewer frozen,
// and one shown again before the last frozen column joins them.
export function withHidden(
  view: View,
  ordered: readonly string[],
  keys: readonly string[],
  hide: boolean,
): View {
  const before = new Set(view.hidden ?? []);
  const after = new Set(
    hide
      ? [...before, ...keys]
      : [...before].filter((key) => !keys.includes(key)),
  );
  const shownBefore = ordered.filter((key) => !before.has(key));
  const frozenBefore = Math.min(
    view.frozen ?? frozenByDefault,
    shownBefore.length,
  );
  const lastFrozen = shownBefore.slice(0, frozenBefore).at(-1);
  const frozenEnd =
    lastFrozen === undefined ? 0 : ordered.indexOf(lastFrozen) + 1;
  const frozen = ordered
    .slice(0, frozenEnd)
    .filter((key) => !after.has(key)).length;
  // Columns the Draft menu's choice leaves out for now stay hidden, after the rest.
  const hidden = [
    ...ordered.filter((key) => after.has(key)),
    ...[...after].filter((key) => !ordered.includes(key)),
  ];
  return {
    ...view,
    hidden: hidden.length === 0 ? undefined : hidden,
    frozen: frozen === frozenByDefault ? undefined : frozen,
  };
}

// A copy with the item at one place taken out and put back at another.
export function movedItem<Item>(
  items: readonly Item[],
  from: number,
  to: number,
): Item[] {
  const others = [...items.slice(0, from), ...items.slice(from + 1)];
  return [
    ...others.slice(0, to),
    ...items.slice(from, from + 1),
    ...others.slice(to),
  ];
}

// The view's order once a column shown moves: the columns shown as moved, in the places they hold
// in the view's order or the table's own, every column not shown staying where it is. None once that
// is the table's own order again.
export function orderAfterMove(
  shown: readonly string[],
  from: number,
  to: number,
  tableOrder: readonly string[],
  viewOrder: readonly string[] | undefined,
): string[] | undefined {
  const moved = inPlacesOf(viewOrder ?? tableOrder, movedItem(shown, from, to));
  return moved.join() === tableOrder.join() ? undefined : moved;
}

// A view's value for each column the table has, under its name in the view, or nothing when none
// is left.
function knownEntries<Name extends "widths" | "units" | "places", Value>(
  name: Name,
  byColumn: Record<string, Value> | undefined,
  known: ReadonlySet<string>,
): Partial<Record<Name, Record<string, Value>>> {
  const kept = Object.fromEntries(
    Object.entries(byColumn ?? {}).filter(([key]) => known.has(key)),
  );
  return hasEntries(kept)
    ? ({ [name]: kept } as Partial<Record<Name, Record<string, Value>>>)
    : {};
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

const momentDay = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

// The day of a moment, such as when something was saved, as people read it where they are, with its
// year.
export function formatMomentDay(moment: string): string {
  return momentDay.format(new Date(moment));
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

// What marks a planned hire: the month it is expected, or no date when that month comes from none,
// since it would move with the day shown.
export const plannedWords = ({
  expected,
  undated,
}: {
  expected: string;
  undated?: true | undefined;
}): string =>
  undated === true
    ? "Planned, no date"
    : `Planned, expected ${formatMonth(expected)}`;

// Each kind's values are of one type: text and dates are strings, choices are lists, and links are
// links or null.
export const asText = (value: CellValue) => value as string;
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

// A calendar value is searched by its digits and its name, and sorts as it is kept.
const calendarWords = (format: (value: string) => string, value: string) =>
  value === "" ? "" : `${value} ${format(value)}`;

const calendarRules = (
  format: (value: string) => string,
): Pick<Rules, "isEmpty" | "words" | "compare"> => ({
  isEmpty: (value) => asText(value) === "",
  words: (_column, value) => calendarWords(format, asText(value)),
  compare: (_column, a, b) => asText(a).localeCompare(asText(b)),
});

const monthRules: Rules = {
  ...calendarRules(formatMonth),
  matches: (value, filter) =>
    textRules.matches(calendarWords(formatMonth, asText(value)), filter),
};

const dateRules: Rules = {
  ...calendarRules(formatDay),
  matches: (value, { from, to }) =>
    (from !== undefined || to !== undefined) &&
    (from === undefined || asText(value) >= from) &&
    (to === undefined || asText(value) <= to),
};

// A number is searched as it is typed and as it is shown.
const numberRules: Rules = {
  isEmpty: (value) => asText(value) === "",
  words: (_column, value) =>
    asText(value) === ""
      ? ""
      : `${asText(value)} ${decimal(Number(asText(value)))}`,
  compare: (_column, a, b) => Number(asText(a)) - Number(asText(b)),
  matches: (value, { atLeast, atMost }) =>
    (atLeast !== undefined || atMost !== undefined) &&
    (atLeast === undefined || Number(asText(value)) >= atLeast) &&
    (atMost === undefined || Number(asText(value)) <= atMost),
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
  month: monthRules,
  number: numberRules,
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
  return filter.notEmpty === true || kind.matches(value, filter);
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

// The group a row is in: the groups follow in order of rank, and each is headed with its label.
export interface RowGroup {
  key: string;
  label: string;
  rank: number;
}

export type RowGroups = readonly [RowGroup, ...RowGroup[]];

// A row's key under a group, since a record has a row under each group it's in.
export const groupedRowId = (groupKey: string, id: string) =>
  `${groupKey} ${id}`;

// A record's row under each group it's in, with the other groups it's in, or its one row while the
// rows aren't grouped.
export interface PlacedRow<Rec> {
  record: Rec;
  key: string;
  group?: RowGroup;
  others?: readonly RowGroup[];
}

export function placedRows<Rec>(
  records: readonly Rec[],
  groupsOf: ((record: Rec) => RowGroups) | undefined,
  idOf: (record: Rec) => string,
): PlacedRow<Rec>[] {
  return records.flatMap((record) => {
    const id = idOf(record);
    if (groupsOf === undefined) return [{ record, key: id }];
    const groups = groupsOf(record);
    return groups.map((group) => ({
      record,
      key: groupedRowId(group.key, id),
      group,
      others: groups.filter((other) => other !== group),
    }));
  });
}

// Each record the rows are of, once, in the rows' order.
export const recordsOf = <Rec>(rows: readonly PlacedRow<Rec>[]): Rec[] => [
  ...new Set(rows.map(({ record }) => record)),
];

// The rows of the records shown, by their groups' rank, and within a group in the order the
// records are shown.
export function rowsInOrder<Rec>(
  rows: readonly PlacedRow<Rec>[],
  shown: readonly Rec[],
): PlacedRow<Rec>[] {
  const place = new Map(shown.map((record, index) => [record, index]));
  const placeOf = (row: PlacedRow<Rec>) => Number(place.get(row.record));
  return rows
    .filter(({ record }) => place.has(record))
    .sort(
      (a, b) =>
        (a.group?.rank ?? 0) - (b.group?.rank ?? 0) || placeOf(a) - placeOf(b),
    );
}
