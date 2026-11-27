// SPDX-License-Identifier: Apache-2.0

// Tests for reading a record's values in added columns apart from the database: each value is read
// into its own type's map, so a text, a date and a note are never taken for one another.

import { describe, expect, it } from "vitest";
import { columnValuesOf } from "./data/person-fields.ts";

describe("a record's values in added columns", () => {
  it("are each read into their own type's map, a text apart from a note", () => {
    const values = columnValuesOf({
      "value:f1": { text: "North 4-12" },
      "value:f2": "*Kind*",
      "value:f3": 0,
    });

    expect(values.texts).toEqual({ f1: "North 4-12" });
    expect(values.notes).toEqual({ f2: "*Kind*" });
    expect(values.numbers).toEqual({ f3: 0 });
  });

  it("read a date apart from a note and a text, and neither as a date", () => {
    const values = columnValuesOf({
      "value:f1": { date: "2026-03-14" },
      "value:f2": "2026-03-15",
      "value:f3": { text: "2026-03-16" },
    });

    expect(values.days).toEqual({ f1: "2026-03-14" });
    expect(values.notes).toEqual({ f2: "2026-03-15" });
    expect(values.texts).toEqual({ f3: "2026-03-16" });
  });

  it("leave out the columns not shown", () => {
    const values = columnValuesOf(
      { "value:f1": { text: "North 4-12" }, "value:f2": { text: "Remote" } },
      (columnId) => columnId === "f2",
    );

    expect(values.texts).toEqual({ f2: "Remote" });
  });
});
