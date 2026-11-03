// SPDX-License-Identifier: Apache-2.0

// Metrics over a table's rows: how many rows fall in each of a column's groups, its choices, or for
// other columns whether a value is filled in, and what share of the rows that is, for one column or
// two crossed. They are counted in the browser, over the rows the view shows and from the columns
// the user may see, as ADR 0006 sets out, so they reveal nothing the table does not.

import { type CellValue, isEmptyIn, type TableColumn } from "./table-view.ts";

export const metricsTitleId = "metrics-title";
export const metricsButtonId = "metrics-button";
export const metricsPanelId = "metrics-panel";

// One of the groups a column's rows fall in.
export interface Group {
  id: string;
  label: string;
}

// The group of rows whose value is empty, in every kind of column.
export const emptyGroup = "";
// The group of rows with any value, in columns without choices.
const filledGroup = "filled";

// The groups a value falls in: each choice it holds, or whether it is filled in.
function groupsOf(column: TableColumn<never>, value: CellValue): string[] {
  if (isEmptyIn(column, value)) return [emptyGroup];
  return column.kind === "choice"
    ? [...new Set(value as string[])]
    : [filledGroup];
}

// Rows counted by the groups of some columns, in order. `of` gives how many rows fall in a group of
// each column, where a column left undefined counts rows in any of its groups.
export interface Counts {
  rows: number;
  of: (groups: readonly (string | undefined)[]) => number;
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
): Counts {
  const counted = new Map<string, number>();
  for (const row of rows) {
    const groups = columns.map((column) =>
      groupsOf(column as TableColumn<never>, column.value(row)),
    );
    for (const pick of picks(groups)) {
      const key = keyOf(pick);
      counted.set(key, (counted.get(key) ?? 0) + 1);
    }
  }
  return {
    rows: rows.length,
    of: (groups) => counted.get(keyOf(groups)) ?? 0,
  };
}

// A column's groups, in order: its choices in their list's order, leaving out retired ones no row
// counted holds, or, for other columns, Populated; then its empty value, when any row counted has it.
// `held` says whether any row counted is in a group.
export function groupsFor(
  column: TableColumn<never>,
  held: (group: string) => boolean,
): Group[] {
  const filled =
    column.kind === "choice"
      ? column.choices
          .filter((choice) => choice.retired !== true || held(choice.id))
          .map(({ id, label }) => ({ id, label }))
      : [{ id: filledGroup, label: "Populated" }];
  return [
    ...filled,
    ...(held(emptyGroup)
      ? [{ id: emptyGroup, label: column.emptyLabel ?? "Empty" }]
      : []),
  ];
}

const percent = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

// A part of some rows as a share of them, such as 12.5%, or none of none as 0%.
export function share(part: number, rows: number): string {
  return percent.format(rows === 0 ? 0 : part / rows);
}
