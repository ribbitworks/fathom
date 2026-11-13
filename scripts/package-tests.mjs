// SPDX-License-Identifier: Apache-2.0

// Runs package tests in one copy of the repository at a time on this computer. Package tests start
// test databases and run every package side by side, so several copies running them at once,
// as checks in several clones do, starve each other until tests time out. A copy that has to wait
// says so, naming the process and folder it waits for, and how long it waited. Each package's Vitest
// gets a share of the cores, rather than a worker for nearly every core each.
// Usage: node scripts/package-tests.mjs <pnpm arguments>, such as --recursive test

import { availableParallelism } from "node:os";
import { pathToFileURL } from "node:url";
import {
  inTurn,
  machineSlots,
  millisecondsPerSecond,
} from "../packages/test-utils/src/slots.ts";
import { runCommand } from "./run-command.mjs";

export const packageTestRuns = machineSlots("package-tests", {
  atOnce: 1,
  retryMilliseconds: millisecondsPerSecond,
  reportAfterMilliseconds: 0,
  waitingTo: "run package tests",
});

// Runs pnpm with these arguments, saying whether it passed.
export async function runPnpm(args, environment = process.env) {
  console.log(`==> pnpm ${args.join(" ")}`);
  return (await runCommand("pnpm", args, environment)) === 0;
}

// Vitest's own default is a worker for each core but one, in every package, while the package tests
// run every package side by side. Chosen by measurement: 4 workers for each of the four packages
// whose tests run longest leaves two cores free, for the development servers, and kept the test
// databases from starving each other.
const packagesRunningLong = 4;
const coresLeftFree = 2;

// How many workers each package's Vitest may run, out of this computer's cores.
export function workersPerPackage(cores = availableParallelism()) {
  return Math.max(1, Math.floor((cores - coresLeftFree) / packagesRunningLong));
}

// Runs pnpm with these arguments once no other copy is running package tests, with each package's
// workers limited unless VITEST_MAX_WORKERS already says how many, and says whether it passed.
export async function runPackageTests(
  args,
  { slots = packageTestRuns, run = runPnpm, environment = process.env } = {},
) {
  // The marker stops package tests run from within these from waiting on the slot this run holds.
  return inTurn(
    (marked) =>
      run(args, {
        ...marked,
        VITEST_MAX_WORKERS:
          marked.VITEST_MAX_WORKERS || String(workersPerPackage()),
      }),
    slots,
    "FATHOM_PACKAGE_TESTS_SLOT",
    environment,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit((await runPackageTests(process.argv.slice(2))) ? 0 : 1);
}
