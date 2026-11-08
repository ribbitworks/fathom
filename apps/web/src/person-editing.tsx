// SPDX-License-Identifier: Apache-2.0

// What changing a person or planned hire needs beyond any record's editing: a note being written, in
// a panel of its own under the details. One note is open at a time, for the record shown; once that
// record is no longer shown the note closes. The page holds this, since it draws both panels.

import type { Person } from "@fathom/shared";
import { type ReactNode, useState } from "react";
import { cellKinds, type EditorProps } from "./cell-kinds.tsx";
import { focusSoon } from "./focus.ts";
import type { Column } from "./people-grid.tsx";
import type { RowChange } from "./people-rows.ts";
import {
  changeId,
  checked,
  editorId,
  type RecordEditingContext,
  type SaveChange as RecordSaveChange,
  useRecordEditing,
} from "./record-editing.tsx";
import type { SidePanel } from "./side-panel.tsx";
import type { CellValue } from "./table-view.ts";

export const personPanelId = "person-panel";

export type SaveChange = RecordSaveChange<Person, RowChange>;
export type EditingContext = RecordEditingContext<Person, RowChange> & {
  name: string;
};

// A note being written, for the record and column it was opened for, with how it is saved.
interface Writing {
  column: Column;
  context: EditingContext & { save: SaveChange };
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

export const usePersonEditing = (notes: Pick<NoteEditing, "start">) =>
  useRecordEditing<Person, RowChange, EditingContext>(notes);

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
