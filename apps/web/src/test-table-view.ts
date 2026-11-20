// SPDX-License-Identifier: Apache-2.0

// Helpers for the table view's tests: a fictional table's columns and rows, and the rows a view
// shows of them.

import { emptyView, type TableColumn, type View } from "./table-view.ts";
import { applyView } from "./table-rows.ts";

export interface Row {
  id: string;
  name: string;
  start: string;
  levels: string[];
}

export const levels = [
  { id: "l1", label: "P1" },
  { id: "l2", label: "P2" },
  { id: "l3", label: "Señor" },
];

export const columns: TableColumn<Row>[] = [
  {
    key: "name",
    label: "Name",
    kind: "text",
    choices: [],
    multiple: false,
    value: (row) => row.name,
  },
  {
    key: "start",
    label: "Start",
    kind: "date",
    choices: [],
    multiple: false,
    value: (row) => row.start,
  },
  {
    key: "level",
    label: "Level",
    kind: "choice",
    choices: levels,
    multiple: true,
    value: (row) => row.levels,
  },
];

export const rows: Row[] = [
  { id: "a", name: "Zoë E10", start: "2024-03-01", levels: ["l2"] },
  { id: "b", name: "ann e2", start: "", levels: ["l1", "l3"] },
  { id: "c", name: "", start: "2025-01-15", levels: [] },
  { id: "d", name: "Cy", start: "2024-03-01", levels: ["l1"] },
];

export const view = (changes: Partial<View>): View => ({
  ...emptyView,
  ...changes,
});
export const ids = (shown: readonly Row[]) => shown.map((row) => row.id);
export const shownBy = (changes: Partial<View>) =>
  ids(applyView(rows, columns, view(changes)));
