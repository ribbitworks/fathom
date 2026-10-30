// SPDX-License-Identifier: Apache-2.0

// Reads and adds the roles users hold. Part of the data access layer, the only server
// code that queries the database. A role name the server no longer knows, such as one renamed
// before going live, is ignored rather than trusted.

import { type Database, userRoles } from "@fathom/db";
import { type Role, roleSchema } from "@fathom/shared";
import { eq } from "drizzle-orm";

export async function readRoles(
  database: Database,
  userId: string,
): Promise<Role[]> {
  const rows = await database
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.flatMap(({ role }) => {
    const known = roleSchema.safeParse(role);
    return known.success ? [known.data] : [];
  });
}

export async function addRoles(
  database: Database,
  userId: string,
  roles: readonly Role[],
): Promise<void> {
  if (roles.length === 0) return;
  await database
    .insert(userRoles)
    .values(roles.map((role) => ({ userId, role })))
    .onConflictDoNothing();
}
