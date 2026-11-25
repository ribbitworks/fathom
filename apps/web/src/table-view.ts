// SPDX-License-Identifier: Apache-2.0

// The view a table shows, as the page address keeps it, and the columns and values it shows.

import {
  columnWidths,
  type Filter,
  type Link,
  type Show,
  type Tier,
  type ViewChoices,
  type ViewDefinition,
  inPlacesOf,
  viewDefinitionSchema,
} from "@fathom/shared";
import { z } from "zod";
import { frozenByDefault } from "./frozen-columns.ts";

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
  // For choice columns: a cell's choices in words, where their names joined would not read as the
  // cell should, such as a run of cycles as "27.1 to 27.2", in its cell, its details and its drafts.
  choicesInWords?: (chosen: readonly string[]) => string;
  // Whether every row has a value, so its filter offers neither Empty nor Not empty.
  required?: boolean;
  // For a choice column of one choice whose blank simply means no, such as a cycle's Current: its
  // filter offers that choice alone, since Empty and Not empty would only say it again.
  blankMeansNo?: true;
  // Whether the column offers a filter, as every column does unless another control already chooses
  // the rows by it, such as Show shipped for a release's Status.
  filterable?: false;
  value: (row: Row) => CellValue;
  // For number columns: the unit the numbers are in, which each cell names by its code, and the most
  // decimal places shown, each number rounded up to them, as estimates are.
  unit?: ColumnUnit | undefined;
  places?: number | undefined;
  // For number columns whose amounts add up, such as Effort: a row's amount, in what totals are kept
  // in, and, where that isn't what the cells show, a total or an average as they would show it; and
  // whether Metrics adds it up until a view chooses another or none, as Features does Effort.
  sum?:
    | {
        amount: (row: Row) => number | null;
        shown?: (amount: number) => string;
        atFirst?: true;
      }
    | undefined;
  // For text columns: what an empty cell shows in grey in its place, such as a name made from other
  // details, which sorting, filtering, and searching take as its value.
  standIn?: (row: Row) => string;
  // The class of data the column's values belong to, which its heading marks unless General.
  dataClass?: Tier | undefined;
  // Set for a column hidden until a view shows it, such as one that repeats what a mark says.
  hiddenAtFirst?: boolean | undefined;
  // False for a column the search leaves out, such as the Key column, whose numbers would match
  // inside other words; a key typed whole finds its record.
  searched?: false | undefined;
  // For a choice column whose choices have colours, such as teams.
  choiceColour?: ((choiceId: string) => string | null) | undefined;
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

// A filter that isn't one column's, such as a feature in any month of a grid of months: the button
// that opens it, and what it filters by, named in its pill and kept in the view as a column's is.
export interface BarFilter<Row> {
  button: string;
  column: TableColumn<Row>;
}

// What a table filters by besides its columns: drafts, and its filters in the bar above it.
export const filtersBesideColumns = <Column>(
  draftFilter: Column,
  barFilters: readonly { column: Column }[] = [],
): Column[] => [draftFilter, ...barFilters.map(({ column }) => column)];

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
  // The key of the number column the metrics add up, or empty for none, when not the table's own.
  sum?: string | undefined;
  // Which of a table's groupings the rows are under, when they aren't in one list.
  grouping?: string | undefined;
  // Which of the table's groupings the rows under each of the first grouping's headings are under.
  thenBy?: string | undefined;
  // Set when the first grouping's groups run the other way, with the group for none at the top.
  groupsReversed?: true | undefined;
  // How many columns, from the first, stay in view while the table scrolls sideways, when not the
  // table's own default.
  frozen?: number | undefined;
  // The keys of the columns in the order the view puts them, when moved from the table's own.
  order?: string[] | undefined;
  // The keys of the columns the table leaves out, which keep their filters, sorts and places.
  hidden?: string[] | undefined;
  // The keys of the columns hidden at first that the view shows.
  shown?: string[] | undefined;
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
  // An older address or saved view names none for one list, which is now no grouping at all.
  const grouping = search.grouping === notGrouped ? undefined : search.grouping;
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
    ...(search.sum === undefined ? {} : { sum: search.sum }),
    ...(grouping === undefined ? {} : { grouping }),
    ...(grouping === undefined || search.thenBy === undefined
      ? {}
      : { thenBy: search.thenBy }),
    ...(grouping === undefined || search.groupsReversed !== true
      ? {}
      : { groupsReversed: true }),
    ...(search.frozen === undefined ? {} : { frozen: search.frozen }),
    ...(hasKeys(search.order) ? { order: search.order } : {}),
    ...(hasKeys(search.hidden) ? { hidden: search.hidden } : {}),
    ...(hasKeys(search.shown) ? { shown: search.shown } : {}),
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

// The view with one of its page's choices set, or, given none, taken out.
export function withChoice(
  view: View,
  key: string,
  value: string | undefined,
): View {
  return {
    ...view,
    choices: withEntry<ViewChoices[string]>(view.choices, key, value),
  };
}

