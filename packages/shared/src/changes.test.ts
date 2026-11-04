// SPDX-License-Identifier: Apache-2.0

// Tests for the text a change history search looks in.

import { describe, expect, it } from "vitest";
import { type ChangedRecord, recordSearchText } from "./changes.ts";

const record = (changed: Partial<ChangedRecord>): ChangedRecord => ({
  kind: "person",
  action: "changed",
  name: null,
  list: null,
  fields: [],
  draft: false,
  ...changed,
});

describe("recordSearchText", () => {
  it("holds a record's name, list, columns, and text values, leaving out yes, no, and empty", () => {
    expect(
      recordSearchText(
        record({
          name: "Fictional Person",
          list: "Sites",
          fields: [
            {
              field: "value",
              column: "Site",
              oldValue: "North",
              newValue: ["South", "East"],
            },
            { field: "retired", oldValue: false, newValue: null },
          ],
        }),
      ),
    ).toBe("Fictional Person Sites Site North South East ");
  });

  it("holds nothing for a record with no name, list, or fields", () => {
    expect(recordSearchText(record({}))).toBe(" ");
  });
});
