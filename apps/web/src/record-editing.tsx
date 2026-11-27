// SPDX-License-Identifier: Apache-2.0

// Changing the values of a record in a details panel, or of one being added there, as its table's
// cells do.

import type { Typing } from "@fathom/shared";
import { Checkbox, Group, NativeSelect, Text } from "@mantine/core";
import {
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { cellKinds, type EditorProps, startingText } from "./cell-kinds.tsx";
import type { Finish } from "./choice-picker.tsx";
import { ClearableInput } from "./clearable-input.tsx";
import { composingWord } from "./composing.ts";
import { focusSoon, selectSoon } from "./focus.ts";
import { NewFormEnter } from "./new-form-enter.ts";
import { readOnlyFor } from "./grid-columns.tsx";
import { valueChange } from "./grid-saving.ts";
import { noteOpenFor } from "./note-address.ts";
import {
  addingFor,
  type Column,
  type GridRecord,
  type RecordTable,
} from "./record-table.ts";
import flagClasses from "./flag-field.module.css";
import classes from "./record-details.module.css";
import {
  type CellValue,
  type ColumnUnit,
  emptyView,
  fieldLabel,
  withUnit,
} from "./table-view.ts";
import { typeIn } from "./type-in.ts";

type Keyed = Pick<Column<never>, "key">;

// Whose values an element belongs to: a record's details, or a form adding one, kept apart, since a
// form can stack under a record's details.
export type ValueScope = "record" | "new-record";

export const scopeOf = (context: {
  adding?: boolean | undefined;
}): ValueScope => (context.adding === true ? "new-record" : "record");

const idOf = (column: Keyed, part: string, scope: ValueScope) =>
  `${scope}-value-${column.key}-${part}`;
export const labelId = (column: Keyed, scope: ValueScope = "record") =>
  idOf(column, "label", scope);
export const changeId = (column: Keyed, scope: ValueScope = "record") =>
  idOf(column, "change", scope);
export const problemId = (column: Keyed, scope: ValueScope = "record") =>
  idOf(column, "problem", scope);
export const editorId = (column: Keyed, scope: ValueScope = "record") =>
  idOf(column, "editor", scope);
const wordsId = (column: Keyed, scope: ValueScope) =>
  idOf(column, "words", scope);

// Puts focus on a value being entered: one typed into is a field always open, and any other value,
// such as a flag's checkbox or a choice's button, is reached by its change control.
export const focusValue = (
  column: Keyed & Pick<Column<never>, "kind">,
  scope: ValueScope,
) => {
  focusSoon(
    typedInto(column) ? editorId(column, scope) : changeId(column, scope),
  );
};

// Puts focus on a form's field as the form opens, or opens as another, since the form's title can't
// be changed.
export function useFocusOnOpen(
  column: (Keyed & Pick<Column<never>, "kind">) | undefined,
  opening?: unknown,
) {
  const focusIt = useEffectEvent(() => {
    if (column !== undefined) focusValue(column, "new-record");
  });
  useEffect(() => {
    focusIt();
  }, [opening]);
}

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
  asTyped,
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
  asTyped?: ((typing: Typing) => Typing) | undefined;
  onText: (text: string) => void;
  onEnter: () => void;
  // What Esc does; with nothing, Esc is left to the panel, which closes.
  onCancel?: (() => void) | undefined;
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
        const box = event.currentTarget;
        onText(asTyped === undefined ? box.value : typeIn(box, asTyped));
      }}
      onKeyDown={(event) => {
        if (composingWord(event)) return;
        if (event.key === "Escape" && onCancel !== undefined) {
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
  alwaysOpen = false,
}: EditorProps & {
  // A New form's field, open from the start, with no earlier value for Esc to put back, so Esc
  // closes the form instead, and Enter, once the value is saved, does the form's own action.
  alwaysOpen?: boolean;
  hint?: string | undefined;
  asTyped?: ((typing: Typing) => Typing) | undefined;
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
  const formAction = useContext(NewFormEnter);
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
      asTyped={asTyped}
      onText={setTyped}
      onEnter={() => {
        onDone(given(text), "enter");
        if (alwaysOpen) formAction?.();
      }}
      // In a New form, with nothing typed to keep, Esc goes to the form, which closes; with something
      // typed, Esc first keeps it in the form, so closing it asks before discarding it.
      onCancel={alwaysOpen ? (text === opened ? undefined : leave) : onCancel}
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
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          !composingWord(event) &&
          !alwaysOpen
        ) {
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
// changes it in one step; and what is wrong with the value last given. A note the address asks for
// is named by that address, and opened once its row is drawn.
export interface Editing {
  // Whose values the row's elements are named for.
  scope: ValueScope;
  open: boolean;
  editor: ReactNode;
  onStart?: (() => void) | undefined;
  problem: string | undefined;
  askedBy?: string | undefined;
  onAsked?: (() => void) | undefined;
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

// Opens a note, for tables that have them, in a panel of its own, where it is read, and written by
// those who may: when chosen, or, once its record's details are drawn, when the address asks for it.
export interface NoteStarter<Rec extends GridRecord, Change, Context> {
  start: NoteOpener<Rec, Change, Context>;
  reopen: NoteOpener<Rec, Change, Context>;
  asking: string | undefined;
}

type NoteOpener<Rec extends GridRecord, Change, Context> = (
  context: Context & { save: SaveChange<Rec, Change> | undefined },
  column: Column<Rec, Change>,
  readOnly: boolean,
) => void;

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

  const stop = (id: string, column: Column<Rec, Change>, scope: ValueScope) => {
    setOpen(undefined);
    setProblem(id, column.key);
    setRefused(withProblem(id, column.key));
    focusSoon(changeId(column, scope));
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
      if (!alwaysOpen) stop(context.id, column, scopeOf(context));
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

  // A form's pickers never add.
  const addingIn = (context: Context, column: Column<Rec, Change>) =>
    context.adding === true
      ? undefined
      : addingFor(column.adds, { id: context.id }, () => {
          focusSoon(changeId(column));
        });

  // How each of the record's values may be changed, if at all.
  const editingOf =
    (context: Context) =>
    (column: Column<Rec, Change>): Editing | undefined => {
      const { id, save } = context;
      const scope = scopeOf(context);
      const kind = cellKinds[column.kind];
      const readOnly = save === undefined || readOnlyFor(column, context.kind);
      // A note opens in its own panel to be read, by everyone who sees it, and there changed by those
      // who may.
      if (kind.inPanel === true) {
        if (notes === undefined) return undefined;
        return {
          scope,
          askedBy:
            noteOpenFor(notes.asking, id) === column.key
              ? notes.asking
              : undefined,
          onAsked: () => {
            notes.reopen({ ...context, save }, column, readOnly);
          },
          open: false,
          editor: undefined,
          onStart: () => {
            setProblem(id, column.key);
            notes.start({ ...context, save }, column, readOnly);
          },
          problem: readOnly
            ? undefined
            : problems.find((one) => one.id === id && one.key === column.key)
                ?.message,
        };
      }
      if (readOnly) return undefined;
      const value = context.values[column.key] as CellValue;
      const wrong = problems.find(
        (one) => one.id === id && one.key === column.key,
      )?.message;
      const { toggled } = kind;
      if (toggled !== undefined) {
        // Named by the row's label and the word beside the box, as both are seen.
        return {
          scope,
          open: false,
          editor: (
            <Group gap={8} wrap="nowrap">
              <span
                className={[flagClasses.flag, flagClasses.textBaseline].join(
                  " ",
                )}
              >
                <Checkbox
                  id={changeId(column, scope)}
                  aria-labelledby={`${labelId(column, scope)} ${wordsId(column, scope)}`}
                  checked={(value as readonly string[]).length > 0}
                  onChange={() => {
                    saved(context, column, toggled(value), save);
                  }}
                />
              </span>
              <Text id={wordsId(column, scope)} inherit>
                {kind.inWords(column, value)}
              </Text>
            </Group>
          ),
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
        scope,
        open: isOpen,
        editor: isOpen && (
          <div className={ownField ? undefined : classes.cellEditor}>
            <Editor
              {...(ownField
                ? {
                    alwaysOpen: context.adding === true,
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
              id={editorId(column, scope)}
              column={column}
              value={value}
              typed=""
              invalid={wrong !== undefined}
              describedBy={
                wrong === undefined ? undefined : problemId(column, scope)
              }
              problem={wrong}
              readOnly={false}
              adding={addingIn(context, column)}
              onDone={(edited, how) => {
                finish(context, column, edited, how, save);
              }}
              onCancel={() => {
                stop(id, column, scope);
              }}
            />
          </div>
        ),
        onStart: () => {
          setProblem(id, column.key);
          setOpen({ id, key: column.key });
          selectSoon(editorId(column, scope));
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
    // Every problem is in one of the columns shown. Only a form adding a
    // record names what was entered.
    focusValue(
      shown.find(({ key }) => keys.has(key)) as Column<Rec, Change>,
      "new-record",
    );
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

// Whether a field is typed into, such as a text, rather than chosen from a list or ticked.
const typedInto = (column: Pick<Column<never>, "kind">) => {
  const { Editor, toggled } = cellKinds[column.kind];
  return Editor === undefined && toggled === undefined;
};

// The first of a form's fields typed into, such as Name, or else its first.
export const firstTypedInto = <Field extends Pick<Column<never>, "kind">>(
  fields: readonly Field[],
): Field | undefined => fields.find(typedInto) ?? fields[0];
