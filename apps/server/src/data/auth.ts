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
import { passwordLength } from "@fathom/shared";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { AuthConfig } from "../config.ts";

// The header the server sets to each request's client address, which Better Auth uses to limit
// sign-in attempts. Any copy a client sends is removed first, so it cannot be forged.
export const clientAddressHeader = "x-fathom-client-address";

export type AuthLog = (
  level: "debug" | "info" | "warn" | "error",
  message: string,
) => void;

const minute = 60;

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
    // A session ends after 30 minutes without use, and is never cached in a cookie. Its expiry is
    // pushed back at most once a minute, so a session in use is not written to the database on
    // every request, and ends no more than a minute early.
    session: {
      expiresIn: 30 * minute,
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
      ipAddress: { ipAddressHeaders: [clientAddressHeader] },
    },
    logger: {
      level: "warn",
      log: (level, message) => {
        log?.(level, message);
      },
    },
    // A deactivated account cannot start a session, even with the right password.
    databaseHooks: {
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
