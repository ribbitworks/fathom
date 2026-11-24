// SPDX-License-Identifier: Apache-2.0

// Tests for metrics over a table's rows: counting rows by one column's groups and by two crossed,
// with rows holding several choices counted in each; adding a number column up in each group; the
// groups each kind of column offers, months among them; and shares.

import { describe, expect, it } from "vitest";
import { countRows, emptyGroup, groupsFor, share } from "./metrics.ts";
import type { TableColumn } from "./table-view.ts";

interface Row {
  start: string;
  level: string[];
  role: string[];
  hours?: number | null;
  needed?: string;
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

const hours: TableColumn<Row> = {
  key: "hours",
  label: "Effort",
  kind: "number",
  choices: [],
  multiple: false,
  value: (row) => (row.hours == null ? "" : String(row.hours)),
  sum: { amount: (row) => row.hours ?? null },
};

const needed: TableColumn<Row> = {
  key: "needed",
  label: "Needed by",
  kind: "month",
  choices: [],
  multiple: false,
  value: (row) => row.needed ?? "",
};

const rows: Row[] = [
  {
    start: "2024-01-01",
    level: ["p4"],
    role: ["test"],
    hours: 10,
    needed: "2027-03",
  },
  {
    start: "",
    level: ["p4"],
    role: ["test", "dev"],
    hours: 4.5,
    needed: "2026-12",
  },
  { start: "2025-06-30", level: ["p3"], role: ["dev"], needed: "2027-03" },
  { start: "", level: [], role: [], hours: 0 },
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

describe("adding a number column up", () => {
  it("totals each group's amounts, counting the rows that have one", () => {
    const counts = countRows(rows, [level], hours);
    expect(counts.summed(["p4"])).toEqual({ total: 14.5, valued: 2 });
    expect(counts.summed(["p3"])).toEqual({ total: 0, valued: 0 });
    expect(counts.summed([emptyGroup])).toEqual({ total: 0, valued: 1 });
    expect(counts.summed([undefined])).toEqual({ total: 14.5, valued: 3 });
  });

  it("adds a row holding several choices into each, and once into the whole", () => {
    const counts = countRows(rows, [role], hours);
    expect(counts.summed(["test"])).toEqual({ total: 14.5, valued: 2 });
    expect(counts.summed(["dev"])).toEqual({ total: 4.5, valued: 1 });
    expect(counts.summed([undefined]).total).toBe(14.5);
  });

  it("adds nothing up without a column to add", () => {
    expect(countRows(rows, [level]).summed([undefined])).toEqual({
      total: 0,
      valued: 0,
    });
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

  it("are a checkbox's one choice and what it calls the unchecked, counting each row in one", () => {
    const manager: TableColumn<Row> = {
      key: "manager",
      label: "Manager?",
      kind: "flag",
      choices: [{ id: "yes", label: "Yes" }],
      multiple: false,
      emptyLabel: "No",
      value: (row) => (row.role.includes("dev") ? ["yes"] : []),
    };
    expect(groupsFor(manager, () => true)).toEqual([
      { id: "yes", label: "Yes" },
      { id: emptyGroup, label: "No" },
    ]);
    const counted = countRows(rows, [manager]);
    expect(counted.of(["yes"])).toBe(2);
    expect(counted.of([emptyGroup])).toBe(2);
  });

  it("are a month column's months, in date order, then its empty value", () => {
    const counts = countRows(rows, [needed]);
    expect(
      groupsFor(
        needed as TableColumn<never>,
        (group) => counts.of([group]) > 0,
        counts.seen(0),
      ),
    ).toEqual([
      { id: "2026-12", label: "Dec 2026" },
      { id: "2027-03", label: "Mar 2027" },
      { id: emptyGroup, label: "Empty" },
    ]);
    expect(counts.of(["2027-03"])).toBe(2);
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
