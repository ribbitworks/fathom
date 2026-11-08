// SPDX-License-Identifier: Apache-2.0

// Changing the values of a person or planned hire in the details panel, or of one being added there,
// as their People cells do: which value's editor is open, what is wrong with the value last given,
// and a note being written, in a panel of its own under the details. Each value is saved and checked
// as its cell saves and checks it. One note is open at a time, for the record shown; once that
// record is no longer shown the note closes. Showing another record, or adding one, while a note has
// been changed, or while a record being added holds something, asks first whether to discard it, so
// nothing typed is lost unasked. The page holds this, since it draws both panels.

import type { Person } from "@fathom/shared";
import { Button, Checkbox, Group, Modal, Text } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { cellKinds, type EditorProps } from "./cell-kinds.tsx";
import { ClearableInput } from "./clearable-input.tsx";
import type { Finish } from "./choice-picker.tsx";
import { focusSoon } from "./focus.ts";
import { type Column, recordProblem } from "./people-grid.tsx";
import type { RowChange } from "./people-rows.ts";
import classes from "./person-panel.module.css";
import { readOnlyFor, valueChange } from "./record-grid.tsx";
import type { SidePanel } from "./side-panel.tsx";
import type { CellValue } from "./table-view.ts";

export const personPanelId = "person-panel";

type Keyed = Pick<Column, "key">;

const idOf = (column: Keyed, part: string) =>
  `${personPanelId}-${column.key}-${part}`;
export const labelId = (column: Keyed) => idOf(column, "label");
export const changeId = (column: Keyed) => idOf(column, "change");
export const problemId = (column: Keyed) => idOf(column, "problem");
export const editorId = (column: Keyed) => idOf(column, "editor");
const wordsId = (column: Keyed) => idOf(column, "words");

// Puts focus on a value being entered: a text or date is a field always open, and any other value
// opens from its change button.
export const focusValue = (column: Column) => {
  focusSoon(
    cellKinds[column.kind].Editor === undefined
      ? editorId(column)
      : changeId(column),
  );
};

// Saves a change to the record, with the column and value it puts there.
export type SaveChange = (
  change: RowChange,
  column: Column,
  value: CellValue,
) => void;

