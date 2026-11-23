// SPDX-License-Identifier: Apache-2.0

// Runs package tests in a check's turn on this computer, with each package's workers limited.
// Usage: node scripts/package-tests.mjs <pnpm arguments>, such as --recursive test

import { availableParallelism } from "node:os";
import { pathToFileURL } from "node:url";
import { inCheckTurn } from "./check-turn.mjs";
import { jobLimitSeconds, runCommand } from "./run-command.mjs";

// Runs pnpm with these arguments, saying whether it passed, stopping it as hung once it runs past a
// check's job limit, as it may hold the check's turn.
export async function runPnpm(args, environment = process.env) {
  console.log(`==> pnpm ${args.join(" ")}`);
  return (
    (await runCommand("pnpm", args, environment, {
      limitSeconds: jobLimitSeconds(environment),
    })) === 0
  );
}

// Vitest's own default is a worker for each core but one, in every package, while the package tests
// run every package side by side. Chosen by measurement: 4 workers for each of the four packages
// whose tests run longest leaves two cores free, for the development servers, and kept the test
// databases from starving each other.
const packagesRunningLong = 4;
const coresLeftFree = 2;

// How many workers each package's Vitest may run, out of this computer's cores, when that many
// checks share it.
export function workersPerPackage(cores = availableParallelism(), shares = 1) {
  return Math.max(
    1,
    Math.floor((cores - coresLeftFree) / shares / packagesRunningLong),
  );
}

// How many checks share this computer, as the check that runs these tests was told, or one when no
// check runs them.
export function sharesOf(environment) {
  const shares = Number.parseInt(environment.FATHOM_CHECK_SHARES ?? "", 10);
  return Number.isInteger(shares) && shares > 0 ? shares : 1;
}

// pnpm's options that choose packages and take a package after them, and those that take none.
const selectorsWithPackage = new Set(["--filter", "-F"]);
const selectorsAlone = new Set(["--fail-if-no-match"]);

// The arguments with pnpm's options that choose packages moved first, since pnpm hands anything
// after a script's name to the script. Throws when such an option is missing its package.
export function selectorsFirst(args) {
  const selectors = [];
  const rest = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args.at(index));
    if (selectorsWithPackage.has(arg)) {
      const selected = args.at(index + 1);
      if (selected === undefined)
        throw new Error(`${arg} needs a package, such as ${arg} @fathom/web`);
      selectors.push(arg, selected);
      index += 1;
    } else if (selectorsAlone.has(arg) || arg.startsWith("--filter="))
      selectors.push(arg);
    else rest.push(arg);
  }
  return [...selectors, ...rest];
}

// Runs pnpm with these arguments in a check's turn, as package tests use every core they are given,
// with each package's workers limited to the check's share unless VITEST_MAX_WORKERS already says
// how many, and says whether it passed.
export async function runPackageTests(
  args,
  { slots, run = runPnpm, environment = process.env } = {},
) {
  const ordered = selectorsFirst(args);
  return inCheckTurn(
    (given) =>
      run(ordered, {
        ...given,
        VITEST_MAX_WORKERS:
          given.VITEST_MAX_WORKERS ||
          String(workersPerPackage(availableParallelism(), sharesOf(given))),
      }),
    { slots, environment },
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exit((await runPackageTests(process.argv.slice(2))) ? 0 : 1);
  } catch (problem) {
    console.error(
      `error: ${problem instanceof Error ? problem.message : String(problem)}`,
    );
    process.exit(1);
  }
}
