// SPDX-License-Identifier: Apache-2.0

// Saving a cell's value, checked against its column and the record's other values, and adding the
// records typed or pasted into new rows.

import type { ClipboardEvent } from "react";
import {
  columnsOn,
  emptyValue,
  isEmpty,
  keptForKind,
  kindOf,
  onRow,
  readOnlyFor,
} from "./grid-columns.tsx";
import { pendingId, wholeCellDraft } from "./grid-drafts.ts";
import type { LayoutGrid } from "./grid-layout.ts";
import type { Cell, NewRow, Row } from "./grid-places.ts";
import type {
  AnyColumn,
  Column,
  GridRecord,
  RecordTable,
  RowProblem,
} from "./record-table.ts";
import { emptiedWords, marksIn } from "./status-mark.tsx";
import type { CellValue } from "./table-view.ts";

// The most rows one paste adds, as the server allows at once.
const pasteLimit = 1000;

// What putting a new value in a record's column comes to: nothing, when it is the value already
// there; what is wrong, with the value itself or with the record's values taken together, beside
// the others'; or the change that saves it.
export function valueChange<Rec extends GridRecord, Change>(
  recordProblem: RecordTable<Rec, Change, unknown>["recordProblem"],
  column: Column<Rec, Change>,
  kind: string,
  before: Record<string, CellValue>,
  value: CellValue,
  others: () => Record<string, CellValue>[],
): { change: Change } | { problem: RowProblem } | undefined {
  if (JSON.stringify(before[column.key]) === JSON.stringify(value)) {
    return undefined;
  }
  const problem = firstProblem(
    columnsOn([column], kind),
    () => value,
    () =>
      recordProblem(
        { ...before, [column.key]: value },
        others,
        column.key,
        before,
      ),
  );
  return problem === undefined ? { change: column.change(value) } : { problem };
}

// Whether a value is missing from a column that needs one.
const neededProblem = (column: AnyColumn, value: CellValue) =>
  column.required && isEmpty(value) ? `${column.label} needed` : undefined;

// What is wrong with a value besides its being needed, such as a date that is not one.
const kindProblem = (column: AnyColumn, value: CellValue) =>
  kindOf(column).problem(column, value);

// What is wrong with a record's values, and in which column, when one: first any value its column
// cannot take, then the record taken whole, such as an Employee ID someone else has, and last any
// value still needed, so that a value that is wrong is named before one only missing.
function firstProblem(
  columns: readonly AnyColumn[],
  valueIn: (column: AnyColumn) => CellValue,
  whole: () => RowProblem | undefined,
): (RowProblem & { needed?: boolean }) | undefined {
  const inColumns = (check: typeof neededProblem, needed: boolean) => {
    for (const column of columns) {
      const message = check(column, valueIn(column));
      if (message !== undefined) {
        return { message, column: column.key, ...(needed ? { needed } : {}) };
      }
    }
    return undefined;
  };
  return (
    inColumns(kindProblem, false) ?? whole() ?? inColumns(neededProblem, true)
  );
}

// Everything wrong with a new record's values, as adding its row checks them, each in its column,
// or, for values taken together that name none, in the first: a value its column will not take or
// still needs, and the values taken together beside the other records', unless their column
// already names a problem.
export function newRecordProblems<Rec extends GridRecord, Change>(
  columns: readonly Column<Rec, Change>[],
  kind: string,
  values: Readonly<Record<string, CellValue>>,
  recordProblem: RecordTable<Rec, Change, unknown>["recordProblem"],
  others: () => Record<string, CellValue>[],
): (RowProblem & { column: string })[] {
  const offeredColumns = columnsOn(columns, kind);
  const inColumns = offeredColumns.flatMap(
    (column): (RowProblem & { column: string })[] => {
      const value = values[column.key] ?? emptyValue(column);
      const message =
        kindProblem(column, value) ?? neededProblem(column, value);
      return message === undefined ? [] : [{ message, column: column.key }];
    },
  );
  const whole = recordProblem({ ...values }, others);
  if (whole === undefined) return inColumns;
  const column = whole.column ?? (offeredColumns[0] as Column<Rec, Change>).key;
  return inColumns.some((problem) => problem.column === column)
    ? inColumns
    : [{ message: whole.message, column }, ...inColumns];
}

