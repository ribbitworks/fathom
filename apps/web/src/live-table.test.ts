// SPDX-License-Identifier: Apache-2.0

// Tests for the parts of a table whose records never have drafts.

import { describe, expect, it } from "vitest";
import { noDrafts } from "./drafts.ts";
import { liveTableParts } from "./live-table.ts";

describe("a table without drafts", () => {
  it("shows its records as they are, with no drafts to decide or describe", () => {
    const records = [{ id: "a" }, { id: "b" }];
    expect(liveTableParts.liveRecords(records)).toEqual(records);
    expect(liveTableParts.drafts()).toEqual(noDrafts());
    expect(liveTableParts.draftFields()).toEqual([]);
  });
});
