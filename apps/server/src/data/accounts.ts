// SPDX-License-Identifier: Apache-2.0

// Local accounts that sign in with a password: creating them, with the roles each holds and its
// default, the passwords Fathom generates for them, which their users must change at first sign-in,
// and the administration of them: those who see accounts list them, and those who manage them change
// their names, email addresses, and roles, reset their passwords, and deactivate them. Administrators
// manage their own account like any other, except that some active account must keep the
// permissions to manage accounts and to edit roles, so no one can lock everyone out, and nobody
// resets their own password here.
// Public sign-up is turned off, so accounts are created here, through Better Auth's own storage,
// which hashes passwords.

import {
  accounts,
  type Database,
  roles as roleTable,
  userRoles,
  users,
} from "@fathom/db";
import {
  type Account,
  type AccountRole,
  kindsIn,
  type PasswordRecipe,
  recipeCharacters,
} from "@fathom/shared";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
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
import { readPasswordSettings } from "./settings.ts";
import {
  defaultRoleOutside,
  findRole,
  findStartingRole,
  giveRoles,
  keepAccessManaged,
  lockAccessManagers,
  readRoles,
} from "./roles.ts";

// Roles by name, for showing.
const byName = (roles: readonly AccountRole[]) =>
  [...roles].sort((a, b) => a.name.localeCompare(b.name));

// Each of the roles with these IDs, by name, refused if any does not exist.
async function findRoles(
  database: Pick<Database, "select">,
  roleIds: readonly string[],
): Promise<AccountRole[]> {
  return byName(await Promise.all(roleIds.map((id) => findRole(database, id))));
}

// What the access history records of an account's roles: the default's name, and every role's.
function roleDetails(
  roles: readonly AccountRole[],
  defaultRoleId: string | null,
): { role?: string; roles: string[] } {
  const role = roles.find(({ id }) => id === defaultRoleId);
  return {
    ...(role === undefined ? {} : { role: role.name }),
    roles: roles.map(({ name }) => name),
  };
}

export interface NewAccount {
  name: string;
  email: string;
  password: string;
  // The default role, any role, starting or made later; it must exist.
  roleId: string;
  // Every role the account holds, the default among them, each of which must exist; left out, the
  // default alone.
  roleIds?: readonly string[] | undefined;
  // Whether its user must change the password before doing anything else.
  mustChangePassword?: boolean;
}

export type AccountDetails = Omit<
  NewAccount,
  "password" | "mustChangePassword"
>;

// A whole number from 0 up to, but not including, the bound, each equally likely.
export type RandomInt = (bound: number) => number;

// A password for a new account or a reset, following the recipe in the password settings: each
// character drawn evenly from the characters the recipe uses, with at least one of each type it
// uses, at a random place, so it meets every rule, since the settings refuse a recipe without each
// type the rules need. The random source must be cryptographically secure.
export function generatePassword(
  recipe: PasswordRecipe,
  random: RandomInt = randomInt,
): string {
  const pick = (characters: string) =>
    characters.charAt(random(characters.length));
  const sets = kindsIn(recipe).map((kind) =>
    recipeCharacters(kind, recipe.avoidLookAlikes),
  );
  const all = sets.join("");
  const characters = sets.map((set) => pick(set));
  while (characters.length < recipe.length) characters.push(pick(all));
  // Drawn out in a random order, so the guaranteed characters may fall anywhere.
  const shuffled: string[] = [];
  while (characters.length > 0) {
    shuffled.push(...characters.splice(random(characters.length), 1));
  }
  return shuffled.join("");
}

const generatePasswordFor = async (database: Pick<Database, "select">) =>
  generatePassword((await readPasswordSettings(database)).recipe);

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
  {
    name,
    email,
    password,
    roleId,
    roleIds = [roleId],
    mustChangePassword = false,
  }: NewAccount,
  createdBy: string | null = null,
): Promise<string> {
  const context = await auth.$context;
  await checkPassword(auth, password);
  const normalizedEmail = await checkEmail(auth, email);
  const held = [...new Set(roleIds)];
  if (!held.includes(roleId)) throw new BadRequestError(defaultRoleOutside);
  await findRoles(database, held);
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
      // Read again, so a role deleted meanwhile is refused rather than named wrongly.
      const roles = await findRoles(transaction, held);
      await giveRoles(transaction, user.id, held, roleId);
      if (mustChangePassword) {
        await transaction
          .update(users)
          .set({ mustChangePassword })
          .where(eq(users.id, user.id));
      }
      await recordEvent(transaction, {
        actorId: createdBy,
        action: "account-created",
        subjectId: user.id,
        details: roleDetails(roles, roleId),
      });
    });
  } catch (error) {
    // An account without its password, role, or history entry is not what was asked for, so it is
    // not kept.
    await context.internalAdapter.deleteUser(user.id);
    throw error;
  }
  return user.id;
}

