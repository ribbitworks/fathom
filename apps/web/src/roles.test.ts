// SPDX-License-Identifier: Apache-2.0

// Tests for what a role's permissions mean in plain English: the pages and views its holders get,
// those they miss and why, what they can and cannot do, permissions that do nothing without
// another, and what an account gains and loses when what it may do changes.

import {
  defaultClasses,
  type Permission,
  permissionDescriptions,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { consequences, difference } from "./roles.ts";

// What a role allows with the data in the classes Fathom starts it in.
const allowed = (granted: readonly Permission[]) =>
  consequences(granted, defaultClasses);

const allows = (permission: Permission) =>
  // The permission is always one of the shared list.
  // eslint-disable-next-line security/detect-object-injection
  permissionDescriptions[permission].allows;
const without = (permission: Permission) =>
  // eslint-disable-next-line security/detect-object-injection
  permissionDescriptions[permission].without;

describe("what a role allows", () => {
  it("lists no pages for a role granting nothing, and every page as not appearing", () => {
    const { gets, cannot } = allowed([]);
    expect(gets).toEqual([]);
    expect(cannot.slice(0, 16)).toEqual([
      "The Overview page does not appear.",
      "The Projects page does not appear.",
      "The Features page does not appear.",
      "The Releases page does not appear.",
      "The People page does not appear.",
      "The Org chart page does not appear.",
      "The Feature assignments page does not appear.",
      "The Drafts page does not appear.",
      "The Capacity page does not appear.",
      "The Lists page does not appear.",
      "The Accounts page does not appear.",
      "The Roles page does not appear.",
      "The Settings page does not appear.",
      "The Data classes page does not appear.",
      "The Change history page does not appear.",
      "The Access history page does not appear.",
    ]);
  });

  it("names the pages a role's permissions open, and only those others as not appearing", () => {
    const { gets, cannot } = allowed(["people:view", "administration:view"]);
    expect(gets).toEqual([
      "People",
      "Org chart",
      "Drafts",
      "Accounts",
      "Roles",
      "Settings",
      "Change history",
      "Access history",
    ]);
    expect(cannot).toContain("The Feature assignments page does not appear.");
    expect(cannot).not.toContain("The People page does not appear.");
    expect(
      allowed(["people:view", "feature-teams:view", "personal:view"]).gets,
    ).toEqual([
      "People",
      "Org chart",
      "Org chart on other dates",
      "Feature assignments",
      "Drafts",
      "Change history",
    ]);
  });

  it("adds the views a role gets, and says why it misses each other view on the pages it reaches", () => {
    const engineeringManager = allowed([
      "people:view",
      "feature-teams:view",
      "allocations:view",
      "personal:view",
    ]);
    expect(engineeringManager.gets).toEqual([
      "People",
      "Org chart",
      "Org chart on other dates",
      "Feature assignments",
      "Allocations",
      "Drafts",
      "Change history",
    ]);
    expect(engineeringManager.misses).toEqual([
      "Org chart on future dates: needs Confidential (Future reorganizations)",
      "Feature assignments grouped by manager: needs Confidential (Future reorganizations)",
    ]);
    const withoutPersonal = allowed(["feature-teams:view"]);
    // A page missed whole opens only to its line saying why.
    expect(withoutPersonal.gets).not.toContain("Feature assignments");
    expect(withoutPersonal.misses).toEqual([
      "Feature assignments: needs Personal (Start date, End date, Past managers, Feature team dates)",
      "Feature assignments grouped by manager: needs Personal (Start date, End date, Past managers, Feature team dates) and Confidential (Future reorganizations)",
    ]);
  });

  it("follows the classes the organization keeps its data in", () => {
    const general = {
      ...defaultClasses,
      futureReorganizations: "general" as const,
    };
    expect(
      consequences(["people:view", "personal:view"], general).misses,
    ).toEqual([]);
  });

  it("gives Personal views to a role that sees Personal data without People, on the pages it reaches", () => {
    expect(allowed(["feature-teams:view", "personal:view"]).misses).toEqual([
      "Feature assignments grouped by manager: needs Confidential (Future reorganizations)",
    ]);
  });

  it("says what its holders can do, in the grid's order, including what editing brings", () => {
    expect(allowed(["people:edit", "plan:view"]).can).toEqual([
      allows("plan:view"),
      allows("people:view"),
      allows("people:edit"),
    ]);
  });

  it("says once what an area the role does not reach at all is closed to", () => {
    const { cannot } = allowed([]);
    expect(cannot).toContain(without("plan:view"));
    expect(cannot).not.toContain(without("plan:edit"));
    expect(cannot).toContain(without("feature-teams:view"));
    expect(cannot).not.toContain(without("feature-teams:edit"));
    expect(cannot).not.toContain(without("feature-teams:approve"));
  });

  it("says each action missing on an area the role reaches in part", () => {
    const { can, cannot } = allowed(["feature-teams:edit"]);
    expect(can).toEqual([
      allows("feature-teams:view"),
      allows("feature-teams:edit"),
    ]);
    expect(cannot).toContain(without("feature-teams:approve"));
    expect(cannot).not.toContain(without("feature-teams:view"));
  });

  it("warns of each permission, granted or brought by another, that does nothing without one the role lacks", () => {
    expect(allowed(["personal:edit"]).ineffective).toEqual([
      "View Personal details does nothing without View People or View Feature teams.",
      "Edit Personal details does nothing without Edit People or Edit Feature teams.",
    ]);
  });

  it("gives no warning once the permission needed is granted, or brought by another", () => {
    expect(allowed(["personal:edit", "people:edit"]).ineffective).toEqual([]);
    expect(
      allowed(["personal:edit", "feature-teams:edit", "people:view"])
        .ineffective,
    ).toEqual([]);
    expect(allowed(["confidential:edit", "people:edit"]).ineffective).toEqual(
      [],
    );
  });

  it("warns that approving planned hires does nothing without seeing the hiring plan", () => {
    expect(allowed(["hiring-plan:approve", "people:view"]).ineffective).toEqual(
      ["Approve Hiring plan does nothing without View Hiring plan."],
    );
  });

  it("names every permission one could do something with, and is content with any of them", () => {
    expect(allowed(["drafts:approve-own"]).ineffective).toEqual([
      "Approve own drafts does nothing without Approve Plan, Approve Features and releases, Approve Allocations, Approve People, Approve Hiring plan, Approve Feature teams, or Approve Configuration.",
    ]);
    expect(
      allowed(["drafts:approve-own", "features:approve", "features:view"])
        .ineffective,
    ).toEqual([]);
  });
});

describe("what a change to an account's permissions does", () => {
  it("lists the pages it gains first, then what it gains", () => {
    expect(
      difference(
        ["people:view"],
        ["people:view", "administration:view", "administration:edit"],
      ),
    ).toEqual({
      gains: [
        "Sees the Accounts page.",
        "Sees the Roles page.",
        "Sees the Settings page.",
        "Sees the Access history page.",
        allows("administration:view"),
        allows("administration:edit"),
      ],
      losses: [],
    });
  });

  it("lists the pages it loses first, then what it loses", () => {
    expect(difference(["people:view"], [])).toEqual({
      gains: [],
      losses: [
        "The People page no longer appears.",
        "The Org chart page no longer appears.",
        "The Drafts page no longer appears.",
        "The Change history page no longer appears.",
        without("people:view"),
      ],
    });
  });

  it("lists gains and losses together, without pages that stay", () => {
    expect(difference(["people:view"], ["plan:view"])).toEqual({
      gains: [
        "Sees the Overview page.",
        "Sees the Projects page.",
        allows("plan:view"),
      ],
      losses: [
        "The People page no longer appears.",
        "The Org chart page no longer appears.",
        without("people:view"),
      ],
    });
  });

  it("finds nothing when nothing changes", () => {
    expect(difference(["plan:view"], ["plan:view"])).toEqual({
      gains: [],
      losses: [],
    });
  });
});
