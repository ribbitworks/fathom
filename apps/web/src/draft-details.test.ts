// SPDX-License-Identifier: Apache-2.0

// Tests for a draft's details in words: what it does, or each field it changes, with who changed it.

import { describe, expect, it } from "vitest";
import { configDraftFields, draftLines } from "./draft-details.tsx";

const draft = {
  madeBy: "Fictional Editor",
  editors: ["Fictional Editor"],
};

describe("a draft's details", () => {
  it("names who added or removed a record, or changed it when no field is shown", () => {
    expect(draftLines({ ...draft, action: "created" }, [])).toEqual([
      "Added by Fictional Editor",
    ]);
    expect(draftLines({ ...draft, action: "deleted" }, [])).toEqual([
      "Removed by Fictional Editor",
    ]);
    expect(
      draftLines({ ...draft, action: "changed", madeBy: null }, []),
    ).toEqual(["Changed by Fathom"]);
  });

  it("names who changed each field, or who last changed the draft when that is not recorded", () => {
    const changed = configDraftFields(
      { action: "changed", changed: ["label", "description"], live: {} },
      { label: "North", description: "" },
    );
    expect(
      draftLines(
        {
          ...draft,
          action: "changed",
          changedBy: { label: "Second Fictional Editor" },
        },
        changed,
      ),
    ).toEqual([
      "Name set to North, by Second Fictional Editor",
      "Description changed, by Fictional Editor",
    ]);
    expect(
      configDraftFields({ action: "created", changed: [], live: {} }, {}),
    ).toEqual([]);
    expect(
      configDraftFields(
        { action: "changed", changed: ["description"], live: {} },
        {},
      ),
    ).toEqual([
      {
        key: "description",
        field: { field: "description", oldValue: null, newValue: null },
      },
    ]);
  });
});
