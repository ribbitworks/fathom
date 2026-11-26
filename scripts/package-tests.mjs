// SPDX-License-Identifier: Apache-2.0

// Runs package tests in a check's turn on this computer, with each package's workers limited.
// Usage: node scripts/package-tests.mjs <pnpm arguments>, such as --recursive test

import { availableParallelism } from "node:os";
import { pathToFileURL } from "node:url";
import { inCheckTurn } from "./check-turn.mjs";
import { jobLimitSeconds, runCommand } from "./run-command.mjs";
import { workspaceManifests } from "./workspace.mjs";

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

// Chosen by measurement, as Checks and CI's Sharing the Machine records.
const packagesRunningLong = [
  "apps/server",
  "apps/web",
  "packages/db",
  "packages/seed",
];
const packagesWithDatabases = new Set([
  "apps/server",
  "packages/db",
  "packages/seed",
]);
const databaseWorkersAtMost = 12;
const coresLeftFree = 2;

// How many workers each package's Vitest may run, out of this computer's cores, when these packages
// run side by side: the cores but two, for the development servers, shared among those whose tests
// run longest, and no more than were measured for a package starting test databases.
export function workersPerPackage(
  cores = availableParallelism(),
  running = packagesRunningLong,
) {
  const long = running.filter((folder) =>
    packagesRunningLong.includes(folder),
  ).length;
  const share = Math.max(
    1,
    Math.floor((cores - coresLeftFree) / Math.max(1, long)),
  );
  return running.some((folder) => packagesWithDatabases.has(folder))
    ? Math.min(share, databaseWorkersAtMost)
    : share;
}

// pnpm's options that choose packages and take a package after them, and those that take none.
const selectorsWithPackage = new Set(["--filter", "-F"]);
const selectorsAlone = new Set(["--fail-if-no-match"]);

// pnpm's options that choose packages, the packages they name, and the other arguments. Throws when
// such an option is missing its package.
function readSelectors(args) {
  const selectors = [];
  const named = [];
  const rest = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args.at(index));
    if (selectorsWithPackage.has(arg)) {
      const selected = args.at(index + 1);
      if (selected === undefined)
        throw new Error(`${arg} needs a package, such as ${arg} @fathom/web`);
      selectors.push(arg, String(selected));
      named.push(String(selected));
      index += 1;
    } else if (arg.startsWith("--filter=")) {
      selectors.push(arg);
      named.push(arg.slice("--filter=".length));
    } else if (selectorsAlone.has(arg)) selectors.push(arg);
    else rest.push(arg);
  }
  return { selectors, named, rest };
}

// The arguments with pnpm's options that choose packages moved first, since pnpm hands anything
// after a script's name to the script.
export function selectorsFirst(args) {
  const { selectors, rest } = readSelectors(args);
  return [...selectors, ...rest];
}

// The package folders pnpm's options choose, by folder or by name. Every package whose tests run
// longest stands in when they choose none, or choose any package this cannot name, such as by a
// pattern, with its dependents, or by leaving one out.
export function packagesChosen(args, manifests = workspaceManifests()) {
  const folders = new Set(manifests.map(({ folder }) => folder));
  const folderOf = new Map(
    manifests.map(({ folder, manifest }) => [manifest.name, folder]),
  );
  const chosen = readSelectors(args).named.map((value) => {
    const path = value.replace(/^\.\//u, "").replace(/\/$/u, "");
    return folders.has(path) ? path : folderOf.get(value);
  });
  return chosen.length === 0 || chosen.includes(undefined)
    ? packagesRunningLong
    : chosen;
}

// Runs pnpm with these arguments in a check's turn, as package tests use every core, with each
// package's workers limited unless VITEST_MAX_WORKERS already says how many, and says whether it
// passed. The workers are shared among the packages chosen, or those `running` names when other
// packages run beside them, out of `cores`.
export async function runPackageTests(
  args,
  {
    slots,
    run = runPnpm,
    environment = process.env,
    running = packagesChosen(args),
    cores = availableParallelism(),
  } = {},
) {
  const ordered = selectorsFirst(args);
  return inCheckTurn(
    (given) =>
      run(ordered, {
        ...given,
        VITEST_MAX_WORKERS:
          given.VITEST_MAX_WORKERS || String(workersPerPackage(cores, running)),
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
