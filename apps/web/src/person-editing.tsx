// SPDX-License-Identifier: Apache-2.0

// Changing a person's values in their details panel, as their People cells do: which value's editor
// is open, what is wrong with the value last given, and a note being written, in a panel of its own
// under the details. Each value is saved and checked as its cell saves and checks it. One note is
// open at a time. Once its person is no longer shown it closes, unless it has been changed, when it
// stays, named for its person, until its own Save, Cancel or close button, so nothing typed is lost,
// as People's note panel stays while its row leaves the table. The page holds this, since it draws
// both panels.

import type { Person } from "@fathom/shared";
import { Checkbox, Group, Text, TextInput } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { cellKinds, type EditorProps } from "./cell-kinds.tsx";
import type { Finish } from "./choice-picker.tsx";
import { focusSoon } from "./focus.ts";
import { type Column, personKind, recordProblem } from "./people-grid.tsx";
import type { RowChange } from "./people-rows.ts";
import classes from "./person-panel.module.css";
import { readOnlyFor, valueChange } from "./record-grid.tsx";
import type { SidePanel } from "./side-panel.tsx";
import type { CellValue } from "./table-view.ts";

export const personPanelId = "person-panel";

const idOf = (column: Column, part: string) =>
  `${personPanelId}-${column.key}-${part}`;
export const labelId = (column: Column) => idOf(column, "label");
export const changeId = (column: Column) => idOf(column, "change");
export const problemId = (column: Column) => idOf(column, "problem");
const editorId = (column: Column) => idOf(column, "editor");
const wordsId = (column: Column) => idOf(column, "words");

export type SaveChange = (person: Person, change: RowChange) => void;

// Editing text or a date, which Enter or leaving the field saves and Esc leaves as it was. It names
// its own problem, which Mantine ties to the field.
function TextEditor({
  id,
  column,
  value,
  problem,
  onDone,
  onCancel,
}: EditorProps) {
  // Text and dates are held as text.
  const [text, setText] = useState(value as string);
  return (
    <TextInput
      id={id}
      size="sm"
      aria-label={column.label}
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

// What changing the person shown needs: the person, how their changes are saved, unless they may
// not be changed for now, and their values and everyone else's, as People's cells check them.
export interface EditingContext {
  person: Person;
  save: SaveChange | undefined;
  valuesOf: (person: Person) => Record<string, CellValue>;
  others: () => Record<string, CellValue>[];
}

// A note being written, for the person and column it was opened for, whatever the panel shows
// meanwhile, with how it is saved.
interface Writing {
  column: Column;
  context: EditingContext & { save: SaveChange };
}

type Checked = { change: RowChange } | { problem: string } | undefined;

// What putting a value in a person's column comes to, as their People cell would find: nothing, when
// it is the value already there, the change that saves it, or why it will not do.
function checked(
  { person, valuesOf, others }: EditingContext,
  column: Column,
  value: CellValue,
): Checked {
  const made = valueChange(
    recordProblem,
    column,
    personKind,
    valuesOf(person),
    value,
    others,
  );
  if (made === undefined) return undefined;
  return "problem" in made ? { problem: made.problem.message } : made;
}

const titleOfDetails = `${personPanelId}-title`;

// A person's note being written, in a panel of its own under their details, which the page holds,
// since it draws both panels.
export function useNoteEditing() {
  const [writing, setWriting] = useState<Writing>();
  // Whether the note open differs from the one it opened with, so it is kept when someone else, or
  // another of the person's notes, is chosen.
  const [changing, setChanging] = useState(false);
  // Why the note last saved was refused, if it was.
  const [refused, setRefused] = useState<string>();

  // Opens a person's note, unless another being changed is open, which keeps focus instead.
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
      column.value(context.person) === ""
        ? editorId(column)
        : `${editorId(column)}-title`,
    );
  };

  // The panel of the note open, under the details, while there is one, given the Employee ID of the
  // person shown, if anyone, and everyone People shows. Showing someone else, or nobody, closes it,
  // unless it has been changed. The person is known by Fathom's own ID, so a change to their
  // Employee ID, before the address has followed it, does not close it.
  const note = (
    shown: string | undefined,
    people: readonly Person[] | undefined,
  ): SidePanel | undefined => {
    if (writing === undefined) return undefined;
    const { column, context } = writing;
    const named = (employeeId: string) =>
      shown?.toLowerCase() === employeeId.toLowerCase();
    const stillShown =
      (people?.find((one) => named(one.employeeId))?.id ??
        (named(context.person.employeeId) ? context.person.id : undefined)) ===
      context.person.id;
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
          // Named for the person too, since someone else may be chosen while it is changed.
          column={{
            ...column,
            label: `${column.label} for ${context.person.preferredName}`,
          }}
          value={column.value(context.person)}
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
            if (made !== undefined) context.save(context.person, made.change);
            close();
          }}
          onCancel={close}
        />
      ),
    };
  };

  return { start, note };
}

