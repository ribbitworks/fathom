// SPDX-License-Identifier: Apache-2.0

// Tests for metrics over a table's rows: counting rows by one column's groups and by two crossed,
// with rows holding several choices counted in each; the groups each kind of column offers; and
// shares.

import { describe, expect, it } from "vitest";
import { countRows, emptyGroup, groupsFor, share } from "./metrics.ts";
import type { TableColumn } from "./table-view.ts";

interface Row {
  start: string;
  level: string[];
  role: string[];
}

const level: TableColumn<Row> = {
  key: "level",
  label: "Level",
  kind: "choice",
  choices: [
    { id: "p3", label: "P3" },
    { id: "p4", label: "P4" },
    { id: "old", label: "Old level", retired: true },
  ],
  multiple: false,
  value: (row) => row.level,
};

const role: TableColumn<Row> = {
  key: "role",
  label: "Role",
  kind: "choice",
  choices: [
    { id: "test", label: "Test engineer" },
    { id: "dev", label: "Developer" },
  ],
  multiple: true,
  emptyLabel: "No role",
  value: (row) => row.role,
};

const start: TableColumn<Row> = {
  key: "start",
  label: "Start",
  kind: "date",
  choices: [],
  multiple: false,
  value: (row) => row.start,
};

const rows: Row[] = [
  { start: "2024-01-01", level: ["p4"], role: ["test"] },
  { start: "", level: ["p4"], role: ["test", "dev"] },
  { start: "2025-06-30", level: ["p3"], role: ["dev"] },
  { start: "", level: [], role: [] },
];

describe("counting rows", () => {
  it("counts rows by one column's groups, and every row in any group", () => {
    const counts = countRows(rows, [level]);
    expect(counts.rows).toBe(4);
    expect(counts.of(["p4"])).toBe(2);
    expect(counts.of(["p3"])).toBe(1);
    expect(counts.of([emptyGroup])).toBe(1);
    expect(counts.of(["old"])).toBe(0);
    expect(counts.of([undefined])).toBe(4);
  });

  it("counts a row holding several choices in each of them, and once in any", () => {
    const counts = countRows(rows, [role]);
    expect(counts.of(["test"])).toBe(2);
    expect(counts.of(["dev"])).toBe(2);
    expect(counts.of([undefined])).toBe(4);
  });

  it("counts rows by two columns crossed, with each column's totals", () => {
    const counts = countRows(rows, [level, role]);
    expect(counts.of(["p4", "test"])).toBe(2);
    expect(counts.of(["p4", "dev"])).toBe(1);
    expect(counts.of(["p3", "test"])).toBe(0);
    expect(counts.of(["p4", undefined])).toBe(2);
    expect(counts.of([undefined, "dev"])).toBe(2);
    expect(counts.of([emptyGroup, emptyGroup])).toBe(1);
    expect(counts.of([undefined, undefined])).toBe(4);
  });

  it("counts dates and text by whether they are filled in", () => {
    const counts = countRows(rows, [start]);
    expect(counts.of(["filled"])).toBe(2);
    expect(counts.of([emptyGroup])).toBe(2);
  });

  it("counts no rows", () => {
    const counts = countRows([], [level, role]);
    expect(counts.rows).toBe(0);
    expect(counts.of([undefined, undefined])).toBe(0);
  });
});

describe("a column's groups", () => {
  const counted = (column: TableColumn<Row>) => {
    const counts = countRows(rows, [column]);
    return groupsFor(column, (group) => {
      return counts.of([group]) > 0;
    });
  };

  it("are its choices in order, retired ones only when held, then its empty value when held", () => {
    expect(counted(level)).toEqual([
      { id: "p3", label: "P3" },
      { id: "p4", label: "P4" },
      { id: emptyGroup, label: "Empty" },
    ]);
    expect(groupsFor(level, (group) => group === "old")).toEqual([
      { id: "p3", label: "P3" },
      { id: "p4", label: "P4" },
      { id: "old", label: "Old level" },
    ]);
  });

  it("call the empty value what the column calls it", () => {
    expect(counted(role).at(-1)).toEqual({ id: emptyGroup, label: "No role" });
  });

  it("are Populated and Empty for columns without choices", () => {
    expect(counted(start).map(({ label }) => label)).toEqual([
      "Populated",
      "Empty",
    ]);
  });
});

describe("shares", () => {
  it("are parts of the rows as percentages, and none of none is 0%", () => {
    expect(share(1, 8)).toBe(
      new Intl.NumberFormat(undefined, {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(0.125),
    );
    expect(share(0, 0)).toBe(share(0, 5));
  });
});
