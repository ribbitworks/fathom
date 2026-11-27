// SPDX-License-Identifier: Apache-2.0

// Metrics over a table's rows: counts, shares and sums by one column's groups or two crossed.

import { formatMonth } from "./day-formats.ts";
import { type Identified, isIdentifiedChoice } from "./identified.ts";
import type { CellValue, TableColumn } from "./table-view.ts";
import { isEmptyIn } from "./table-rows.ts";

export const metricsTitleId = "metrics-title";
export const metricsButtonId = "metrics-button";
export const metricsPanelId = "metrics-panel";

// One of the groups a column's rows fall in.
export interface Group {
  id: string;
  label: string;
  record?: Identified;
}

// The group of rows whose value is empty, in every kind of column.
export const emptyGroup = "";
// The group of rows with any value, in columns without choices.
const filledGroup = "filled";

// The groups a value falls in: each choice it holds, its month, or whether it is filled in.
function groupsOf(column: TableColumn<never>, value: CellValue): string[] {
  if (column.kind === "flag") {
    return (value as string[]).length > 0
      ? [...(value as string[])]
      : [emptyGroup];
  }
  if (isEmptyIn(column, value)) return [emptyGroup];
  if (column.kind === "choice") return [...new Set(value as string[])];
  const months = monthsOf(column);
  return months === undefined ? [filledGroup] : [months.of(value)];
}

// How a column breaks down by month: as it says, or a month column's by its own months.
const monthsOf = (column: TableColumn<never>): TableColumn<never>["months"] =>
  column.months ??
  (column.kind === "month" ? { of: (value) => value as string } : undefined);

// The amounts of a number column added up over some rows: their total, and how many have one.
export interface Summed {
  total: number;
  valued: number;
}

const noneSummed: Summed = { total: 0, valued: 0 };

// Rows counted by the groups of some columns, in order. `of` gives how many rows fall in a group of
// each column, where a column left undefined counts rows in any of its groups; `summed` gives the
// amounts of the column added up, if any, over the same rows; and `seen` the groups the rows of a
// column, by its place, fell in.
export interface Counts {
  rows: number;
  of: (groups: readonly (string | undefined)[]) => number;
  summed: (groups: readonly (string | undefined)[]) => Summed;
  seen: (index: number) => ReadonlySet<string>;
}

// Group identifiers hold no control characters, so these stand for any group and between groups.
const keyOf = (groups: readonly (string | undefined)[]) =>
  groups.map((group) => (group === undefined ? "\u0000" : group)).join("\n");

// Every way to pick, for each column, one of a row's groups or any group.
function picks(groupsByColumn: readonly string[][]): (string | undefined)[][] {
  return groupsByColumn.reduce<(string | undefined)[][]>(
    (made, groups) =>
      made.flatMap((pick) =>
        [...groups, undefined].map((group) => [...pick, group]),
      ),
    [[]],
  );
}

export function countRows<Row>(
  rows: readonly Row[],
  columns: readonly TableColumn<Row>[],
  added?: TableColumn<Row>,
): Counts {
  const counted = new Map<string, number>();
  const sums = new Map<string, Summed>();
  const seen = columns.map(() => new Set<string>());
  for (const row of rows) {
    const groups = columns.map((column) =>
      groupsOf(column as TableColumn<never>, column.value(row)),
    );
    groups.forEach((held, at) => {
      for (const group of held) seen.at(at)?.add(group);
    });
    const amount = added?.sum?.amount(row) ?? null;
    for (const pick of picks(groups)) {
      const key = keyOf(pick);
      counted.set(key, (counted.get(key) ?? 0) + 1);
      if (amount !== null) {
        const { total, valued } = sums.get(key) ?? noneSummed;
        sums.set(key, { total: total + amount, valued: valued + 1 });
      }
    }
  }
  return {
    rows: rows.length,
    of: (groups) => counted.get(keyOf(groups)) ?? 0,
    summed: (groups) => sums.get(keyOf(groups)) ?? noneSummed,
    // The index is always one of the columns'.
    seen: (index) => seen.at(index) as ReadonlySet<string>,
  };
}

// The groups a column's rows fill in, before the empty one: its choices, its months, or Populated.
function filledGroups(
  column: TableColumn<never>,
  held: (group: string) => boolean,
  seen: ReadonlySet<string>,
): Group[] {
  if (column.kind === "choice" || column.kind === "flag") {
    return column.choices
      .filter((choice) => choice.retired !== true || held(choice.id))
      .map((choice) => ({
        id: choice.id,
        label: choice.label,
        ...(isIdentifiedChoice(choice) ? { record: choice.record } : {}),
      }));
  }
  if (monthsOf(column) !== undefined) {
    // Months written as 2027-03 sort as text in date order.
    return [...seen]
      .filter((month) => month !== emptyGroup)
      .sort()
      .map((month) => ({ id: month, label: formatMonth(month) }));
  }
  return [{ id: filledGroup, label: "Populated" }];
}

// A column's groups, in order: its choices in their list's order, leaving out retired ones no row
// counted holds, its months in date order, or, for other columns, Populated; then its empty value,
// when any row counted has it. `held` says whether any row counted is in a group, and `seen` the
// groups any row counted fell in.
export function groupsFor(
  column: TableColumn<never>,
  held: (group: string) => boolean,
  seen: ReadonlySet<string> = new Set(),
): Group[] {
  const filled = filledGroups(column, held, seen);
  return [
    ...filled,
    ...(held(emptyGroup)
      ? [
          {
            id: emptyGroup,
            label: column.emptyLabel ?? column.months?.emptyLabel ?? "Empty",
          },
        ]
      : []),
  ];
}

export type FigureMove =
  "unpublished" | "rejected" | "waiting" | "live" | "liveUnpublished";

// A figure as shown, and as the rows it is compared with give it: live only, as the drafts will make
// it, and as they will without the user's own unpublished changes; where drafts show, as published,
// as waiting and live, where the view counts each.
export type FigureAs =
  | { now: string }
  | { now: string; coming: string; comingPublished: string }
  | {
      now: string;
      published: string;
      waiting: string;
      live: string | undefined;
    };

// What moves a figure: the user's own unpublished change, the newest, before a rejected draft, before
// a waiting one, each still to come where only live shows.
export function figureMove(as: FigureAs): FigureMove | undefined {
  if ("coming" in as) {
    if (as.coming !== as.comingPublished) return "liveUnpublished";
    return as.coming === as.now ? undefined : "live";
  }
  if (!("published" in as)) return undefined;
  if (as.published !== as.now) return "unpublished";
  if (as.waiting !== as.published) return "rejected";
  return as.live !== undefined && as.live !== as.waiting
    ? "waiting"
    : undefined;
}

const percent = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

// A part of some rows as a share of them, such as 12.5%, or none of none as 0%.
export function share(part: number, rows: number): string {
  return percent.format(rows === 0 ? 0 : part / rows);
}
