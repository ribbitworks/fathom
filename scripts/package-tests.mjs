// SPDX-License-Identifier: Apache-2.0

// Runs package tests in one copy of the repository at a time on this computer. Package tests start
// test databases and run every package side by side, so several copies running them at once,
// as checks in several clones do, starve each other until tests time out. A copy that has to wait
// says so, naming the process and folder it waits for, and how long it waited.
// Usage: node scripts/package-tests.mjs <pnpm arguments>, such as --recursive test

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { inSlot, machineSlots } from "../packages/test-utils/src/slots.ts";

const millisecondsPerSecond = 1_000;

export const packageTestRuns = machineSlots("package-tests", {
  atOnce: 1,
  retryMilliseconds: millisecondsPerSecond,
  reportAfterMilliseconds: 0,
  waitingTo: "run package tests",
});

// Runs pnpm with these arguments, saying whether it passed.
export function runPnpm(args, environment) {
  console.log(`==> pnpm ${args.join(" ")}`);
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
    env: environment,
  });
  if (result.error)
    console.error(`error: pnpm did not start: ${result.error.message}`);
  return result.status === 0;
}

// Runs pnpm with these arguments once no other copy is running package tests, and says whether it
// passed.
export async function runPackageTests(
  args,
  { slots = packageTestRuns, run = runPnpm, environment = process.env } = {},
) {
  // Set for the tests' own processes, so package tests run from within them do not wait on the slot
  // their own run holds.
  const runInHeldSlot = () =>
    Promise.resolve(
      run(args, { ...environment, FATHOM_PACKAGE_TESTS_SLOT: "1" }),
    );
  if (environment.FATHOM_PACKAGE_TESTS_SLOT === "1") return runInHeldSlot();
  const asked = Date.now();
  let waited = false;
  return inSlot(
    () => {
      if (waited) {
        slots.report(
          `Waited ${String(Math.round((Date.now() - asked) / millisecondsPerSecond))}s to run package tests`,
        );
      }
      return runInHeldSlot();
    },
    {
      ...slots,
      report: (message) => {
        waited = true;
        slots.report(message);
      },
    },
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit((await runPackageTests(process.argv.slice(2))) ? 0 : 1);
}
