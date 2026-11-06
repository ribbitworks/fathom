// SPDX-License-Identifier: Apache-2.0

// Development accounts, one for each persona in docs/product/brief.md, named after the persona and
// holding its default roles from docs/product/roles.md, so each role can be tried by signing in as
// it, a Resource Planner, which sees people without their Restricted details, and a Superuser, which
// holds every starting role, and so every permission, for trying anything at once. They share one
// password. Accounts are never deleted, since the change history and saved views refer to them, so
// removing the seed data deactivates them, and seeding again reactivates them. Development only:
// the seed package is never part of the runtime image.

import { type Database, users } from "@fathom/db";
import { createAccount, setAccountActive } from "@fathom/server/accounts";
import type { Auth } from "@fathom/server/auth";
import { type Role, roleSchema } from "@fathom/shared";
import { and, inArray, isNull } from "drizzle-orm";

// The email domain of the seeded accounts.
export const accountDomain = "fathom.test";

export interface PersonaAccount {
  name: string;
  email: string;
  roles: readonly Role[];
}

export const personaAccounts: readonly PersonaAccount[] = [
  {
    name: "Product Manager",
    email: `product.manager@${accountDomain}`,
    roles: ["viewer", "project-planner"],
  },
  {
    name: "Project Manager",
    email: `project.manager@${accountDomain}`,
    roles: ["viewer", "project-planner", "approver"],
  },
  {
    name: "Engineering Manager",
    email: `engineering.manager@${accountDomain}`,
    roles: ["viewer", "project-planner", "resource-planner", "people-manager"],
  },
  {
    name: "Feature Lead",
    email: `feature.lead@${accountDomain}`,
    roles: ["viewer", "project-planner"],
  },
  {
    name: "Engineering Director",
    email: `engineering.director@${accountDomain}`,
    roles: [
      "viewer",
      "project-planner",
      "resource-planner",
      "leadership",
      "approver",
    ],
  },
  {
    name: "Engineering Operations Manager",
    email: `engineering.operations.manager@${accountDomain}`,
    roles: ["viewer", "workforce-administrator"],
  },
  // A second account for the same persona, so the seed data can show a draft that two people
  // changed.
  {
    name: "Second Engineering Operations Manager",
    email: `engineering.operations.manager.2@${accountDomain}`,
    roles: ["viewer", "workforce-administrator"],
  },
  {
    name: "Executive",
    email: `executive@${accountDomain}`,
    roles: ["viewer", "leadership"],
  },
  {
    name: "Team Member",
    email: `team.member@${accountDomain}`,
    roles: ["viewer"],
  },
  // No persona sees people without Restricted details, so this account shows what such a reader
  // sees.
  {
    name: "Resource Planner",
    email: `resource.planner@${accountDomain}`,
    roles: ["viewer", "resource-planner"],
  },
  {
    name: "Fathom Administrator",
    email: `fathom.administrator@${accountDomain}`,
    roles: ["administrator"],
  },
  // Together the starting roles grant every permission, which a test checks, so this account can
  // try anything without signing in as another.
  {
    name: "Superuser",
    email: `superuser@${accountDomain}`,
    roles: roleSchema.options,
  },
];

function emails(accounts: readonly PersonaAccount[]): string[] {
  return accounts.map(({ email }) => email);
}

// Creates the accounts that are missing and reactivates those removed before, through the server's
// own account code, recording each in the access history as done by the server's operators. An
// account already there keeps its password. Returns the addresses it created or reactivated.
export async function seedAccounts(
  auth: Auth,
  database: Database,
  password: string,
  accounts: readonly PersonaAccount[] = personaAccounts,
): Promise<string[]> {
  const existing = await database
    .select({
      id: users.id,
      email: users.email,
      deactivatedAt: users.deactivatedAt,
    })
    .from(users)
    .where(inArray(users.email, emails(accounts)));
  const done: string[] = [];
  for (const account of accounts) {
    const found = existing.find(({ email }) => email === account.email);
    if (found === undefined) {
      await createAccount(auth, database, { ...account, password }, null);
      done.push(account.email);
    } else if (found.deactivatedAt !== null) {
      await setAccountActive(auth, database, found.id, true, null);
      done.push(account.email);
    }
  }
  return done;
}

// Deactivates the active seeded accounts and signs them out, through the server's own account code,
// recording each in the access history as done by the server's operators. Returns the addresses it
// deactivated, in the order of the accounts.
export async function unseedAccounts(
  auth: Auth,
  database: Database,
  accounts: readonly PersonaAccount[] = personaAccounts,
): Promise<string[]> {
  const active = await database
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(inArray(users.email, emails(accounts)), isNull(users.deactivatedAt)),
    );
  const done: string[] = [];
  for (const account of accounts) {
    const found = active.find(({ email }) => email === account.email);
    if (found === undefined) continue;
    await setAccountActive(auth, database, found.id, false, null);
    done.push(account.email);
  }
  return done;
}
