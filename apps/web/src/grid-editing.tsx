// SPDX-License-Identifier: Apache-2.0

// Editing the shared table's cells like a spreadsheet's, from the keyboard and the pointer, with the
// editor of the cell being edited.

import { type ComponentProps, type KeyboardEvent, useState } from "react";
import type { Typing } from "@fathom/shared";
import { startingText } from "./cell-kinds.tsx";
import type { Finish } from "./choice-picker.tsx";
import { composingWord } from "./composing.ts";
import { focusSoon } from "./focus.ts";
import { focusRecordCell } from "./grid-row.tsx";
import { emptyValue, kindOf, readOnlyFor } from "./grid-columns.tsx";
import type { Cell, Row } from "./grid-places.ts";
import classes from "./pages.module.css";
import { addingFor, type Column, type GridRecord } from "./record-table.ts";
import { opensMenu } from "./row-controls.tsx";
import type { MenuGrid } from "./row-menus.tsx";
import { type CellValue, fieldLabel } from "./table-view.ts";
import { typeIn } from "./type-in.ts";

export function gridEditing<Rec extends GridRecord, Change, Request>(
  grid: Pick<
    MenuGrid<Rec, Change, Request>,
    | "ticks"
    | "columns"
    | "locked"
    | "rowKind"
    | "shownIds"
    | "newRows"
    | "setPanelOpen"
    | "typed"
    | "editing"
    | "openedWith"
    | "setOpenedWith"
    | "problem"
    | "setProblem"
    | "setMenuFor"
    | "rows"
    | "rowKey"
    | "cellId"
    | "at"
    | "writingInPanel"
    | "setActive"
    | "setEditing"
    | "moveTo"
    | "valueAt"
    | "shownAt"
    | "putBack"
    | "save"
    | "fillNewRow"
    | "emptyNewRow"
    | "kindKept"
    | "followingKind"
    | "submitNewRows"
    | "hasRowMenu"
  >,
) {
  const {
    ticks,
    columns,
    locked,
    rowKind,
    shownIds,
    newRows,
    setPanelOpen,
    typed,
    editing,
    openedWith,
    setOpenedWith,
    problem,
    setProblem,
    setMenuFor,
    rows,
    rowKey,
    cellId,
    at,
    writingInPanel,
    setActive,
    setEditing,
    moveTo,
    valueAt,
    shownAt,
    putBack,
    save,
    fillNewRow,
    emptyNewRow,
    kindKept,
    followingKind,
    submitNewRows,
    hasRowMenu,
  } = grid;
  // Whether a cell's value may not change, as in a record nobody may change yet, or a column whose
  // values follow from another's or that its kind of row does not have.
  const readOnlyAt = (cell: Cell) => {
    const { row, column } = at(cell);
    return (
      Boolean(row.record && locked(row.record)) ||
      readOnlyFor(column, rowKind(row))
    );
  };

  const opensEditor = (cell: Cell) => {
    const { toggled, inPanel } = kindOf(at(cell).column);
    return toggled === undefined && (!readOnlyAt(cell) || inPanel === true);
  };

  // Starts editing a cell, or, for a kind edited in one step, such as a checkbox, saves the value
  // editing gives, unless what started it was typing.
  const startEdit = (cell: Cell, typedFirst?: string) => {
    // A cell already being edited keeps what is typed, such as when its editor is double-clicked.
    if (editing?.row === cell.row && editing.column === cell.column) return;
    const { row, column } = at(cell);
    const { toggled, inPanel: opensPanel, asTyped } = kindOf(column);
    if (readOnlyAt(cell) && opensPanel !== true) return;
    // Typing does nothing in a cell edited in the side panel, as in a checkbox.
    if (writingInPanel || (opensPanel === true && typedFirst !== undefined))
      return;
    const value = valueAt(row, column);
    setActive(cell);
    if (toggled !== undefined) {
      if (typedFirst === undefined) save(cell, toggled(shownAt(row, column)));
      return;
    }
    setEditing(cell);
    setPanelOpen(
      opensPanel === true
        ? { row, column, readOnly: readOnlyAt(cell) }
        : undefined,
    );
    setMenuFor(undefined);
    const opening =
      typeof value === "string" ? startingText(column, value) : "";
    const given = typedFirst ?? opening;
    const starting = asTyped?.({ text: given, cursor: null }).text ?? given;
    setOpenedWith((before) => ({
      text: opening,
      value,
      edit: (before?.edit ?? 0) + 1,
    }));
    typed.current = starting;
    focusSoon(`${cellId(cell.row, cell.column)}-editor`);
  };

  const stopEdit = (then: Cell) => {
    setEditing(undefined);
    moveTo(then.row, then.column);
  };
  // Saves the cell being edited and goes on as the key that finished it asks: Enter adds a new row's
  // record or, on a record, moves down; Tab moves across, straight on to editing in a new row where
  // the next cell opens an editor; and
  // leaving the cell stays put. A refused value keeps the cell open, with the problem named; once
  // the cell is left, the cell shows its own value again.
  const finish = (cell: Cell, given: CellValue, how: Finish) => {
    // Text left as the editor opened with it keeps the value, which may hold more than it showed.
    const value =
      openedWith !== undefined && given === openedWith.text
        ? openedWith.value
        : given;
    if (!save(cell, value)) {
      // Only a record's value is refused, since a new row keeps what is typed until it is added.
      if (how === "leave") {
        setEditing(undefined);
        putBack();
      }
      return;
    }
    const { row, column } = at(cell);
    const key = column.key;
    if (how === "enter" && row.newRow) {
      setEditing(undefined);
      submitNewRows(
        newRows.map((newRow) =>
          newRow.key === row.newRow.key
            ? followingKind({
                key: newRow.key,
                ...kindKept(newRow),
                values: { ...newRow.values, [key]: value },
              })
            : newRow,
        ),
      );
      return;
    }
    if (how === "enter") {
      stopEdit({ ...cell, row: cell.row + 1 });
      return;
    }
    if (how === "leave") {
      setEditing(undefined);
      return;
    }
    const across = {
      ...cell,
      column: cell.column + (how === "next" ? 1 : -1),
    };
    const within = across.column >= 0 && across.column < columns.length;
    if (row.newRow && within && opensEditor(across)) {
      startEdit(across);
    } else {
      stopEdit(within ? across : cell);
    }
  };

  const onEditorKey = (event: KeyboardEvent, cell: Cell) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setProblem(undefined);
      stopEdit(cell);
    } else if (event.key === "Enter" && !composingWord(event)) {
      event.preventDefault();
      finish(cell, typed.current, "enter");
    } else if (event.key === "Tab") {
      event.preventDefault();
      finish(cell, typed.current, event.shiftKey ? "previous" : "next");
    }
  };

  const onCellKey = (event: KeyboardEvent, cell: Cell) => {
    if (event.target !== event.currentTarget) return;
    const { row, column } = at(cell);
    const plain = !event.altKey && !event.metaKey && !event.ctrlKey;
    const moves: Record<string, Cell> = {
      ArrowUp: { ...cell, row: cell.row - 1 },
      ArrowDown: { ...cell, row: cell.row + 1 },
      ArrowLeft: { ...cell, column: cell.column - 1 },
      ArrowRight: { ...cell, column: cell.column + 1 },
      Home: { ...cell, column: 0 },
      End: { ...cell, column: columns.length - 1 },
    };
    // Ctrl+Home and Ctrl+End, or Cmd with the same keys, go to the table's first and last cells.
    const corners: Record<string, Cell> = {
      Home: { row: 0, column: 0 },
      End: { row: rows.length - 1, column: columns.length - 1 },
    };
    const jump =
      (event.ctrlKey || event.metaKey) && !event.altKey
        ? corners[event.key]
        : undefined;
    const move = plain ? moves[event.key] : jump;
    if (move) {
      event.preventDefault();
      moveTo(move.row, move.column);
      return;
    }
    // Tab and Shift+Tab move across, on to the next or previous row at either end, and leave the
    // table only from its first or last cell.
    if (event.key === "Tab") {
      const step = event.shiftKey ? -1 : 1;
      const index = cell.row * columns.length + cell.column + step;
      if (index < 0 || index >= rows.length * columns.length) return;
      event.preventDefault();
      moveTo(Math.floor(index / columns.length), index % columns.length);
      return;
    }
    if (opensMenu(event)) {
      event.preventDefault();
      if (hasRowMenu(row)) setMenuFor({ key: rowKey(row), place: "end" });
      return;
    }
    if (!plain) return;
    const { asTyped, inPanel } = kindOf(column);
    // Keys typed fast reach the cell until its editor has focus, and follow the first. They come
    // before every other key's meaning, so a space typed then is text, not a tick or a fresh start.
    if (
      event.key.length === 1 &&
      editing?.row === cell.row &&
      editing.column === cell.column &&
      inPanel !== true
    ) {
      event.preventDefault();
      const next = typed.current + event.key;
      typed.current = asTyped?.({ text: next, cursor: null }).text ?? next;
      // The editor, which keeps its own text once open, starts afresh from what is typed so far.
      setOpenedWith((before) => before && { ...before, edit: before.edit + 1 });
      focusSoon(`${cellId(cell.row, cell.column)}-editor`);
      return;
    }
    if (
      ticks !== undefined &&
      event.key === " " &&
      cell.column === 0 &&
      row.record !== undefined
    ) {
      event.preventDefault();
      if (ticks.tickable(row.record, shownIds)) {
        ticks.onTick([row.record.id], !ticks.ticked.has(row.record.id));
      }
      return;
    }
    if (row.record && locked(row.record)) {
      if (inPanel === true && (event.key === "Enter" || event.key === "F2")) {
        event.preventDefault();
        startEdit(cell);
      }
      return;
    }
    if (event.key === "Enter" && row.newRow && !emptyNewRow(row.newRow)) {
      event.preventDefault();
      submitNewRows();
    } else if (
      event.key === "Enter" ||
      event.key === "F2" ||
      event.key === " "
    ) {
      event.preventDefault();
      startEdit(cell);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      if (readOnlyFor(column, rowKind(row)) || writingInPanel) return;
      if (!save(cell, emptyValue(column))) putBack();
    } else if (event.key.length === 1) {
      event.preventDefault();
      startEdit(cell, event.key);
    }
  };
  // The problem in a cell, if any: one saving its value found, or one found in it when its new row
  // was added.
  const problemIn = (cell: Cell): string | undefined => {
    const { row, column } = at(cell);
    const key = rowKey(row);
    if (problem?.row === key) {
      return problem.column === column.key ? problem.message : undefined;
    }
    if (row.newRow === undefined) return undefined;
    if (row.newRow.problem !== undefined) {
      return row.newRow.problemAt === column.key
        ? row.newRow.problem
        : undefined;
    }
    const wrong = row.newRow.soFar;
    return wrong?.column === column.key ? wrong.message : undefined;
  };

  // The problem named under a row, in its first cell, if any: one saving a value found, or one
  // found when its new row was added.
  const rowProblemOf = (row: Row<Rec>): string | undefined =>
    problem?.row === rowKey(row) ? problem.message : row.newRow?.problem;

  // The element naming the problem in the cell being edited, when it is shown: under the row, or in
  // a new row's mark, which is hidden while the row's first cell is edited.
  const problemTarget = (cell: Cell): string | undefined => {
    const { row } = at(cell);
    const shown =
      rowProblemOf(row) !== undefined ||
      (row.newRow?.soFar !== undefined && cell.column !== 0);
    return problemIn(cell) !== undefined && shown
      ? `${cellId(cell.row, 0)}-problem`
      : undefined;
  };

  // A saved record's picker links what it adds to the record; a new row's fills the row, where its
  // column says so.
  const addingAt = (cell: Cell, column: Column<Rec, Change>) => {
    const { row } = at(cell);
    const { adds } = column;
    if (row.newRow) {
      const { key } = row.newRow;
      return adds?.fillsNewRow === true
        ? addingFor(
            adds,
            {
              fill: (ids) => {
                fillNewRow(key, column, [...ids]);
              },
            },
            () => {
              focusSoon(cellId(cell.row, cell.column));
            },
          )
        : undefined;
    }
    const { record } = row;
    return addingFor(adds, { id: record.id }, () => {
      focusRecordCell(record.id, column.key);
    });
  };

  const editor = (
    cell: Cell,
    column: Column<Rec, Change>,
    value: CellValue,
  ) => {
    const id = `${cellId(cell.row, cell.column)}-editor`;
    const { Editor, asTyped } = kindOf(column);
    const invalid = problemIn(cell) !== undefined;
    const describedBy = problemTarget(cell);
    if (Editor !== undefined) {
      return (
        <Editor
          key={openedWith?.edit}
          id={id}
          column={column}
          value={value}
          typed={typed.current}
          invalid={invalid}
          describedBy={describedBy}
          readOnly={readOnlyAt(cell)}
          adding={addingAt(cell, column)}
          onDone={(edited, how) => {
            finish(cell, edited, how);
          }}
          onCancel={() => {
            stopEdit(cell);
          }}
        />
      );
    }
    const input = (
      <TypedInput
        key={openedWith?.edit}
        id={id}
        className={[
          classes.recordEditor,
          invalid ? classes.recordEditorInvalid : "",
        ].join(" ")}
        aria-label={fieldLabel(column)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        starting={typed.current}
        asTyped={asTyped}
        onTyped={(next) => {
          typed.current = next;
        }}
        onKeyDown={(event) => {
          onEditorKey(event, cell);
        }}
        onBlur={() => {
          finish(cell, typed.current, "leave");
        }}
      />
    );
    // A number in a unit names the unit's code beside it, as its cell does.
    return column.unit === undefined ? (
      input
    ) : (
      <span className={classes.recordUnitEditor}>
        {input}
        <span className={classes.recordUnitCode}>{column.unit.code}</span>
      </span>
    );
  };
  return {
    startEdit,
    onCellKey,
    problemIn,
    editor,
  };
}

export type EditingGrid<Rec extends GridRecord, Change, Request> = MenuGrid<
  Rec,
  Change,
  Request
> &
  ReturnType<typeof gridEditing<Rec, Change, Request>>;

// A cell's text editor, which keeps what is typed itself and reports each change, so typing draws
// only the editor rather than the whole table.
function TypedInput({
  starting,
  asTyped,
  onTyped,
  ...input
}: Omit<ComponentProps<"input">, "value" | "onChange"> & {
  starting: string;
  asTyped: ((typing: Typing) => Typing) | undefined;
  onTyped: (typed: string) => void;
}) {
  const [value, setValue] = useState(starting);
  return (
    <input
      {...input}
      value={value}
      autoComplete="off"
      onChange={(event) => {
        const box = event.currentTarget;
        const next = asTyped === undefined ? box.value : typeIn(box, asTyped);
        setValue(next);
        onTyped(next);
      }}
    />
  );
}
