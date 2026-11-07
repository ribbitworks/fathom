// SPDX-License-Identifier: Apache-2.0

// Creates the first Administrator when Fathom is installed: an account named Fathom Administrator,
// holding the Administrator starting role, with the email address given. Fathom generates its
// password, which the command prints once, and it is changed at first sign-in. Once any account
// holds the Administrator role, the command changes nothing, so running it again is safe.
// scripts/create-administrator.sh runs it in development.

import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { printPassword, runAccountCommand } from "./create-account.ts";
import {
  administratorName,
  createFirstAdministrator,
} from "./data/accounts.ts";

const usage = "Usage: create-administrator --email <email address>";

export function createAdministratorCommand(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  return runAccountCommand(environment, async (auth, database) => {
    const { email } = parseArgs({
      args,
      options: { email: { type: "string" } },
    }).values;
    if (!email?.trim()) throw new Error(usage);
    const created = await createFirstAdministrator(auth, database, email);
    if (created === null) {
      console.log(
        "An account already holds the Administrator role, so nothing was changed.",
      );
      return;
    }
    console.log(
      `Created the ${administratorName} account for ${email.trim().toLowerCase()}.`,
    );
    printPassword(created.password);
  });
}

/* v8 ignore start -- Only runs as a separate process; the tests call createAdministratorCommand. */
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await createAdministratorCommand(process.argv.slice(2));
}
/* v8 ignore stop */
