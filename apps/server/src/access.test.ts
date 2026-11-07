// SPDX-License-Identifier: Apache-2.0

// The specification of what each starting role lets a user do, from docs/product/roles.md, checked one
// role at a time. A change to the starting roles changes this table and the mapping it checks,
// together. Also tests building a user's permissions from what their stored role grants, and the
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
// Each persona's role grants exactly what that persona's roles granted together before each account
// held one role, as the owner decided on 2026-11-06.
const expected: [Role, Permission[]][] = [
  ["team-member", ["plan:view", "allocations:view", "changes:view"]],
  [
    "planner",
    [
      "plan:view",
      "plan:edit",
      "allocations:view",
      "drafts:submit",
      "changes:view",
    ],
  ],
  [
    "project-manager",
    [
      "plan:view",
      "plan:edit",
      "allocations:view",
      "feature-teams:approve",
      "configuration:view",
      "drafts:submit",
      "drafts:approve",
      "changes:view",
    ],
  ],
  [
    "engineering-manager",
    [
      "plan:view",
      "plan:edit",
      "allocations:view",
      "allocations:edit",
      "people:view",
      "team-colours:edit",
      "feature-teams:propose",
      "feature-teams:edit",
      "restricted:view",
      "drafts:submit",
      "changes:view",
    ],
  ],
  [
    "engineering-director",
    [
      "plan:view",
      "plan:edit",
      "allocations:view",
      "allocations:edit",
      "people:view",
      "feature-teams:approve",
      "restricted:view",
      "confidential:view",
      "configuration:view",
      "drafts:submit",
      "drafts:approve",
      "changes:view",
    ],
  ],
  [
    "workforce-administrator",
    [
      "plan:view",
      "allocations:view",
      "people:view",
      "people:edit",
      "team-colours:edit",
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
    "executive",
    [
      "plan:view",
      "allocations:view",
      "people:view",
      "restricted:view",
      "confidential:view",
      "changes:view",
    ],
  ],
  [
    "resource-planner",
    [
      "plan:view",
      "allocations:view",
      "allocations:edit",
      "people:view",
      "drafts:submit",
      "changes:view",
    ],
  ],
  // Running Fathom needs no access to people data or the plan.
  [
    "administrator",
    ["accounts:manage", "roles:edit", "settings:edit", "history:view"],
  ],
];

describe("what each role lets a user do", () => {
  it.each(expected)("%s", (role, permissions) => {
    expect(actorFor(user, role).permissions).toEqual([...permissions].sort());
  });

  it.each(expected)("%s views everything it edits", (role) => {
    const { permissions } = actorFor(user, role);
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

  it("names the roles that grant a permission", () => {
    expect(rolesGranting("confidential:view")).toEqual([
      "engineering-director",
      "workforce-administrator",
      "executive",
    ]);
    expect(rolesGranting("accounts:manage")).toEqual(["administrator"]);
  });
});

describe("permissions from a stored role", () => {
  it("grants what the role stores, with viewing what may be edited", () => {
    expect(
      actorWith(user, ["plan:edit", "drafts:approve"]).permissions,
    ).toEqual(["drafts:approve", "plan:edit", "plan:view"]);
  });

  it("ignores a permission the server does not know", () => {
    expect(
      actorWith(user, ["retired:permission", "history:view"]).permissions,
    ).toEqual(["history:view"]);
  });
});

describe("permission checks", () => {
  it("allow an actor whose role grants the permission", () => {
    expect(() => {
      requirePermission(actorFor(user, "administrator"), "accounts:manage");
    }).not.toThrow();
  });

  it("refuse an actor whose role does not, as forbidden", () => {
    let refusal: unknown;
    try {
      requirePermission(actorFor(user, "executive"), "accounts:manage");
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(ForbiddenError);
    expect(refusal).toMatchObject({ statusCode: 403, message: "Forbidden" });
  });

  it("allow an actor whose role grants any one of several permissions", () => {
    expect(() => {
      requireAnyPermission(actorFor(user, "executive"), [
        "configuration:view",
        "people:view",
      ]);
    }).not.toThrow();
  });

  it("refuse an actor whose role grants none of several permissions", () => {
    expect(() => {
      requireAnyPermission(actorFor(user, "team-member"), [
        "configuration:view",
        "people:view",
      ]);
    }).toThrow(ForbiddenError);
  });
});
