// SPDX-License-Identifier: Apache-2.0

// Local accounts that sign in with a password: creating them, with the roles they hold, and the
// administration that needs the accounts:manage permission, which lists accounts, changes their
// names, email addresses, and roles, resets their passwords, and deactivates them. Administrators
// manage their own account like any other, except that the last active Administrator keeps the role
// and stays active, so no one can lock everyone out, and nobody resets their own password here.
// Public sign-up is turned off, so accounts are created here, through Better Auth's own storage,
// which hashes passwords.

import {
  accounts,
  type Database,
  roles as roleTable,
  userRoles,
  users,
} from "@fathom/db";
import { type Account, type Role, roleSchema } from "@fathom/shared";
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { type Actor, requirePermission } from "../access.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.ts";
import type { Auth } from "./auth.ts";
import type { Transaction } from "./changes.ts";
import { type HistoryEvent, recordEvent, recordEvents } from "./history.ts";
import { addRoles, readRoles } from "./roles.ts";

export interface NewAccount {
  name: string;
  email: string;
  password: string;
  roles?: readonly Role[];
}

async function checkPassword(auth: Auth, password: string): Promise<void> {
  const { minPasswordLength, maxPasswordLength } = (await auth.$context)
    .password.config;
  if (password.length < minPasswordLength) {
    throw new BadRequestError(
      `The password must have at least ${String(minPasswordLength)} characters`,
    );
  }
  if (password.length > maxPasswordLength) {
    throw new BadRequestError(
      `The password must have at most ${String(maxPasswordLength)} characters`,
    );
  }
}

// The email address as accounts store it, refused if it is not valid or another account uses it.
async function checkEmail(
  auth: Auth,
  email: string,
  ownerId?: string,
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  // An account with a mistyped email address could never sign in.
  if (!z.email().safeParse(normalized).success) {
    throw new BadRequestError("The email address is not valid");
  }
  const existing = await (
    await auth.$context
  ).internalAdapter.findUserByEmail(normalized);
  if (existing && existing.user.id !== ownerId) {
    throw new ConflictError(
      "An account with this email address already exists",
    );
  }
  return normalized;
}

// Creates an account, records who created it in the access history, and returns its identifier.
// The creator is null for the server's operators, as when the account command creates one.
export async function createAccount(
  auth: Auth,
  database: Database,
  { name, email, password, roles = [] }: NewAccount,
  createdBy: string | null = null,
): Promise<string> {
  const context = await auth.$context;
  await checkPassword(auth, password);
  const normalizedEmail = await checkEmail(auth, email);
  const user = await context.internalAdapter.createUser(
    { name: name.trim(), email: normalizedEmail, emailVerified: true },
    { method: "admin" },
  );
  try {
    await context.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await context.password.hash(password),
    });
    await database.transaction(async (transaction) => {
      await addRoles(transaction, user.id, roles);
      await recordEvent(transaction, {
        actorId: createdBy,
        action: "account-created",
        subjectId: user.id,
        details: { roles: [...roles] },
      });
    });
  } catch (error) {
    // An account without its password, roles, or history entry is not what was asked for, so it is
    // not kept.
    await context.internalAdapter.deleteUser(user.id);
    throw error;
  }
  return user.id;
}

// Deactivates or reactivates an account, recording who did it in the access history, and signs it
// out everywhere when deactivated. The actor is null for the server's operators, as when the
// development seed command does it. Callers check permissions first.
export async function setAccountActive(
  auth: Auth,
  database: Database,
  userId: string,
  active: boolean,
  actorId: string | null,
  // Runs first in the change's transaction, and refuses it by throwing.
  check: (transaction: Transaction) => Promise<void> = async () => {},
): Promise<void> {
  await database.transaction(async (transaction) => {
    await check(transaction);
    await transaction
      .update(users)
      .set({ deactivatedAt: active ? null : new Date() })
      .where(eq(users.id, userId));
    await recordEvent(transaction, {
      actorId,
      action: active ? "account-reactivated" : "account-deactivated",
      subjectId: userId,
    });
  });
  if (!active) {
    await (await auth.$context).internalAdapter.deleteUserSessions(userId);
  }
}

