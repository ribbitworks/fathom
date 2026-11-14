// SPDX-License-Identifier: Apache-2.0

// Changing the values of a record in a details panel, or of one being added there, as its table's
// cells do: which value's editor is open, and what is wrong with the value last given. Each value is
// saved and checked as its cell saves and checks it.

import { Checkbox, Group, NativeSelect, Text } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { cellKinds, type EditorProps, startingText } from "./cell-kinds.tsx";
import type { Finish } from "./choice-picker.tsx";
import { ClearableInput } from "./clearable-input.tsx";
import { focusSoon, selectSoon } from "./focus.ts";
import {
  type Column,
  type GridRecord,
  readOnlyFor,
  type RecordTable,
  valueChange,
} from "./record-grid.tsx";
import classes from "./record-details.module.css";
import {
  type CellValue,
  type ColumnUnit,
  emptyView,
  fieldLabel,
  withUnit,
} from "./table-view.ts";

type Keyed = Pick<Column<never>, "key">;

const idOf = (column: Keyed, part: string) =>
  `record-value-${column.key}-${part}`;
export const labelId = (column: Keyed) => idOf(column, "label");
export const changeId = (column: Keyed) => idOf(column, "change");
export const problemId = (column: Keyed) => idOf(column, "problem");
export const editorId = (column: Keyed) => idOf(column, "editor");
const wordsId = (column: Keyed) => idOf(column, "words");

// Puts focus on a value being entered: a text or date is a field always open, and any other value
// opens from its change button.
export const focusValue = (column: Keyed & Pick<Column<never>, "kind">) => {
  focusSoon(
    cellKinds[column.kind].Editor === undefined
      ? editorId(column)
      : changeId(column),
  );
};

// Saves a change to the record, with the column and value it puts there.
export type SaveChange<Rec extends GridRecord, Change> = (
  change: Change,
  column: Column<Rec, Change>,
  value: CellValue,
) => void;

// A panel's field for a value typed in place, which Enter or leaving it saves and Esc leaves as it
// was, with an × to empty it. It names its own problem, which Mantine ties to the field.
export function ValueField({
  id,
  label,
  clearLabel,
  hint,
  problem,
  text,
  maxLength,
  onText,
  onEnter,
  onCancel,
  onLeave,
}: {
  id: string;
  label: string;
  clearLabel: string;
  hint?: string | undefined;
  problem?: string | undefined;
  text: string;
  maxLength?: number | undefined;
  onText: (text: string) => void;
  onEnter: () => void;
  onCancel: () => void;
  onLeave?: (() => void) | undefined;
}) {
  return (
    <ClearableInput
      id={id}
      size="sm"
      aria-label={label}
      clearLabel={clearLabel}
      placeholder={hint}
      maxLength={maxLength}
      onClear={() => {
        onText("");
      }}
      error={problem}
      value={text}
      autoComplete="off"
      onChange={(event) => {
        onText(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        } else if (event.key === "Enter") {
          event.preventDefault();
          onEnter();
        }
      }}
      onBlur={onLeave}
    />
  );
}

