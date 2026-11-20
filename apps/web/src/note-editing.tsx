// SPDX-License-Identifier: Apache-2.0

// A record's note, opened in a panel of its own under its details or form, and kept open in the
// page's address. The page holds this, since it draws both panels.

import { type ReactNode, useContext, useEffect, useState } from "react";
import type { useDiscardQuestion } from "./discard-question.tsx";
import { cellKinds, type EditorProps } from "./cell-kinds.tsx";
import { focusSoon } from "./focus.ts";
import {
  noteLeftBehind,
  noteOpenFor,
  type OpenNoteAddress,
  OpenNoteContext,
  openNoteValue,
} from "./note-address.ts";
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
// given, or says why it will not do. A note of a record being added isn't kept in the address,
// since its form isn't; any other is, once the address has caught up with its opening.
interface Writing {
  recordId: string;
  name: string;
  column: EditorProps["column"];
  Editor: (props: EditorProps) => ReactNode;
  value: CellValue;
  readOnly: boolean;
  finish: (edited: CellValue) => string | undefined;
  address: string | undefined;
  inAddress: boolean;
}

type Opening<Rec extends GridRecord, Change> = NoteContext<Rec, Change> & {
  save: SaveChange<Rec, Change> | undefined;
};

export function useNoteEditing(detailsTitleId: string) {
  const given = useContext(OpenNoteContext);
  const [ownAddress, setOwnAddress] = useState<string>();
  const address: OpenNoteAddress = given ?? {
    note: ownAddress,
    onNote: setOwnAddress,
  };
  const [writing, setWriting] = useState<Writing>();
  // Whether the note open differs from the one it opened with, so it is kept when another of the
  // record's notes is chosen, and showing another record asks first.
  const [changing, setChanging] = useState(false);
  // Why the note last saved was refused, if it was.
  const [refused, setRefused] = useState<string>();
  // The address of a note just closed or given up, which opens nothing until the address moves on.
  const [givenUp, setGivenUp] = useState<string>();
  if (givenUp !== undefined && givenUp !== address.note) setGivenUp(undefined);
  // An address naming a note no longer shown, taken out once the page is drawn.
  const [leftBehind, setLeftBehind] = useState<string>();
  if (leftBehind !== undefined && leftBehind !== address.note) {
    setLeftBehind(undefined);
  }
  const leave = (kept: string | undefined) => {
    if (kept !== undefined && kept === address.note && kept !== leftBehind) {
      setLeftBehind(kept);
    }
  };
  const { onNote } = address;
  useEffect(() => {
    if (leftBehind !== undefined) onNote(undefined, true);
  }, [leftBehind, onNote]);

  // Who may write is decided here, as the note opens, and holds while it stays open.
  const open = <Rec extends GridRecord, Change>(
    context: Opening<Rec, Change>,
    column: Column<Rec, Change>,
    readOnly: boolean,
    kept: string | undefined,
  ) => {
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
      address: kept,
      inAddress: kept === undefined || kept === address.note,
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

  // The note the address asks to open, while none is open and it wasn't just given up.
  const asking =
    writing === undefined && address.note !== givenUp
      ? address.note
      : undefined;

  // Opens a record's note, unless another being changed is open, which keeps focus instead.
  const start = <Rec extends GridRecord, Change>(
    context: Opening<Rec, Change>,
    column: Column<Rec, Change>,
    readOnly = false,
  ) => {
    if (writing !== undefined && changing) {
      focusSoon(`${editorId(writing.column)}-title`);
      return;
    }
    const kept =
      context.adding === true
        ? undefined
        : openNoteValue(context.id, column.key);
    open(context, column, readOnly, kept);
    if (kept !== undefined && kept !== address.note) {
      address.onNote(kept, false);
    }
  };

  // Opens the note the address asks for, as its record's details are drawn, without adding to Back's
  // history.
  const reopen = <Rec extends GridRecord, Change>(
    context: Opening<Rec, Change>,
    column: Column<Rec, Change>,
    readOnly: boolean,
  ) => {
    if (noteOpenFor(asking, context.id) === column.key) {
      open(context, column, readOnly, asking);
    }
  };

  // Whether the note open is the one shown: one being changed always is; otherwise the record must
  // be shown and the address keep it open, once it has caught up with its opening.
  const stillOpen = (
    { recordId, address: kept, inAddress }: Writing,
    shown: string | undefined,
  ) =>
    changing ||
    (shown === recordId &&
      (kept === undefined || !inAddress || address.note === kept));

  // The panel of the note open, while there is one, given Fathom's own ID for the record shown, if
  // any. Showing another record, or none, closes it, unless it has been changed, which the page asks
  // about first, so it stays only when the address moved on its own, as by Back.
  const note = (shown: string | undefined): SidePanel | undefined => {
    if (noteLeftBehind(address.note, shown) && !changing) leave(address.note);
    if (writing === undefined) return undefined;
    if (!stillOpen(writing, shown)) {
      leave(writing.address);
      setWriting(undefined);
      return undefined;
    }
    if (!writing.inAddress && writing.address === address.note) {
      setWriting({ ...writing, inAddress: true });
    }
    const { recordId, name, column, Editor, value, readOnly, finish } = writing;
    const stillShown = shown === recordId;
    // Focus goes back to the note's button, or, with another record shown, to its name.
    const close = () => {
      forget();
      if (writing.address !== undefined && writing.address === address.note) {
        address.onNote(undefined, false);
      }
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

  function forget() {
    setGivenUp(writing?.address);
    setWriting(undefined);
    setChanging(false);
    setRefused(undefined);
  }

  // Gives up the note open, as before showing something else, taking it out of the address.
  const discard = () => {
    leave(writing?.address);
    forget();
  };

  return {
    start,
    reopen,
    asking,
    note,
    changing: writing !== undefined && changing,
    discard,
  };
}

export type NoteEditing = ReturnType<typeof useNoteEditing>;

// What a panel needs to open its record's notes.
export type NoteOpening = Pick<NoteEditing, "start" | "reopen" | "asking">;

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
