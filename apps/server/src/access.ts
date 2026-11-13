// SPDX-License-Identifier: Apache-2.0

// What a user's active role lets them do, and the checks the data access layer makes. Each account
// holds one or more roles, and a session acts as one of them at a time, never several at once. Roles
// and what they grant are kept in the database, where they can be edited; the starting roles below
// are what the migrations stored, kept here for tests and seed data that act as a starting role
// without reading the database. Adding a permission changes the shared list in packages/shared,
// with its plain-English description.

import type {
  ClassifiedField,
  ClassifiedView,
  DataClasses,
  Permission,
  Role,
  Tier,
} from "@fathom/shared";
import {
  changesField,
  changesHiringPlan,
  defaultClasses,
  editsClass,
  roleSchema,
  seesClass,
  seesEmployment,
  seesField,
  seesHiringPlan,
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

// Who is making a request, the role they act as, what it lets them do, and the classes the
// organization keeps its built-in details in, which decide what those permissions reach. The role is
// null for an actor made without reading the database, as for tests.
export interface Actor {
  user: SignedInUser;
  roleId: string | null;
  permissions: Permission[];
  dataClasses: DataClasses;
}

// An actor whose active role grants the permissions given, as read from the database. A permission
// the server does not know grants nothing, rather than being trusted.
export function actorWith(
  user: SignedInUser,
  grantedPermissions: readonly string[],
  roleId: string | null = null,
  dataClasses: DataClasses = defaultClasses,
): Actor {
  return {
    user,
    roleId,
    permissions: withImplied(grantedPermissions).sort(),
    dataClasses,
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

// What lets a user see and change some data: its tier, or, for the hiring plan's own details, the
// hiring plan's permissions with its class, since the hiring plan is a permission area of its own,
// as the Decisions Log sets out.
export type Sensitivity = Tier | "hiring-plan";

// Whether a user sees and changes data of a class beyond General.
const classAccess = (dataClass: Exclude<Tier, "general">) => ({
  sees: (actor: Actor) => seesClass(actor.permissions, dataClass),
  edits: (actor: Actor) => editsClass(actor.permissions, dataClass),
});

// Whether a user sees and changes data of each sensitivity. General people data comes with seeing
// and editing people. Every sensitivity must be listed, which the compiler checks.
const sensitivityAccess: Record<
  Sensitivity,
  { sees: (actor: Actor) => boolean; edits: (actor: Actor) => boolean }
> = {
  general: {
    sees: (actor) => actor.permissions.includes("people:view"),
    edits: (actor) => actor.permissions.includes("people:edit"),
  },
  personal: classAccess("personal"),
  confidential: classAccess("confidential"),
  "hiring-plan": { sees: seesHiringPlan, edits: changesHiringPlan },
};

const accessOf = (sensitivity: Sensitivity) =>
  // The sensitivity is always one of the fixed sensitivities listed above.
  // eslint-disable-next-line security/detect-object-injection
  sensitivityAccess[sensitivity];

const tierRank: readonly Tier[] = ["general", "personal", "confidential"];

// A tier as stored, or, for one the server no longer knows, the most sensitive, rather than trusted.
export const storedTier = (value: unknown): Tier =>
  tierSchema.catch("confidential").parse(value);

// The tier of a sensitivity's data: for the hiring plan, the class the organization keeps it in.
export const tierOfSensitivity =
  (dataClasses: DataClasses) =>
  (sensitivity: Sensitivity): Tier =>
    sensitivity === "hiring-plan" ? dataClasses.hiringPlan : sensitivity;

// The most sensitive of some tiers, or General when there are none.
export function mostSensitive(tiers: readonly Tier[]): Tier {
  return tiers.reduce<Tier>(
    (most, tier) =>
      tierRank.indexOf(tier) > tierRank.indexOf(most) ? tier : most,
    "general",
  );
}

export const seesSensitivity = (
  actor: Actor,
  sensitivity: Sensitivity,
): boolean => accessOf(sensitivity).sees(actor);

// Whether the actor sees people's employment and their past managers, as the org chart draws them.
export const seesPeopleOverTime = (actor: Actor): boolean =>
  seesEmployment(actor) && seesField(actor, "managerHistory");

// Refuses changing a built-in detail to an actor who cannot see and change its class.
export function requireFieldEdit(actor: Actor, field: ClassifiedField): void {
  if (!changesField(actor, field)) throw new ForbiddenError();
}

export function requireSensitivityEdit(
  actor: Actor,
  sensitivity: Sensitivity,
): void {
  if (!accessOf(sensitivity).edits(actor)) throw new ForbiddenError();
}

// Refuses a page or view the actor's role does not see every class of data for, saying why.
export function requireView(actor: Actor, view: ClassifiedView): void {
  const why = whyMissing(view, actor);
  if (why !== undefined) throw new ForbiddenError(why);
}
