// SPDX-License-Identifier: Apache-2.0

// The People table, edited like a spreadsheet. Arrow keys, Home, End, and Tab move between cells,
// and Ctrl+Home and Ctrl+End go to the first and last. On a
// person, Enter, F2, or typing edits the cell, and Delete clears it. While editing, Enter saves and
// moves down, Tab saves and moves across, and Esc cancels. A column drawing on a list is edited by
// typing to narrow its choices and picking one, as choice-picker.tsx sets out. Empty rows at the end
// take new people: Tab moves straight on to editing the next cell, and Enter, in a cell or on the
// row, adds the person and starts the next. Pasting rows copied from a spreadsheet into a new row
// adds a person for each, all saved together; rows that will not do stay as new rows with their
// problems shown. Each person's menu, also opened with Shift+F10, deletes them. Every column can be
// dragged by its header, moved with Alt and the arrow keys, or moved from its menu, and columns
// drawing on lists are changed from there too. Viewers see the same table, read only.

import type {
  Choice,
  Field,
  List,
  Person,
  PersonChange,
  PersonRequest,
} from "@fathom/shared";
import { personLengths } from "@fathom/shared";
import { ActionIcon, Menu, VisuallyHidden } from "@mantine/core";
import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useState,
} from "react";
import { ChoicePicker, type Finish } from "./choice-picker.tsx";
import { focusSoon } from "./focus.ts";
import { shortcutsFor } from "./list-panel.tsx";
import { Icon } from "./icons.tsx";
import { sameName } from "./lists.ts";
import classes from "./pages.module.css";

export interface PeopleActions {
  // Adds people, all saved together; if they cannot be saved, gives back what was entered.
  add: (requests: PersonRequest[], onFailed: () => void) => void;
  update: (person: Person, change: PersonChange) => void;
  remove: (person: Person) => void;
  // Moves a column, by its key, to just after another, or to the start when there is none.
  moveColumn: (key: string, label: string, after: string | null) => void;
  editColumn: (field: Field) => void;
}

type Kind = "text" | "date" | "choice";

export interface Column {
  // A person's own detail, or a column drawing on a list, by its identifier.
  key: string;
  label: string;
  kind: Kind;
  required: boolean;
  // For columns drawing on a list: the column, its list's choices, and whether it takes several.
  field?: Field;
  choices: Choice[];
  multiple: boolean;
}

// What a cell holds: text, a date as YYYY-MM-DD or empty, or the chosen choices.
type Value = string | string[];

interface Draft {
  key: number;
  values: Record<string, Value>;
  problem?: string;
}

type Row = { person: Person; draft?: never } | { draft: Draft; person?: never };

// A cell by the keys of its row and column.
interface Place {
  row: string;
  column: string;
}

interface Cell {
  row: number;
  column: number;
}

const headerId = (column: Column) => `column-${column.key}`;

const shortcuts = shortcutsFor(navigator.userAgent);

// The most rows one paste adds, as the server allows at once.
const pasteLimit = 1000;

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

// The People table's columns, in the order given by their keys: each person's name and Employee ID,
// the columns drawing on lists, and, for those who may see them, start and end dates. A column the
// order does not name yet comes at the end.
export function columnsFor(
  fields: readonly Field[],
  lists: readonly List[],
  order: readonly string[],
  showDates: boolean,
): Column[] {
  const builtIn = (key: string, label: string, kind: Kind, required = false) =>
    ({
      key,
      label,
      kind,
      required,
      choices: [],
      multiple: false,
    }) satisfies Column;
  const all: Column[] = [
    builtIn("preferredName", "Name", "text", true),
    builtIn("employeeId", "Employee ID", "text", true),
    ...(showDates
      ? [
          builtIn("startDate", "Start", "date"),
          builtIn("endDate", "End", "date"),
        ]
      : []),
    ...fields.map((field): Column => ({
      key: field.id,
      label: field.name,
      kind: "choice",
      required: field.required,
      field,
      choices: lists.find(({ id }) => id === field.listId)?.choices ?? [],
      multiple: field.multiple,
    })),
  ];
  const place = (column: Column) => {
    const at = order.indexOf(column.key);
    return at === -1 ? order.length : at;
  };
  return all
    .map((column, index) => ({ column, index }))
    .sort((a, b) => place(a.column) - place(b.column) || a.index - b.index)
    .map(({ column }) => column);
}

