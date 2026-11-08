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
  requireSensitivityEdit,
  rolesGranting,
  seesSensitivity,
  tierOfSensitivity,
} from "./access.ts";
import { ForbiddenError } from "./errors.ts";

const user = {
  id: "user-1",
  name: "Fictional Person",
  email: "person@example.test",
};
// What each starting role lets a user do, as the owner decided on 2026-11-07.
const expected: [Role, Permission[]][] = [
  ["team-member", ["plan:view", "allocations:view", "org-chart:view"]],
  [
    "product-manager",
    [
      "plan:view",
      "plan:edit",
      "plan:approve",
      "features:edit",
      "allocations:view",
      "org-chart:view",
      "drafts:submit",
      "changes:view",
    ],
  ],
  [
    "feature-lead",
    [
      "plan:view",
      "features:edit",
      "allocations:view",
      "allocations:edit",
      "people:view",
      "org-chart:view",
      "feature-teams:propose",
      "drafts:submit",
      "changes:view",
    ],
  ],
  [
    "project-manager",
    [
      "plan:view",
      "plan:edit",
      "plan:approve",
      "features:edit",
      "releases:approve",
      "allocations:view",
      "org-chart:view",
      "people:view",
      "people:approve",
      "feature-teams:approve",
      "hiring-plan:view",
      "hiring-plan:approve",
      "configuration:view",
      "configuration:approve",
      "drafts:submit",
      "changes:view",
    ],
  ],
  [
    "engineering-manager",
    [
      "plan:view",
      "plan:edit",
      "features:edit",
      "allocations:view",
      "allocations:edit",
      "org-chart:view",
      "people:view",
      "team-colours:edit",
      "feature-teams:propose",
      "restricted:view",
      "hiring-plan:view",
      "drafts:submit",
      "changes:view",
    ],
  ],
  // Everything but managing accounts, editing roles, and changing settings.
  [
    "engineering-director",
    [
      "plan:view",
      "plan:edit",
      "plan:approve",
      "features:edit",
      "releases:approve",
      "allocations:view",
      "allocations:edit",
      "people:view",
      "people:edit",
      "people:approve",
      "org-chart:view",
      "team-colours:edit",
      "feature-teams:propose",
      "feature-teams:edit",
      "feature-teams:approve",
      "restricted:view",
      "restricted:edit",
      "confidential:view",
      "confidential:edit",
      "hiring-plan:view",
      "hiring-plan:edit",
      "hiring-plan:approve",
      "configuration:view",
      "configuration:edit",
      "configuration:approve",
      "drafts:submit",
      "drafts:approve-own",
      "accounts:view",
      "roles:view",
      "settings:view",
      "history:view",
      "changes:view",
    ],
  ],
  [
    "workforce-administrator",
    [
      "plan:view",
      "allocations:view",
      "org-chart:view",
      "people:view",
      "people:edit",
      "team-colours:edit",
      "feature-teams:edit",
      "restricted:view",
      "restricted:edit",
      "confidential:view",
      "confidential:edit",
      "hiring-plan:view",
      "hiring-plan:edit",
      "configuration:view",
      "configuration:edit",
      "changes:view",
    ],
  ],
  // Every view, and nothing that changes or approves.
  [
    "executive",
    [
      "plan:view",
      "allocations:view",
      "people:view",
      "org-chart:view",
      "restricted:view",
      "confidential:view",
      "hiring-plan:view",
      "configuration:view",
      "accounts:view",
      "roles:view",
      "settings:view",
      "history:view",
      "changes:view",
    ],
  ],
  [
    "resource-planner",
    [
      "plan:view",
      "allocations:view",
      "allocations:edit",
      "org-chart:view",
      "people:view",
      "drafts:submit",
      "changes:view",
    ],
  ],
  // Running Fathom needs no access to people data or the plan.
  [
    "administrator",
    [
      "accounts:view",
      "accounts:manage",
      "roles:view",
      "roles:edit",
      "settings:view",
      "settings:edit",
      "history:view",
    ],
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
    expect(actorWith(user, ["plan:edit", "plan:approve"]).permissions).toEqual([
      "plan:approve",
      "plan:edit",
      "plan:view",
    ]);
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

describe("the hiring plan's permissions", () => {
  it("are apart from Confidential data's", () => {
    const viewer = actorWith(user, ["people:view", "hiring-plan:view"]);
    expect(seesSensitivity(viewer, "hiring-plan")).toBe(true);
    expect(seesSensitivity(viewer, "confidential")).toBe(false);
    expect(
      seesSensitivity(actorWith(user, ["confidential:edit"]), "hiring-plan"),
    ).toBe(false);
    expect(() => {
      requireSensitivityEdit(viewer, "hiring-plan");
    }).toThrow(ForbiddenError);
    expect(() => {
      requireSensitivityEdit(
        actorWith(user, ["hiring-plan:edit"]),
        "hiring-plan",
      );
    }).not.toThrow();
  });

  it("cover data recorded as Confidential", () => {
    expect(tierOfSensitivity("hiring-plan")).toBe("confidential");
    expect(tierOfSensitivity("restricted")).toBe("restricted");
  });
});
