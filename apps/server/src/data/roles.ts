// SPDX-License-Identifier: Apache-2.0

// Reads and gives the roles each user holds, and what the one a session acts as grants. Part of the
// data access layer, the only server code that queries the database. Roles are kept in the database
// with the permissions they grant, read afresh on every request, so a change to a role takes effect
// at once. Each account holds one or more roles, any role, starting or made later, one of them its
// default; a session acts as one of them at a time, and only that one's permissions apply.

import {
  type Database,
  rolePermissions,
  roles as roleTable,
  sessions,
  userRoles,
  users,
} from "@fathom/db";
import type { AccountRole, DataClasses } from "@fathom/shared";
import { and, asc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { BadRequestError, ConflictError, NotFoundError } from "../errors.ts";
import type { Transaction } from "./changes.ts";
import { readDataClasses } from "./data-classes.ts";
import { recordEvent, recordEvents } from "./history.ts";

// A role a user holds, with the key of the starting role it is, if any, and what it is for.
export interface HeldRole extends AccountRole {
  key: string | null;
  description: string;
}

// The roles an account holds, by name, and its default, null only for an account with no role,
// which Fathom never makes.
export interface HeldRoles {
  roles: HeldRole[];
  defaultRoleId: string | null;
}

// Takes the database or a transaction, which both read the same way.
export async function readRoles(
  database: Pick<Database, "select">,
  userId: string,
): Promise<HeldRoles> {
  const held = await database
    .select({
      id: roleTable.id,
      key: roleTable.key,
      name: roleTable.name,
      description: roleTable.description,
      isDefault: userRoles.isDefault,
    })
    .from(userRoles)
    .innerJoin(roleTable, eq(roleTable.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))
    .orderBy(asc(roleTable.name));
  return {
    roles: held.map(({ id, key, name, description }) => ({
      id,
      key,
      name,
      description,
    })),
    defaultRoleId: held.find(({ isDefault }) => isDefault)?.id ?? null,
  };
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

export const defaultRoleOutside =
  "The default role must be one of the account's roles";

// Gives an account its roles, in place of any it held, with one of them its default, which callers
// check is among them. Each role must exist. Takes the database or a transaction.
export async function giveRoles(
  database: Pick<Database, "insert" | "update" | "delete">,
  userId: string,
  roleIds: readonly string[],
  defaultRoleId: string,
): Promise<void> {
  await database
    .delete(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        notInArray(userRoles.roleId, [...roleIds]),
      ),
    );
  // The old default is cleared before the new one is set, since the database refuses two at once.
  await database
    .update(userRoles)
    .set({ isDefault: false })
    .where(eq(userRoles.userId, userId));
  await database
    .insert(userRoles)
    .values(roleIds.map((roleId) => ({ userId, roleId })))
    .onConflictDoNothing();
  await database
    .update(userRoles)
    .set({ isDefault: true })
    .where(
      and(eq(userRoles.userId, userId), eq(userRoles.roleId, defaultRoleId)),
    );
}

// Gives an account one role, its default, in place of any it held.
export const giveRole = (
  database: Pick<Database, "insert" | "update" | "delete">,
  userId: string,
  roleId: string,
) => giveRoles(database, userId, [roleId], roleId);

// What a signed-in user making a request holds: the role their session acts as, the roles they may
// switch to, and their default, the permissions the active role grants, as stored, and whether they
// must change their password before anything else.
export interface ActorAccess extends Omit<HeldRoles, "roles"> {
  role: HeldRole | null;
  roles: AccountRole[];
  permissions: string[];
  dataClasses: DataClasses;
  mustChangePassword: boolean;
}

// The role a session acts as: the one it acts as already, while the account still holds it, or, the
// first time, the role remembered from the browser's last choice, if the account holds it, or else
// its default.
function activeRole(
  held: HeldRoles,
  candidates: readonly (string | null | undefined)[],
): HeldRole | null {
  const chosen = [...candidates, held.defaultRoleId].find((id) =>
    held.roles.some((role) => role.id === id),
  );
  return held.roles.find(({ id }) => id === chosen) ?? null;
}

// What a signed-in user making a request holds, or null if their account has been deactivated, so a
// session that outlives a deactivation, however briefly, grants nothing. Picks the session's role
// the first time, or again when the account no longer holds it, and keeps it on the session.
export async function readActorAccess(
  database: Database,
  userId: string,
  sessionId: string,
  rememberedRoleId?: string,
): Promise<ActorAccess | null> {
  const [user] = await database
    .select({
      deactivatedAt: users.deactivatedAt,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (user === undefined || user.deactivatedAt !== null) return null;
  const [held, [session]] = await Promise.all([
    readRoles(database, userId),
    database
      .select({ activeRoleId: sessions.activeRoleId })
      .from(sessions)
      .where(eq(sessions.id, sessionId)),
  ]);
  const current = session?.activeRoleId ?? null;
  const role = activeRole(held, [current, rememberedRoleId]);
  if (role !== null && role.id !== current) {
    // Changed only if no other request changed it first, so each change is recorded once.
    const changed = await database
      .update(sessions)
      .set({ activeRoleId: role.id })
      .where(
        and(
          eq(sessions.id, sessionId),
          current === null
            ? isNull(sessions.activeRoleId)
            : eq(sessions.activeRoleId, current),
        ),
      )
      .returning({ id: sessions.id });
    // The role a session starts as is recorded as signing in, so the history shows the role used
    // for the whole session. A session whose role the account no longer holds moves to another,
    // which is recorded as a switch, as the user's own switches are.
    const recorded =
      current === null
        ? { action: "signed-in" as const, details: { role: role.name } }
        : {
            action: "role-switched" as const,
            details: {
              role: role.name,
              previousRole: (await findRole(database, current)).name,
            },
          };
    await recordEvents(
      database,
      changed.map(() => ({ actorId: userId, subjectId: userId, ...recorded })),
    );
  }
  const granted =
    role === null
      ? []
      : await database
          .select({ permission: rolePermissions.permission })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, role.id));
  return {
    role,
    roles: held.roles.map(({ id, name }) => ({ id, name })),
    defaultRoleId: held.defaultRoleId,
    permissions: granted.map(({ permission }) => permission),
    dataClasses: await readDataClasses(database),
    mustChangePassword: user.mustChangePassword,
  };
}

// Gives the session a password change starts the role the session it replaces acted as, so the
// change is neither a new sign-in nor a change of role.
export async function keepSessionRole(
  database: Pick<Database, "update">,
  token: string,
  roleId: string | null,
): Promise<void> {
  await database
    .update(sessions)
    .set({ activeRoleId: roleId })
    .where(eq(sessions.token, token));
}

// Switches a session to another of its account's roles, recording the switch in the access history.
// A role the account does not hold is not found, so whether it exists is not revealed; switching to
// the role already acted as changes nothing.
export async function switchRole(
  database: Database,
  userId: string,
  sessionId: string,
  roleId: string,
): Promise<void> {
  await database.transaction(async (transaction) => {
    const [session] = await transaction
      .select({ activeRoleId: sessions.activeRoleId })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .for("update");
    const { roles } = await readRoles(transaction, userId);
    const role = roles.find(({ id }) => id === roleId);
    if (session === undefined || role === undefined) {
      throw new NotFoundError("This account doesn't have that role");
    }
    if (session.activeRoleId === roleId) return;
    const previous = roles.find(({ id }) => id === session.activeRoleId);
    await transaction
      .update(sessions)
      .set({ activeRoleId: roleId })
      .where(eq(sessions.id, sessionId));
    await recordEvent(transaction, {
      actorId: userId,
      action: "role-switched",
      subjectId: userId,
      details: {
        role: role.name,
        ...(previous === undefined ? {} : { previousRole: previous.name }),
      },
    });
  });
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

// Refuses a change, made earlier in the same transaction, that leaves no active account with a role
// that grants each of the permissions that keep Fathom manageable. Callers take lockAccessManagers
// first, and the refusal undoes the change.
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
