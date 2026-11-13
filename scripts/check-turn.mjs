// SPDX-License-Identifier: Apache-2.0

// Runs a check, such as 'pnpm check' or 'pnpm test:changed', in one copy of the repository at a time
// on this computer. A check's linters, type checks, scans and tests together use every core, so two
// copies checking at once slow each other until tests time out. A copy that has to wait says so,
// naming the process and folder it waits for, and how long it waited. It ends as the command does.
// Usage: node scripts/check-turn.mjs <command> [arguments], such as bash scripts/check.sh

import { pathToFileURL } from "node:url";
import {
  inTurn,
  machineSlots,
  millisecondsPerSecond,
} from "../packages/test-utils/src/slots.ts";
import { runCommand } from "./run-command.mjs";

export const checkRuns = machineSlots("checks", {
  atOnce: 1,
  retryMilliseconds: millisecondsPerSecond,
  reportAfterMilliseconds: 0,
  waitingTo: "run a check",
});

// Runs the work once no other copy is running a check, and gives back what it gives. The work's
// environment is marked, so a check started from within it goes ahead rather than waiting on the
// slot this one holds.
export function inCheckTurn(
  work,
  { slots = checkRuns, environment = process.env } = {},
) {
  return inTurn(work, slots, "FATHOM_CHECK_SLOT", environment);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [command, ...args] = process.argv.slice(2);
  if (command === undefined) {
    console.error("error: Usage: check-turn.mjs <command> [arguments]");
    process.exit(2);
  }
  try {
    process.exit(
      await inCheckTurn((environment) =>
        runCommand(command, args, environment),
      ),
    );
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
