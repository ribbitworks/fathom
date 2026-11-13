// SPDX-License-Identifier: Apache-2.0

// Roles as those who see and edit administration see and change them: listing roles with what they
// grant and how many active accounts hold them, which choosing each account's role also needs,
// creating roles, such as by copying another, changing a role's name,
// description, and what it grants, and working out what a change would do to each account before it
// is saved. Every change is recorded in the access history. A change that would leave no active
// account with Edit Administration is refused.

import {
  databaseCodes,
  type Database,
  hasDatabaseCode,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "@fathom/db";
import {
  type Permission,
  permissionSchema,
  type RoleEffects,
  type RoleChange,
  type RoleRequest,
  type RoleSummary,
  sameGrants,
  withImplied,
} from "@fathom/shared";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { type Actor, requirePermission } from "../access.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import type { Transaction } from "./changes.ts";
import { recordEvent } from "./history.ts";
import { keepAccessManaged, lockAccessManagers } from "./roles.ts";

export interface RoleAdministration {
  listRoles(actor: Actor): Promise<RoleSummary[]>;
  createRole(actor: Actor, role: RoleRequest): Promise<RoleSummary>;
  // Refused if the role has changed since the one making the change read it.
  updateRole(actor: Actor, id: string, role: RoleChange): Promise<RoleSummary>;
  // What giving a role these permissions would change for each active account holding it, without
  // saving anything.
  previewRole(
    actor: Actor,
    id: string,
    permissions: readonly Permission[],
  ): Promise<RoleEffects>;
}

const nameTaken = "A role with that name already exists";

// The permissions a role stores that the server knows, in the shared list's order.
const known = (stored: readonly string[]): Permission[] =>
  permissionSchema.options.filter((permission) => stored.includes(permission));

export function createRoleAdministration(
  database: Database,
): RoleAdministration {
  // Reads roles, all or one, with what they grant and how many active accounts hold them.
  async function readRoles(
    reader: Pick<Database, "select">,
    id?: string,
  ): Promise<RoleSummary[]> {
    const rows = await reader
      .select({
        id: roles.id,
        key: roles.key,
        name: roles.name,
        description: roles.description,
        updatedAt: roles.updatedAt,
      })
      .from(roles)
      .where(id === undefined ? undefined : eq(roles.id, id))
      .orderBy(asc(roles.name));
    const ids = rows.map((row) => row.id);
    if (ids.length === 0) return [];
    const [grants, holders] = await Promise.all([
      reader
        .select({
          roleId: rolePermissions.roleId,
          permission: rolePermissions.permission,
        })
        .from(rolePermissions)
        .where(inArray(rolePermissions.roleId, ids)),
      reader
        .select({
          roleId: userRoles.roleId,
          accounts: sql<number>`count(*)::int`,
        })
        .from(userRoles)
        .innerJoin(users, eq(users.id, userRoles.userId))
        .where(and(inArray(userRoles.roleId, ids), isNull(users.deactivatedAt)))
        .groupBy(userRoles.roleId),
    ]);
    return rows.map((row) => ({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
      permissions: known(
        grants
          .filter((grant) => grant.roleId === row.id)
          .map((grant) => grant.permission),
      ),
      accounts:
        holders.find((holder) => holder.roleId === row.id)?.accounts ?? 0,
    }));
  }

  async function readRole(
    reader: Pick<Database, "select">,
    id: string,
  ): Promise<RoleSummary> {
    const [role] = await readRoles(reader, id);
    if (role === undefined) throw new NotFoundError("There is no such role");
    return role;
  }

  // Refuses a name another role has, whatever its case, with a plain message rather than the
  // database's.
  async function checkName(
    transaction: Transaction,
    name: string,
    id?: string,
  ): Promise<void> {
    const [taken] = await transaction
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          sql`lower(${roles.name}) = lower(${name})`,
          id === undefined ? undefined : ne(roles.id, id),
        ),
      )
      .limit(1);
    if (taken !== undefined) throw new ConflictError(nameTaken);
  }

  async function grant(
    transaction: Transaction,
    roleId: string,
    permissions: readonly Permission[],
  ): Promise<void> {
    if (permissions.length === 0) return;
    await transaction
      .insert(rolePermissions)
      .values(permissions.map((permission) => ({ roleId, permission })));
  }

  // A name taken by a change saved at the same moment is refused like any other.
  async function refusingTakenNames<T>(change: () => Promise<T>): Promise<T> {
    try {
      return await change();
    } catch (error) {
      if (hasDatabaseCode(error, databaseCodes.uniqueViolation)) {
        throw new ConflictError(nameTaken);
      }
      throw error;
    }
  }

  return {
    async listRoles(actor) {
      requirePermission(actor, "administration:view");
      return readRoles(database);
    },

    async createRole(actor, { name, description, permissions }) {
      requirePermission(actor, "administration:edit");
      const id = await refusingTakenNames(() =>
        database.transaction(async (transaction) => {
          await checkName(transaction, name);
          const created = randomUUID();
          await transaction
            .insert(roles)
            .values({ id: created, name, description });
          await grant(transaction, created, permissions);
          await recordEvent(transaction, {
            actorId: actor.user.id,
            action: "role-created",
            subjectId: null,
            details: { role: name, granted: [...permissions] },
          });
          return created;
        }),
      );
      return readRole(database, id);
    },

    async updateRole(actor, id, { name, description, permissions, updatedAt }) {
      requirePermission(actor, "administration:edit");
      await readRole(database, id);
      await refusingTakenNames(() =>
        database.transaction(async (transaction) => {
          await lockAccessManagers(transaction);
          const previous = await readRole(transaction, id);
          if (previous.updatedAt !== updatedAt) {
            throw new ConflictError(
              "Someone else changed this role after it was opened; close it and open it again",
            );
          }
          const granted = permissions.filter(
            (permission) => !previous.permissions.includes(permission),
          );
          const withdrawn = previous.permissions.filter(
            (permission) => !permissions.includes(permission),
          );
          if (
            name === previous.name &&
            description === previous.description &&
            granted.length === 0 &&
            withdrawn.length === 0
          ) {
            return;
          }
          if (name !== previous.name) await checkName(transaction, name, id);
          await transaction
            .update(roles)
            .set({ name, description, updatedAt: new Date() })
            .where(eq(roles.id, id));
          // Permissions the server no longer knows grant nothing, and go when a role is saved.
          await transaction
            .delete(rolePermissions)
            .where(eq(rolePermissions.roleId, id));
          await grant(transaction, id, permissions);
          if (withdrawn.length > 0) {
            await keepAccessManaged(
              transaction,
              "Some active account must keep Edit Administration",
            );
          }
          await recordEvent(transaction, {
            actorId: actor.user.id,
            action: "role-changed",
            subjectId: null,
            details: {
              role: name,
              ...(name === previous.name
                ? {}
                : { previousName: previous.name }),
              granted,
              withdrawn,
            },
          });
        }),
      );
      return readRole(database, id);
    },

    async previewRole(actor, id, permissions) {
      requirePermission(actor, "administration:edit");
      const role = await readRole(database, id);
      const before = withImplied(role.permissions);
      const after = withImplied(permissions);
      if (sameGrants(before, after)) return { effects: [] };
      // Each account holds one role, so a change to it changes every active holder alike.
      const holders = await database
        .select({ id: users.id, name: users.name, email: users.email })
        .from(userRoles)
        .innerJoin(users, eq(users.id, userRoles.userId))
        .where(and(eq(userRoles.roleId, id), isNull(users.deactivatedAt)))
        .orderBy(asc(users.name), asc(users.email));
      return {
        effects: holders.map((account) => ({ account, before, after })),
      };
    },
  };
}
