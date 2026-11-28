// SPDX-License-Identifier: Apache-2.0

// Runs a check, such as 'pnpm check' or 'pnpm test:changed', in its turn on this computer, two copies
// of the repository at a time. It ends as the command does.
// Usage: node scripts/check-turn.mjs <command> [arguments], such as bash scripts/check.sh

import { pathToFileURL } from "node:url";
import {
  inTurn,
  machineSlots,
  millisecondsPerSecond,
} from "../packages/test-utils/src/slots.ts";
import { runCommand } from "./run-command.mjs";

// Two checks at once each run about as fast as one alone, as Checks and CI's Sharing the Machine
// records.
export const checkRuns = machineSlots("checks", {
  atOnce: 2,
  retryMilliseconds: millisecondsPerSecond,
  reportAfterMilliseconds: 0,
  waitingTo: "run a check",
});

const slotMarker = "FATHOM_CHECK_SLOT";

// Runs the work in its turn, and gives back what it gives. The work's environment is marked, so a
// check started from within it goes ahead rather than waiting on the turn this one holds.
export const inCheckTurn = (
  work,
  { slots = checkRuns, environment = process.env } = {},
) => inTurn(work, slots, slotMarker, environment);

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
