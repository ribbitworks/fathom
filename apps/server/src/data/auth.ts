// SPDX-License-Identifier: Apache-2.0

// Sign-in and sessions, through Better Auth, which keeps its accounts, sessions, and sign-in rate
// limits in Fathom's database. Accounts are created only by administrators, there is no email, and
// sessions are checked against the database on every request, so deactivating an account takes
// effect at once. Better Auth's warnings and errors go to Fathom's log as its fixed messages only,
// without the details it attaches, which can name a user.

import {
  accounts,
  type Database,
  rateLimits,
  sessions,
  users,
  verifications,
} from "@fathom/db";
import { betterAuth } from "better-auth";
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
const hour = 60 * minute;

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
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    // A session ends after 12 hours without use, and is never cached in a cookie.
    session: {
      expiresIn: 12 * hour,
      updateAge: hour,
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
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
