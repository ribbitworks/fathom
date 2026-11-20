// SPDX-License-Identifier: Apache-2.0

// Runs a check, such as 'pnpm check' or 'pnpm test:changed', in its turn on this computer, two copies
// of the repository at a time, each told its share of the cores. It ends as the command does.
// Usage: node scripts/check-turn.mjs <command> [arguments], such as bash scripts/check.sh

import { pathToFileURL } from "node:url";
import {
  holdsTurn,
  inTurn,
  machineSlots,
  millisecondsPerSecond,
} from "../packages/test-utils/src/slots.ts";
import { runCommand } from "./run-command.mjs";

// A check's linters, type checks, scans and tests together can use every core, so more than two
// checking at once slow each other until tests time out.
export const checkRuns = machineSlots("checks", {
  atOnce: 2,
  retryMilliseconds: millisecondsPerSecond,
  reportAfterMilliseconds: 0,
  waitingTo: "run a check",
});

const slotMarker = "FATHOM_CHECK_SLOT";

// The environment a check runs in once it has its turn: told how many checks share the computer, so
// it uses only its share of the cores, unless it runs alone, as on GitHub, where CI is true.
export function sharingEnvironment(environment, checksAtOnce) {
  if (environment.CI === "true" || environment.FATHOM_CHECK_SHARES)
    return environment;
  return { ...environment, FATHOM_CHECK_SHARES: String(checksAtOnce) };
}

// Runs the work in its turn, and gives back what it gives. The work's environment is marked, so a
// check started from within it goes ahead rather than waiting on the turn this one holds, and keeps
// the share of the cores it was given, or every core for a run started already holding a turn.
export function inCheckTurn(
  work,
  { slots = checkRuns, environment = process.env } = {},
) {
  const alreadyHeld = holdsTurn(environment, slotMarker);
  return inTurn(
    (marked) =>
      work(alreadyHeld ? marked : sharingEnvironment(marked, slots.atOnce)),
    slots,
    slotMarker,
    environment,
  );
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
