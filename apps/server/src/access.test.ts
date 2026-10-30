// SPDX-License-Identifier: Apache-2.0

// The specification of what each role lets a user do, from the proposal in docs/product/roles.md,
// checked one role at a time. A change to the roles changes this table and the mapping it checks,
// together. Also tests the permission check the data
// access layer makes.

import type { Permission, Role } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  actorFor,
  ForbiddenError,
  requirePermission,
  rolesGranting,
} from "./access.ts";

const user = {
  id: "user-1",
  name: "Fictional Person",
  email: "person@example.test",
};
const expected: [Role, Permission[]][] = [
  [
    "viewer",
    ["plan:view", "allocations:view", "people:view", "configuration:view"],
  ],
  ["project-planner", ["plan:edit", "drafts:submit"]],
  ["resource-planner", ["allocations:edit", "drafts:submit"]],
  [
    "people-manager",
    ["feature-teams:propose", "feature-teams:edit", "restricted:view"],
  ],
  [
    "workforce-administrator",
    [
      "people:edit",
      "feature-teams:edit",
      "feature-teams:approve",
      "restricted:view",
      "restricted:edit",
      "confidential:view",
      "confidential:edit",
      "configuration:edit",
    ],
  ],
  ["leadership", ["restricted:view", "confidential:view"]],
  ["approver", ["drafts:approve"]],
  // Running Fathom needs no access to people data, so Administrators hold Viewer only if given it.
  ["administrator", ["accounts:manage"]],
];

describe("what each role lets a user do on its own", () => {
  it.each(expected)("%s", (role, permissions) => {
    expect(actorFor(user, [role]).permissions).toEqual([...permissions].sort());
  });

  it("combines the permissions of every role a user holds", () => {
    const actor = actorFor(user, ["people-manager", "viewer"]);
    expect(actor.roles).toEqual(["viewer", "people-manager"]);
    expect(actor.permissions).toContain("plan:view");
    expect(actor.permissions).toContain("restricted:view");
    expect(actor.permissions).not.toContain("confidential:view");
  });

  it("names the roles that grant a permission", () => {
    expect(rolesGranting("confidential:view")).toEqual([
      "workforce-administrator",
      "leadership",
    ]);
    expect(rolesGranting("plan:view")).toEqual(["viewer"]);
  });
});

describe("permission checks", () => {
  it("allow an actor whose roles grant the permission", () => {
    expect(() => {
      requirePermission(actorFor(user, ["administrator"]), "accounts:manage");
    }).not.toThrow();
  });

  it("refuse an actor whose roles do not, as forbidden", () => {
    let refusal: unknown;
    try {
      requirePermission(actorFor(user, ["leadership"]), "accounts:manage");
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(ForbiddenError);
    expect(refusal).toMatchObject({ statusCode: 403, message: "Forbidden" });
  });
});
