// SPDX-License-Identifier: Apache-2.0

// Creates an account that signs in with a password, such as the first administrator's. Takes the
// name, email address, and roles as arguments, and reads the password from standard input, so it
// never appears on a command line. Every account is a Viewer unless --no-viewer is given, as for a
// person who runs Fathom without seeing people data. scripts/create-account.sh prompts for the
// password in development.

import {
  createDatabase,
  createPool,
  describeError,
  loadDatabaseConfig,
} from "@fathom/db";
import { roleSchema } from "@fathom/shared";
import { text } from "node:stream/consumers";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { loadAuthConfig } from "./config.ts";
import { createAccount } from "./data/accounts.ts";
import { createAuth } from "./data/auth.ts";

const usage = `Usage: create-account --name <name> --email <email address> [--role <role>]... [--no-viewer]
Roles: ${roleSchema.options.join(", ")}`;

// Returns a failing exit code after reporting what went wrong.
export async function createAccountCommand(
  args: string[],
  password: Promise<string>,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  let pool: ReturnType<typeof createPool> | undefined;
  try {
    const { values } = parseArgs({
      args,
      allowNegative: true,
      options: {
        name: { type: "string" },
        email: { type: "string" },
        role: { type: "string", multiple: true, default: [] },
        viewer: { type: "boolean", default: true },
      },
    });
    if (!values.name?.trim() || !values.email?.trim()) throw new Error(usage);
    const roles = [...(values.viewer ? ["viewer"] : []), ...values.role].map(
      (role) => {
        const known = roleSchema.safeParse(role);
        if (!known.success) throw new Error(`Unknown role ${role}\n${usage}`);
        return known.data;
      },
    );
    pool = createPool(loadDatabaseConfig(environment));
    const database = createDatabase(pool);
    const auth = createAuth(database, loadAuthConfig(environment));
    await createAccount(auth, database, {
      roles,
      name: values.name,
      email: values.email,
      // A single line, as typed or piped in.
      password: (await password).replace(/\r?\n$/, ""),
    });
    console.log(`Created the account for ${values.email.trim().toLowerCase()}`);
    return 0;
  } catch (error) {
    console.error(`error: ${describeError(error)}`);
    return 1;
  } finally {
    await pool?.end();
  }
}

/* v8 ignore start -- Only runs as a separate process; the tests call createAccountCommand. */
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await createAccountCommand(
    process.argv.slice(2),
    text(process.stdin),
  );
}
/* v8 ignore stop */
