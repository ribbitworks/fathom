// SPDX-License-Identifier: Apache-2.0

// Runs the tests a change can affect, for the rounds of fixes before the full 'pnpm check', without
// measuring coverage, which only the full check enforces. What changed since this branch left
// origin/main counts, committed or not, or with --uncommitted, only the work not yet committed. A
// TypeScript or JavaScript file in a package's src folder runs only the tests that import it,
// directly or through other files, in that package and every package depending on it; a Help page
// runs the web app's tests that import the Help pages. Any other change in a package, such as its
// settings, stylesheets or migrations, runs every test of that package and of every package
// depending on it. A source file removed runs nothing of its own, since whatever imported it
// changed too. Any code changed runs the script tests, which also check package files. A change
// outside the packages, other than to documentation, can affect any test, such as the lockfile,
// scripts/ or deploy/, so it runs every test. A change to the web app's stylesheets alone runs only
// the web app's tests and the linters. Tests that reach code other than by importing it, such as
// building the web app, run in the full check. Runs any tests once no other copy of the repository
// is running a check.
// Usage: node scripts/test-changed.mjs [--uncommitted]

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { inCheckTurn } from "./check-turn.mjs";
import { changedPaths } from "./changed-paths.mjs";
import { runPackageTests, runPnpm } from "./package-tests.mjs";
import { packageGroups, workspaceManifests } from "./workspace.mjs";

const webApp = "apps/web";
const helpPages = "docs/help/";
// Gathers the Help pages, so it stands for each of them, a removed one included, which no test
// could import.
const helpPagesModule = `${webApp}/src/help-pages.ts`;

const scriptOrModule = /\.(?:[cm]?[jt]s|tsx)$/;

// Whether a changed path is documentation alone, which no test reads; Help pages are built into the
// web app, so they are not.
export function isDocumentation(path) {
  return (
    !path.startsWith(helpPages) &&
    (path.endsWith(".md") || path.startsWith("docs/"))
  );
}

// The workspace package a path is part of, such as apps/server, or undefined outside the packages.
function packageOf(path) {
  if (path.startsWith(helpPages)) return webApp;
  const [group, name, ...rest] = path.split("/");
  return packageGroups.includes(group) && rest.length > 0
    ? `${group}/${name}`
    : undefined;
}

function isWebStylesheet(path) {
  return path.startsWith(`${webApp}/`) && path.endsWith(".css");
}

// Whether the tests that import this file are all the tests it can affect. Vitest also reruns every
// test when a file it loads itself, such as a test setup file, changes.
function reachedByImports(path) {
  if (path.startsWith(helpPages)) return true;
  const owner = packageOf(path);
  return (
    owner !== undefined &&
    path.startsWith(`${owner}/src/`) &&
    scriptOrModule.test(path)
  );
}

// The workspace's packages, by folder: the folders of the packages each depends on, and whether it
// has tests.
export function readWorkspace(manifests = workspaceManifests()) {
  const folderOf = new Map(
    manifests.map(({ folder, manifest }) => [manifest.name, folder]),
  );
  return new Map(
    manifests.map(({ folder, manifest }) => [
      folder,
      {
        dependsOn: Object.keys({
          ...manifest.dependencies,
          ...manifest.devDependencies,
        })
          .map((name) => folderOf.get(name))
          .filter((dependency) => dependency !== undefined),
        hasTests: manifest.scripts?.test !== undefined,
      },
    ]),
  );
}

// These package folders and every package depending on them, directly or through others.
function withDependents(folders, workspace) {
  const found = new Set(folders);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [folder, { dependsOn }] of workspace) {
      if (!found.has(folder) && dependsOn.some((one) => found.has(one))) {
        found.add(folder);
        grew = true;
      }
    }
  }
  return found;
}

const withTests = (folders, workspace) =>
  [...folders].filter((folder) => workspace.get(folder)?.hasTests).sort();

