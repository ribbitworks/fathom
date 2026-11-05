// SPDX-License-Identifier: Apache-2.0

// Reads and adds the roles users hold, and what their roles grant. Part of the data access layer, the
// only server code that queries the database. Roles are kept in the database with the permissions
// they grant, read afresh on every request, so a change to a role takes effect at once. A user's
// roles are also named by the key of the starting role each is, for showing; roles made later have
// no key and are known only by what they grant.

import {
  type Database,
  rolePermissions,
  roles as roleTable,
  userRoles,
  users,
} from "@fathom/db";
import { type Role, roleSchema } from "@fathom/shared";
import { eq, inArray } from "drizzle-orm";

// Takes the database or a transaction, which both read the same way.
export async function readRoles(
  database: Pick<Database, "select">,
  userId: string,
): Promise<Role[]> {
  const rows = await database
    .select({ role: roleTable.key })
    .from(userRoles)
    .innerJoin(roleTable, eq(roleTable.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));
  return rows.flatMap(({ role }) => {
    const known = roleSchema.safeParse(role);
    return known.success ? [known.data] : [];
  });
}

// Takes the database or a transaction, which both insert the same way. Every role asked for must
// exist, so an account never silently gets less than it was given.
export async function addRoles(
  database: Pick<Database, "insert" | "select">,
  userId: string,
  roles: readonly Role[],
): Promise<void> {
  if (roles.length === 0) return;
  const found = await database
    .select({ id: roleTable.id })
    .from(roleTable)
    .where(inArray(roleTable.key, [...roles]));
  if (found.length !== new Set(roles).size)
    throw new Error("A role to be given is missing from the database");
  await database
    .insert(userRoles)
    .values(found.map(({ id }) => ({ userId, roleId: id })))
    .onConflictDoNothing();
}

// What a signed-in user making a request holds: their roles' keys, and every permission their roles
// grant, as stored.
export interface ActorAccess {
  roles: Role[];
  permissions: string[];
}

// What a signed-in user making a request holds, or null if their account has been deactivated, so a
// session that outlives a deactivation, however briefly, grants nothing.
export async function readActorAccess(
  database: Database,
  userId: string,
): Promise<ActorAccess | null> {
  const [user] = await database
    .select({ deactivatedAt: users.deactivatedAt })
    .from(users)
    .where(eq(users.id, userId));
  if (user?.deactivatedAt !== null) return null;
  const [roles, granted] = await Promise.all([
    readRoles(database, userId),
    database
      .selectDistinct({ permission: rolePermissions.permission })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .where(eq(userRoles.userId, userId)),
  ]);
  return { roles, permissions: granted.map(({ permission }) => permission) };
}