// Creates an account with a password Fathom generates, which its user must change at first sign-in,
// and returns its identifier and the password, for showing once.
export async function createAccountWithGeneratedPassword(
  auth: Auth,
  database: Database,
  account: AccountDetails,
  createdBy: string | null = null,
): Promise<{ id: string; password: string }> {
  const password = await generatePasswordFor(database);
  const id = await createAccount(
    auth,
    database,
    { ...account, password, mustChangePassword: true },
    createdBy,
  );
  return { id, password };
}

export const administratorName = "Fathom Administrator";

// Creates the Fathom Administrator account, holding the Administrator starting role, with a
// generated password, unless an account already holds that role, when it returns null and changes
// nothing. Recorded as created by the server's operators. Two runs at once wait for each other, so
// only one creates it: the lock is held until the account and its role are saved, and the check
// after it sees them.
export async function createFirstAdministrator(
  auth: Auth,
  database: Database,
  email: string,
): Promise<{ id: string; password: string } | null> {
  return database.transaction(async (transaction) => {
    await lockAccessManagers(transaction);
    const [holder] = await transaction
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(roleTable, eq(roleTable.id, userRoles.roleId))
      .where(eq(roleTable.key, "administrator"))
      .limit(1);
    if (holder !== undefined) return null;
    return createAccountWithGeneratedPassword(auth, database, {
      name: administratorName,
      email,
      roleId: await findStartingRole(transaction, "administrator"),
    });
  });
}

