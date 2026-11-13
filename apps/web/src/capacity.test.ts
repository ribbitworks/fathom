// SPDX-License-Identifier: Apache-2.0

// Tests for the Capacity page's modes: which a role sees, from its permissions and the data it sees,
// and the mode shown for the one asked for.

import { defaultClasses, type Permission } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { capacityModes, shownCapacityMode } from "./capacity.ts";

const access = (permissions: readonly Permission[]) => ({
  permissions,
  dataClasses: defaultClasses,
});

const seesPeople: Permission[] = [
  "allocations:view",
  "feature-teams:view",
  "people:view",
  "personal:view",
];

describe("the modes a role sees", () => {
  it("gives People to a role that sees allocations and everything its grid reads", () => {
    expect(capacityModes(access(seesPeople))).toEqual(["people"]);
    expect(
      capacityModes(access([...seesPeople, "configuration:view"])),
    ).toEqual(["people", "settings"]);
  });

  it.each([
    ["Personal details", "personal:view"],
    ["feature teams", "feature-teams:view"],
    ["people", "people:view"],
  ] as const)("leaves out People without %s", (_, missing) => {
    expect(
      capacityModes(access(seesPeople.filter((one) => one !== missing))),
    ).toEqual([]);
  });

  it("gives Settings to a role that sees configuration", () => {
    expect(capacityModes(access(["configuration:view"]))).toEqual(["settings"]);
  });
});

describe("the mode shown", () => {
  it("is the one asked for, where the role sees it", () => {
    expect(
      shownCapacityMode(
        "settings",
        access([...seesPeople, "configuration:view"]),
      ),
    ).toBe("settings");
  });

  it("is the first the role sees, when none or another is asked for", () => {
    expect(shownCapacityMode(undefined, access(seesPeople))).toBe("people");
    expect(shownCapacityMode("people", access(["configuration:view"]))).toBe(
      "settings",
    );
  });

  it("is Settings for a role that sees no mode", () => {
    expect(shownCapacityMode(undefined, access([]))).toBe("settings");
  });
});
