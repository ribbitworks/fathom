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
    expect(cannot.slice(0, 11)).toEqual([
      "The Overview page does not appear.",
      "The Projects page does not appear.",
      "The Releases page does not appear.",
      "The People page does not appear.",
      "The Drafts page does not appear.",
      "The Capacity page does not appear.",
      "The Lists page does not appear.",
      "The Accounts page does not appear.",
      "The Roles page does not appear.",
      "The Change history page does not appear.",
      "The Access history page does not appear.",
    ]);
  });

  it("names the pages a role's permissions open, and only those others as not appearing", () => {
    const { pages, cannot } = consequences(["people:view", "roles:edit"]);
    expect(pages).toEqual(["People", "Drafts", "Roles"]);
    expect(cannot).toContain("The Accounts page does not appear.");
    expect(cannot).not.toContain("The People page does not appear.");
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
    expect(cannot).toContain(without("feature-teams:propose"));
    expect(cannot).not.toContain(without("feature-teams:approve"));
    expect(cannot).not.toContain(without("feature-teams:edit"));
  });

  it("says each action missing on an area the role reaches in part", () => {
    const { can, cannot } = consequences(["feature-teams:propose"]);
    expect(can).toEqual([allows("feature-teams:propose")]);
    expect(cannot).toContain(without("feature-teams:approve"));
    expect(cannot).toContain(without("feature-teams:edit"));
    expect(cannot).not.toContain(without("feature-teams:propose"));
  });

  it("warns of each permission, granted or brought by another, that does nothing without one the role lacks", () => {
    expect(consequences(["restricted:edit"]).ineffective).toEqual([
      "View Restricted details does nothing without View People.",
      "Edit Restricted details does nothing without Edit People.",
    ]);
  });

  it("gives no warning once the permission needed is granted, or brought by another", () => {
    expect(
      consequences(["restricted:view", "people:view"]).ineffective,
    ).toEqual([]);
    expect(
      consequences(["confidential:edit", "people:edit"]).ineffective,
    ).toEqual([]);
  });
});

describe("what a change to an account's permissions does", () => {
  it("lists the pages it gains first, then what it gains", () => {
    expect(
      difference(
        ["changes:view"],
        ["changes:view", "people:view", "roles:edit"],
      ),
    ).toEqual({
      gains: [
        "Sees the People page.",
        "Sees the Drafts page.",
        "Sees the Roles page.",
        allows("people:view"),
        allows("roles:edit"),
      ],
      losses: [],
    });
  });

  it("lists the pages it loses first, then what it loses", () => {
    expect(
      difference(["changes:view", "people:view"], ["changes:view"]),
    ).toEqual({
      gains: [],
      losses: [
        "The People page no longer appears.",
        "The Drafts page no longer appears.",
        without("people:view"),
      ],
    });
  });

  it("lists gains and losses together, without pages that stay", () => {
    expect(
      difference(["people:view", "changes:view"], ["people:view", "plan:view"]),
    ).toEqual({
      gains: [
        "Sees the Overview page.",
        "Sees the Projects page.",
        "Sees the Releases page.",
        allows("plan:view"),
      ],
      losses: [
        "The Change history page no longer appears.",
        without("changes:view"),
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
