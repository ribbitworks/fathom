// SPDX-License-Identifier: Apache-2.0

// The cell of the shared table selected and the cell being edited, and what else the table keeps
// while it is used.

import { useRef, useState } from "react";
import type { ScreenPoint } from "./app-menu.tsx";
import { focusSoon } from "./focus.ts";
import type { ShownGrid } from "./grid-groups.tsx";
import {
  type Cell,
  type NewRow,
  type OpenMenu,
  type Place,
  placeStore,
  type Row,
  type ShownProblem,
} from "./grid-places.ts";
import { useRowReuse } from "./grid-row-reuse.ts";
import type { Column, GridRecord } from "./record-table.ts";
import type { CellValue } from "./table-view.ts";

export function useGridState<Rec extends GridRecord, Change>() {
  const [newRows, setNewRows] = useState<NewRow[]>([{ key: 0, values: {} }]);
  const [nextKey, setNextKey] = useState(1);
  // The selected cell and the cell being edited, by row and column key rather than position, so they
  // stay with their record when a save puts the rows in a new order.
  const [activeAt] = useState(placeStore);
  const [editingAt, setEditingAt] = useState<Place>();
  // The record and column edited in the side panel, such as a note's, as they were when it opened,
  // so a note being written stays open, and is saved to its record, if its row leaves the view.
  const [panelOpen, setPanelOpen] = useState<{
    row: Row<Rec>;
    column: Column<Rec, Change>;
    readOnly: boolean;
  }>();
  // Whether something is being changed in the side panel, rather than only read there.
  const [panelWriting, setPanelWriting] = useState(false);
  // What is typed in the cell being edited so far, from what the editor first shows, such as a first
  // key typed, read when it is saved.
  const typed = useRef("");
  // What the open editor started with: the value's text and the value it stands for, and which
  // opening of an editor it is.
  const [openedWith, setOpenedWith] = useState<{
    text: string;
    value: CellValue;
    edit: number;
  }>();
  const [problem, setProblem] = useState<ShownProblem>();
  const [menuFor, setMenuFor] = useState<OpenMenu>();
  const [pointedAt, setPointedAt] = useState<
    OpenMenu & { place: ScreenPoint }
  >();
  const [dragging, setDragging] = useState<string>();
  // The column whose filter is open, by key.
  const [filtering, setFiltering] = useState<string>();
  const state = {
    newRows,
    setNewRows,
    nextKey,
    setNextKey,
    activeAt,
    editingAt,
    setEditingAt,
    panelOpen,
    setPanelOpen,
    panelWriting,
    setPanelWriting,
    typed,
    openedWith,
    setOpenedWith,
    problem,
    setProblem,
    menuFor,
    setMenuFor,
    pointedAt,
    setPointedAt,
    dragging,
    setDragging,
    filtering,
    setFiltering,
  };
  return { ...state, ...useRowReuse(state) };
}

export type StateGrid<Rec extends GridRecord, Change, Request> = ShownGrid<
  Rec,
  Change,
  Request
> &
  ReturnType<typeof useGridState<Rec, Change>>;

export function gridSelection<Rec extends GridRecord, Change, Request>(
  grid: Pick<
    StateGrid<Rec, Change, Request>,
    | "canAdd"
    | "columns"
    | "canEdit"
    | "shownRows"
    | "newRows"
    | "activeAt"
    | "editingAt"
    | "setEditingAt"
    | "panelOpen"
    | "setPanelOpen"
    | "panelWriting"
    | "setPanelWriting"
  >,
) {
  const {
    canAdd,
    columns,
    canEdit,
    shownRows,
    newRows,
    activeAt,
    editingAt,
    setEditingAt,
    panelOpen,
    setPanelOpen,
    panelWriting,
    setPanelWriting,
  } = grid;
  const rows: Row<Rec>[] = [
    ...shownRows,
    ...(canEdit && canAdd ? newRows.map((newRow) => ({ newRow })) : []),
  ];
  const rowKey = (row: Row<Rec>) =>
    row.newRow ? `new-${String(row.newRow.key)}` : row.key;
  const rowKeys = rows.map(rowKey);
  const keys = columns.map((column) => column.key);
  const cellId = (row: number, column: number) =>
    `cell-${String(rowKeys.at(row))}-${String(keys.at(column))}`;
  // The row and column of a cell, which is always within the table.
  const at = (cell: Cell) => ({
    row: rows[cell.row] as Row<Rec>,
    column: columns[cell.column] as Column<Rec, Change>,
  });
  const placeOf = (cell: Cell): Place => ({
    row: String(rowKeys.at(cell.row)),
    column: String(keys.at(cell.column)),
  });
  // Each row's and column's place by its key, looked up by every cell as the selection moves.
  const rowAt = new Map(
    rowKeys.map((key, index): [string, number] => [key, index]).reverse(),
  );
  const columnAt = new Map(
    keys.map((key, index): [string, number] => [key, index]).reverse(),
  );
  const cellAt = (place: Place) => ({
    row: rowAt.get(place.row) ?? -1,
    column: columnAt.get(place.column) ?? -1,
  });
  // The cell selected at a place, or the first when the one selected has gone.
  const activeOf = (place: Place | undefined) => {
    const found = place === undefined ? undefined : cellAt(place);
    return found && found.row !== -1 && found.column !== -1
      ? found
      : { row: 0, column: 0 };
  };
  const activeNow = () => activeOf(activeAt.get());
  const placed = editingAt === undefined ? undefined : cellAt(editingAt);
  // The cell being edited, while its row and column are shown.
  const editing =
    placed && placed.row !== -1 && placed.column !== -1 ? placed : undefined;
  // What the side panel edits, if anything: a note only shown closes once its row is not.
  const inPanel =
    panelOpen && (editing !== undefined || !panelOpen.readOnly)
      ? panelOpen
      : undefined;
  // A note being written closes only by its panel's own buttons, and keeps the table from changing
  // values until then.
  const writingInPanel =
    inPanel !== undefined && !inPanel.readOnly && panelWriting;
  const setActive = (cell: Cell) => {
    activeAt.set(placeOf(cell));
  };
  const setEditing = (cell: Cell | undefined) => {
    if (cell === undefined) {
      setPanelOpen(undefined);
      setPanelWriting(false);
    }
    setEditingAt(cell === undefined ? undefined : placeOf(cell));
  };
  // Focuses a cell of a new row by its key, since the row may not be drawn yet.
  const focusNew = (newKey: number) => {
    const place = { row: `new-${String(newKey)}`, column: String(keys[0]) };
    activeAt.set(place);
    focusSoon(`cell-${place.row}-${place.column}`);
  };

  const moveTo = (row: number, column: number) => {
    const target = {
      row: Math.max(0, Math.min(row, rows.length - 1)),
      column: Math.max(0, Math.min(column, columns.length - 1)),
    };
    setActive(target);
    focusSoon(cellId(target.row, target.column));
  };
  return {
    rows,
    rowKey,
    keys,
    cellId,
    at,
    activeOf,
    activeNow,
    editing,
    inPanel,
    writingInPanel,
    setActive,
    setEditing,
    focusNew,
    moveTo,
  };
}

export type SelectionGrid<Rec extends GridRecord, Change, Request> = StateGrid<
  Rec,
  Change,
  Request
> &
  ReturnType<typeof gridSelection<Rec, Change, Request>>;
