// SPDX-License-Identifier: Apache-2.0

// What each role lets a user do, from the proposal in docs/product/roles.md, and the checks the data
// access layer makes. A user can do what any of their roles allows. Changing what a role grants
// changes this mapping and the test that spells it out; adding or renaming a role or permission also
// changes the shared lists in packages/shared.

import type { Permission, Role, Tier } from "@fathom/shared";
import { roleSchema } from "@fathom/shared";
import { ForbiddenError } from "./errors.ts";

// Every role must be listed, which the compiler checks.
const grants: Record<Role, readonly Permission[]> = {
  viewer: ["plan:view", "allocations:view", "changes:view"],
  "project-planner": ["plan:edit", "drafts:submit", "changes:view"],
  // Resource Planners see people, since they allocate them.
  "resource-planner": [
    "people:view",
    "allocations:edit",
    "drafts:submit",
    "changes:view",
  ],
  // People Managers edit feature teams directly until plan approval arrives, as Roles sets out.
  "people-manager": [
    "people:view",
    "feature-teams:propose",
    "feature-teams:edit",
    "restricted:view",
    "changes:view",
  ],
  "workforce-administrator": [
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
  leadership: [
    "people:view",
    "restricted:view",
    "confidential:view",
    "changes:view",
  ],
  approver: ["drafts:approve", "feature-teams:approve", "changes:view"],
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
  requireAnyPermission(actor, [permission]);
}

// Allows an actor whose roles grant at least one of the permissions.
export function requireAnyPermission(
  actor: Actor,
  permissions: readonly Permission[],
): void {
  if (!permissions.some((permission) => actor.permissions.includes(permission)))
    throw new ForbiddenError();
}

// The permissions that let a user see and change data of each tier. General people data comes with
// seeing and editing people.
const tierPermissions: Record<Tier, { view: Permission; edit: Permission }> = {
  general: { view: "people:view", edit: "people:edit" },
  restricted: { view: "restricted:view", edit: "restricted:edit" },
  confidential: { view: "confidential:view", edit: "confidential:edit" },
};

const tierRank: readonly Tier[] = ["general", "restricted", "confidential"];

// The most sensitive of some tiers, or General when there are none.
export function mostSensitive(tiers: readonly Tier[]): Tier {
  return tiers.reduce<Tier>(
    (most, tier) =>
      tierRank.indexOf(tier) > tierRank.indexOf(most) ? tier : most,
    "general",
  );
}

export function seesTier(actor: Actor, tier: Tier): boolean {
  // The tier is always one of the fixed tiers listed above.
  // eslint-disable-next-line security/detect-object-injection
  return actor.permissions.includes(tierPermissions[tier].view);
}

export function requireTierEdit(actor: Actor, tier: Tier): void {
  // eslint-disable-next-line security/detect-object-injection
  requirePermission(actor, tierPermissions[tier].edit);
}
