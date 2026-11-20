// SPDX-License-Identifier: Apache-2.0

// Tests for what a table that changes none of its records itself is never asked.

import { describe, expect, it } from "vitest";
import { readOnlyTableParts } from "./record-table.ts";

describe("a read-only table", () => {
  it("names no new row or removal, finds no draft fields, checks nothing, and refuses to add a record", () => {
    expect([
      readOnlyTableParts.newRowLabel(),
      readOnlyTableParts.removeLabel(),
    ]).toEqual(["", ""]);
    expect(readOnlyTableParts.draftFields()).toEqual([]);
    expect(readOnlyTableParts.recordProblem).not.toThrow();
    expect(() => readOnlyTableParts.request()).toThrow(
      "A read-only table adds no records",
    );
  });
});
