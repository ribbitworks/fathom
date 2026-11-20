// SPDX-License-Identifier: Apache-2.0

// Tests for the order a table's groups run in: earliest first with the group for none last, or
// reversed with it first; the address and saved views keeping the order; and the Group by menu's
// changes to it.

import { describe, expect, it } from "vitest";
import {
  emptyView,
  groupedFirstBy,
  knownView,
  sameView,
  searchFor,
  setsApart,
  ungrouped,
  type View,
  viewFrom,
  withGroupsReversed,
} from "./table-view.ts";
import {
  byGroupRank,
  placedRows,
  type RowGroup,
  rowsInOrder,
} from "./row-groups.ts";

const group = (key: string, rank: number): RowGroup => ({
  key,
  label: key,
  rank,
});

const none = group("none", Number.MAX_SAFE_INTEGER);
const march = group("2027-03", 202703);
const may = group("2027-05", 202705);

describe("the groups' order", () => {
  it("runs earliest first, the group for none last", () => {
    expect([none, may, march].sort(byGroupRank(false))).toEqual([
      march,
      may,
      none,
    ]);
  });

  it("runs latest first once reversed, the group for none first", () => {
    expect([march, none, may].sort(byGroupRank(true))).toEqual([
      none,
      may,
      march,
    ]);
  });

  it("reverses the first grouping's groups alone, keeping the second's and the records' order", () => {
    // Given records under a month, then under a letter
    const monthOf = new Map([
      ["first", march],
      ["second", march],
      ["third", may],
      ["fourth", none],
    ]);
    const letterOf = new Map([
      ["first", group("b", 2)],
      ["second", group("a", 1)],
      ["third", group("a", 1)],
      ["fourth", group("a", 1)],
    ]);
    const records = ["first", "second", "third", "fourth"];
    const rows = placedRows(
      records,
      (record) => [monthOf.get(record) as RowGroup],
      (record) => record,
      (record) => [letterOf.get(record) as RowGroup],
    );

    // When the first grouping's groups are reversed
    const shown = rowsInOrder(rows, records, true).map(({ record }) => record);

    // Then the month for none comes first, and March's letters still run a to b
    expect(shown).toEqual(["fourth", "third", "second", "first"]);
  });
});

describe("the order in the view", () => {
  const grouped: View = { ...emptyView, grouping: "neededBy" };

  it("is kept in the address and saved views while the rows are grouped", () => {
    const reversed = withGroupsReversed(grouped, true);
    expect(searchFor(reversed)).toEqual({
      grouping: "neededBy",
      groupsReversed: true,
    });
    expect(viewFrom(searchFor(reversed))).toEqual(reversed);
    expect(knownView(reversed, [])).toEqual(reversed);
    expect(setsApart(reversed)).toBe(true);
    expect(sameView(reversed, grouped)).toBe(false);
  });

  it("opens earliest first from an address or saved view without it", () => {
    expect(viewFrom({ grouping: "neededBy" }).groupsReversed).toBeUndefined();
  });

  it("is dropped while the rows are in one list", () => {
    expect(viewFrom({ groupsReversed: true })).toEqual(emptyView);
  });

  it("goes back to earliest first when chosen", () => {
    const reversed = withGroupsReversed(grouped, true);
    expect(withGroupsReversed(reversed, false)).toEqual({
      ...grouped,
      groupsReversed: undefined,
    });
  });
});

describe("the Group by menu's changes to the order", () => {
  const reversed: View = {
    ...emptyView,
    grouping: "neededBy",
    thenBy: "statusId",
    groupsReversed: true,
  };

  it("keeps the order while the same grouping is chosen again", () => {
    expect(groupedFirstBy(reversed, "neededBy")).toEqual(reversed);
  });

  it("starts another grouping earliest first, keeping the second grouping", () => {
    expect(groupedFirstBy(reversed, "priorityId")).toEqual({
      ...reversed,
      grouping: "priorityId",
      groupsReversed: undefined,
    });
  });

  it("takes the second grouping away once it is chosen first", () => {
    expect(groupedFirstBy(reversed, "statusId")).toEqual({
      ...emptyView,
      grouping: "statusId",
      thenBy: undefined,
      groupsReversed: undefined,
    });
  });

  it("takes the order away with the grouping, by None or Clear grouping", () => {
    const inOneList = {
      ...emptyView,
      grouping: undefined,
      thenBy: undefined,
      groupsReversed: undefined,
    };
    expect(groupedFirstBy(reversed, undefined)).toEqual(inOneList);
    expect(ungrouped(reversed)).toEqual(inOneList);
  });
});