// Editing text or a date in its row's field. A column that offers units has their menu beside it.
function TextEditor({
  id,
  column,
  value,
  problem,
  hint,
  asTyped,
  units,
  onUnit,
  onDone,
  onCancel,
}: EditorProps & {
  hint?: string | undefined;
  asTyped?: ((text: string) => string) | undefined;
  // In a form or panel, for a column that offers units: the units, and how to enter it in one.
  units?: readonly ColumnUnit[] | undefined;
  onUnit?: ((unit: string) => void) | undefined;
}) {
  // Text and dates are held as text. A number shown to fewer places than it holds opens as shown,
  // and, left so, keeps the value.
  const opened = startingText(column, value as string);
  // Until something is typed, the field follows the value, so choosing another unit shows the same
  // value in it rather than reading the number shown in the new unit.
  const [typed, setTyped] = useState<string>();
  const text = typed ?? opened;
  const given = (entered: string) => (entered === opened ? value : entered);
  const choosesUnit = units !== undefined && onUnit !== undefined;
  const leave = () => {
    onDone(given(text), "leave");
  };
  const field = (
    <ValueField
      id={id}
      label={fieldLabel(column)}
      clearLabel={`Clear ${column.label}`}
      hint={hint}
      problem={problem}
      text={text}
      onText={(typed) => {
        setTyped(asTyped?.(typed) ?? typed);
      }}
      onEnter={() => {
        onDone(given(text), "enter");
      }}
      onCancel={onCancel}
      // With a menu of units beside it, the field is left only once neither has focus.
      onLeave={choosesUnit ? undefined : leave}
    />
  );
  const { unit } = column;
  if (unit === undefined || !choosesUnit) return field;
  // A number in a form or panel offers the units to enter it in, beside the field.
  return (
    <Group
      gap={6}
      wrap="nowrap"
      align="flex-start"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) leave();
      }}
      onKeyDown={(event) => {
        // The field handles its own keys; Esc in the menu of units cancels as it does.
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div className={classes.unitField}>{field}</div>
      <NativeSelect
        size="sm"
        aria-label={`${column.label} unit`}
        value={unit.key}
        data={units.map(({ key, name }) => ({ value: key, label: name }))}
        onChange={(event) => {
          onUnit(event.currentTarget.value);
        }}
      />
    </Group>
  );
}

// The units a form or panel enters columns in: those its table shows, until one is chosen there,
// which holds until the table shows another.
export function useChosenUnits(
  tableUnits: Readonly<Record<string, string>> | undefined,
): {
  units: Record<string, string> | undefined;
  choose: (key: string, unit: string) => void;
} {
  const [chosen, setChosen] = useState<{
    from: string;
    units: Record<string, string> | undefined;
  }>();
  const from = JSON.stringify(tableUnits ?? {});
  const units = chosen?.from === from ? chosen.units : tableUnits;
  return {
    units,
    choose: (key, unit) => {
      setChosen({
        from,
        units: withUnit({ ...emptyView, units }, key, unit).units,
      });
    },
  };
}

// How a row's value may be changed: by its editor, started from the button beside the value and
// shown in its place while open, or, with nothing to start, by a checkbox shown as the value, which
// changes it in one step; and what is wrong with the value last given.
export interface Editing {
  open: boolean;
  editor: ReactNode;
  onStart?: (() => void) | undefined;
  problem: string | undefined;
}

// What changing the record shown needs: Fathom's own ID for it, its kind, its values and
// everyone else's, as its table's cells check them, and how its changes are saved, unless it may not
// be changed for now.
export interface RecordEditingContext<Rec extends GridRecord, Change> {
  id: string;
  kind: string;
  values: Record<string, CellValue>;
  save: SaveChange<Rec, Change> | undefined;
  others: () => Record<string, CellValue>[];
  recordProblem: RecordTable<Rec, Change, unknown>["recordProblem"];
  // Whether the record is being added, so its text and dates are fields always open.
  adding?: boolean;
  // What an empty text field shows in grey, if anything, such as the name a record goes by while it
  // has none of its own.
  hint?: (column: Column<Rec, Change>) => string | undefined;
  // In a form or panel: changes the unit a column that offers units is entered in.
  onUnit?: (column: Column<Rec, Change>, unit: string) => void;
}

// Opens a note, for tables that have them, which is written in a panel of its own.
export interface NoteStarter<Rec extends GridRecord, Change, Context> {
  start: (
    context: Context & { save: SaveChange<Rec, Change> },
    column: Column<Rec, Change>,
  ) => void;
}

type Checked<Change> = { change: Change } | { problem: string } | undefined;

interface ValueProblem {
  id: string;
  key: string;
  message: string;
}

// A list of what is wrong with values, with one value's message set, or, with none, taken away.
const withProblem =
  (id: string, key: string, message?: string) =>
  (current: readonly ValueProblem[]): readonly ValueProblem[] => [
    ...current.filter((one) => one.id !== id || one.key !== key),
    ...(message === undefined ? [] : [{ id, key, message }]),
  ];

