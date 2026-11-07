// SPDX-License-Identifier: Apache-2.0

// Creates an account that signs in with a password. Takes the name, email address, and one starting
// role as arguments; the account holds the Team Member role unless --role names another. Fathom
// generates the password, which the command prints once, and its user changes it at first sign-in.
// scripts/create-account.sh runs it in development.

import {
  createDatabase,
  createPool,
  type Database,
  describeError,
  loadDatabaseConfig,
} from "@fathom/db";
import { roleSchema } from "@fathom/shared";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { loadAuthConfig } from "./config.ts";
import { createAccountWithGeneratedPassword } from "./data/accounts.ts";
import { type Auth, createAuth } from "./data/auth.ts";
import { findStartingRole } from "./data/roles.ts";

const usage = `Usage: create-account --name <name> --email <email address> [--role <role>]
Roles: ${roleSchema.options.join(", ")}`;

// Runs a command against Fathom's database, and returns a failing exit code after reporting what
// went wrong.
export async function runAccountCommand(
  environment: NodeJS.ProcessEnv,
  work: (auth: Auth, database: Database) => Promise<void>,
): Promise<number> {
  let pool: ReturnType<typeof createPool> | undefined;
  try {
    pool = createPool(loadDatabaseConfig(environment));
    const database = createDatabase(pool);
    await work(createAuth(database, loadAuthConfig(environment)), database);
    return 0;
  } catch (error) {
    console.error(`error: ${describeError(error)}`);
    return 1;
  } finally {
    await pool?.end();
  }
}

// Prints a generated password, which is shown nowhere else.
export function printPassword(password: string): void {
  console.log(`Password: ${password}`);
  console.log(
    "Fathom shows this password only once, and asks for a new one at first sign-in.",
  );
}

// Creates the account, recorded in the access history as created by the server's operators, and
// prints its password.
export function createAccountCommand(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  return runAccountCommand(environment, async (auth, database) => {
    const { values } = parseArgs({
      args,
      options: {
        name: { type: "string" },
        email: { type: "string" },
        role: { type: "string", default: "team-member" },
      },
    });
    const { name, email } = values;
    if (!name?.trim() || !email?.trim()) throw new Error(usage);
    const role = roleSchema.safeParse(values.role);
    if (!role.success) {
      throw new Error(`Unknown role ${values.role}\n${usage}`);
    }
    const { password } = await createAccountWithGeneratedPassword(
      auth,
      database,
      { roleId: await findStartingRole(database, role.data), name, email },
    );
    console.log(`Created the account for ${email.trim().toLowerCase()}.`);
    printPassword(password);
  });
}

/* v8 ignore start -- Only runs as a separate process; the tests call createAccountCommand. */
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await createAccountCommand(process.argv.slice(2));
}
/* v8 ignore stop */
