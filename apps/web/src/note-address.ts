// SPDX-License-Identifier: Apache-2.0

// How an open note is kept in a page's address, and how the signed-in pages give that address to
// the notes they open.

import { createContext } from "react";
import { z } from "zod";

const separator = ".";

// A column's key is a word or an ID, never holding the separator; a record's ID may hold anything.
const columnKeyLength = 36;
const recordIdLength = 120;

const noteValue = z
  .string()
  .max(columnKeyLength + separator.length + recordIdLength)
  .optional()
  .catch(undefined);

// The note open from a record's details, and the one open from a table's cell, each kept apart so
// neither closes the other.
export const noteSearch = z.object({ note: noteValue, tableNote: noteValue });

// The note's column, then its record by Fathom's own ID, so an address left naming another record's
// note opens nothing.
export const openNoteValue = (recordId: string, columnKey: string): string =>
  `${columnKey}${separator}${recordId}`;

export interface KeptNote {
  recordId: string;
  columnKey: string;
}

export function keptNote(address: string | undefined): KeptNote | undefined {
  if (address === undefined) return undefined;
  const at = address.indexOf(separator);
  if (at <= 0 || at === address.length - 1) return undefined;
  return {
    columnKey: address.slice(0, at),
    recordId: address.slice(at + separator.length),
  };
}

// The column of the note the address keeps open for the record shown, if it keeps one for it.
export const noteOpenFor = (
  address: string | undefined,
  shown: string | undefined,
): string | undefined => {
  const kept = keptNote(address);
  return kept !== undefined && kept.recordId === shown
    ? kept.columnKey
    : undefined;
};

// Whether the address names a note of a record other than the one shown, so it should be taken out.
export const noteLeftBehind = (
  address: string | undefined,
  shown: string | undefined,
): boolean => {
  const kept = keptNote(address);
  return kept !== undefined && shown !== undefined && kept.recordId !== shown;
};

// The note the page's address keeps open, and how to keep another, or none, there.
export interface OpenNoteAddress {
  note: string | undefined;
  onNote: (note: string | undefined, replace: boolean) => void;
}

// Given by the signed-in pages; without it, as when a panel is drawn on its own, a note is kept in
// the page alone.
export const OpenNoteContext = createContext<OpenNoteAddress | undefined>(
  undefined,
);

// The same for a note opened from a table's cell.
export const TableNoteContext = createContext<OpenNoteAddress | undefined>(
  undefined,
);
