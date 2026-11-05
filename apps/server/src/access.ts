// SPDX-License-Identifier: Apache-2.0

// What a user's roles let them do, and the checks the data access layer makes. A user can do what any
// of their roles allows. Roles and what they grant are kept in the database, where they can be
// edited; the starting roles below are what migration 0020 stored, kept here for tests and seed data
// that act as a starting role without reading the database. Adding a permission changes the shared
// list in packages/shared, with its plain-English description.

import type { Permission, Role, Tier } from "@fathom/shared";
import { permissionSchema, roleSchema, tierSchema } from "@fathom/shared";
import { ForbiddenError } from "./errors.ts";

// What each role Fathom starts with grants, as the migration that made roles editable stored it,
// which a test checks. Every role must be listed, which the compiler checks.
export const startingGrants: Record<Role, readonly Permission[]> = {
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
    "people:edit",
    "feature-teams:edit",
    "restricted:edit",
    "confidential:edit",
    "configuration:edit",
    "changes:view",
  ],
  leadership: [
    "people:view",
    "restricted:view",
    "confidential:view",
    "changes:view",
  ],
  // Approvers see lists, so every Approver can judge drafts of them.
  approver: [
    "drafts:approve",
    "feature-teams:approve",
    "configuration:view",
    "changes:view",
  ],
  administrator: ["accounts:manage", "history:view"],
};

// Editing data lets a user view it too, as Roles decides.
const viewedWhenEdited: Partial<Record<Permission, Permission>> = {
  "plan:edit": "plan:view",
  "allocations:edit": "allocations:view",
  "people:edit": "people:view",
  "restricted:edit": "restricted:view",
  "confidential:edit": "confidential:view",
  "configuration:edit": "configuration:view",
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

// An actor holding roles that grant the permissions given, as read from the database. A permission
// the server does not know grants nothing, rather than being trusted.
export function actorWith(
  user: SignedInUser,
  heldRoles: readonly Role[],
  grantedPermissions: readonly string[],
): Actor {
  const roles = roleSchema.options.filter((role) => heldRoles.includes(role));
  const granted = permissionSchema.options.filter((permission) =>
    grantedPermissions.includes(permission),
  );
  const permissions = new Set([
    ...granted,
    // The permission is always one of the fixed permissions listed above.
    // eslint-disable-next-line security/detect-object-injection
    ...granted.flatMap((permission) => viewedWhenEdited[permission] ?? []),
  ]);
  return { user, roles, permissions: [...permissions].sort() };
}

// An actor holding starting roles as Fathom first grants them, for tests and seed data.
export function actorFor(
  user: SignedInUser,
  heldRoles: readonly Role[],
): Actor {
  return actorWith(
    user,
    heldRoles,
    // The role is always one of the fixed roles listed above.
    // eslint-disable-next-line security/detect-object-injection
    heldRoles.flatMap((role) => startingGrants[role]),
  );
}

// The starting roles that grant a permission on their own.
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

// A tier as stored, or, for one the server no longer knows, the most sensitive, rather than trusted.
export const storedTier = (value: unknown): Tier =>
  tierSchema.catch("confidential").parse(value);

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
