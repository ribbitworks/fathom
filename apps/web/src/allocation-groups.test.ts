// SPDX-License-Identifier: Apache-2.0

// Tests for someone's rows in the Allocations grid when grouped by feature team, by manager or by
// what they're allocated to, and the months each row holds.

import type { TeamMonths } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { groupedRows, type HeldRow, rowsByWork } from "./allocation-groups.ts";
import {
  featureTeamGrouping,
  managerGrouping,
  type PersonMonths,
} from "./team-months.tsx";

const months = ["2027-02", "2027-03", "2027-04"];
const search = { id: "t-search", name: "Search", colour: null };
const blair = { id: "p-blair", name: "Blair Fictional" };
const dana = { id: "p-dana", name: "Dana Fictional" };

const base: HeldRow = {
  id: "p-casey",
  personId: "p-casey",
  name: "Casey Fictional",
  manager: blair,
  values: {},
  links: {},
  outside: new Set(["2027-02"]),
};

const rowsOf = ({
  row = base,
  teamsIn = new Map(),
  managers,
  grouping,
}: {
  row?: HeldRow;
  teamsIn?: PersonMonths["teamsIn"];
  managers?: TeamMonths["people"][number]["managers"];
  grouping?: string;
}) => groupedRows(row, { teamsIn, managers, months, grouping });

const held = (rows: readonly HeldRow[]) =>
  rows.map(({ holds }) => holds && [...holds]);

describe("groupedRows", () => {
  it("gives someone one row when not grouped", () => {
    expect(rowsOf({ managers: { "2027-03": dana } })).toEqual([base]);
  });

  describe("by feature team", () => {
    it("gives a row under each team and under none, each holding its months and those outside employment", () => {
      const rows = rowsOf({
        teamsIn: new Map([["2027-03", [search]]]),
        grouping: featureTeamGrouping,
      });

      expect(rows.map(({ group }) => group)).toEqual([search, undefined]);
      expect(held(rows)).toEqual([
        ["2027-03", "2027-02"],
        ["2027-04", "2027-02"],
      ]);
      expect(new Set(rows.map(({ id }) => id)).size).toBe(2);
    });

    it("gives someone on one team in every month one row under it, holding every month", () => {
      const rows = rowsOf({
        teamsIn: new Map([
          ["2027-03", [search]],
          ["2027-04", [search]],
        ]),
        grouping: featureTeamGrouping,
      });

      expect(rows).toEqual([{ ...base, group: search }]);
    });

    it("keeps one row for someone outside employment in every month", () => {
      const row = { ...base, outside: new Set(months) };

      expect(rowsOf({ row, grouping: featureTeamGrouping })).toEqual([row]);
    });
  });

  describe("by manager", () => {
    it("gives a row under each manager reported to, each holding that line's months", () => {
      const rows = rowsOf({
        managers: { "2027-02": blair, "2027-03": blair, "2027-04": dana },
        grouping: managerGrouping,
      });

      expect(rows.map(({ manager }) => manager)).toEqual([blair, dana]);
      expect(held(rows)).toEqual([
        ["2027-03", "2027-02"],
        ["2027-04", "2027-02"],
      ]);
    });

    it("gives a row under none for the months with no manager", () => {
      const rows = rowsOf({
        managers: { "2027-03": blair, "2027-04": null },
        grouping: managerGrouping,
      });

      expect(rows.map(({ manager }) => manager)).toEqual([blair, null]);
    });

    it("gives no row for a manager only in months outside employment", () => {
      const rows = rowsOf({
        managers: { "2027-02": dana, "2027-03": blair, "2027-04": blair },
        grouping: managerGrouping,
      });

      expect(rows).toEqual([base]);
    });

    it("keeps one row under today's manager when the months' managers are not sent", () => {
      expect(rowsOf({ grouping: managerGrouping })).toEqual([base]);
    });
  });
});

describe("rowsByWork", () => {
  const on = (id: string, featureId: string) => ({
    id,
    featureId,
    activityId: null,
  });

  it("gives someone a row under each feature they're allocated to, holding that feature's allocations alone", () => {
    const rows = rowsByWork(base, [
      on("a1", "f-search"),
      on("a2", "f-billing"),
      on("a3", "f-search"),
    ]);

    expect(
      rows.map(({ row, allocations }) => [
        row.id,
        row.work,
        allocations.map(({ id }) => id),
      ]),
    ).toEqual([
      ["f-search p-casey", "f-search", ["a1", "a3"]],
      ["f-billing p-casey", "f-billing", ["a2"]],
    ]);
  });

  it("gives someone allocated to nothing one row, under none", () => {
    expect(rowsByWork(base, [])).toEqual([{ row: base, allocations: [] }]);
  });
});
