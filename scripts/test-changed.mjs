// SPDX-License-Identifier: Apache-2.0

// Runs the tests a change can affect, for the rounds of fixes before the full 'pnpm check': every
// test of each workspace package changed since this branch left origin/main, committed or not, and
// of every package that depends on one, with the script tests, which also check package files. A
// change outside the packages, other than to documentation, can affect any test, such as the
// lockfile, scripts/ or deploy/, so it runs every test. Runs any tests once no other copy of the
// repository is running a check.
// Usage: node scripts/test-changed.mjs

import { pathToFileURL } from "node:url";
import { inCheckTurn } from "./check-turn.mjs";
import { changedPaths } from "./changed-paths.mjs";
import { runPackageTests, runPnpm } from "./package-tests.mjs";

function isDocumentation(path) {
  return path.endsWith(".md") || path.startsWith("docs/");
}

// The tests to run for these changed paths: none, every test, or the script tests and the tests of
// the package folders given, such as apps/server, with every package depending on them.
export function testsFor(paths) {
  const packages = new Set();
  let scripts = false;
  for (const path of paths) {
    if (isDocumentation(path)) continue;
    const match = /^((?:apps|packages)\/[^/]+)\//.exec(path);
    if (!match) return { kind: "everything" };
    scripts = true;
    packages.add(match[1]);
  }
  return scripts
    ? { kind: "packages", packages: [...packages].sort() }
    : { kind: "none" };
}

// Runs the tests chosen, once no other copy of the repository is running a check, unless there are
// none, and says whether they passed.
export async function runTests(
  tests,
  { inTurn = inCheckTurn, run = runPnpm, runPackages = runPackageTests } = {},
) {
  if (tests.kind === "none") {
    console.log("==> Only documentation changed, so no tests run");
    return true;
  }
  return inTurn(async (environment) => {
    if (tests.kind === "everything") {
      console.log("==> Files outside the packages changed, so every test runs");
      return run(["test"], environment);
    }
    console.log(
      `==> Testing the scripts, ${tests.packages.join(", ")}, and the packages depending on them`,
    );
    const scriptsPassed = await run(["test:scripts"], environment);
    const packageArgs = [
      ...tests.packages.flatMap((folder) => ["--filter", `...{./${folder}}`]),
      "--parallel",
      "--no-bail",
      "--if-present",
      "test",
    ];
    const packagesPassed = await runPackages(packageArgs, { environment });
    return scriptsPassed && packagesPassed;
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let tests;
  try {
    tests = testsFor(changedPaths());
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  }
  try {
    process.exit((await runTests(tests)) ? 0 : 1);
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