// What putting a value in a record's column comes to, as its cell would find: nothing, when it is
// the value already there, the change that saves it, or why it will not do.
export function checked<Rec extends GridRecord, Change>(
  { kind, values, others, recordProblem }: RecordEditingContext<Rec, Change>,
  column: Column<Rec, Change>,
  value: CellValue,
): Checked<Change> {
  const made = valueChange(recordProblem, column, kind, values, value, others);
  if (made === undefined) return undefined;
  return "problem" in made ? { problem: made.problem.message } : made;
}

// Changing the values of the record a details panel shows, each in its row, held by the panel; a
// table with notes opens them through what it is given.
export function useRecordEditing<
  Rec extends GridRecord,
  Change,
  Context extends RecordEditingContext<Rec, Change> = RecordEditingContext<
    Rec,
    Change
  >,
>(notes?: NoteStarter<Rec, Change, Context>) {
  // The value whose editor is open, by the record's own ID and the column's key, and what is wrong
  // with the values last given, each named under its own row.
  const [open, setOpen] = useState<{ id: string; key: string }>();
  const [problems, setProblems] = useState<
    readonly { id: string; key: string; message: string }[]
  >([]);
  // Values being entered that were refused, so never saved: Add names them rather than taking them
  // as empty.
  const [refused, setRefused] = useState<readonly ValueProblem[]>([]);
  // Names what is wrong with one value, or, with no message, takes back what was.
  const setProblem = (id: string, key: string, message?: string) => {
    setProblems(withProblem(id, key, message));
  };
  const clearProblems = () => {
    setProblems([]);
  };

  // Saves a value as its cell would, returning whether it would do, and naming why not.
  const saved = (
    context: RecordEditingContext<Rec, Change>,
    column: Column<Rec, Change>,
    value: CellValue,
    save: SaveChange<Rec, Change>,
  ): boolean => {
    const made = checked(context, column, value);
    if (made !== undefined && "problem" in made) {
      setProblem(context.id, column.key, made.problem);
      setRefused(withProblem(context.id, column.key, made.problem));
      return false;
    }
    setProblem(context.id, column.key);
    setRefused(withProblem(context.id, column.key));
    if (made !== undefined) save(made.change, column, value);
    return true;
  };

  const stop = (id: string, column: Column<Rec, Change>) => {
    setOpen(undefined);
    setProblem(id, column.key);
    setRefused(withProblem(id, column.key));
    focusSoon(changeId(column));
  };

  // A refused value keeps its editor open, naming why, unless the editor was left, which puts the
  // value back, as in a table's cell; a field always open stays, naming why.
  const finish = (
    context: RecordEditingContext<Rec, Change>,
    column: Column<Rec, Change>,
    value: CellValue,
    how: Finish,
    save: SaveChange<Rec, Change>,
  ) => {
    const alwaysOpen = context.adding === true && !hasEditor(column);
    if (saved(context, column, value, save)) {
      if (!alwaysOpen) stop(context.id, column);
    } else if (how === "leave" && !alwaysOpen) {
      setOpen(undefined);
      setProblem(context.id, column.key);
    }
  };

  // Closes an editor open for a record no longer shown, or that may no longer be changed, as the
  // panel is drawn, so it never opens again on its own.
  const closeStale = ({ id, save }: RecordEditingContext<Rec, Change>) => {
    if (open !== undefined && (save === undefined || open.id !== id)) {
      setOpen(undefined);
      clearProblems();
    }
  };

  // How each of the record's values may be changed, if at all.
  const editingOf =
    (context: Context) =>
    (column: Column<Rec, Change>): Editing | undefined => {
      const { id, save } = context;
      if (save === undefined || readOnlyFor(column, context.kind)) {
        return undefined;
      }
      const kind = cellKinds[column.kind];
      const value = context.values[column.key] as CellValue;
      const wrong = problems.find(
        (one) => one.id === id && one.key === column.key,
      )?.message;
      const { toggled } = kind;
      if (toggled !== undefined) {
        // Named by the row's label and the word beside the box, as both are seen.
        return {
          open: false,
          editor: (
            <Group gap={8} wrap="nowrap">
              <Checkbox
                id={changeId(column)}
                aria-labelledby={`${labelId(column)} ${wordsId(column)}`}
                checked={(value as readonly string[]).length > 0}
                onChange={() => {
                  saved(context, column, toggled(value), save);
                }}
              />
              <Text id={wordsId(column)}>{kind.inWords(column, value)}</Text>
            </Group>
          ),
          problem: wrong,
        };
      }
      if (kind.inPanel === true) {
        if (notes === undefined) return undefined;
        return {
          open: false,
          editor: undefined,
          onStart: () => {
            setProblem(id, column.key);
            notes.start({ ...context, save }, column);
          },
          problem: wrong,
        };
      }
      const isOpen =
        (context.adding === true && !hasEditor(column)) ||
        (open?.id === id && open.key === column.key);
      // The panel's own text field names its problem; a table's other cell editors, which reach
      // their cell's edges, leave it to the row.
      const ownField = kind.Editor === undefined;
      const Editor = kind.Editor ?? TextEditor;
      return {
        open: isOpen,
        editor: isOpen && (
          <div className={ownField ? undefined : classes.cellEditor}>
            <Editor
              {...(ownField
                ? {
                    hint: context.hint?.(column),
                    asTyped: kind.asTyped,
                    units: column.units?.offered,
                    onUnit:
                      context.onUnit &&
                      ((unit: string) => {
                        context.onUnit?.(column, unit);
                      }),
                  }
                : {})}
              id={editorId(column)}
              column={column}
              value={value}
              typed=""
              invalid={wrong !== undefined}
              describedBy={wrong === undefined ? undefined : problemId(column)}
              problem={wrong}
              readOnly={false}
              onDone={(edited, how) => {
                finish(context, column, edited, how, save);
              }}
              onCancel={() => {
                stop(id, column);
              }}
            />
          </div>
        ),
        onStart: () => {
          setProblem(id, column.key);
          setOpen({ id, key: column.key });
          selectSoon(editorId(column));
        },
        problem: ownField ? undefined : wrong,
      };
    };

  // Names what is wrong with a record's values, each under its row, as when it was given, such as
  // when the record is added.
  const refuse = (
    id: string,
    found: readonly { key: string; message: string }[],
  ) => {
    setProblems(found.map(({ key, message }) => ({ id, key, message })));
  };

  // Names what is wrong with the values being entered, with focus on the first of them shown.
  const refuseEntered = (
    id: string,
    found: readonly { column: string; message: string }[],
    shown: readonly Column<Rec, Change>[],
  ) => {
    refuse(
      id,
      found.map(({ column, message }) => ({ key: column, message })),
    );
    const keys = new Set(found.map(({ column }) => column));
    // Every problem is in one of the columns shown.
    focusValue(shown.find(({ key }) => keys.has(key)) as Column<Rec, Change>);
  };

  // What Add finds with the values being entered: each one refused, under its row, in place of
  // whatever else is found for that row.
  const withRefused = (
    id: string,
    shown: readonly Pick<Column<never>, "key">[],
    found: readonly { column: string; message: string }[],
  ) => {
    const entered = refused
      .filter(
        (one) => one.id === id && shown.some(({ key }) => key === one.key),
      )
      .map(({ key, message }) => ({ column: key, message }));
    return [
      ...entered,
      ...found.filter(
        ({ column }) => !entered.some((one) => one.column === column),
      ),
    ];
  };

  // Whether an editor stays open for the record, as one holding a value it will not give up does.
  const unfinished = (id: string) => open?.id === id;

  return {
    closeStale,
    editingOf,
    refuse,
    refuseEntered,
    withRefused,
    unfinished,
  };
}

// Whether a column's values are changed with an editor of their kind's own, rather than as text.
const hasEditor = (column: Pick<Column<never>, "kind">) =>
  cellKinds[column.kind].Editor !== undefined;
