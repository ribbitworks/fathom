// SPDX-License-Identifier: Apache-2.0

// What each role lets a user do, from the proposal in docs/product/roles.md, and the checks the data
// access layer makes. A user can do what any of their roles allows. Changing what a role grants
// changes this mapping and the test that spells it out; adding or renaming a role or permission also
// changes the shared lists in packages/shared.

import type { Permission, Role } from "@fathom/shared";
import { roleSchema } from "@fathom/shared";
import { ForbiddenError } from "./errors.ts";

// Every role must be listed, which the compiler checks.
const grants: Record<Role, readonly Permission[]> = {
  viewer: [
    "plan:view",
    "allocations:view",
    "people:view",
    "configuration:view",
  ],
  "project-planner": ["plan:edit", "drafts:submit"],
  "resource-planner": ["allocations:edit", "drafts:submit"],
  // People Managers edit feature teams directly until plan approval arrives, as Roles sets out.
  "people-manager": [
    "feature-teams:propose",
    "feature-teams:edit",
    "restricted:view",
  ],
  "workforce-administrator": [
    "people:edit",
    "feature-teams:edit",
    "feature-teams:approve",
    "restricted:view",
    "restricted:edit",
    "confidential:view",
    "confidential:edit",
    "configuration:edit",
  ],
  leadership: ["restricted:view", "confidential:view"],
  approver: ["drafts:approve"],
  administrator: ["accounts:manage", "history:view"],
};

export interface SignedInUser {
  id: string;
  name: string;
  email: string;
}

// Who is making a request, and what their roles let them do.
export interface Actor {
  user: SignedInUser;
  roles: Role[];
  permissions: Permission[];
}

export function actorFor(
  user: SignedInUser,
  heldRoles: readonly Role[],
): Actor {
  const roles = roleSchema.options.filter((role) => heldRoles.includes(role));
  // The role is always one of the fixed roles listed above.
  // eslint-disable-next-line security/detect-object-injection
  const permissions = new Set(roles.flatMap((role) => grants[role]));
  return { user, roles, permissions: [...permissions].sort() };
}

// The roles that grant a permission on their own.
export function rolesGranting(permission: Permission): Role[] {
  return roleSchema.options.filter((role) =>
    actorFor({ id: "", name: "", email: "" }, [role]).permissions.includes(
      permission,
    ),
  );
}

export function requirePermission(actor: Actor, permission: Permission): void {
  if (!actor.permissions.includes(permission)) throw new ForbiddenError();
}
