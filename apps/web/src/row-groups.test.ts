// SPDX-License-Identifier: Apache-2.0

// Tests for placing a table's rows under their groups, in order, with a record under each of
// its groups.

import { describe, expect, it } from "vitest";
import {
  placedRows,
  recordsOf,
  type RowGroup,
  rowsInOrder,
} from "./row-groups.ts";

describe("placing rows under their groups", () => {
  const group = (key: string, rank: number): RowGroup => ({
    key,
    label: `Group ${key}`,
    rank,
  });
  const [x, y] = [group("x", 0), group("y", 1)];
  const groupsOf = (record: string) =>
    record === "both" ? ([x, y] as const) : ([x] as const);

  it("gives a record one row, keyed by itself, while the rows aren't grouped", () => {
    expect(placedRows(["a"], undefined, (record) => record)).toEqual([
      { record: "a", key: "a" },
    ]);
  });

  it("gives a record a row under each of its groups, each naming the others", () => {
    expect(placedRows(["both"], groupsOf, (record) => record)).toEqual([
      { record: "both", key: "x both", group: x, others: [{ group: y }] },
      { record: "both", key: "y both", group: y, others: [{ group: x }] },
    ]);
  });

  it("names each record once, in the rows' order", () => {
    const rows = placedRows(["both", "one"], groupsOf, (record) => record);
    expect(recordsOf(rows)).toEqual(["both", "one"]);
  });

  it("orders the rows of the records shown by group, then as the records are shown", () => {
    const rows = placedRows(
      ["both", "one", "hidden"],
      groupsOf,
      (record) => record,
    );
    expect(rowsInOrder(rows, ["one", "both"]).map(({ key }) => key)).toEqual([
      "x one",
      "x both",
      "y both",
    ]);
  });

  describe("and under each group's second groups", () => {
    const [p, q] = [group("p", 0), group("q", 1)];
    const subgroupsOf = (record: string) =>
      record === "one" ? ([q] as const) : ([p, q] as const);
    const place = (records: readonly string[]) =>
      placedRows(records, groupsOf, (record) => record, subgroupsOf);

    it("gives a record a row under each pair of groups, each with the others' groups it differs in", () => {
      expect(place(["both"])).toEqual([
        {
          record: "both",
          key: "x p both",
          group: x,
          subgroup: p,
          others: [{ subgroup: q }, { group: y }, { group: y, subgroup: q }],
        },
        {
          record: "both",
          key: "x q both",
          group: x,
          subgroup: q,
          others: [{ subgroup: p }, { group: y, subgroup: p }, { group: y }],
        },
        {
          record: "both",
          key: "y p both",
          group: y,
          subgroup: p,
          others: [{ group: x }, { group: x, subgroup: q }, { subgroup: q }],
        },
        {
          record: "both",
          key: "y q both",
          group: y,
          subgroup: q,
          others: [{ group: x, subgroup: p }, { group: x }, { subgroup: p }],
        },
      ]);
    });

    it("orders the rows by group, then second group, then as the records are shown", () => {
      expect(
        rowsInOrder(place(["both", "one"]), ["one", "both"])
          .filter(({ group }) => group === x)
          .map(({ key }) => key),
      ).toEqual(["x p both", "x q one", "x q both"]);
    });
  });
});
