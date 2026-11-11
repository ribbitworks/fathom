// SPDX-License-Identifier: Apache-2.0

// Tests for the data classes pages and views need: which classes a role sees, what each view is
// missing for a role, and the line saying why.

import { describe, expect, it } from "vitest";
import type { Permission } from "./access.ts";
import { seesClass, seesView, whyMissing } from "./data-classes.ts";

const personal: Permission[] = ["people:view", "personal:view"];
const everything: Permission[] = [...personal, "confidential:view"];

describe("seesClass", () => {
  it.each([
    ["General, with no permissions", [], "general", true],
    ["Personal, with people", personal, "personal", true],
    ["Personal, without people", ["personal:view"], "personal", false],
    ["Personal, without it", ["people:view"], "personal", false],
    ["Confidential, with it", ["confidential:view"], "confidential", true],
    ["Confidential, without it", personal, "confidential", false],
  ] as const)("%s", (_, permissions, dataClass, expected) => {
    expect(seesClass(permissions, dataClass)).toBe(expected);
  });
});

describe("whether a role sees a view", () => {
  it("does for a role that sees every class the view needs", () => {
    expect(seesView("orgChartFutureDates", everything)).toBe(true);
  });

  it("does not for a role missing any of them", () => {
    expect(seesView("allocations", ["people:view"])).toBe(false);
    expect(seesView("groupingByManager", personal)).toBe(false);
  });
});

describe("why a view is missing", () => {
  it.each([
    ["allocations", [], "Allocations needs Personal access."],
    ["featureAssignments", [], "Feature assignments needs Personal access."],
    ["orgChartOtherDates", [], "Other dates need Personal access."],
    [
      "groupingByManager",
      personal,
      "Grouping by manager needs Confidential access.",
    ],
    ["orgChartFutureDates", personal, "Future dates need Confidential access."],
    [
      "orgChartFutureDates",
      [],
      "Future dates need Personal and Confidential access.",
    ],
  ] as const)("says it of %s", (view, permissions, expected) => {
    expect(whyMissing(view, permissions)).toBe(expected);
  });

  it("says nothing when the role sees the view", () => {
    expect(whyMissing("allocations", personal)).toBeUndefined();
  });
});