const isChoiceValue = (value: unknown): value is string | string[] =>
  typeof value === "string" ||
  (Array.isArray(value) && value.every((each) => typeof each === "string"));

// The view a page's address holds, with the page's own choices, each kept under its own name.
export function viewOfAddress<Search extends ViewSearch>(
  search: Search,
  choiceKeys: readonly (keyof Search & string)[] = [],
): View {
  const choices = Object.fromEntries(
    choiceKeys.flatMap((key) => {
      // The key is always one of the page's own choices.
      // eslint-disable-next-line security/detect-object-injection
      const value = search[key];
      return isChoiceValue(value) ? [[key, value]] : [];
    }),
  );
  return viewFrom({ ...search, choices });
}

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
  // The view as the address holds it, each choice under its own name.
  const addressFor = (view: View) => {
    const { choices: kept, ...written } = searchFor(view);
    return { ...written, ...kept };
  };
  return {
    view: viewOfAddress(search, choiceKeys),
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
    ...(view.sum === undefined ? {} : { sum: view.sum }),
    ...(view.grouping === undefined ? {} : { grouping: view.grouping }),
    ...(view.thenBy === undefined ? {} : { thenBy: view.thenBy }),
    ...(view.groupsReversed === true ? { groupsReversed: true } : {}),
    ...(view.frozen === undefined ? {} : { frozen: view.frozen }),
    ...(hasKeys(view.order) ? { order: view.order } : {}),
    ...(hasKeys(view.hidden) ? { hidden: view.hidden } : {}),
    ...(hasKeys(view.shown) ? { shown: view.shown } : {}),
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

// The view as a saved view keeps it: as the address holds it, without the breakdown while it breaks
// down by nothing, since an empty Metrics panel is nothing to save. A column chosen to add up, or
// Nothing, is kept, since it differs from the table's own.
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

// The Group by menu's choice of no grouping, which shows the rows in one list.
export const notGrouped = "none";
export const notGroupedLabel = "None";

// The grouping a view puts the rows under: the one it names, or none, which shows them in one list.
export function activeGrouping<Grouping extends { key: string }>(
  view: Pick<View, "grouping">,
  groupings: readonly Grouping[] | undefined,
): Grouping | undefined {
  return groupings?.find(({ key }) => key === view.grouping);
}

// The grouping a view puts the rows under within each of the first grouping's headings: the one it
// names, while the rows are grouped by another.
export function activeThenBy<Grouping extends { key: string }>(
  view: Pick<View, "grouping" | "thenBy">,
  groupings: readonly Grouping[] | undefined,
): Grouping | undefined {
  const first = activeGrouping(view, groupings);
  return first === undefined || view.thenBy === first.key
    ? undefined
    : groupings?.find(({ key }) => key === view.thenBy);
}

// The view with its rows grouped first by a grouping, or by none, keeping the second grouping
// unless it is the first now, even on a board, which shows the first alone, and the groups' order
// while the first grouping stays the same.
export function groupedFirstBy(view: View, key: string | undefined): View {
  const keepsThenBy = key !== undefined && key !== view.thenBy;
  return {
    ...view,
    grouping: key,
    thenBy: keepsThenBy ? view.thenBy : undefined,
    groupsReversed: key === view.grouping ? view.groupsReversed : undefined,
  };
}

// The view with its rows in one list again.
export const ungrouped = (view: View): View => ({
  ...view,
  grouping: undefined,
  thenBy: undefined,
  groupsReversed: undefined,
});

// The view with the first grouping's groups in order of rank, or reversed.
export const withGroupsReversed = (view: View, reversed: boolean): View => ({
  ...view,
  groupsReversed: reversed ? true : undefined,
});

// Whether the view sorts the rows, or sets which columns are frozen, their order, which are hidden,
// how wide they are, the units and decimal places they are shown in, whether retired records show,
// or the page's own choices, which the Views menu names and Clear all clears with the filters.
export function setsApart(view: View): boolean {
  return (
    view.sort.length > 0 ||
    view.choices !== undefined ||
    view.grouping !== undefined ||
    view.thenBy !== undefined ||
    view.groupsReversed !== undefined ||
    view.frozen !== undefined ||
    view.order !== undefined ||
    view.hidden !== undefined ||
    view.shown !== undefined ||
    view.widths !== undefined ||
    view.units !== undefined ||
    view.places !== undefined ||
    view.retired !== undefined
  );
}

// Whether the view hides any rows, or a filter of the page's own in use does too.
export const narrowsWith = (view: View, pageFilter: object | undefined) =>
  narrows(view) || pageFilter !== undefined;

// Whether the view hides any rows, rather than only sorting them.
export function narrows(view: View): boolean {
  return (
    view.search.trim() !== "" ||
    Object.values(view.filters).some((filter) => isActive(filter))
  );
}

type Summable = readonly {
  key: string;
  sum?: { amount: unknown; atFirst?: true } | undefined;
}[];

// The column Metrics adds up until a view chooses another or none, or "" for none.
export const sumAtFirst = (columns: Summable): string =>
  columns.find(({ sum }) => sum?.atFirst === true)?.key ?? "";

// The sum a view keeps for the column chosen to add up: none when it is the table's own, so
// choosing it is no change.
export const chosenSum = (
  key: string,
  columns: Summable,
): string | undefined => (key === sumAtFirst(columns) ? undefined : key);

// The view with only the filters, sorts, and breakdown on columns the table has, and the filters it
// offers that are not columns, leaving out those on columns the user may not see, such as in a link
// from someone who may, and with its groupings, frozen columns, retired records and the page's
// choices, and the hidden columns, widths, units, and decimal places of the columns the table has.
// The breakdown keeps only the columns the metrics offer, when given, and the sum only a column the
// table has that adds up, other than the one it adds up at first.
export function knownView(
  view: View,
  columns: Summable,
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
    ...(view.sum === undefined ||
    chosenSum(view.sum, columns) === undefined ||
    (view.sum !== "" &&
      !columns.some(({ key, sum }) => key === view.sum && sum !== undefined))
      ? {}
      : { sum: view.sum }),
    ...(view.grouping === undefined ? {} : { grouping: view.grouping }),
    ...(view.thenBy === undefined ? {} : { thenBy: view.thenBy }),
    ...(view.groupsReversed === true ? { groupsReversed: true as const } : {}),
    ...(view.frozen === undefined ? {} : { frozen: view.frozen }),
    ...(view.retired === true ? { retired: true as const } : {}),
    ...(view.choices === undefined ? {} : { choices: view.choices }),
    ...orderOf(view.order, known),
    ...knownKeys("hidden", view.hidden, known),
    ...knownKeys("shown", view.shown, known),
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

// The hidden, or shown, columns while they name any column the table has, keeping those the Draft
// menu's choice leaves out for now, as the order does.
function knownKeys<Key extends "hidden" | "shown">(
  name: Key,
  keys: string[] | undefined,
  known: ReadonlySet<string>,
): Partial<Record<Key, string[]>> {
  return keys?.some((key) => known.has(key)) === true
    ? ({ [name]: keys } as Record<Key, string[]>)
    : {};
}

// A column the view hides: one it names hidden, or one hidden at first it doesn't name shown.
export interface Hideable {
  key: string;
  hiddenAtFirst?: boolean | undefined;
}

const hiddenIn = (
  view: Pick<View, "hidden" | "shown">,
  { key, hiddenAtFirst }: Hideable,
) =>
  hiddenAtFirst === true
    ? view.shown?.includes(key) !== true
    : view.hidden?.includes(key) === true;

export const shownColumnsOf = <Column extends Hideable>(
  view: Pick<View, "hidden" | "shown">,
  columns: readonly Column[],
): Column[] => columns.filter((column) => !hiddenIn(view, column));
export const hiddenColumnsOf = <Column extends Hideable>(
  view: Pick<View, "hidden" | "shown">,
  columns: readonly Column[],
): Column[] => columns.filter((column) => hiddenIn(view, column));

// The view with a column that is never hidden shown, such as the one naming each record.
export function alwaysShowing(view: View, key: string): View {
  const hidden = (view.hidden ?? []).filter((other) => other !== key);
  return { ...view, hidden: hidden.length === 0 ? undefined : hidden };
}

// The view with columns hidden, or shown again, given the table's columns in the view's order.
// Frozen columns count the columns shown, so a frozen column hidden leaves one fewer frozen, and one
// shown again before the last frozen column joins them. A column hidden at first is shown by naming
// it shown, and hidden again by no longer naming it.
export function withHidden(
  view: View,
  columns: readonly Hideable[],
  keys: readonly string[],
  hide: boolean,
): View {
  const ordered = columns.map(({ key }) => key);
  const atFirst = new Set(
    columns.flatMap(({ key, hiddenAtFirst }) =>
      hiddenAtFirst === true ? [key] : [],
    ),
  );
  const before = new Set([
    ...(view.hidden ?? []),
    ...hiddenColumnsOf(view, columns).map(({ key }) => key),
  ]);
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
  // Columns the Draft menu's choice leaves out for now stay hidden, or shown, after the rest.
  const hidden = [
    ...ordered.filter((key) => after.has(key) && !atFirst.has(key)),
    ...[...after].filter((key) => !ordered.includes(key)),
  ];
  const shown = [
    ...ordered.filter((key) => atFirst.has(key) && !after.has(key)),
    ...(view.shown ?? []).filter((key) => !ordered.includes(key)),
  ];
  return {
    ...view,
    hidden: hidden.length === 0 ? undefined : hidden,
    shown: shown.length === 0 ? undefined : shown,
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
