// SPDX-License-Identifier: Apache-2.0

// Tests for the Capacity page's tabs: which a role sees, from its permissions and the data it sees,
// the tab shown for the one asked for, an old address's tab, and the table each grid tab keeps.

import { defaultClasses, type Permission } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  capacityModeOfTable,
  capacityModeSchema,
  capacityModes,
  capacityTables,
  shownCapacityMode,
} from "./capacity.ts";

const access = (permissions: readonly Permission[]) => ({
  permissions,
  dataClasses: defaultClasses,
});

const seesFeatureTeams: Permission[] = ["feature-teams:view", "personal:view"];

const seesAllocations: Permission[] = [
  "allocations:view",
  "feature-teams:view",
  "people:view",
  "personal:view",
];

describe("the tabs a role sees", () => {
  it("gives every tab, in order, to a role that sees them all", () => {
    expect(
      capacityModes(access([...seesAllocations, "configuration:view"])),
    ).toEqual(["feature-teams", "allocations"]);
  });

  it("gives Feature teams to a role that sees feature teams and Personal details", () => {
    expect(capacityModes(access(seesFeatureTeams))).toEqual(["feature-teams"]);
  });

  it("leaves out Feature teams without Personal details", () => {
    expect(capacityModes(access(["feature-teams:view"]))).toEqual([]);
  });

  it.each([
    ["allocations", "allocations:view"],
    ["people", "people:view"],
  ] as const)("leaves out Allocations without %s", (_, missing) => {
    expect(
      capacityModes(access(seesAllocations.filter((one) => one !== missing))),
    ).toEqual(["feature-teams"]);
  });

  it("gives no tab to a role that sees configuration alone", () => {
    expect(capacityModes(access(["configuration:view"]))).toEqual([]);
  });
});

describe("the tab shown", () => {
  it("is the one asked for, where the role sees it", () => {
    expect(shownCapacityMode("allocations", access(seesAllocations))).toBe(
      "allocations",
    );
  });

  it("is the first the role sees, when none or another is asked for", () => {
    expect(shownCapacityMode(undefined, access(seesAllocations))).toBe(
      "feature-teams",
    );
    expect(shownCapacityMode("allocations", access(seesFeatureTeams))).toBe(
      "feature-teams",
    );
  });

  it("is the first of all for a role that sees no tab", () => {
    expect(shownCapacityMode(undefined, access([]))).toBe("feature-teams");
  });
});

describe("an address's tab", () => {
  it("opens Allocations for People, its name before", () => {
    expect(capacityModeSchema.parse("people")).toBe("allocations");
  });

  it("refuses a tab Capacity doesn't have", () => {
    expect(capacityModeSchema.safeParse("work").success).toBe(false);
  });
});

describe("each grid tab's table", () => {
  it("names the tab of each table it keeps views for", () => {
    expect([
      capacityModeOfTable(capacityTables["feature-teams"]),
      capacityModeOfTable(capacityTables.allocations),
    ]).toEqual(["feature-teams", "allocations"]);
  });

  it("names no tab for a table on another page", () => {
    expect(capacityModeOfTable("people")).toBeUndefined();
  });
});
