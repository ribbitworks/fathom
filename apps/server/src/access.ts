// SPDX-License-Identifier: Apache-2.0

// What a user's active role lets them do, and the checks the data access layer makes. Each account
// holds one or more roles, and a session acts as one of them at a time, never several at once. Roles
// and what they grant are kept in the database, where they can be edited; the starting roles below
// are what the migrations stored, kept here for tests and seed data that act as a starting role
// without reading the database. Adding a permission changes the shared list in packages/shared,
// with its plain-English description.

import type { ClassifiedView, Permission, Role, Tier } from "@fathom/shared";
import {
  classPermissions,
  roleSchema,
  seesClass,
  startingRoles,
  tierSchema,
  whyMissing,
  withImplied,
} from "@fathom/shared";
import { ForbiddenError } from "./errors.ts";

export interface SignedInUser {
  id: string;
  name: string;
  email: string;
}

// Who is making a request, the role they act as, and what it lets them do. The role is null for an
// actor made without reading the database, as for tests.
export interface Actor {
  user: SignedInUser;
  roleId: string | null;
  permissions: Permission[];
}

// An actor whose active role grants the permissions given, as read from the database. A permission
// the server does not know grants nothing, rather than being trusted.
export function actorWith(
  user: SignedInUser,
  grantedPermissions: readonly string[],
  roleId: string | null = null,
): Actor {
  return {
    user,
    roleId,
    permissions: withImplied(grantedPermissions).sort(),
  };
}

// An actor holding a starting role as Fathom first grants it, for tests and seed data.
export function actorFor(user: SignedInUser, role: Role): Actor {
  // The role is always one of the fixed roles.
  // eslint-disable-next-line security/detect-object-injection
  return actorWith(user, startingRoles[role].permissions);
}

// The starting roles that grant a permission.
export function rolesGranting(permission: Permission): Role[] {
  return roleSchema.options.filter((role) =>
    actorFor({ id: "", name: "", email: "" }, role).permissions.includes(
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

// What lets a user see and change some data: its tier, or, for the hiring plan's own details, which
// are Confidential, the hiring plan's permissions, since the hiring plan is a permission area of
// its own, as the Decisions Log sets out.
export type Sensitivity = Tier | "hiring-plan";

// The permissions that let a user see and change data of each sensitivity. General people data
// comes with seeing and editing people. Every sensitivity must be listed, which the compiler checks.
const sensitivityPermissions: Record<
  Sensitivity,
  { view: Permission; edit: Permission }
> = {
  general: { view: "people:view", edit: "people:edit" },
  ...classPermissions,
  "hiring-plan": { view: "hiring-plan:view", edit: "hiring-plan:edit" },
};

const permissionsOf = (sensitivity: Sensitivity) =>
  // The sensitivity is always one of the fixed sensitivities listed above.
  // eslint-disable-next-line security/detect-object-injection
  sensitivityPermissions[sensitivity];

const tierRank: readonly Tier[] = ["general", "personal", "confidential"];

// A tier as stored, or, for one the server no longer knows, the most sensitive, rather than trusted.
export const storedTier = (value: unknown): Tier =>
  tierSchema.catch("confidential").parse(value);

// The tier data of a sensitivity is recorded at: the hiring plan is Confidential.
export const tierOfSensitivity = (sensitivity: Sensitivity): Tier =>
  sensitivity === "hiring-plan" ? "confidential" : sensitivity;

// The most sensitive of some tiers, or General when there are none.
export function mostSensitive(tiers: readonly Tier[]): Tier {
  return tiers.reduce<Tier>(
    (most, tier) =>
      tierRank.indexOf(tier) > tierRank.indexOf(most) ? tier : most,
    "general",
  );
}

// Personal and Confidential data are seen as their classes are, the rest with their own permission.
export function seesSensitivity(
  actor: Actor,
  sensitivity: Sensitivity,
): boolean {
  return sensitivity === "personal" || sensitivity === "confidential"
    ? seesClass(actor.permissions, sensitivity)
    : actor.permissions.includes(permissionsOf(sensitivity).view);
}

export const seesPersonalDetails = (actor: Actor): boolean =>
  seesClass(actor.permissions, "personal");

export function requireSensitivityEdit(
  actor: Actor,
  sensitivity: Sensitivity,
): void {
  requirePermission(actor, permissionsOf(sensitivity).edit);
}

// Refuses a page or view the actor's role does not see every class of data for, saying why.
export function requireView(actor: Actor, view: ClassifiedView): void {
  const why = whyMissing(view, actor.permissions);
  if (why !== undefined) throw new ForbiddenError(why);
}
