// SPDX-License-Identifier: Apache-2.0

// Development accounts, one for each persona in docs/product/brief.md, named after the persona and
// holding its role from docs/product/roles.md, so each role can be tried by signing in as it, a
// Resource Planner, which sees people without their Restricted details, and a Superuser, which holds
// a role of the seed's own granting every permission, for trying anything at once. They share one
// password. Accounts are never deleted, since the change history and saved views refer to them, so
// removing the seed data deactivates them, and seeding again reactivates them. Development only:
// the seed package is never part of the runtime image.

import {
  type Database,
  rolePermissions,
  roles as roleTable,
  users,
} from "@fathom/db";
import { type Actor, actorFor, actorWith } from "@fathom/server/access";
import { createAccount, setAccountActive } from "@fathom/server/accounts";
import type { Auth } from "@fathom/server/auth";
import { findStartingRole } from "@fathom/server/roles";
import { permissionSchema, type Role } from "@fathom/shared";
import { and, inArray, isNull, sql } from "drizzle-orm";

// The email domain of the seeded accounts.
export const accountDomain = "fathom.test";

// The seed's own role, which is not a starting role: it has no key, and a Fathom set up without the
// seed data does not have it.
export const superuserRole = {
  name: "Superuser",
  description:
    "Grants every permission, for trying anything in development. Only the seed data has this role.",
} as const;

export interface PersonaAccount {
  name: string;
  email: string;
  // A starting role, or the seed's own Superuser role.
  role: Role | "superuser";
}

export const personaAccounts: readonly PersonaAccount[] = [
  {
    name: "Product Manager",
    email: `product.manager@${accountDomain}`,
    role: "planner",
  },
  {
    name: "Project Manager",
    email: `project.manager@${accountDomain}`,
    role: "project-manager",
  },
  {
    name: "Engineering Manager",
    email: `engineering.manager@${accountDomain}`,
    role: "engineering-manager",
  },
  {
    name: "Feature Lead",
    email: `feature.lead@${accountDomain}`,
    role: "planner",
  },
  {
    name: "Engineering Director",
    email: `engineering.director@${accountDomain}`,
    role: "engineering-director",
  },
  {
    name: "Engineering Operations Manager",
    email: `engineering.operations.manager@${accountDomain}`,
    role: "workforce-administrator",
  },
  // A second account for the same persona, so the seed data can show a draft that two people
  // changed.
  {
    name: "Second Engineering Operations Manager",
    email: `engineering.operations.manager.2@${accountDomain}`,
    role: "workforce-administrator",
  },
  {
    name: "Executive",
    email: `executive@${accountDomain}`,
    role: "executive",
  },
  {
    name: "Team Member",
    email: `team.member@${accountDomain}`,
    role: "team-member",
  },
  // No persona sees people without Restricted details, so this account shows what such a reader
  // sees.
  {
    name: "Resource Planner",
    email: `resource.planner@${accountDomain}`,
    role: "resource-planner",
  },
  {
    name: "Fathom Administrator",
    email: `fathom.administrator@${accountDomain}`,
    role: "administrator",
  },
  {
    name: "Superuser",
    email: `superuser@${accountDomain}`,
    role: "superuser",
  },
];

// What a persona account may do, as its role first grants it, for seed data made as that persona.
export function personaActor(
  user: Actor["user"],
  role: PersonaAccount["role"],
): Actor {
  return role === "superuser"
    ? actorWith(user, permissionSchema.options)
    : actorFor(user, role);
}

// The Superuser role's ID, made with every permission if it is missing. Found by its name, whatever
// its case, as role names are unique.
async function superuserRoleId(database: Database): Promise<string> {
  const byName = sql`lower(${roleTable.name}) = lower(${superuserRole.name})`;
  const [found] = await database
    .select({ id: roleTable.id })
    .from(roleTable)
    .where(byName);
  if (found !== undefined) return found.id;
  return database.transaction(async (transaction) => {
    const [made] = await transaction
      .insert(roleTable)
      .values({ ...superuserRole })
      .returning({ id: roleTable.id });
    const id = String(made?.id);
    await transaction.insert(rolePermissions).values(
      permissionSchema.options.map((permission) => ({
        roleId: id,
        permission,
      })),
    );
    return id;
  });
}

async function roleIdOf(
  database: Database,
  role: PersonaAccount["role"],
): Promise<string> {
  return role === "superuser"
    ? superuserRoleId(database)
    : findStartingRole(database, role);
}

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
      await createAccount(
        auth,
        database,
        {
          name: account.name,
          email: account.email,
          password,
          roleId: await roleIdOf(database, account.role),
        },
        null,
      );
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
