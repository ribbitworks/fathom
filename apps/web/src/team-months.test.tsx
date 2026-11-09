// SPDX-License-Identifier: Apache-2.0

// Tests for feature teams month by month as a table of records: the months shown around today, and
// what a table that never changes anything answers.

import { describe, expect, it } from "vitest";
import {
  gridMonthsAround,
  noTeamMonthActions,
  teamMonthsTable,
} from "./team-months.tsx";

describe("gridMonthsAround", () => {
  it("is twelve months back to eleven ahead of the current month", () => {
    expect(gridMonthsAround("2027-03-10")).toEqual({
      from: "2026-03",
      to: "2028-02",
    });
  });
});

describe("the table", () => {
  const table = teamMonthsTable({ months: [], teams: [], people: [] }, false);

  it("is never asked to change anything, and has nothing to say if it were", () => {
    expect(table.request([], "")).toEqual({});
    expect(table.newRowLabel("")).toBe("");
    expect(table.drafts([]).people).toEqual([]);
    expect(table.liveRecords([])).toEqual([]);
    expect(table.draftFields({} as never, {} as never, [], [])).toEqual([]);
    expect(table.recordProblem({}, () => [])).toBeUndefined();
    expect(table.removeLabel({} as never)).toBe("");
    expect(() => {
      (noTeamMonthActions.add as () => void)();
    }).not.toThrow();
  });

  it("names a row by its person", () => {
    expect(table.nameOf({ name: "Avery Fictional" } as never)).toBe(
      "Avery Fictional",
    );
  });
});
