// SPDX-License-Identifier: Apache-2.0

// Tests for the data classes: which classes a role sees and changes, the classes built-in details
// are kept in, who may move data between classes, what each view is missing for a role, and the
// line saying why.

import { describe, expect, it } from "vitest";
import type { Permission } from "./access.ts";
import {
  type ClassAccess,
  type DataClasses,
  defaultClasses,
  editsClass,
  editsField,
  seesClass,
  seesEmployment,
  seesField,
  seesView,
  whyMissing,
  whyNoMove,
} from "./data-classes.ts";

const personal: Permission[] = ["people:view", "personal:view"];
const everything: Permission[] = [...personal, "confidential:view"];

const access = (
  permissions: readonly Permission[],
  moved: Partial<DataClasses> = {},
): ClassAccess => ({
  permissions,
  dataClasses: { ...defaultClasses, ...moved },
});

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

describe("editsClass", () => {
  it.each([
    ["General, with no permissions", [], "general", true],
    ["Personal, with it", ["personal:edit"], "personal", true],
    ["Personal, with only viewing it", personal, "personal", false],
    ["Confidential, with it", ["confidential:edit"], "confidential", true],
    ["Confidential, without it", ["personal:edit"], "confidential", false],
  ] as const)("%s", (_, permissions, dataClass, expected) => {
    expect(editsClass(permissions, dataClass)).toBe(expected);
  });
});

describe("a built-in detail's class", () => {
  it("is its default until moved", () => {
    expect(seesField(access(personal), "startDate")).toBe(true);
    expect(seesField(access(personal), "futureReorganizations")).toBe(false);
  });

  it("is where the organization moved it", () => {
    const moved = access(["people:view"], { startDate: "general" });
    expect(seesField(moved, "startDate")).toBe(true);
    expect(editsField(moved, "startDate")).toBe(true);
    expect(
      seesField(access(personal, { endDate: "confidential" }), "endDate"),
    ).toBe(false);
  });
});

describe("seesEmployment", () => {
  it("needs both start and end dates' classes", () => {
    expect(seesEmployment(access(personal))).toBe(true);
    expect(seesEmployment(access(personal, { endDate: "confidential" }))).toBe(
      false,
    );
    expect(seesEmployment(access([], { startDate: "general" }))).toBe(false);
  });
});

describe("why a role may not move data", () => {
  const classifier: Permission[] = [...personal, "data:classify"];

  it("allows moving between classes the role sees, with Classify data", () => {
    expect(whyNoMove(classifier, "personal", "general")).toBeUndefined();
  });

  it("needs Classify data", () => {
    expect(whyNoMove(everything, "general", "personal")).toBe(
      "Moving data to another class needs Classify data",
    );
  });

  it.each([
    ["the class data leaves", "confidential", "personal"],
    ["the class data enters", "general", "confidential"],
  ] as const)("needs sight of %s", (_, from, to) => {
    expect(whyNoMove(classifier, from, to)).toBe(
      "This role can't see Confidential data",
    );
  });
});

describe("whether a role sees a view", () => {
  it("does for a role that sees every class the view needs", () => {
    expect(seesView("orgChartFutureDates", access(everything))).toBe(true);
  });

  it("does not for a role missing any of them", () => {
    expect(seesView("allocations", access(["people:view"]))).toBe(false);
    expect(seesView("groupingByManager", access(personal))).toBe(false);
  });

  it("follows the classes the organization moved the view's details to", () => {
    const general = {
      startDate: "general",
      endDate: "general",
      managerHistory: "general",
      featureTeamDates: "general",
    } as const;
    expect(seesView("allocations", access([], general))).toBe(true);
    expect(
      seesView("allocations", access(personal, { endDate: "confidential" })),
    ).toBe(false);
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
    expect(whyMissing(view, access(permissions))).toBe(expected);
  });

  it("names the class a detail was moved to", () => {
    expect(
      whyMissing("allocations", access(personal, { endDate: "confidential" })),
    ).toBe("Allocations needs Confidential access.");
  });

  it("says nothing when the role sees the view", () => {
    expect(whyMissing("allocations", access(personal))).toBeUndefined();
  });
});
