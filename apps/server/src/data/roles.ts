// SPDX-License-Identifier: Apache-2.0

// Reads and adds the roles users hold. Part of the data access layer, the only server code that
// queries the database. Roles are kept in the database; until what each grants is read from there
// too, the server knows a role by the key of the starting role it is, and a role without a key it
// knows grants nothing, rather than being trusted.

import {
  type Database,
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

// The roles of a signed-in user making a request, or null if their account has been deactivated, so
// a session that outlives a deactivation, however briefly, grants nothing.
export async function readActorRoles(
  database: Database,
  userId: string,
): Promise<Role[] | null> {
  const [user] = await database
    .select({ deactivatedAt: users.deactivatedAt })
    .from(users)
    .where(eq(users.id, userId));
  if (user?.deactivatedAt !== null) return null;
  return readRoles(database, userId);
}
