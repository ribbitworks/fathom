// SPDX-License-Identifier: Apache-2.0

// Creates local accounts that sign in with a password, with the roles they hold. Public
// sign-up is turned off, so accounts are created here, through Better Auth's own storage, which
// hashes the password.

import type { Database } from "@fathom/db";
import type { Role } from "@fathom/shared";
import { z } from "zod";
import type { Auth } from "./auth.ts";
import { addRoles } from "./roles.ts";

export interface NewAccount {
  name: string;
  email: string;
  password: string;
  roles?: readonly Role[];
}

export async function createAccount(
  auth: Auth,
  database: Database,
  { name, email, password, roles = [] }: NewAccount,
): Promise<void> {
  const context = await auth.$context;
  const { minPasswordLength, maxPasswordLength } = context.password.config;
  if (password.length < minPasswordLength) {
    throw new Error(
      `The password must have at least ${String(minPasswordLength)} characters`,
    );
  }
  if (password.length > maxPasswordLength) {
    throw new Error(
      `The password must have at most ${String(maxPasswordLength)} characters`,
    );
  }
  const normalizedEmail = email.trim().toLowerCase();
  // An account with a mistyped email address could never sign in.
  if (!z.email().safeParse(normalizedEmail).success) {
    throw new Error("The email address is not valid");
  }
  if (await context.internalAdapter.findUserByEmail(normalizedEmail)) {
    throw new Error("An account with this email address already exists");
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
    await addRoles(database, user.id, roles);
  } catch (error) {
    // An account without its password or roles is not what was asked for, so it is not kept.
    await context.internalAdapter.deleteUser(user.id);
    throw error;
  }
}
