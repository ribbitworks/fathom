// SPDX-License-Identifier: Apache-2.0

// The specification of what each starting role lets a user do, from docs/product/roles.md, checked one
// role at a time. A change to the starting roles changes this table and the mapping it checks,
// together. Also tests building a user's permissions from what their stored roles grant, and the
// permission checks the data access layer makes.

import { type Permission, permissionSchema, type Role } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  actorFor,
  actorWith,
  requireAnyPermission,
  requirePermission,
  rolesGranting,
} from "./access.ts";
import { ForbiddenError } from "./errors.ts";

const user = {
  id: "user-1",
  name: "Fictional Person",
  email: "person@example.test",
};
const expected: [Role, Permission[]][] = [
  ["viewer", ["plan:view", "allocations:view", "changes:view"]],
  [
    "project-planner",
    ["plan:view", "plan:edit", "drafts:submit", "changes:view"],
  ],
  [
    "resource-planner",
    [
      "people:view",
      "allocations:view",
      "allocations:edit",
      "drafts:submit",
      "changes:view",
    ],
  ],
  [
    "people-manager",
    [
      "people:view",
      "feature-teams:propose",
      "feature-teams:edit",
      "restricted:view",
      "changes:view",
    ],
  ],
  [
    "workforce-administrator",
    [
      "people:view",
      "people:edit",
      "feature-teams:edit",
      "restricted:view",
      "restricted:edit",
      "confidential:view",
      "confidential:edit",
      "configuration:view",
      "configuration:edit",
      "changes:view",
    ],
  ],
  [
    "leadership",
    ["people:view", "restricted:view", "confidential:view", "changes:view"],
  ],
  [
    "approver",
    [
      "drafts:approve",
      "feature-teams:approve",
      "configuration:view",
      "changes:view",
    ],
  ],
  // Running Fathom needs no access to people data, so Administrators hold Viewer only if given it.
  ["administrator", ["accounts:manage", "roles:edit", "history:view"]],
];

describe("what each role lets a user do on its own", () => {
  it.each(expected)("%s", (role, permissions) => {
    expect(actorFor(user, [role]).permissions).toEqual([...permissions].sort());
  });

  it.each(expected)("%s views everything it edits", (role) => {
    const { permissions } = actorFor(user, [role]);
    const edited = permissions.filter((permission) =>
      permission.endsWith(":edit"),
    );
    for (const permission of edited) {
      const view = permission.replace(/:edit$/, ":view");
      if (permissionSchema.safeParse(view).success) {
        expect(permissions).toContain(view);
      }
    }
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
    expect(rolesGranting("plan:view")).toEqual(["viewer", "project-planner"]);
  });
});

describe("permissions from stored roles", () => {
  it("grants what the roles store, with viewing what may be edited, whatever roles are named", () => {
    const actor = actorWith(user, [], ["plan:edit", "drafts:approve"]);
    expect(actor.roles).toEqual([]);
    expect(actor.permissions).toEqual([
      "drafts:approve",
      "plan:edit",
      "plan:view",
    ]);
  });

  it("ignores a permission the server does not know, and names only known roles", () => {
    const actor = actorWith(
      user,
      ["viewer", "retired-role" as Role],
      ["retired:permission", "history:view"],
    );
    expect(actor.roles).toEqual(["viewer"]);
    expect(actor.permissions).toEqual(["history:view"]);
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

  it("allow an actor whose roles grant any one of several permissions", () => {
    expect(() => {
      requireAnyPermission(actorFor(user, ["leadership"]), [
        "configuration:view",
        "people:view",
      ]);
    }).not.toThrow();
  });

  it("refuse an actor whose roles grant none of several permissions", () => {
    expect(() => {
      requireAnyPermission(actorFor(user, ["viewer"]), [
        "configuration:view",
        "people:view",
      ]);
    }).toThrow(ForbiddenError);
  });
});