// The tests to run for these changed paths: none, the web app's tests and the linters, or the
// script tests with the package folders whose every test runs, which is all of them for a change
// outside the packages, and those whose tests run only when they import a changed file.
export function testsFor(
  paths,
  { workspace = readWorkspace(), exists = existsSync } = {},
) {
  const code = paths.filter((path) => !isDocumentation(path));
  if (code.length > 0 && code.every(isWebStylesheet))
    return { kind: "stylesheets" };
  if (code.some((path) => packageOf(path) === undefined))
    return {
      kind: "everything",
      whole: withTests(workspace.keys(), workspace),
      related: [],
      files: [],
    };
  if (code.length === 0) return { kind: "none" };
  const imported = code.filter(reachedByImports);
  const wholly = withDependents(
    code.filter((path) => !reachedByImports(path)).map(packageOf),
    workspace,
  );
  const files = [
    ...new Set(
      imported
        .map((path) => (path.startsWith(helpPages) ? helpPagesModule : path))
        .filter((path) => exists(path)),
    ),
  ].sort();
  const importing = [...withDependents(files.map(packageOf), workspace)].filter(
    (folder) => !wholly.has(folder),
  );
  return {
    kind: "packages",
    whole: withTests(wholly, workspace),
    related: withTests(importing, workspace),
    files,
  };
}

// The tests to run for the command's arguments, with --uncommitted counting only the work not yet
// committed. Throws on an unknown argument.
export function testsForArguments(
  args,
  listChanged = changedPaths,
  choose = testsFor,
) {
  const { values } = parseArgs({
    args,
    options: { uncommitted: { type: "boolean", default: false } },
  });
  return choose(listChanged({ uncommitted: values.uncommitted }));
}

const filtersFor = (folders) =>
  folders.flatMap((folder) => ["--filter", `./${folder}`]);

// Runs the tests chosen, once no other copy of the repository is running a check, unless there are
// none, and says whether they passed.
export async function runTests(
  tests,
  {
    inTurn = inCheckTurn,
    run = runPnpm,
    runPackages = runPackageTests,
    root = process.cwd(),
  } = {},
) {
  if (tests.kind === "none") {
    console.log("==> Only documentation changed, so no tests run");
    return true;
  }
  return inTurn(async (environment) => {
    if (tests.kind === "stylesheets") {
      console.log(
        "==> Only the web app's stylesheets changed, so its tests and the linters run",
      );
      const lintPassed = await run(["lint"], environment);
      const formatPassed = await run(["format:check"], environment);
      const webPassed = await runPackages(
        [...filtersFor([webApp]), "exec", "vitest", "run"],
        { environment },
      );
      return lintPassed && formatPassed && webPassed;
    }
    console.log(
      tests.kind === "everything"
        ? "==> Files outside the packages changed, so every test runs"
        : "==> Testing the scripts and the packages a change can affect",
    );
    const scriptsPassed = await run(["test:scripts"], environment);
    let packagesPassed = true;
    if (tests.whole.length > 0) {
      console.log(`==> Every test of ${tests.whole.join(", ")}`);
      packagesPassed = await runPackages(
        [
          ...filtersFor(tests.whole),
          "--parallel",
          "--no-bail",
          "exec",
          "vitest",
          "run",
        ],
        { environment },
      );
    }
    if (tests.related.length > 0) {
      console.log(
        `==> The tests of ${tests.related.join(", ")} that import ${tests.files.join(", ")}`,
      );
      const relatedPassed = await runPackages(
        [
          ...filtersFor(tests.related),
          "--parallel",
          "--no-bail",
          "exec",
          "vitest",
          "related",
          "--run",
          "--passWithNoTests",
          ...tests.files.map((file) => resolve(root, file)),
        ],
        { environment },
      );
      packagesPassed = packagesPassed && relatedPassed;
    }
    return scriptsPassed && packagesPassed;
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let tests;
  try {
    tests = testsForArguments(process.argv.slice(2));
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
