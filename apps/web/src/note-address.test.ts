// SPDX-License-Identifier: Apache-2.0

// Tests for how an open note is kept in a page's address: written, read back, and matched to the
// record shown.

import { describe, expect, it } from "vitest";
import {
  keptNote,
  openNoteValue,
  noteLeftBehind,
  noteOpenFor,
  noteSearch,
} from "./note-address.ts";

const recordId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";

describe("a note's address", () => {
  it("names the column, then the record", () => {
    expect(openNoteValue(recordId, "note")).toBe(`note.${recordId}`);
  });

  it("reads back the column and record it was written with", () => {
    expect(keptNote(openNoteValue(recordId, "note"))).toEqual({
      columnKey: "note",
      recordId,
    });
  });

  it("keeps a record's ID whole, whatever it holds", () => {
    const cycle = `${recordId} 2027-01-04.x`;
    expect(keptNote(openNoteValue(cycle, "note"))?.recordId).toBe(cycle);
  });

  it.each([
    ["no address", undefined],
    ["no separator", "note"],
    ["no column", `.${recordId}`],
    ["no record", "note."],
  ])("names no note with %s", (_case, address) => {
    expect(keptNote(address)).toBeUndefined();
  });
});

describe("the note open for the record shown", () => {
  it("is the column the address names for that record", () => {
    expect(noteOpenFor(openNoteValue(recordId, "note"), recordId)).toBe("note");
  });

  it("is none for another record", () => {
    expect(
      noteOpenFor(openNoteValue(recordId, "note"), otherId),
    ).toBeUndefined();
  });

  it("is none with no record shown", () => {
    expect(
      noteOpenFor(openNoteValue(recordId, "note"), undefined),
    ).toBeUndefined();
  });
});

describe("a note left behind", () => {
  it("is one named for a record other than the one shown", () => {
    expect(noteLeftBehind(openNoteValue(recordId, "note"), [otherId])).toBe(
      true,
    );
  });

  it("isn't the note of any record shown, as a project's under one of its activities", () => {
    expect(
      noteLeftBehind(openNoteValue(recordId, "note"), [otherId, recordId]),
    ).toBe(false);
  });

  it("isn't the note of the record shown", () => {
    expect(noteLeftBehind(openNoteValue(recordId, "note"), [recordId])).toBe(
      false,
    );
  });

  it("isn't known while no record is shown, as while a page loads", () => {
    expect(noteLeftBehind(openNoteValue(recordId, "note"), [])).toBe(false);
  });

  it("isn't anything with no note named", () => {
    expect(noteLeftBehind(undefined, [recordId])).toBe(false);
  });
});

describe("the address's note", () => {
  it("is kept as given", () => {
    const note = openNoteValue(recordId, "note");
    expect(noteSearch.parse({ note })).toEqual({ note });
  });

  it("is kept up to the longest a note's address may be", () => {
    const longest = "x".repeat(157);
    expect(noteSearch.parse({ note: longest })).toEqual({ note: longest });
  });

  it("is ignored when longer than any note's address", () => {
    expect(noteSearch.parse({ note: "x".repeat(158) })).toEqual({
      note: undefined,
    });
  });

  it("is ignored when it isn't text", () => {
    expect(noteSearch.parse({ note: 3 })).toEqual({ note: undefined });
  });
});