// The new rows pasted text makes, from the given column across: one for each line, with each cell's
// text matched to the column's choices by name, or taken as a web link's address, and any problem
// found.
export function pastedRows(
  text: string,
  columns: readonly AnyColumn[],
  from: number,
  firstKey: number,
  kind = "",
): NewRow[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      const values: Record<string, CellValue> = {};
      let problem: string | undefined;
      for (const [offset, cell] of line.split("\t").entries()) {
        const column = columns[from + offset];
        const content = cell.trim();
        if (
          column === undefined ||
          readOnlyFor(column, kind) ||
          content === ""
        ) {
          continue;
        }
        // A pasted row has no record yet.
        const read = kindOf(column).pasted(
          onRow<never, AnyColumn>(column, undefined, kind),
          content,
        );
        if ("problem" in read) problem ??= read.problem;
        else values[column.key] = read.value;
      }
      return {
        key: firstKey + index,
        values,
        ...(problem === undefined ? {} : { problem }),
      };
    });
}

export function gridSaving<Rec extends GridRecord, Change, Request>(
  grid: LayoutGrid<Rec, Change, Request>,
) {
  const {
    table,
    actions,
    allColumns,
    known,
    columns,
    records,
    liveById,
    draftById,
    defaultKind,
    rowKind,
    setAdded,
    setShownAs,
    stableId,
    newRows,
    setNewRows,
    nextKey,
    setNextKey,
    setProblem,
    setMenuFor,
    rowKey,
    at,
    editing,
    writingInPanel,
    setEditing,
    focusNew,
  } = grid;
  // A new row's value in a column: what is put in it, or what the column shows on a new row of its
  // kind.
  const newValue = (newRow: NewRow, column: Column<Rec, Change>): CellValue =>
    newRow.values[column.key] ??
    column.newRowValue?.(newRow.kind ?? defaultKind) ??
    emptyValue(column);
  const valueAt = (row: Row<Rec>, column: Column<Rec, Change>) =>
    row.newRow ? newValue(row.newRow, column) : column.value(row.record);
  // An empty row's starting values stay hidden until something is typed in it, so it is not taken
  // for a record.
  const shownAt = (row: Row<Rec>, column: Column<Rec, Change>) =>
    row.newRow && emptyNewRow(row.newRow)
      ? emptyValue(column)
      : valueAt(row, column);
  // What an empty cell of a record shows in grey, if anything.
  const standInAt = (row: Row<Rec>, column: Column<Rec, Change>) => {
    if (row.newRow || !isEmpty(valueAt(row, column))) return undefined;
    return (
      column.standIn?.(row.record) ??
      // A draft emptying the value, or filling it, says so wherever the view marks that draft.
      (marksIn(wholeCellDraft(draftById.get(row.record.id), column), known.show)
        ? emptiedWords(column.label, column.emptyLabel)
        : undefined)
    );
  };

  // What an empty cell of a record's Live row shows in grey, worked out from the record as it is
  // live, so a stand-in made from other cells uses their live values too.
  const liveStandIn = (record: Rec, column: Column<Rec, Change>) => {
    const live = liveById.get(record.id);
    if (live === undefined || !isEmpty(column.value(live))) return undefined;
    return (
      column.standIn?.(live) ??
      (wholeCellDraft(record.draft, column)
        ? emptiedWords(column.label, column.emptyLabel)
        : undefined)
    );
  };
  // Each record's values, by column.
  const valuesOf = (record: Rec): Record<string, CellValue> =>
    Object.fromEntries(
      allColumns.map((column) => [column.key, column.value(record)]),
    );

  // Every record's and new row's values, by the record's stable identifier or the new row's key,
  // read once for a save or for adding
  // rows, and only when a record's problem needs them.
  const everyRowsValues = () => {
    let read: [string, Record<string, CellValue>][] | undefined;
    return () => {
      read ??= [
        ...records.map((record): [string, Record<string, CellValue>] => [
          stableId(record),
          valuesOf(record),
        ]),
        ...newRows.map((newRow): [string, Record<string, CellValue>] => [
          `new-${String(newRow.key)}`,
          newRow.values,
        ]),
      ];
      return read;
    };
  };

  // The values of every record and new row but the one named by its key among them.
  const otherValues =
    (rowsValues: () => [string, Record<string, CellValue>][], except: string) =>
    () =>
      rowsValues().flatMap(([key, values]) => (key === except ? [] : [values]));

  // What is wrong so far with a new row's values, named by its row's key, besides what it still
  // needs, such as an Employee ID someone else has. An empty row has nothing wrong yet.
  const wrongSoFar = (
    values: Record<string, CellValue>,
    key: string,
    kind: string,
  ): RowProblem | undefined => {
    if (Object.values(values).every(isEmpty)) return undefined;
    const found = firstProblem(
      columnsOn(allColumns, kind),
      (column) => values[column.key] ?? emptyValue(column),
      () => table.recordProblem(values, otherValues(everyRowsValues(), key)),
    );
    return found?.needed === true ? undefined : found;
  };

  // A record's cell whose new value was refused shows the value it had again, so the row is as it
  // was and has no problem to name.
  const putBack = () => {
    setProblem(undefined);
  };

  // Saves a cell's new value: on a record, at once; on a new row, into the row. Returns whether it
  // would do, showing the problem on the row when it would not.
  const save = (cell: Cell, value: CellValue): boolean => {
    const { row, column } = at(cell);
    return saveTo(row, column, value);
  };

  const saveTo = (
    row: Row<Rec>,
    column: Column<Rec, Change>,
    value: CellValue,
  ): boolean => {
    const key = rowKey(row);
    if (row.newRow) {
      const made = followingKind({
        key: row.newRow.key,
        ...kindKept(row.newRow),
        values: { ...row.newRow.values, [column.key]: value },
      });
      const soFar = wrongSoFar(made.values, key, made.kind ?? defaultKind);
      setNewRows((current) =>
        current.map((newRow) =>
          newRow.key === row.newRow.key
            ? { ...made, ...(soFar ? { soFar } : {}) }
            : newRow,
        ),
      );
      setProblem(undefined);
      return true;
    }
    const made = valueChange(
      table.recordProblem,
      column,
      rowKind(row),
      valuesOf(row.record),
      value,
      otherValues(everyRowsValues(), stableId(row.record)),
    );
    if (made === undefined) return true;
    if ("problem" in made) {
      setProblem({
        row: key,
        column: made.problem.column ?? column.key,
        message: made.problem.message,
      });
      return false;
    }
    setProblem(undefined);
    actions.update(row.record, made.change);
    return true;
  };

  const emptyNewRow = (newRow: NewRow) =>
    Object.values(newRow.values).every(isEmpty);

  // A new row's kind, kept when the row is made again with new values.
  const kindKept = (newRow: NewRow) =>
    newRow.kind === undefined ? {} : { kind: newRow.kind };

  // A new row of the kind its values make it, when they decide one, without the values that kind
  // does not have.
  const followingKind = (newRow: NewRow): NewRow => {
    const kind = table.kindOfNewRow?.(newRow.values);
    if (kind === undefined || kind === (newRow.kind ?? defaultKind)) {
      return newRow;
    }
    const made: NewRow = {
      ...newRow,
      kind,
      values: keptForKind(allColumns, newRow.values, kind).values,
    };
    if (kind === defaultKind) delete made.kind;
    return made;
  };

  // A new row with something in it can be cleared, so it is no longer added.
  const clearable = (newRow: NewRow) => !emptyNewRow(newRow);

  // Takes away a new row and what it holds, leaving an empty one at the end, and puts focus on the
  // row after it.
  const clearNewRow = (newRow: NewRow) => {
    const kept = newRows.filter(({ key }) => key !== newRow.key);
    const last = kept.at(-1);
    const free = Math.max(nextKey, ...newRows.map(({ key }) => key + 1));
    const next =
      last === undefined || !emptyNewRow(last)
        ? [...kept, { key: free, values: {} }]
        : kept;
    setNewRows(next);
    if (next.length > kept.length) setNextKey(free + 1);
    setMenuFor(undefined);
    setEditing(undefined);
    // New rows end with an empty one, which a row that can be cleared is always before.
    const after = next.find(({ key }) => key > newRow.key) as NewRow;
    focusNew(after.key);
  };

  // Adds the records in the new rows, all together, once every one of them will do; otherwise shows
  // each row's problem and puts focus on the first.
  const submitNewRows = (current: NewRow[] = newRows) => {
    const filled = current.filter((newRow) => !emptyNewRow(newRow));
    if (filled.length === 0) return;
    const rowsValues = everyRowsValues();
    const checked = filled.map((newRow): NewRow => {
      if (newRow.problem !== undefined) return newRow;
      const found = firstProblem(
        columnsOn(allColumns, newRow.kind ?? defaultKind),
        // The columns given are the table's own.
        (column) => newValue(newRow, column as Column<Rec, Change>),
        () =>
          table.recordProblem(
            newRow.values,
            otherValues(rowsValues, `new-${String(newRow.key)}`),
          ),
      );
      if (found === undefined) return newRow;
      return {
        ...newRow,
        problem: found.message,
        ...(found.column === undefined ? {} : { problemAt: found.column }),
      };
    });
    // Keys for the rows made next, after every key in use, since rows just pasted may already have
    // taken the next ones.
    const free = Math.max(nextKey, ...current.map(({ key }) => key + 1));
    const withProblem = checked.find((newRow) => newRow.problem);
    if (withProblem) {
      setNewRows([...checked, { key: free, values: {} }]);
      setNextKey(free + 1);
      focusNew(withProblem.key);
      return;
    }
    const pending = filled.map((newRow) => {
      const kind = newRow.kind ?? defaultKind;
      return {
        id: pendingId(),
        request: table.request(
          columnsOn(allColumns, kind)
            .filter(({ readOnly }) => readOnly !== true)
            .map((column) => column.change(newValue(newRow, column))),
          kind,
        ),
      };
    });
    setAdded(
      (current) => new Set([...current, ...pending.map(({ id }) => id)]),
    );
    actions.add(
      pending,
      (ids) => {
        setShownAs(
          (current) =>
            new Map([
              ...current,
              ...pending.map(
                ({ id }, index) => [String(ids.at(index)), id] as const,
              ),
            ]),
        );
      },
      // What was entered comes back above any new rows typed in since.
      () => {
        setNewRows((current) => [...filled, ...current]);
      },
    );
    setNewRows([{ key: free, values: {} }]);
    setNextKey(free + 2);
    setProblem(undefined);
    focusNew(free);
  };
  // Pasting rows into a new row adds a record for each, from the cell pasted into across.
  const onPaste = (event: ClipboardEvent, cell: Cell) => {
    const { row } = at(cell);
    const pasted = event.clipboardData.getData("text/plain");
    if (
      !row.newRow ||
      editing !== undefined ||
      writingInPanel ||
      pasted.trim() === ""
    ) {
      return;
    }
    event.preventDefault();
    const made = pastedRows(
      pasted,
      columns,
      cell.column,
      nextKey,
      rowKind(row),
    ).map((newRow) => followingKind({ ...newRow, ...kindKept(row.newRow) }));
    if (made.length > pasteLimit) {
      setProblem({
        row: rowKey(row),
        message: `Up to ${String(pasteLimit)} rows at once`,
      });
      return;
    }
    // Adding them takes the next keys past these rows.
    const kept = newRows.filter(
      (newRow) => newRow.key !== row.newRow.key && !emptyNewRow(newRow),
    );
    submitNewRows([...kept, ...made]);
  };
  return {
    newValue,
    valueAt,
    shownAt,
    standInAt,
    liveStandIn,
    putBack,
    save,
    saveTo,
    emptyNewRow,
    kindKept,
    followingKind,
    clearable,
    clearNewRow,
    submitNewRows,
    onPaste,
  };
}

export type SavingGrid<Rec extends GridRecord, Change, Request> = LayoutGrid<
  Rec,
  Change,
  Request
> &
  ReturnType<typeof gridSaving<Rec, Change, Request>>;
