// SPDX-License-Identifier: Apache-2.0

// Tests for grouping rows by the one choice a column holds: each choice's group in its list's
// order, its heading, and the group of rows with none.

import { describe, expect, it } from "vitest";
import { byChoice, holdsOneChoice } from "./choice-grouping.ts";
import type { Column, GridRecord } from "./record-grid.tsx";

interface Row extends GridRecord {
  chosen: string[];
}

const column: Column<Row> = {
  key: "site",
  kind: "choice",
  label: "Site",
  required: false,
  multiple: false,
  choices: [
    { id: "c1", label: "Harbour", description: "", retired: false },
    { id: "c2", label: "Quay", description: "", retired: true },
  ],
  value: ({ chosen }) => chosen,
  live: () => [],
  change: () => undefined,
};
const row = (chosen: string[]): Row => ({ id: "r1", chosen });

describe("grouping by a column's one choice", () => {
  it("ranks each choice's group by its place in the list, retired ones included", () => {
    const grouping = byChoice(column);
    expect(grouping).toMatchObject({ key: "site", label: "Site" });
    expect(grouping.of(row(["c2"]))).toEqual([
      { key: "c2", label: "Quay", rank: 1 },
    ]);
  });

  it("heads a group with the heading given for its choice", () => {
    const grouping = byChoice(column, ({ label }) => `${label} office`);
    expect(grouping.of(row(["c1"]))[0].label).toBe("Harbour office");
  });

  it("puts rows with none, or a choice no longer in the list, last under the column's words for none", () => {
    const grouping = byChoice({ ...column, emptyLabel: "No site yet" });
    const none = {
      key: "no-choice",
      label: "No site yet",
      rank: Number.MAX_SAFE_INTEGER,
    };
    expect(grouping.of(row([]))).toEqual([none]);
    expect(grouping.of(row(["gone"]))).toEqual([none]);
  });

  it("offers only columns holding one choice", () => {
    expect(holdsOneChoice(column)).toBe(true);
    expect(holdsOneChoice({ ...column, multiple: true })).toBe(false);
    expect(holdsOneChoice({ ...column, kind: "text" })).toBe(false);
  });
});
