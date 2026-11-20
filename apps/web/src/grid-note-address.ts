// SPDX-License-Identifier: Apache-2.0

// A note opened from the shared table's cell, kept in the page's address, as a note opened from a
// record's details is.

import { usePrevious } from "@mantine/hooks";
import { useContext, useEffect } from "react";
import { kindOf } from "./grid-columns.tsx";
import type { gridEditing } from "./grid-editing.tsx";
import type { Cell } from "./grid-places.ts";
import type { gridSelection, StateGrid } from "./grid-selection.ts";
import { keptNote, openNoteValue, TableNoteContext } from "./note-address.ts";
import type { GridRecord } from "./record-table.ts";

type NoteGrid<Rec extends GridRecord, Change, Request> = Pick<
  StateGrid<Rec, Change, Request>,
  "panelOpen" | "panelWriting" | "columns"
> &
  Pick<
    ReturnType<typeof gridSelection<Rec, Change, Request>>,
    "rows" | "setEditing"
  > &
  Pick<ReturnType<typeof gridEditing<Rec, Change, Request>>, "startEdit">;

// The cell of the note an address names, while its row and column are shown. Only a note's column
// is given a key, so an address naming any other column opens nothing.
export function cellOfNote(
  address: string | undefined,
  recordIds: readonly (string | undefined)[],
  noteKeys: readonly (string | undefined)[],
): Cell | undefined {
  const kept = keptNote(address);
  if (kept === undefined) return undefined;
  const row = recordIds.indexOf(kept.recordId);
  const column = noteKeys.indexOf(kept.columnKey);
  return row === -1 || column === -1 ? undefined : { row, column };
}

export function useTableNoteAddress<Rec extends GridRecord, Change, Request>(
  grid: NoteGrid<Rec, Change, Request>,
) {
  const address = useContext(TableNoteContext);
  const { panelOpen, panelWriting, columns, rows, startEdit, setEditing } =
    grid;
  const record = panelOpen?.row.record;
  // The note open, as the address names it, unless it is a new row's, which has no record yet.
  const open =
    panelOpen === undefined || record === undefined
      ? undefined
      : openNoteValue(record.id, panelOpen.column.key);
  const asked = address?.note;
  const wasOpen = usePrevious(open);
  const wasAsked = usePrevious(asked);
  const target = cellOfNote(
    asked,
    rows.map((row) => row.record?.id),
    columns.map((column) =>
      kindOf(column).inPanel === true ? column.key : undefined,
    ),
  );
  const onNote = address?.onNote;
  // Opening or closing a note in the table adds to Back's history, unless the address moved first.
  useEffect(() => {
    if (onNote === undefined || open === wasOpen) return;
    if (open !== undefined && open !== asked) onNote(open, false);
    if (open === undefined && wasOpen === asked) onNote(undefined, false);
  }, [open, wasOpen, asked, onNote]);
  // The address moving on its own, by a reload, Back or a link, opens the note it names, once its
  // row is shown, or closes the one open, unless it is being written.
  const shown = target !== undefined;
  useEffect(() => {
    if (asked === open) return;
    if (target !== undefined) startEdit(target);
    else if (asked !== wasAsked && open !== undefined && !panelWriting) {
      setEditing(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the address moving, or the note's row arriving, opens or closes a note here, never a re-sort
  }, [asked, shown]);
}
