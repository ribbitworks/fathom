// SPDX-License-Identifier: Apache-2.0

// What changing a person or planned hire needs beyond any record's editing: its notes, written in a
// panel of their own under the details, and which person the address names.

import type { Person } from "@fathom/shared";
import { useState } from "react";
import {
  type NoteContext,
  type NoteOpening,
  useNoteEditing,
} from "./note-editing.tsx";
import type { RowChange } from "./people-rows.ts";
import {
  type SaveChange as RecordSaveChange,
  useRecordEditing,
} from "./record-editing.tsx";

export const personPanelId = "person-panel";

export type SaveChange = RecordSaveChange<Person, RowChange>;
export type EditingContext = NoteContext<Person, RowChange>;

const titleOfDetails = `${personPanelId}-title`;

export const usePersonNotes = () => useNoteEditing(titleOfDetails);

export const usePersonEditing = (notes: NoteOpening) =>
  useRecordEditing<Person, RowChange, EditingContext>(notes);

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
