// SPDX-License-Identifier: Apache-2.0

// Reads and gives the role each user holds, and what it grants. Part of the data access layer, the
// only server code that queries the database. Roles are kept in the database with the permissions
// they grant, read afresh on every request, so a change to a role takes effect at once. Each account
// holds exactly one role, any role, starting or made later.

import {
  type Database,
  rolePermissions,
  roles as roleTable,
  userRoles,
  users,
} from "@fathom/db";
import type { AccountRole } from "@fathom/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import { BadRequestError, ConflictError } from "../errors.ts";
import type { Transaction } from "./changes.ts";

// The role a user holds, with the key of the starting role it is, if any, and what it is for.
export interface HeldRole extends AccountRole {
  key: string | null;
  description: string;
}

// Takes the database or a transaction, which both read the same way. Null for an account with no
// role, which Fathom never makes.
export async function readRole(
  database: Pick<Database, "select">,
  userId: string,
): Promise<HeldRole | null> {
  const [held] = await database
    .select({
      id: roleTable.id,
      key: roleTable.key,
      name: roleTable.name,
      description: roleTable.description,
    })
    .from(userRoles)
    .innerJoin(roleTable, eq(roleTable.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));
  return held ?? null;
}

// The role with this ID, refused if there is none, so an account is never given a role that does not
// exist. Takes the database or a transaction, which both read the same way.
export async function findRole(
  database: Pick<Database, "select">,
  roleId: string,
): Promise<AccountRole> {
  const [found] = await database
    .select({ id: roleTable.id, name: roleTable.name })
    .from(roleTable)
    .where(eq(roleTable.id, roleId));
  if (found === undefined) throw new BadRequestError("There is no such role");
  return found;
}

// The ID of the starting role with this key, such as administrator, however it has been renamed.
export async function findStartingRole(
  database: Pick<Database, "select">,
  key: string,
): Promise<string> {
  const [found] = await database
    .select({ id: roleTable.id })
    .from(roleTable)
    .where(eq(roleTable.key, key));
  if (found === undefined) {
    throw new Error(`The starting role ${key} is missing from the database`);
  }
  return found.id;
}

// Gives an account its one role, in place of any it held. Takes the database or a transaction,
// which both write the same way.
export async function giveRole(
  database: Pick<Database, "insert">,
  userId: string,
  roleId: string,
): Promise<void> {
  await database
    .insert(userRoles)
    .values({ userId, roleId })
    .onConflictDoUpdate({
      target: userRoles.userId,
      set: { roleId, createdAt: new Date() },
    });
}

// What a signed-in user making a request holds: their role, and every permission it grants, as
// stored, and whether they must change their password before anything else.
export interface ActorAccess {
  role: HeldRole | null;
  permissions: string[];
  mustChangePassword: boolean;
}

// What a signed-in user making a request holds, or null if their account has been deactivated, so a
// session that outlives a deactivation, however briefly, grants nothing.
export async function readActorAccess(
  database: Database,
  userId: string,
): Promise<ActorAccess | null> {
  const [user] = await database
    .select({
      deactivatedAt: users.deactivatedAt,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (user === undefined || user.deactivatedAt !== null) return null;
  const [role, granted] = await Promise.all([
    readRole(database, userId),
    database
      .select({ permission: rolePermissions.permission })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .where(eq(userRoles.userId, userId)),
  ]);
  return {
    role,
    permissions: granted.map(({ permission }) => permission),
    mustChangePassword: user.mustChangePassword,
  };
}

// Changes that could leave nobody able to manage accounts, or to edit roles, wait for each other
// until their transaction ends, so two at once cannot each leave the other as the last such account
// and then remove it. Each takes this lock before any account's or role's row, so none waits on
// another in the opposite order. Relies on PostgreSQL's default isolation, under which each
// statement sees what the change before it saved.
export async function lockAccessManagers(
  transaction: Transaction,
): Promise<void> {
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended('fathom.administrators', 0))`,
  );
}

// The permissions that keep Fathom manageable: without an active account holding each, nobody could
// give anyone access again.
const keptPermissions = ["accounts:manage", "roles:edit"] as const;

// Refuses a change, made earlier in the same transaction, that leaves no active account whose role
// grants each of the permissions that keep Fathom manageable. Callers take lockAccessManagers first,
// and the refusal undoes the change.
export async function keepAccessManaged(
  transaction: Transaction,
  refusal: string,
): Promise<void> {
  for (const permission of keptPermissions) {
    const [holder] = await transaction
      .select({ id: users.id })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .where(
        and(
          eq(rolePermissions.permission, permission),
          isNull(users.deactivatedAt),
        ),
      )
      .limit(1);
    if (holder === undefined) throw new ConflictError(refusal);
  }
}
