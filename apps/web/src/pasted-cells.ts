// SPDX-License-Identifier: Apache-2.0

// Text pasted from a spreadsheet, as its rows of cells: cells split by tabs and rows by line breaks,
// except within a cell in quotes, as spreadsheets and Fathom's own export write a cell holding a
// tab, a line break or a quote, with each quote in it doubled. A quote that never closes, or closes
// before its cell ends, was typed rather than written by a spreadsheet, so its cell reads as written.

const quote = '"';

const endsCell = (char: string) =>
  char === "" || char === "\t" || char === "\n" || char === "\r";

// Where a quoted cell starting at the given place ends, just past its closing quote, and what it
// holds; or undefined when its quotes don't make a quoted cell.
function quotedCell(
  text: string,
  start: number,
): { end: number; cell: string } | undefined {
  let cell = "";
  let at = start + 1;
  while (at < text.length) {
    const char = text.charAt(at);
    if (char !== quote) {
      cell += char;
      at += 1;
    } else if (text.charAt(at + 1) === quote) {
      cell += quote;
      at += 2;
    } else {
      return endsCell(text.charAt(at + 1)) ? { end: at + 1, cell } : undefined;
    }
  }
  return undefined;
}

export function pastedCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let at = 0;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  while (at < text.length) {
    const char = text.charAt(at);
    const quoted =
      char === quote && cell === "" ? quotedCell(text, at) : undefined;
    if (quoted !== undefined) {
      cell = quoted.cell;
      at = quoted.end;
      continue;
    }
    if (char === "\t") {
      endCell();
    } else if (char === "\n" || char === "\r") {
      endCell();
      rows.push(row);
      row = [];
      if (char === "\r" && text.charAt(at + 1) === "\n") at += 1;
    } else {
      cell += char;
    }
    at += 1;
  }
  if (cell !== "" || row.length > 0) {
    endCell();
    rows.push(row);
  }
  return rows;
}
