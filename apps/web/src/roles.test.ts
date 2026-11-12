// SPDX-License-Identifier: Apache-2.0

// Tests for what a role's permissions mean in plain English: the pages its holders see, what they
// can and cannot do, permissions that do nothing without another, and what an account gains and
// loses when what it may do changes.

import { type Permission, permissionDescriptions } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { consequences, difference } from "./roles.ts";

const allows = (permission: Permission) =>
  // The permission is always one of the shared list.
  // eslint-disable-next-line security/detect-object-injection
  permissionDescriptions[permission].allows;
const without = (permission: Permission) =>
  // eslint-disable-next-line security/detect-object-injection
  permissionDescriptions[permission].without;

describe("what a role allows", () => {
  it("lists no pages for a role granting nothing, and every page as not appearing", () => {
    const { pages, cannot } = consequences([]);
    expect(pages).toEqual([]);
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
    const { pages, cannot } = consequences([
      "people:view",
      "administration:view",
    ]);
    expect(pages).toEqual([
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
    expect(consequences(["people:view", "feature-teams:view"]).pages).toEqual([
      "People",
      "Org chart",
      "Feature assignments",
      "Drafts",
      "Change history",
    ]);
  });

  it("says what its holders can do, in the grid's order, including what editing brings", () => {
    expect(consequences(["people:edit", "plan:view"]).can).toEqual([
      allows("plan:view"),
      allows("people:view"),
      allows("people:edit"),
    ]);
  });

  it("says once what an area the role does not reach at all is closed to", () => {
    const { cannot } = consequences([]);
    expect(cannot).toContain(without("plan:view"));
    expect(cannot).not.toContain(without("plan:edit"));
    expect(cannot).toContain(without("feature-teams:view"));
    expect(cannot).not.toContain(without("feature-teams:edit"));
    expect(cannot).not.toContain(without("feature-teams:approve"));
  });

  it("says each action missing on an area the role reaches in part", () => {
    const { can, cannot } = consequences(["feature-teams:edit"]);
    expect(can).toEqual([
      allows("feature-teams:view"),
      allows("feature-teams:edit"),
    ]);
    expect(cannot).toContain(without("feature-teams:approve"));
    expect(cannot).not.toContain(without("feature-teams:view"));
  });

  it("warns of each permission, granted or brought by another, that does nothing without one the role lacks", () => {
    expect(consequences(["personal:edit"]).ineffective).toEqual([
      "View Personal details does nothing without View People.",
      "Edit Personal details does nothing without Edit People.",
    ]);
  });

  it("gives no warning once the permission needed is granted, or brought by another", () => {
    expect(consequences(["personal:view", "people:view"]).ineffective).toEqual(
      [],
    );
    expect(
      consequences(["confidential:edit", "people:edit"]).ineffective,
    ).toEqual([]);
  });

  it("warns that approving planned hires does nothing without seeing the hiring plan", () => {
    expect(
      consequences(["hiring-plan:approve", "people:view"]).ineffective,
    ).toEqual(["Approve Hiring plan does nothing without View Hiring plan."]);
  });

  it("names every permission one could do something with, and is content with any of them", () => {
    expect(consequences(["drafts:approve-own"]).ineffective).toEqual([
      "Approve Their own drafts does nothing without Approve Plan, Approve Features and releases, Approve Allocations, Approve People, Approve Hiring plan, Approve Feature teams, or Approve Configuration.",
    ]);
    expect(
      consequences(["drafts:approve-own", "features:approve", "features:view"])
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
