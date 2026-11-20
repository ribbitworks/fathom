// SPDX-License-Identifier: Apache-2.0

// The shared table's rows and cells by place, and where a row's menu is open from.

import type { ScreenPoint } from "./app-menu.tsx";
import type { RowProblem } from "./record-table.ts";
import type { CellValue, PlacedRow } from "./table-view.ts";

// The problem with a row's values, by its row's key, and the column it is in, when it is in one.
export interface ShownProblem extends RowProblem {
  row: string;
}

export interface NewRow {
  key: number;
  // The kind of record it adds, when not the table's first.
  kind?: string;
  values: Record<string, CellValue>;
  problem?: string;
  // The column the problem is in, when it is in one.
  problemAt?: string;
  // What is wrong with the row so far, besides what it still needs, found when a value is put in
  // it, so its mark names it before it is added.
  soFar?: RowProblem | undefined;
}

// A record's row under each group it's in, or a new row.
export type Row<Rec> =
  | (PlacedRow<Rec> & { newRow?: never })
  | {
      newRow: NewRow;
      record?: never;
      key?: never;
      group?: never;
      others?: never;
    };

// Where a row's menu is open from: the ⋯ at the row's end, which the keyboard opens it from too,
// the ⋯ over its Name cell, or the pointer, where the row was right-clicked.
export type MenuPlace = MoreButtonPlace | ScreenPoint;

export type MoreButtonPlace = "end" | "name";

export interface OpenMenu {
  key: string;
  place: MenuPlace;
}

// A cell by the keys of its row and column.
export interface Place {
  row: string;
  column: string;
}

export interface Cell {
  row: number;
  column: number;
}
