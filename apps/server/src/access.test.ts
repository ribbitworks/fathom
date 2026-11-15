// SPDX-License-Identifier: Apache-2.0

// The specification of what each starting role lets a user do, from docs/product/roles.md, checked one
// role at a time. A change to the starting roles changes this table and the mapping it checks,
// together. Also tests building a user's permissions from what their stored role grants, and the
// permission checks the data access layer makes.

import {
  defaultClasses,
  type Permission,
  permissionSchema,
  type Role,
  type Tier,
} from "@fathom/shared";
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
  id: "10000000-0000-4000-8000-000000000001",
  name: "Fictional Person",
  email: "person@example.test",
};
// What each starting role lets a user do, as docs/product/roles.md sets out.
const expected: [Role, Permission[]][] = [
  [
    "team-member",
    [
      "plan:view",
      "features:view",
      "allocations:view",
      "people:view",
      "feature-teams:view",
    ],
  ],
  [
    "product-manager",
    [
      "plan:view",
      "plan:edit",
      "plan:approve",
      "features:view",
      "features:edit",
      "features:approve",
      "allocations:view",
      "people:view",
      "feature-teams:view",
      "configuration:view",
    ],
  ],
  [
    "feature-lead",
    [
      "plan:view",
      "features:view",
      "features:edit",
      "people:view",
      "feature-teams:view",
      "feature-teams:edit",
    ],
  ],
  [
    "project-manager",
    [
      "plan:view",
      "plan:edit",
      "plan:approve",
      "features:view",
      "features:edit",
      "features:approve",
      "allocations:view",
      "allocations:approve",
      "people:view",
      "people:approve",
      "feature-teams:view",
      "feature-teams:approve",
      "hiring-plan:view",
      "hiring-plan:approve",
      "configuration:view",
      "configuration:approve",
      "personal:view",
      "confidential:view",
    ],
  ],
  [
    "engineering-manager",
    [
      "plan:view",
      "plan:edit",
      "features:view",
      "features:edit",
      "allocations:view",
      "allocations:edit",
      "people:view",
      "feature-teams:view",
      "feature-teams:edit",
      "hiring-plan:view",
      "configuration:view",
      "personal:view",
      "confidential:view",
    ],
  ],
  [
    "engineering-director",
    [
      "plan:view",
      "plan:edit",
      "plan:approve",
      "features:view",
      "features:edit",
      "features:approve",
      "allocations:view",
      "allocations:edit",
      "allocations:approve",
      "people:view",
      "people:edit",
      "people:approve",
      "feature-teams:view",
      "feature-teams:edit",
      "feature-teams:approve",
      "hiring-plan:view",
      "hiring-plan:edit",
      "hiring-plan:approve",
      "configuration:view",
      "configuration:edit",
      "configuration:approve",
      "administration:view",
      "personal:view",
      "personal:edit",
      "confidential:view",
      "confidential:edit",
      "data:classify",
      "drafts:approve-own",
    ],
  ],
  [
    "workforce-administrator",
    [
      "plan:view",
      "features:view",
      "allocations:view",
      "people:view",
      "people:edit",
      "feature-teams:view",
      "feature-teams:edit",
      "hiring-plan:view",
      "hiring-plan:edit",
      "configuration:view",
      "configuration:edit",
      "personal:view",
      "personal:edit",
      "confidential:view",
      "confidential:edit",
      "data:classify",
    ],
  ],
  [
    "executive",
    [
      "plan:view",
      "features:view",
      "allocations:view",
      "people:view",
      "feature-teams:view",
      "hiring-plan:view",
      "configuration:view",
      "administration:view",
      "personal:view",
      "confidential:view",
    ],
  ],
  ["administrator", ["administration:view", "administration:edit"]],
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
      "project-manager",
      "engineering-manager",
      "engineering-director",
      "workforce-administrator",
      "executive",
    ]);
    expect(rolesGranting("administration:edit")).toEqual(["administrator"]);
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
      actorWith(user, ["retired:permission", "administration:view"])
        .permissions,
    ).toEqual(["administration:view"]);
  });
});

describe("permission checks", () => {
  it("allow an actor whose role grants the permission", () => {
    expect(() => {
      requirePermission(actorFor(user, "administrator"), "administration:edit");
    }).not.toThrow();
  });

  it("refuse an actor whose role does not, as forbidden", () => {
    let refusal: unknown;
    try {
      requirePermission(actorFor(user, "executive"), "administration:edit");
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
        "hiring-plan:view",
      ]);
    }).toThrow(ForbiddenError);
  });
});

describe("the hiring plan's permissions", () => {
  const hiringPlanIn = (dataClass: Tier) => ({
    ...defaultClasses,
    hiringPlan: dataClass,
  });

  it("are apart from Confidential data's", () => {
    const viewer = actorWith(user, ["people:view", "confidential:edit"]);
    expect(seesSensitivity(viewer, "confidential")).toBe(true);
    expect(seesSensitivity(viewer, "hiring-plan")).toBe(false);
    expect(() => {
      requireSensitivityEdit(viewer, "hiring-plan");
    }).toThrow(ForbiddenError);
  });

  it("show the hiring plan only with its class", () => {
    const viewer = actorWith(user, ["people:view", "hiring-plan:view"]);
    expect(seesSensitivity(viewer, "hiring-plan")).toBe(false);
    expect(
      seesSensitivity(
        actorWith(user, [...viewer.permissions, "confidential:view"]),
        "hiring-plan",
      ),
    ).toBe(true);
    expect(
      seesSensitivity(
        actorWith(user, viewer.permissions, null, hiringPlanIn("general")),
        "hiring-plan",
      ),
    ).toBe(true);
  });

  it("change the hiring plan only with Edit on its class", () => {
    const editor = actorWith(user, ["hiring-plan:edit", "confidential:view"]);
    expect(() => {
      requireSensitivityEdit(editor, "hiring-plan");
    }).toThrow(ForbiddenError);
    expect(() => {
      requireSensitivityEdit(
        actorWith(user, [...editor.permissions, "confidential:edit"]),
        "hiring-plan",
      );
    }).not.toThrow();
    expect(() => {
      requireSensitivityEdit(
        actorWith(user, ["hiring-plan:edit"], null, hiringPlanIn("general")),
        "hiring-plan",
      );
    }).not.toThrow();
  });

  it("keep the hiring plan in its class", () => {
    expect(tierOfSensitivity(defaultClasses)("hiring-plan")).toBe(
      "confidential",
    );
    expect(tierOfSensitivity(hiringPlanIn("personal"))("hiring-plan")).toBe(
      "personal",
    );
    expect(tierOfSensitivity(defaultClasses)("personal")).toBe("personal");
  });
});
