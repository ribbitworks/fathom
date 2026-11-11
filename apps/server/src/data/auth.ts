// SPDX-License-Identifier: Apache-2.0

// Sign-in and sessions, through Better Auth, which keeps its accounts, sessions, and sign-in rate
// limits in Fathom's database. Accounts are created only by administrators, there is no email, and
// sessions are checked against the database on every request, so deactivating an account takes
// effect at once, and a deactivated account cannot sign in. Better Auth's warnings and errors go to
// Fathom's log as its fixed messages only, without the details it attaches, which can name a user.

import {
  accounts,
  type Database,
  rateLimits,
  sessions,
  users,
  verifications,
} from "@fathom/db";
import { passwordLength, sessionIdleMinutes } from "@fathom/shared";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { and, eq, exists } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { AuthConfig } from "../config.ts";
import { recordEvent } from "./history.ts";

// The header the server sets to each request's client address, which Better Auth uses to limit
// sign-in attempts. Any copy a client sends is removed first, so it cannot be forged.
export const clientAddressHeader = "x-fathom-client-address";

export type AuthLog = (
  level: "debug" | "info" | "warn" | "error",
  message: string,
) => void;

const minute = 60;

// Browsers do not keep cookies apart by port; the default port keeps Better Auth's default names.
function cookiePrefix(publicUrl: string): string | undefined {
  const { port } = new URL(publicUrl);
  return port === "" ? undefined : `fathom-${port}`;
}

export function createAuth(
  database: Database,
  config: AuthConfig,
  // Commands that report their own errors leave it out.
  log?: AuthLog,
) {
  return betterAuth({
    appName: "Fathom",
    baseURL: config.publicUrl,
    basePath: "/api/auth",
    secret: config.secret,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        rateLimit: rateLimits,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: passwordLength.minimum,
      maxPasswordLength: passwordLength.maximum,
    },
    // A session ends after a time without use, and is never cached in a cookie. Its expiry is
    // pushed back at most once a minute, so a session in use is not written to the database on
    // every request, and ends no more than a minute early.
    session: {
      expiresIn: sessionIdleMinutes * minute,
      updateAge: minute,
      cookieCache: { enabled: false },
    },
    // Limits are kept in the database, so they hold across restarts, and apply in every
    // environment, not only production.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: minute,
      max: 100,
      customRules: { "/sign-in/email": { window: minute, max: 5 } },
    },
    advanced: {
      useSecureCookies: true,
      cookiePrefix: cookiePrefix(config.publicUrl),
      ipAddress: { ipAddressHeaders: [clientAddressHeader] },
    },
    logger: {
      level: "warn",
      log: (level, message) => {
        log?.(level, message);
      },
    },
    databaseHooks: {
      // A user changing their own password is recorded in the access history before the new one is
      // saved, so if it cannot be recorded, the password is not changed. Better Auth runs here
      // without a transaction, so a save that fails after the entry is written leaves an entry for a
      // change that did not happen, which is accepted as safer than a change without one. The entry
      // names the signed-in user, since Fathom's only way to change a password through Better Auth
      // is changing one's own; a plugin that let one user set another's would need it changed.
      // Administrators' resets do not come through Better Auth, and record their own entries. A
      // password set with no one signed in is refused with an error.
      account: {
        update: {
          before: async (account, context) => {
            if (account.password === undefined) return;
            const userId = context?.context.session?.user.id;
            if (userId === undefined) {
              throw new APIError("FORBIDDEN", {
                message: "Sign in to change the password",
              });
            }
            await recordEvent(database, {
              actorId: userId,
              action: "password-changed",
              subjectId: userId,
            });
          },
          // Once users have changed their own password, it is no longer one Fathom generated, so
          // they may go on. Cleared only after the new one is saved, so a failed save leaves them
          // still to change it. Kept if an administrator's reset has replaced the new password
          // since: the account's row is locked first, so a reset either saved before is seen, or
          // waits and sets it again.
          after: async (account, context) => {
            const userId = context?.context.session?.user.id;
            const { password } = account;
            if (
              userId === undefined ||
              context?.path !== "/change-password" ||
              typeof password !== "string"
            ) {
              return;
            }
            await database.transaction(async (transaction) => {
              await transaction
                .select({ id: users.id })
                .from(users)
                .where(eq(users.id, userId))
                .for("update");
              await transaction
                .update(users)
                .set({ mustChangePassword: false })
                .where(
                  and(
                    eq(users.id, userId),
                    exists(
                      transaction
                        .select({ id: accounts.id })
                        .from(accounts)
                        .where(
                          and(
                            eq(accounts.id, account.id),
                            eq(accounts.password, password),
                          ),
                        ),
                    ),
                  ),
                );
            });
          },
        },
      },
      // A deactivated account cannot start a session, even with the right password.
      session: {
        create: {
          before: async (session) => {
            const [user] = await database
              .select({ deactivatedAt: users.deactivatedAt })
              .from(users)
              .where(eq(users.id, session.userId));
            // Refused, too, if the account cannot be found.
            return user !== undefined && user.deactivatedAt === null;
          },
        },
      },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