function personValue(person: Person, column: Column): Value {
  if (column.kind === "choice") return person.values[column.key] ?? [];
  const detail = person[column.key as "preferredName" | "startDate"];
  return detail ?? "";
}

function draftValue(draft: Draft, column: Column): Value {
  return draft.values[column.key] ?? (column.kind === "choice" ? [] : "");
}

function isEmpty(value: Value): boolean {
  return Array.isArray(value) ? value.length === 0 : value.trim() === "";
}

const isDay = (text: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(text) &&
  !Number.isNaN(Date.parse(`${text}T00:00:00Z`));

// The width of a column, which comes from its kind alone.
function widthClass(column: Column): string | undefined {
  if (column.key === "preferredName") return classes.peopleColName;
  if (column.key === "employeeId") return classes.peopleColId;
  return column.kind === "date"
    ? classes.peopleColDate
    : classes.peopleColChoice;
}

// A cell's value in words.
function shown(column: Column, value: Value): string {
  if (Array.isArray(value)) {
    return value
      .map((id) => column.choices.find((choice) => choice.id === id)?.label)
      .filter((label) => label !== undefined)
      .join(", ");
  }
  return column.kind === "date" && isDay(value) ? formatDay(value) : value;
}

// The choices a cell offers: those offered in its list, and any retired ones it already has.
function choicesFor(column: Column, value: string[]) {
  return column.choices
    .filter((choice) => !choice.retired || value.includes(choice.id))
    .map((choice) => ({ value: choice.id, label: choice.label }));
}

// What is wrong with a value for a column, if anything.
export function valueProblem(column: Column, value: Value): string | undefined {
  if (column.required && isEmpty(value)) return `${column.label} needed`;
  if (typeof value !== "string") return undefined;
  const limit =
    column.key === "employeeId"
      ? personLengths.employeeId
      : personLengths.preferredName;
  if (column.kind === "text" && value.trim().length > limit) {
    return `${column.label} too long`;
  }
  if (column.kind === "date" && value !== "" && !isDay(value)) {
    return `${column.label}: use a date such as 2026-10-31`;
  }
  return undefined;
}

// What is wrong with a person's details taken together, if anything: an Employee ID someone else has,
// or an end date before the start date.
function recordProblem(
  values: Record<string, Value>,
  others: readonly string[],
): string | undefined {
  const employeeId = values.employeeId;
  if (
    typeof employeeId === "string" &&
    others.some((other) => sameName(other, employeeId))
  ) {
    return "Someone already has that Employee ID";
  }
  const { startDate, endDate } = values;
  if (
    typeof startDate === "string" &&
    typeof endDate === "string" &&
    startDate !== "" &&
    endDate !== "" &&
    endDate < startDate
  ) {
    return "The end date cannot be before the start date";
  }
  return undefined;
}

// The request that adds a new row's person.
function requestFor(draft: Draft, columns: readonly Column[]): PersonRequest {
  const text = (key: string) => {
    // The key is one of the fixed details named below.
    // eslint-disable-next-line security/detect-object-injection
    const value = draft.values[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const date = (key: string) => (text(key) === "" ? null : text(key));
  const values = Object.fromEntries(
    columns
      .filter((column) => column.kind === "choice")
      .map((column) => [column.key, draftValue(draft, column) as string[]]),
  );
  return {
    preferredName: text("preferredName"),
    employeeId: text("employeeId"),
    ...(columns.some((column) => column.kind === "date")
      ? { startDate: date("startDate"), endDate: date("endDate") }
      : {}),
    values,
  };
}

// The new rows pasted text makes, from the given column across: one for each line, with each cell's
// text matched to the column's choices by name, and any problem found.
export function pastedDrafts(
  text: string,
  columns: readonly Column[],
  from: number,
  firstKey: number,
): Draft[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      const values: Record<string, Value> = {};
      let problem: string | undefined;
      for (const [offset, cell] of line.split("\t").entries()) {
        const column = columns[from + offset];
        const content = cell.trim();
        if (column === undefined || content === "") continue;
        if (column.kind !== "choice") {
          values[column.key] = content;
          continue;
        }
        const choice = column.choices.find(
          (option) => !option.retired && sameName(option.label, content),
        );
        if (choice === undefined) {
          problem ??= `No ${column.label} called ${content}`;
        } else {
          values[column.key] = [choice.id];
        }
      }
      return {
        key: firstKey + index,
        values,
        ...(problem === undefined ? {} : { problem }),
      };
    });
}

// Where a dragged column should go, by key: just after another, or at the start. Undefined when it
// stays where it is.
export function droppedAfter(
  keys: readonly string[],
  moved: string,
  onto: string,
): string | null | undefined {
  const from = keys.indexOf(moved);
  const to = keys.indexOf(onto);
  if (from === -1 || to === -1 || from === to) return undefined;
  const others = keys.filter((key) => key !== moved);
  const at = others.indexOf(onto) + (to > from ? 1 : 0);
  return others[at - 1] ?? null;
}

export function PeopleGrid({
  people,
  fields,
  order,
  lists,
  canEdit,
  canEditColumns,
  showDates,
  actions,
}: {
  people: Person[];
  fields: Field[];
  // The keys of the columns, in order.
  order: string[];
  lists: List[];
  canEdit: boolean;
  canEditColumns: boolean;
  showDates: boolean;
  actions: PeopleActions;
}) {
  const columns = columnsFor(fields, lists, order, showDates);
  const [drafts, setDrafts] = useState<Draft[]>([{ key: 0, values: {} }]);
  const [nextKey, setNextKey] = useState(1);
  // The selected cell and the cell being edited, by row and column key rather than position, so they
  // stay with their person when a save puts the rows in a new order.
  const [activeAt, setActiveAt] = useState<Place>();
  const [editingAt, setEditingAt] = useState<Place>();
  // What is typed in the cell being edited: its text, or what narrows its choices.
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<{ row: string; message: string }>();
  const [menuFor, setMenuFor] = useState<string>();
  const [dragging, setDragging] = useState<string>();

  const rows: Row[] = [
    ...people.map((person) => ({ person })),
    ...(canEdit ? drafts.map((draft) => ({ draft })) : []),
  ];
  const rowKey = (row: Row) =>
    row.person ? row.person.id : `new-${String(row.draft.key)}`;
  const rowKeys = rows.map(rowKey);
  const keys = columns.map((column) => column.key);
  const cellId = (row: number, column: number) =>
    `cell-${String(rowKeys.at(row))}-${String(keys.at(column))}`;
  // The row and column of a cell, which is always within the table.
  const at = (cell: Cell) => ({
    row: rows[cell.row] as Row,
    column: columns[cell.column] as Column,
  });
  const placeOf = (cell: Cell): Place => ({
    row: String(rowKeys.at(cell.row)),
    column: String(keys.at(cell.column)),
  });
  const cellAt = (place: Place) => ({
    row: rowKeys.indexOf(place.row),
    column: keys.indexOf(place.column),
  });
  // The selected cell, or the first when the one selected has gone.
  const found = activeAt === undefined ? undefined : cellAt(activeAt);
  const active =
    found && found.row !== -1 && found.column !== -1
      ? found
      : { row: 0, column: 0 };
  const editing = editingAt === undefined ? undefined : cellAt(editingAt);
  const setActive = (cell: Cell) => {
    setActiveAt(placeOf(cell));
  };
  const setEditing = (cell: Cell | undefined) => {
    setEditingAt(cell === undefined ? undefined : placeOf(cell));
  };
  const valueAt = (row: Row, column: Column) =>
    row.person
      ? personValue(row.person, column)
      : draftValue(row.draft, column);

  // Focuses a cell of a new row by its key, since the row may not be drawn yet.
  const focusNew = (draftKey: number) => {
    const place = { row: `new-${String(draftKey)}`, column: String(keys[0]) };
    setActiveAt(place);
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

  const startEdit = (cell: Cell, typed?: string) => {
    const { row, column } = at(cell);
    if (row.person && !canEdit) return;
    const value = valueAt(row, column);
    setActive(cell);
    setEditing(cell);
    setMenuFor(undefined);
    setText(typed ?? (Array.isArray(value) ? "" : value));
    focusSoon(`${cellId(cell.row, cell.column)}-editor`);
  };

  const stopEdit = (then: Cell) => {
    setEditing(undefined);
    moveTo(then.row, then.column);
  };

  const otherEmployeeIds = (except: string) => [
    ...people.filter(({ id }) => id !== except).map((p) => p.employeeId),
    ...drafts
      .filter((draft) => `new-${String(draft.key)}` !== except)
      .flatMap((draft) =>
        typeof draft.values.employeeId === "string"
          ? [draft.values.employeeId]
          : [],
      ),
  ];

  // Saves a cell's new value: on a person, at once; on a new row, into the row. Returns whether it
  // would do, showing the problem on the row when it would not.
  const save = (cell: Cell, value: Value): boolean => {
    const { row, column } = at(cell);
    const key = rowKey(row);
    if (row.draft) {
      setDrafts((current) =>
        current.map((draft) =>
          draft.key === row.draft.key
            ? {
                key: draft.key,
                values: { ...draft.values, [column.key]: value },
              }
            : draft,
        ),
      );
      setProblem(undefined);
      return true;
    }
    const before = personValue(row.person, column);
    if (JSON.stringify(before) === JSON.stringify(value)) return true;
    const message =
      valueProblem(column, value) ??
      recordProblem(
        {
          startDate: row.person.startDate ?? "",
          endDate: row.person.endDate ?? "",
          [column.key]: value,
        },
        column.key === "employeeId" ? otherEmployeeIds(row.person.id) : [],
      );
    if (message !== undefined) {
      setProblem({ row: key, message });
      return false;
    }
    setProblem(undefined);
    let change: PersonChange;
    if (Array.isArray(value)) {
      change = { values: { [column.key]: value } };
    } else if (column.kind === "date") {
      change = { [column.key]: value === "" ? null : value };
    } else {
      change = { [column.key]: value.trim() };
    }
    actions.update(row.person, change);
    return true;
  };

  const emptyDraft = (draft: Draft) =>
    Object.values(draft.values).every(isEmpty);

  // Adds the people in the new rows, all together, once every one of them will do; otherwise shows
  // each row's problem and puts focus on the first.
  const submitDrafts = (current: Draft[] = drafts) => {
    const filled = current.filter((draft) => !emptyDraft(draft));
    if (filled.length === 0) return;
    const checked = filled.map((draft) => {
      const message =
        draft.problem ??
        columns
          .map((column) => valueProblem(column, draftValue(draft, column)))
          .find((found) => found !== undefined) ??
        recordProblem(
          draft.values,
          otherEmployeeIds(`new-${String(draft.key)}`),
        );
      return message === undefined ? draft : { ...draft, problem: message };
    });
    const withProblem = checked.find((draft) => draft.problem);
    if (withProblem) {
      setDrafts([...checked, { key: nextKey, values: {} }]);
      setNextKey(nextKey + 1);
      focusNew(withProblem.key);
      return;
    }
    actions.add(
      filled.map((draft) => requestFor(draft, columns)),
      () => {
        setDrafts([...filled, { key: nextKey + 1, values: {} }]);
      },
    );
    setDrafts([{ key: nextKey, values: {} }]);
    setNextKey(nextKey + 2);
    setProblem(undefined);
    focusNew(nextKey);
  };

  // Saves the cell being edited and goes on as the key that finished it asks: Enter adds a new row's
  // person or, on a person, moves down; Tab moves across, straight on to editing in a new row; and
  // leaving the cell stays put. A value that will not do keeps the cell open with its problem, or,
  // when the cell was left, is put back, with the problem still shown.
  const finish = (cell: Cell, value: Value, how: Finish) => {
    if (!save(cell, value)) {
      if (how === "leave") setEditing(undefined);
      return;
    }
    const { row, column } = at(cell);
    const key = column.key;
    if (how === "enter" && row.draft) {
      setEditing(undefined);
      submitDrafts(
        drafts.map((draft) =>
          draft.key === row.draft.key
            ? { key: draft.key, values: { ...draft.values, [key]: value } }
            : draft,
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
    if (row.draft && within) {
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
    } else if (event.key === "Enter") {
      event.preventDefault();
      finish(cell, text, "enter");
    } else if (event.key === "Tab") {
      event.preventDefault();
      finish(cell, text, event.shiftKey ? "previous" : "next");
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
    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      event.preventDefault();
      if (row.person && canEdit) setMenuFor(row.person.id);
      return;
    }
    if (!plain || (row.person && !canEdit)) return;
    if (event.key === "Enter" && row.draft && !emptyDraft(row.draft)) {
      event.preventDefault();
      submitDrafts();
    } else if (
      event.key === "Enter" ||
      event.key === "F2" ||
      event.key === " "
    ) {
      event.preventDefault();
      startEdit(cell);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      save(cell, column.kind === "choice" ? [] : "");
    } else if (event.key.length === 1) {
      event.preventDefault();
      startEdit(cell, event.key);
    }
  };

  // Pasting rows into a new row adds a person for each, from the cell pasted into across.
  const onPaste = (event: ClipboardEvent, cell: Cell) => {
    const { row } = at(cell);
    const pasted = event.clipboardData.getData("text/plain");
    if (!row.draft || editing !== undefined || pasted.trim() === "") return;
    event.preventDefault();
    const made = pastedDrafts(pasted, columns, cell.column, nextKey);
    if (made.length > pasteLimit) {
      setProblem({
        row: rowKey(row),
        message: `Up to ${String(pasteLimit)} rows at once`,
      });
      return;
    }
    setNextKey(nextKey + made.length + 1);
    const kept = drafts.filter(
      (draft) => draft.key !== row.draft.key && !emptyDraft(draft),
    );
    submitDrafts([...kept, ...made]);
  };

  const moveColumnBy = (column: Column, step: -1 | 1) => {
    const index = keys.indexOf(column.key);
    const to = index + step;
    if (to < 0 || to >= keys.length) return;
    const others = keys.filter((key) => key !== column.key);
    actions.moveColumn(column.key, column.label, others[to - 1] ?? null);
    focusSoon(headerId(column));
  };

  const onDrop = (event: DragEvent, onto: Column) => {
    event.preventDefault();
    const moved = columns.find(({ key }) => key === dragging);
    setDragging(undefined);
    if (moved === undefined) return;
    const after = droppedAfter(keys, moved.key, onto.key);
    if (after !== undefined) actions.moveColumn(moved.key, moved.label, after);
  };

  const header = (column: Column) => {
    const { field } = column;
    if (!canEditColumns) {
      return (
        <th key={column.key} scope="col" className={classes.peopleHead}>
          {column.label}
        </th>
      );
    }
    return (
      <th
        key={column.key}
        scope="col"
        className={classes.peopleHead}
        draggable
        onDragStart={() => {
          setDragging(column.key);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          onDrop(event, column);
        }}
      >
        <Menu position="bottom-start" withinPortal hideDetached={false}>
          <Menu.Target>
            <button
              id={headerId(column)}
              type="button"
              className={classes.peopleHeadButton}
              aria-label={`${column.label} column`}
              onKeyDown={(event) => {
                if (event.altKey && event.key === "ArrowLeft") {
                  event.preventDefault();
                  moveColumnBy(column, -1);
                } else if (event.altKey && event.key === "ArrowRight") {
                  event.preventDefault();
                  moveColumnBy(column, 1);
                }
              }}
            >
              {column.label}
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            {field && (
              <Menu.Item
                onClick={() => {
                  actions.editColumn(field);
                }}
              >
                Edit column
              </Menu.Item>
            )}
            <Menu.Item
              rightSection={<kbd>{shortcuts.left}</kbd>}
              onClick={() => {
                moveColumnBy(column, -1);
              }}
            >
              Move left
            </Menu.Item>
            <Menu.Item
              rightSection={<kbd>{shortcuts.right}</kbd>}
              onClick={() => {
                moveColumnBy(column, 1);
              }}
            >
              Move right
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </th>
    );
  };

  const editor = (cell: Cell, column: Column, value: Value) => {
    const id = `${cellId(cell.row, cell.column)}-editor`;
    if (Array.isArray(value)) {
      return (
        <ChoicePicker
          id={id}
          label={column.label}
          options={choicesFor(column, value)}
          multiple={column.multiple}
          initial={value}
          typed={text}
          onDone={(values, how) => {
            finish(cell, values, how);
          }}
          onCancel={() => {
            stopEdit(cell);
          }}
        />
      );
    }
    return (
      <input
        id={id}
        className={classes.peopleEditor}
        aria-label={column.label}
        value={text}
        autoComplete="off"
        onChange={(event) => {
          setText(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          onEditorKey(event, cell);
        }}
        onBlur={() => {
          finish(cell, text, "leave");
        }}
      />
    );
  };

  const rowMenu = (person: Person) => (
    <Menu
      opened={menuFor === person.id}
      onChange={(opened) => {
        setMenuFor(opened ? person.id : undefined);
      }}
      position="bottom-end"
      withinPortal
      hideDetached={false}
    >
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          className={classes.peopleRowActions}
          // Tab moves between cells; the menu also opens with Shift+F10 on any of the row's cells.
          tabIndex={-1}
          aria-label={`Actions for ${person.preferredName}`}
        >
          <Icon name="more" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          color="red"
          onClick={() => {
            actions.remove(person);
            moveTo(active.row, active.column);
          }}
        >
          Delete person
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  // Menus and choices stay shown beside their cell however the table scrolls, so they are not hidden
  // when the cell is partly out of view.
  return (
    <div className={classes.peopleScroll}>
      <table role="grid" aria-label="People" className={classes.peopleTable}>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} className={widthClass(column)} />
          ))}
          {canEdit && <col className={classes.peopleColActions} />}
        </colgroup>
        <thead>
          <tr>
            {columns.map(header)}
            {canEdit && (
              <th scope="col" className={classes.peopleHead}>
                <VisuallyHidden>Actions</VisuallyHidden>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const key = rowKey(row);
            const rowProblem =
              problem?.row === key ? problem.message : row.draft?.problem;
            return (
              <tr
                key={key}
                className={row.draft ? classes.peopleNewRow : classes.peopleRow}
                aria-label={row.draft ? "New person" : undefined}
              >
                {columns.map((column, columnIndex) => {
                  const cell = { row: rowIndex, column: columnIndex };
                  const editingHere =
                    editing?.row === rowIndex && editing.column === columnIndex;
                  const isActive =
                    active.row === rowIndex && active.column === columnIndex;
                  return (
                    <td
                      key={column.key}
                      id={cellId(rowIndex, columnIndex)}
                      role="gridcell"
                      tabIndex={isActive ? 0 : -1}
                      aria-invalid={
                        columnIndex === 0 && rowProblem !== undefined
                          ? true
                          : undefined
                      }
                      className={classes.peopleCell}
                      onKeyDown={(event) => {
                        onCellKey(event, cell);
                      }}
                      onPaste={(event) => {
                        onPaste(event, cell);
                      }}
                      onFocus={(event) => {
                        if (event.target === event.currentTarget) {
                          setActive(cell);
                        }
                      }}
                      onDoubleClick={() => {
                        startEdit(cell);
                      }}
                    >
                      {editingHere
                        ? editor(cell, column, valueAt(row, column))
                        : shown(column, valueAt(row, column))}
                      {columnIndex === 0 && rowProblem !== undefined && (
                        <span className={classes.peopleProblem} role="alert">
                          {rowProblem}
                        </span>
                      )}
                    </td>
                  );
                })}
                {canEdit && (
                  <td className={classes.peopleCell}>
                    {row.person && rowMenu(row.person)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