export interface AccountChange {
  name?: string | undefined;
  email?: string | undefined;
  roles?: readonly Role[] | undefined;
}

export interface AccountAdministration {
  listAccounts(actor: Actor): Promise<Account[]>;
  createAccount(actor: Actor, account: NewAccount): Promise<Account>;
  // Changes any of an account's name, email address, and roles together, recording each that
  // changes in the access history.
  updateAccount(
    actor: Actor,
    userId: string,
    change: AccountChange,
  ): Promise<Account>;
  // Signs the user out everywhere, so only the new password works.
  resetPassword(actor: Actor, userId: string, password: string): Promise<void>;
  // Deactivating signs the user out everywhere.
  setActive(actor: Actor, userId: string, active: boolean): Promise<Account>;
  // Changes the signed-in user's own name, which needs no role, recording it in the access history.
  // A name another account has is refused, so nobody can act under a colleague's name.
  renameSelf(actor: Actor, name: string): Promise<void>;
}

export function createAccountAdministration(
  database: Database,
  auth: Auth,
): AccountAdministration {
  // Reads through a transaction, holding the account's row until it ends, when given one.
  async function readAccount(
    userId: string,
    transaction?: Transaction,
  ): Promise<Account> {
    const query = (transaction ?? database)
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        deactivatedAt: users.deactivatedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    const [user] = await (transaction ? query.for("update") : query);
    if (user === undefined) throw new NotFoundError("There is no such account");
    const { deactivatedAt, createdAt, ...details } = user;
    return {
      ...details,
      createdAt: createdAt.toISOString(),
      roles: await readRoles(transaction ?? database, userId),
      active: deactivatedAt === null,
    };
  }

  // Changes to accounts that could remove an Administrator wait for each other until their
  // transaction ends, so two at once cannot each leave the other as the last Administrator and then
  // remove it. Each takes this lock before any account's row, so none waits on another in the
  // opposite order. Relies on PostgreSQL's default isolation, under which each statement sees what
  // the change before it saved.
  async function lockAdministrators(transaction: Transaction): Promise<void> {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended('fathom.administrators', 0))`,
    );
  }

  // Refuses a change that leaves an account without the Administrator role, or deactivated, when no
  // other active account holds the role. Callers take lockAdministrators first.
  async function keepAnAdministrator(
    transaction: Transaction,
    userId: string,
    refusal: string,
  ): Promise<void> {
    const [other] = await transaction
      .select({ id: users.id })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .innerJoin(roleTable, eq(roleTable.id, userRoles.roleId))
      .where(
        and(
          eq(roleTable.key, "administrator"),
          isNull(users.deactivatedAt),
          ne(users.id, userId),
        ),
      )
      .limit(1);
    if (other === undefined) throw new ConflictError(refusal);
  }

  async function signOutEverywhere(userId: string): Promise<void> {
    await (await auth.$context).internalAdapter.deleteUserSessions(userId);
  }

  return {
    async listAccounts(actor) {
      requirePermission(actor, "accounts:manage");
      const rows = await database
        .select({ id: users.id })
        .from(users)
        .orderBy(asc(users.name), asc(users.email));
      return Promise.all(rows.map(({ id }) => readAccount(id)));
    },

    async createAccount(actor, account) {
      requirePermission(actor, "accounts:manage");
      return readAccount(
        await createAccount(auth, database, account, actor.user.id),
      );
    },

    async updateAccount(actor, userId, change) {
      requirePermission(actor, "accounts:manage");
      await readAccount(userId);
      const changedEmail =
        change.email === undefined
          ? undefined
          : await checkEmail(auth, change.email, userId);
      await database.transaction(async (transaction) => {
        await lockAdministrators(transaction);
        const previous = await readAccount(userId, transaction);
        const name = change.name?.trim() ?? previous.name;
        const email = changedEmail ?? previous.email;
        const roles = roleSchema.options.filter((role) =>
          (change.roles ?? previous.roles).includes(role),
        );
        const rolesChanged =
          roles.length !== previous.roles.length ||
          roles.some((role) => !previous.roles.includes(role));
        const events: HistoryEvent[] = [
          ...(name === previous.name ? [] : ["name-changed" as const]),
          ...(email === previous.email ? [] : ["email-changed" as const]),
        ].map((action) => ({
          actorId: actor.user.id,
          action,
          subjectId: userId,
        }));
        if (rolesChanged) {
          events.push({
            actorId: actor.user.id,
            action: "roles-changed",
            subjectId: userId,
            details: { previousRoles: previous.roles, roles },
          });
        }
        if (events.length === 0) return;
        if (rolesChanged && !roles.includes("administrator")) {
          await keepAnAdministrator(
            transaction,
            userId,
            "The last active Administrator keeps the Administrator role",
          );
        }
        await transaction
          .update(users)
          .set({ name, email, updatedAt: new Date() })
          .where(eq(users.id, userId));
        if (rolesChanged) {
          // Only the starting roles are given here, so roles made later, which have no key, stay.
          await transaction
            .delete(userRoles)
            .where(
              and(
                eq(userRoles.userId, userId),
                inArray(
                  userRoles.roleId,
                  transaction
                    .select({ id: roleTable.id })
                    .from(roleTable)
                    .where(isNotNull(roleTable.key)),
                ),
              ),
            );
          await addRoles(transaction, userId, roles);
        }
        await recordEvents(transaction, events);
      });
      return readAccount(userId);
    },

    async resetPassword(actor, userId, password) {
      requirePermission(actor, "accounts:manage");
      // Changing one's own password needs the current one, so a session left open cannot be used
      // to take the account over.
      if (actor.user.id === userId) {
        throw new ForbiddenError(
          "Change your own password from your account, giving your current password",
        );
      }
      await readAccount(userId);
      await checkPassword(auth, password);
      const hash = await (await auth.$context).password.hash(password);
      // The new password and its history entry are saved together, so no reset goes unrecorded.
      await database.transaction(async (transaction) => {
        await transaction
          .update(accounts)
          .set({ password: hash, updatedAt: new Date() })
          .where(
            and(
              eq(accounts.userId, userId),
              eq(accounts.providerId, "credential"),
            ),
          );
        await recordEvent(transaction, {
          actorId: actor.user.id,
          action: "password-reset",
          subjectId: userId,
        });
      });
      await signOutEverywhere(userId);
    },

    async renameSelf(actor, name) {
      const userId = actor.user.id;
      const next = name.trim();
      // The name and its history entry are saved together, so no change goes unrecorded.
      await database.transaction(async (transaction) => {
        const previous = await readAccount(userId, transaction);
        if (next === previous.name) return;
        const [taken] = await transaction
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              sql`lower(${users.name}) = lower(${next})`,
              ne(users.id, userId),
            ),
          )
          .limit(1);
        if (taken !== undefined) {
          throw new ConflictError(
            "Another account already has that name; choose another",
          );
        }
        await transaction
          .update(users)
          .set({ name: next, updatedAt: new Date() })
          .where(eq(users.id, userId));
        await recordEvent(transaction, {
          actorId: userId,
          action: "own-name-changed",
          subjectId: userId,
        });
      });
    },

    async setActive(actor, userId, active) {
      requirePermission(actor, "accounts:manage");
      await readAccount(userId);
      await setAccountActive(
        auth,
        database,
        userId,
        active,
        actor.user.id,
        active
          ? undefined
          : async (transaction) => {
              await lockAdministrators(transaction);
              await keepAnAdministrator(
                transaction,
                userId,
                "The last active Administrator cannot be deactivated",
              );
            },
      );
      return readAccount(userId);
    },
  };
}
