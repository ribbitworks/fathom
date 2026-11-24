// SPDX-License-Identifier: Apache-2.0

// Tests for the columns that use each list: a built-in list's own column, and the columns added to
// a table that draw on a list, named by their page and sorted.

import { describe, expect, it } from "vitest";
import { builtInListUses, listUses } from "./list-uses.ts";

describe("the columns that use a list", () => {
  it("names each built-in list's own column by its page", () => {
    expect(builtInListUses).toEqual({
      positions: { page: "People", column: "Position" },
      "hiring-states": { page: "People", column: "State" },
      "proposal-statuses": { page: "Proposals", column: "Status" },
      "feature-statuses": { page: "Features", column: "Status" },
      "feature-priorities": { page: "Features", column: "Priority" },
      "feature-sizes": { page: "Features", column: "Size" },
      "feature-risks": { page: "Features", column: "Risk" },
    });
  });

  it.each([null, undefined])(
    "names no column for a list of an organization's own, with builtIn %s, that none uses",
    (builtIn) => {
      expect(listUses(builtIn, [])).toEqual([]);
    },
  );

  it("names the columns added to People and Features by their page", () => {
    expect(
      listUses(null, [
        { table: "people", name: "Office" },
        { table: "features", name: "Site" },
      ]),
    ).toEqual([
      { page: "Features", column: "Site" },
      { page: "People", column: "Office" },
    ]);
  });

  it("sorts a built-in list's own columns among those added, by page then column, in any case", () => {
    expect(
      listUses("positions", [
        { table: "people", name: "previous position" },
        { table: "people", name: "Desk" },
        { table: "features", name: "Owner position" },
      ]),
    ).toEqual([
      { page: "Features", column: "Owner position" },
      { page: "People", column: "Desk" },
      { page: "People", column: "Position" },
      { page: "People", column: "previous position" },
    ]);
  });
});