// Deactivates or reactivates an account, recording who did it in the access history, and signs it
// out everywhere when deactivated. The actor is null for the server's operators, as when the
// development seed command does it. Callers check permissions first. When asked to keep Fathom
// manageable, as for Administrators acting in Fathom, deactivating is refused if it would leave no
// active account able to manage accounts or edit roles; the server's operators are not held to it.
export async function setAccountActive(
  auth: Auth,
  database: Database,
  userId: string,
  active: boolean,
  actorId: string | null,
  keepManaged = false,
): Promise<void> {
  const guarded = keepManaged && !active;
  await database.transaction(async (transaction) => {
    if (guarded) await lockAccessManagers(transaction);
    await transaction
      .update(users)
      .set({ deactivatedAt: active ? null : new Date() })
      .where(eq(users.id, userId));
    if (guarded) {
      await keepAccessManaged(
        transaction,
        "The last active account that can manage accounts or edit roles cannot be deactivated",
      );
    }
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
  // The default role, which must be among the roles the account holds after the change.
  roleId?: string | undefined;
  // Every role the account is to hold; left out with a default given, the default alone.
  roleIds?: readonly string[] | undefined;
}

// The roles and default an account change asks for, refusing a default outside them, or undefined
// when it asks for none or for those the account holds. A default given without the roles is the
// account's only role.
function changedRoles(
  previous: Account,
  { roleId, roleIds }: AccountChange,
): { roleIds: string[]; defaultRoleId: string } | undefined {
  if (roleId === undefined && roleIds === undefined) return undefined;
  const previousIds = previous.roles.map(({ id }) => id);
  const defaultRoleId = roleId ?? previous.role?.id;
  if (defaultRoleId === undefined) {
    throw new BadRequestError(defaultRoleOutside);
  }
  const wanted = [...new Set(roleIds ?? [defaultRoleId])];
  if (!wanted.includes(defaultRoleId)) {
    throw new BadRequestError(defaultRoleOutside);
  }
  const same =
    defaultRoleId === previous.role?.id &&
    wanted.length === previousIds.length &&
    wanted.every((id) => previousIds.includes(id));
  return same ? undefined : { roleIds: wanted, defaultRoleId };
}

export interface AccountAdministration {
  listAccounts(actor: Actor): Promise<Account[]>;
  // Returns the account with the password Fathom generated for it.
  createAccount(
    actor: Actor,
    account: AccountDetails,
  ): Promise<{ account: Account; password: string }>;
  // Changes any of an account's name, email address, roles, and default role together, recording
  // each that changes in the access history.
  updateAccount(
    actor: Actor,
    userId: string,
    change: AccountChange,
  ): Promise<Account>;
  // Gives the account a password Fathom generates, which its user must change at next sign-in, and
  // returns it. Signs the user out everywhere, so only the new password works.
  resetPassword(actor: Actor, userId: string): Promise<string>;
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
    const reader = transaction ?? database;
    if (transaction) {
      await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
    }
    const [user] = await reader
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
    const { roles, defaultRoleId } = await readRoles(reader, userId);
    const { deactivatedAt, createdAt, ...details } = user;
    const shown = roles.map(({ id, name }) => ({ id, name }));
    return {
      ...details,
      role: shown.find(({ id }) => id === defaultRoleId) ?? null,
      roles: shown,
      createdAt: createdAt.toISOString(),
      active: deactivatedAt === null,
    };
  }

  async function signOutEverywhere(userId: string): Promise<void> {
    await (await auth.$context).internalAdapter.deleteUserSessions(userId);
  }

  return {
    async listAccounts(actor) {
      requirePermission(actor, "accounts:view");
      const rows = await database
        .select({ id: users.id })
        .from(users)
        .orderBy(asc(users.name), asc(users.email));
      return Promise.all(rows.map(({ id }) => readAccount(id)));
    },

    async createAccount(actor, account) {
      requirePermission(actor, "accounts:manage");
      const { id, password } = await createAccountWithGeneratedPassword(
        auth,
        database,
        account,
        actor.user.id,
      );
      return { account: await readAccount(id), password };
    },

    async updateAccount(actor, userId, change) {
      requirePermission(actor, "accounts:manage");
      await readAccount(userId);
      const changedEmail =
        change.email === undefined
          ? undefined
          : await checkEmail(auth, change.email, userId);
      await database.transaction(async (transaction) => {
        await lockAccessManagers(transaction);
        const previous = await readAccount(userId, transaction);
        const name = change.name?.trim() ?? previous.name;
        const email = changedEmail ?? previous.email;
        const roles = changedRoles(previous, change);
        const events: HistoryEvent[] = [
          ...(name === previous.name ? [] : ["name-changed" as const]),
          ...(email === previous.email ? [] : ["email-changed" as const]),
        ].map((action) => ({
          actorId: actor.user.id,
          action,
          subjectId: userId,
        }));
        if (roles !== undefined) {
          const before = roleDetails(previous.roles, previous.role?.id ?? null);
          events.push({
            actorId: actor.user.id,
            action: "roles-changed",
            subjectId: userId,
            details: {
              ...roleDetails(
                await findRoles(transaction, roles.roleIds),
                roles.defaultRoleId,
              ),
              ...(before.role === undefined
                ? {}
                : { previousRole: before.role }),
              previousRoles: before.roles,
            },
          });
        }
        if (events.length === 0) return;
        await transaction
          .update(users)
          .set({ name, email, updatedAt: new Date() })
          .where(eq(users.id, userId));
        if (roles !== undefined) {
          await giveRoles(
            transaction,
            userId,
            roles.roleIds,
            roles.defaultRoleId,
          );
          await keepAccessManaged(
            transaction,
            "The last active account that can manage accounts or edit roles keeps that access",
          );
        }
        await recordEvents(transaction, events);
      });
      return readAccount(userId);
    },

    async resetPassword(actor, userId) {
      requirePermission(actor, "accounts:manage");
      // Changing one's own password needs the current one, so a session left open cannot be used
      // to take the account over.
      if (actor.user.id === userId) {
        throw new ForbiddenError(
          "Change your own password from your account, giving your current password",
        );
      }
      await readAccount(userId);
      const password = await generatePasswordFor(database);
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
        await transaction
          .update(users)
          .set({ mustChangePassword: true })
          .where(eq(users.id, userId));
        await recordEvent(transaction, {
          actorId: actor.user.id,
          action: "password-reset",
          subjectId: userId,
        });
      });
      await signOutEverywhere(userId);
      return password;
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
        true,
      );
      return readAccount(userId);
    },
  };
}
