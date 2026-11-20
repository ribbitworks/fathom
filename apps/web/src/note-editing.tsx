// SPDX-License-Identifier: Apache-2.0

// A record's note, in a panel of its own under the details or the form beside the table, read there,
// and written by those who may. One note is open at a time, for the record shown; once that record is no longer shown the
// note closes. The page holds this, since it draws both panels.

import { type ReactNode, useState } from "react";
import type { useDiscardQuestion } from "./discard-question.tsx";
import { cellKinds, type EditorProps } from "./cell-kinds.tsx";
import { focusSoon } from "./focus.ts";
import {
  changeId,
  checked,
  editorId,
  type RecordEditingContext,
  type SaveChange,
} from "./record-editing.tsx";
import type { Column, GridRecord } from "./record-table.ts";
import type { SidePanel } from "./side-panel.tsx";
import type { CellValue } from "./table-view.ts";

export type NoteContext<Rec extends GridRecord, Change> = RecordEditingContext<
  Rec,
  Change
> & { name: string };

// A note being written, for the record and column it was opened for. Finishing it saves the value
// given, or says why it will not do.
interface Writing {
  recordId: string;
  name: string;
  column: EditorProps["column"];
  Editor: (props: EditorProps) => ReactNode;
  value: CellValue;
  readOnly: boolean;
  finish: (edited: CellValue) => string | undefined;
}

export function useNoteEditing(detailsTitleId: string) {
  const [writing, setWriting] = useState<Writing>();
  // Whether the note open differs from the one it opened with, so it is kept when another of the
  // record's notes is chosen, and showing another record asks first.
  const [changing, setChanging] = useState(false);
  // Why the note last saved was refused, if it was.
  const [refused, setRefused] = useState<string>();

  // Opens a record's note, unless another being changed is open, which keeps focus instead.
  const start = <Rec extends GridRecord, Change>(
    context: NoteContext<Rec, Change> & {
      save: SaveChange<Rec, Change> | undefined;
    },
    column: Column<Rec, Change>,
    readOnly = false,
  ) => {
    if (writing !== undefined && changing) {
      focusSoon(`${editorId(writing.column)}-title`);
      return;
    }
    setWriting({
      recordId: context.id,
      name: context.name,
      column,
      // A kind written in the side panel has an editor.
      Editor: cellKinds[column.kind].Editor as Writing["Editor"],
      value: context.values[column.key] as CellValue,
      readOnly: readOnly || context.save === undefined,
      finish: (edited) => {
        const made = checked(context, column, edited);
        if (made !== undefined && "problem" in made) return made.problem;
        if (made !== undefined) context.save?.(made.change, column, edited);
        return undefined;
      },
    });
    setRefused(undefined);
    // A note with something in it opens as it reads, with its editor hidden, its title then taking
    // focus; a read-only note's panel is titled by the editor's own ID, as an empty note's editor is.
    focusSoon(
      readOnly || context.values[column.key] === ""
        ? editorId(column)
        : `${editorId(column)}-title`,
    );
  };

  // The panel of the note open, while there is one, given Fathom's own ID for the record shown, if
  // any. Showing another record, or none, closes it, unless it has been changed, which the page asks
  // about first, so it stays only when the address moved on its own, as by Back.
  const note = (shown: string | undefined): SidePanel | undefined => {
    if (writing === undefined) return undefined;
    const { recordId, name, column, Editor, value, readOnly, finish } = writing;
    const stillShown = shown === recordId;
    if (!changing && !stillShown) {
      setWriting(undefined);
      return undefined;
    }
    // Focus goes back to the note's button, or, with another record shown, to its name.
    const close = () => {
      setWriting(undefined);
      setChanging(false);
      setRefused(undefined);
      focusSoon(stillShown ? changeId(column) : detailsTitleId);
    };
    const id = editorId(column);
    return {
      key: "record-note",
      id: `${id}-panel`,
      name: column.label,
      node: (
        <Editor
          id={id}
          // Named for the record too, in case the address moves on while it is changed.
          column={{ ...column, label: `${column.label} for ${name}` }}
          value={value}
          typed=""
          invalid={refused !== undefined}
          problem={refused}
          readOnly={readOnly}
          onChanged={setChanging}
          onDone={(edited) => {
            const problem = finish(edited);
            if (problem !== undefined) {
              setRefused(problem);
              return;
            }
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

export const noteQuestion = {
  title: "Discard changes to the note?",
  keep: "Keep writing",
};

// Goes on once any note being changed has been given up, asking first.
export function afterNote(
  notes: Pick<NoteEditing, "changing" | "discard">,
  ask: ReturnType<typeof useDiscardQuestion>["ask"],
  go: () => void,
) {
  ask(notes.changing ? noteQuestion : undefined, () => {
    notes.discard();
    go();
  });
}
