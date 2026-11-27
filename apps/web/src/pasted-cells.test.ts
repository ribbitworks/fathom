// SPDX-License-Identifier: Apache-2.0

// Tests for reading text pasted from a spreadsheet as rows of cells.

import { describe, expect, it } from "vitest";
import { pastedCells } from "./pasted-cells.ts";

describe("pasted cells", () => {
  it("splits rows by line breaks and cells by tabs", () => {
    expect(pastedCells("Ada\tE1\r\nBea\tE2\n")).toEqual([
      ["Ada", "E1"],
      ["Bea", "E2"],
    ]);
  });

  it("keeps a quoted cell's tabs, line breaks and doubled quotes in one cell", () => {
    expect(pastedCells('Ada\t"Lift\r\nRoom ""4""\tB"\tE1')).toEqual([
      ["Ada", 'Lift\r\nRoom "4"\tB', "E1"],
    ]);
  });

  it("reads a cell whose quote never closes as written, so the rows after it stay rows", () => {
    expect(pastedCells('"Sam Rivera\tE1\nBea Fictional\tE2')).toEqual([
      ['"Sam Rivera', "E1"],
      ["Bea Fictional", "E2"],
    ]);
  });

  it("reads a cell whose quote closes before its end as written", () => {
    expect(pastedCells('"Sam" Rivera\tE1')).toEqual([['"Sam" Rivera', "E1"]]);
  });

  it("ends a quoted cell at the end of its row, and at the end of the text", () => {
    expect(pastedCells('Ada\t"Lift\nRoom 4"\nBea\t"Stairs"')).toEqual([
      ["Ada", "Lift\nRoom 4"],
      ["Bea", "Stairs"],
    ]);
  });

  it("takes a quote within a cell as written", () => {
    expect(pastedCells('5" screen\tE1')).toEqual([['5" screen', "E1"]]);
  });

  it("keeps an empty last cell, and reads nothing from nothing", () => {
    expect(pastedCells("Ada\t")).toEqual([["Ada", ""]]);
    expect(pastedCells("")).toEqual([]);
  });
});
