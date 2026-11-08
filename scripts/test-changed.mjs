// SPDX-License-Identifier: Apache-2.0

// Runs the tests a change can affect, for the rounds of fixes before the full 'pnpm check': every
// test of each workspace package changed since this branch left origin/main, committed or not, and
// of every package that depends on one, with the script tests, which also check package files. A
// change outside the packages, other than to documentation, can affect any test, such as the
// lockfile, scripts/ or deploy/, so it runs every test.
// Usage: node scripts/test-changed.mjs

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

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

function output(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.stderr.trim()}`,
    );
  return result.stdout;
}

// Every path changed since the branch left origin/main, committed or not, new files included. A
// moved file is listed at both its old and its new path, so the package it left is tested too.
function changedPaths() {
  const base = output("git", ["merge-base", "HEAD", "origin/main"]).trim();
  const lines = [
    output("git", ["diff", "--name-only", "--no-renames", base]),
    output("git", ["ls-files", "--others", "--exclude-standard"]),
  ].join("\n");
  return lines.split("\n").filter((line) => line !== "");
}

function run(args) {
  console.log(`==> pnpm ${args.join(" ")}`);
  return spawnSync("pnpm", args, { stdio: "inherit" }).status === 0;
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
  let passed = true;
  if (tests.kind === "none") {
    console.log("==> Only documentation changed, so no tests run");
  } else if (tests.kind === "everything") {
    console.log("==> Files outside the packages changed, so every test runs");
    passed = run(["test"]);
  } else {
    console.log(
      `==> Testing the scripts, ${tests.packages.join(", ")}, and the packages depending on them`,
    );
    const scriptsPassed = run(["test:scripts"]);
    const packagesPassed = run([
      ...tests.packages.flatMap((folder) => ["--filter", `...{./${folder}}`]),
      "--parallel",
      "--no-bail",
      "--if-present",
      "test",
    ]);
    passed = scriptsPassed && packagesPassed;
  }
  process.exit(passed ? 0 : 1);
}
