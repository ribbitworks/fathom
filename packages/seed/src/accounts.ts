// SPDX-License-Identifier: Apache-2.0

// Development accounts, one for each persona in docs/product/brief.md, holding its role, and a
// Superuser: seeding them, and removing the seed data, which deactivates them. Development only.

import {
  type Database,
  lastViews,
  rolePermissions,
  roles as roleTable,
  users,
} from "@fathom/db";
import { type Actor, actorFor, actorWith } from "@fathom/server/access";
import { createAccount, setAccountActive } from "@fathom/server/accounts";
import type { Auth } from "@fathom/server/auth";
import { findStartingRole } from "@fathom/server/roles";
import { permissionSchema, type Role, roleSchema } from "@fathom/shared";
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
  // A starting role, or the seed's own Superuser role, which is the account's default.
  role: Role | "superuser";
  // The other starting roles the account holds, if any.
  otherRoles?: readonly Role[];
}

export const personaAccounts: readonly PersonaAccount[] = [
  {
    name: "Product Manager",
    email: `product.manager@${accountDomain}`,
    role: "product-manager",
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
    role: "feature-lead",
    otherRoles: ["engineering-manager"],
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
  {
    name: "Fathom Administrator",
    email: `fathom.administrator@${accountDomain}`,
    role: "administrator",
  },
  {
    name: "Superuser",
    email: `superuser@${accountDomain}`,
    role: "superuser",
    otherRoles: roleSchema.options,
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
      const roleId = await roleIdOf(database, account.role);
      const others = await Promise.all(
        (account.otherRoles ?? []).map((role) => roleIdOf(database, role)),
      );
      await createAccount(
        auth,
        database,
        {
          name: account.name,
          email: account.email,
          password,
          roleId,
          roleIds: [roleId, ...others],
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
// recording each in the access history as done by the server's operators, and forgets the views
// every seeded account last showed. Returns the addresses it deactivated, in the order of the
// accounts.
export async function unseedAccounts(
  auth: Auth,
  database: Database,
  accounts: readonly PersonaAccount[] = personaAccounts,
): Promise<string[]> {
  const seeded = database
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, emails(accounts)));
  await database.delete(lastViews).where(inArray(lastViews.userId, seeded));
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
