// SPDX-License-Identifier: Apache-2.0

// Local accounts that sign in with a password: creating them, with the roles they hold, and the
// administration that needs the accounts:manage permission, which lists accounts, changes their
// roles, resets their passwords, and deactivates them. Nobody changes their own roles or deactivates
// themselves, so no one can raise their own access or lock everyone out. Public sign-up is turned
// off, so accounts are created here, through Better Auth's own storage, which hashes passwords.

import { accounts, type Database, userRoles, users } from "@fathom/db";
import type { Account, Role } from "@fathom/shared";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { type Actor, requirePermission } from "../access.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.ts";
import type { Auth } from "./auth.ts";
import { recordEvent } from "./history.ts";
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
  const normalizedEmail = email.trim().toLowerCase();
  // An account with a mistyped email address could never sign in.
  if (!z.email().safeParse(normalizedEmail).success) {
    throw new BadRequestError("The email address is not valid");
  }
  if (await context.internalAdapter.findUserByEmail(normalizedEmail)) {
    throw new ConflictError(
      "An account with this email address already exists",
    );
  }
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
): Promise<void> {
  await database.transaction(async (transaction) => {
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

export interface AccountAdministration {
  listAccounts(actor: Actor): Promise<Account[]>;
  createAccount(actor: Actor, account: NewAccount): Promise<Account>;
  setRoles(
    actor: Actor,
    userId: string,
    roles: readonly Role[],
  ): Promise<Account>;
  // Signs the user out everywhere, so only the new password works.
  resetPassword(actor: Actor, userId: string, password: string): Promise<void>;
  // Deactivating signs the user out everywhere.
  setActive(actor: Actor, userId: string, active: boolean): Promise<Account>;
}

export function createAccountAdministration(
  database: Database,
  auth: Auth,
): AccountAdministration {
  async function readAccount(userId: string): Promise<Account> {
    const [user] = await database
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        deactivatedAt: users.deactivatedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (user === undefined) throw new NotFoundError("There is no such account");
    const { deactivatedAt, createdAt, ...details } = user;
    return {
      ...details,
      createdAt: createdAt.toISOString(),
      roles: await readRoles(database, userId),
      active: deactivatedAt === null,
    };
  }

  function refuseOwnAccount(actor: Actor, userId: string, change: string) {
    if (actor.user.id === userId) {
      throw new ForbiddenError(`You cannot ${change} your own account`);
    }
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

    async setRoles(actor, userId, roles) {
      requirePermission(actor, "accounts:manage");
      refuseOwnAccount(actor, userId, "change the roles of");
      const previous = await readAccount(userId);
      await database.transaction(async (transaction) => {
        await transaction.delete(userRoles).where(eq(userRoles.userId, userId));
        await addRoles(transaction, userId, roles);
        await recordEvent(transaction, {
          actorId: actor.user.id,
          action: "roles-changed",
          subjectId: userId,
          details: { previousRoles: previous.roles, roles: [...roles] },
        });
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

    async setActive(actor, userId, active) {
      requirePermission(actor, "accounts:manage");
      refuseOwnAccount(actor, userId, "deactivate or reactivate");
      await readAccount(userId);
      await setAccountActive(auth, database, userId, active, actor.user.id);
      return readAccount(userId);
    },
  };
}