export type NoteEditing = ReturnType<typeof useNoteEditing>;

// Changing the values of the person the details panel shows, each in its row, held by the panel;
// their notes are opened in the page's note panel.
export function usePersonEditing(notes: Pick<NoteEditing, "start">) {
  // The value whose editor is open, by the person's own ID and the column's key, and what is wrong
  // with the value last given there.
  const [open, setOpen] = useState<{ id: string; key: string }>();
  const [problem, setProblem] = useState<{
    id: string;
    key: string;
    message: string;
  }>();

  // Saves a value as its People cell would, returning whether it would do, and naming why not.
  const saved = (
    context: EditingContext,
    column: Column,
    value: CellValue,
    save: SaveChange,
  ): boolean => {
    const made = checked(context, column, value);
    if (made !== undefined && "problem" in made) {
      setProblem({
        id: context.person.id,
        key: column.key,
        message: made.problem,
      });
      return false;
    }
    setProblem(undefined);
    if (made !== undefined) save(context.person, made.change);
    return true;
  };

  const stop = (column: Column) => {
    setOpen(undefined);
    setProblem(undefined);
    focusSoon(changeId(column));
  };

  // A refused value keeps its editor open, naming why, unless the editor was left, which puts the
  // value back, as in a People cell.
  const finish = (
    context: EditingContext,
    column: Column,
    value: CellValue,
    how: Finish,
    save: SaveChange,
  ) => {
    if (saved(context, column, value, save)) {
      stop(column);
    } else if (how === "leave") {
      setOpen(undefined);
      setProblem(undefined);
    }
  };

  // Closes an editor open for someone no longer shown, or who may no longer be changed, as the panel
  // is drawn, so it never opens again on its own.
  const closeStale = ({ person, save }: EditingContext) => {
    if (open !== undefined && (save === undefined || open.id !== person.id)) {
      setOpen(undefined);
      setProblem(undefined);
    }
  };

  // How each of the person's values may be changed, if at all.
  const editingOf =
    (context: EditingContext) =>
    (column: Column): Editing | undefined => {
      const { person, save } = context;
      if (save === undefined || readOnlyFor(column, personKind)) {
        return undefined;
      }
      const kind = cellKinds[column.kind];
      const value = column.value(person);
      const wrong =
        problem?.id === person.id && problem.key === column.key
          ? problem.message
          : undefined;
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
      const isOpen = open?.id === person.id && open.key === column.key;
      // The panel's own text field names its problem; People's other cell editors, which reach
      // their cell's edges, leave it to the row.
      const ownField = kind.Editor === undefined;
      const Editor = kind.Editor ?? TextEditor;
      return {
        open: isOpen,
        editor: isOpen && (
          <div className={ownField ? undefined : classes.cellEditor}>
            <Editor
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
                stop(column);
              }}
            />
          </div>
        ),
        onStart: () => {
          setProblem(undefined);
          setOpen({ id: person.id, key: column.key });
          focusSoon(editorId(column));
        },
        problem: ownField ? undefined : wrong,
      };
    };

  return { closeStale, editingOf };
}