// Editing text or a date, which Enter or leaving the field saves and Esc leaves as it was, with an ×
// to empty it. It names its own problem, which Mantine ties to the field.
function TextEditor({
  id,
  column,
  value,
  problem,
  hint,
  onDone,
  onCancel,
}: EditorProps & { hint?: string | undefined }) {
  // Text and dates are held as text.
  const [text, setText] = useState(value as string);
  return (
    <ClearableInput
      id={id}
      size="sm"
      aria-label={column.label}
      clearLabel={`Clear ${column.label}`}
      placeholder={hint}
      onClear={() => {
        setText("");
      }}
      error={problem}
      value={text}
      autoComplete="off"
      onChange={(event) => {
        setText(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        } else if (event.key === "Enter") {
          event.preventDefault();
          onDone(text, "enter");
        }
      }}
      onBlur={() => {
        onDone(text, "leave");
      }}
    />
  );
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

// What changing the record shown needs: Fathom's own ID for it, its kind, its name, its values and
// everyone else's, as People's cells check them, and how its changes are saved, unless it may not be
// changed for now.
export interface EditingContext {
  id: string;
  kind: string;
  name: string;
  values: Record<string, CellValue>;
  save: SaveChange | undefined;
  others: () => Record<string, CellValue>[];
  // Whether the record is being added, so its text and dates are fields always open.
  adding?: boolean;
  // What an empty text field shows in grey, if anything, such as the name a record goes by while it
  // has none of its own.
  hint?: (column: Column) => string | undefined;
}

// A note being written, for the record and column it was opened for, with how it is saved.
interface Writing {
  column: Column;
  context: EditingContext & { save: SaveChange };
}

type Checked = { change: RowChange } | { problem: string } | undefined;

// What putting a value in a record's column comes to, as its People cell would find: nothing, when
// it is the value already there, the change that saves it, or why it will not do.
function checked(
  { kind, values, others }: EditingContext,
  column: Column,
  value: CellValue,
): Checked {
  const made = valueChange(recordProblem, column, kind, values, value, others);
  if (made === undefined) return undefined;
  return "problem" in made ? { problem: made.problem.message } : made;
}

const titleOfDetails = `${personPanelId}-title`;

// A note being written, in a panel of its own under the details, which the page holds, since it
// draws both panels.
export function useNoteEditing() {
  const [writing, setWriting] = useState<Writing>();
  // Whether the note open differs from the one it opened with, so it is kept when another of the
  // record's notes is chosen, and showing another record asks first.
  const [changing, setChanging] = useState(false);
  // Why the note last saved was refused, if it was.
  const [refused, setRefused] = useState<string>();

  // Opens a record's note, unless another being changed is open, which keeps focus instead.
  const start = (
    context: EditingContext & { save: SaveChange },
    column: Column,
  ) => {
    if (writing !== undefined && changing) {
      focusSoon(`${editorId(writing.column)}-title`);
      return;
    }
    setWriting({ column, context });
    setRefused(undefined);
    // A note with something in it opens as it reads, with its editor hidden.
    focusSoon(
      context.values[column.key] === ""
        ? editorId(column)
        : `${editorId(column)}-title`,
    );
  };

  // The panel of the note open, under the details, while there is one, given Fathom's own ID for the
  // record shown, if any. Showing another record, or none, closes it, unless it has been changed,
  // which the page asks about first, so it stays only when the address moved on its own, as by Back.
  const note = (shown: string | undefined): SidePanel | undefined => {
    if (writing === undefined) return undefined;
    const { column, context } = writing;
    const stillShown = shown === context.id;
    if (!changing && !stillShown) {
      setWriting(undefined);
      return undefined;
    }
    // A kind written in the side panel has an editor.
    const NoteEditor = cellKinds[column.kind].Editor as (
      props: EditorProps,
    ) => ReactNode;
    // Focus goes back to the note's button, or, with someone else shown, to their name.
    const close = () => {
      setWriting(undefined);
      setChanging(false);
      setRefused(undefined);
      focusSoon(stillShown ? changeId(column) : titleOfDetails);
    };
    const id = editorId(column);
    return {
      key: "person-note",
      id: `${id}-panel`,
      name: column.label,
      node: (
        <NoteEditor
          id={id}
          // Named for the record too, in case the address moves on while it is changed.
          column={{ ...column, label: `${column.label} for ${context.name}` }}
          value={context.values[column.key] as CellValue}
          typed=""
          invalid={refused !== undefined}
          problem={refused}
          readOnly={false}
          onChanged={setChanging}
          onDone={(edited) => {
            const made = checked(context, column, edited);
            if (made !== undefined && "problem" in made) {
              setRefused(made.problem);
              return;
            }
            if (made !== undefined) context.save(made.change, column, edited);
            close();
          }}
          onCancel={close}
        />
      ),
    };
  };

  const discard = () => {
    setWriting(undefined);
    setChanging(false);
    setRefused(undefined);
  };

  return { start, note, changing: writing !== undefined && changing, discard };
}

export type NoteEditing = ReturnType<typeof useNoteEditing>;

// Changing the values of the record the details panel shows, each in its row, held by the panel;
// its notes are opened in the page's note panel.
export function usePersonEditing(notes: Pick<NoteEditing, "start">) {
  // The value whose editor is open, by the record's own ID and the column's key, and what is wrong
  // with the values last given, each named under its own row.
  const [open, setOpen] = useState<{ id: string; key: string }>();
  const [problems, setProblems] = useState<
    readonly { id: string; key: string; message: string }[]
  >([]);
  // Names what is wrong with one value, or, with no message, takes back what was.
  const setProblem = (id: string, key: string, message?: string) => {
    setProblems((current) => [
      ...current.filter((one) => one.id !== id || one.key !== key),
      ...(message === undefined ? [] : [{ id, key, message }]),
    ]);
  };
  const clearProblems = () => {
    setProblems([]);
  };

  // Saves a value as its People cell would, returning whether it would do, and naming why not.
  const saved = (
    context: EditingContext,
    column: Column,
    value: CellValue,
    save: SaveChange,
  ): boolean => {
    const made = checked(context, column, value);
    if (made !== undefined && "problem" in made) {
      setProblem(context.id, column.key, made.problem);
      return false;
    }
    setProblem(context.id, column.key);
    if (made !== undefined) save(made.change, column, value);
    return true;
  };

  const stop = (id: string, column: Column) => {
    setOpen(undefined);
    setProblem(id, column.key);
    focusSoon(changeId(column));
  };

  // A refused value keeps its editor open, naming why, unless the editor was left, which puts the
  // value back, as in a People cell; a field always open stays, naming why.
  const finish = (
    context: EditingContext,
    column: Column,
    value: CellValue,
    how: Finish,
    save: SaveChange,
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
  const closeStale = ({ id, save }: EditingContext) => {
    if (open !== undefined && (save === undefined || open.id !== id)) {
      setOpen(undefined);
      clearProblems();
    }
  };

  // How each of the person's values may be changed, if at all.
  const editingOf =
    (context: EditingContext) =>
    (column: Column): Editing | undefined => {
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
        return {
          open: false,
          editor: undefined,
          onStart: () => {
            notes.start({ ...context, save }, column);
          },
          problem: undefined,
        };
      }
      const isOpen =
        (context.adding === true && !hasEditor(column)) ||
        (open?.id === id && open.key === column.key);
      // The panel's own text field names its problem; People's other cell editors, which reach
      // their cell's edges, leave it to the row.
      const ownField = kind.Editor === undefined;
      const Editor = kind.Editor ?? TextEditor;
      return {
        open: isOpen,
        editor: isOpen && (
          <div className={ownField ? undefined : classes.cellEditor}>
            <Editor
              {...(ownField ? { hint: context.hint?.(column) } : {})}
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
          focusSoon(editorId(column));
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
    shown: readonly Column[],
  ) => {
    refuse(
      id,
      found.map(({ column, message }) => ({ key: column, message })),
    );
    const keys = new Set(found.map(({ column }) => column));
    // Every problem is in one of the columns shown.
    focusValue(shown.find(({ key }) => keys.has(key)) as Column);
  };

  return { closeStale, editingOf, refuse, refuseEntered };
}

// Whether a column's values are changed with an editor of their kind's own, rather than as text.
const hasEditor = (column: Column) =>
  cellKinds[column.kind].Editor !== undefined;

// Asking whether to discard what is being written before showing another record or adding one: a
// note changed, or a record being added that holds something. Discard goes on; Keep writing, or
// closing the question, stays.
export function useDiscardQuestion() {
  const [asking, setAsking] = useState<{
    title: string;
    keep: string;
    go: () => void;
  }>();
  const ask = (
    question: { title: string; keep: string } | undefined,
    go: () => void,
  ) => {
    if (question === undefined) go();
    else setAsking({ ...question, go });
  };
  const close = () => {
    setAsking(undefined);
  };
  const dialog = (
    <Modal
      opened={asking !== undefined}
      onClose={close}
      title={asking?.title}
      size="sm"
    >
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={close} data-autofocus>
          {asking?.keep}
        </Button>
        <Button
          color="red"
          onClick={() => {
            asking?.go();
            close();
          }}
        >
          Discard
        </Button>
      </Group>
    </Modal>
  );
  return { ask, dialog };
}

export const noteQuestion = {
  title: "Discard the note you're writing?",
  keep: "Keep writing",
};

// Fathom's own ID for the record the address names by its ID, kept while that ID changes and the
// address has not yet followed it, so what is open for the record stays open.
export function useShownId(
  open: string | undefined,
  people: readonly Person[] | undefined,
): string | undefined {
  const [followed, setFollowed] = useState<{ open: string; id: string }>();
  const named = people?.find(
    ({ employeeId }) => employeeId.toLowerCase() === open?.toLowerCase(),
  );
  if (
    open !== undefined &&
    named !== undefined &&
    (followed === undefined ||
      followed.id !== named.id ||
      followed.open !== open)
  ) {
    setFollowed({ open, id: named.id });
  }
  if (named !== undefined) return named.id;
  return followed !== undefined && followed.open === open
    ? followed.id
    : undefined;
}
