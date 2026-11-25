// SPDX-License-Identifier: Apache-2.0

// Runs the tests a change can affect, checking the coverage of the source files changed, as the
// Testing Standards' Running Tests sets out. Usage: node scripts/test-changed.mjs [--uncommitted]
// [--without-types]

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
// The packages' coverage settings measure their TypeScript source, and leave out its tests.
const typeScriptSource = /\.tsx?$/;
const typeScriptTest = /\.test\.tsx?$/;

// Whether a changed path is documentation alone, which no test reads; Help pages are built into the
// web app, so they are not.
export function isDocumentation(path) {
  return (
    !path.startsWith(helpPages) &&
    (path.endsWith(".md") || path.startsWith("docs/"))
  );
}

// The scripts that start the packages' tests, whose own tests stub that out, so a change to one runs
// every package's tests to show they still start.
const packageTestRunners = new Set([
  "scripts/check-turn.mjs",
  "scripts/package-tests.mjs",
  "scripts/run-command.mjs",
  "scripts/test-changed.mjs",
  "scripts/workspace.mjs",
]);

// Whether only the script tests can reach a changed path: the scripts' own Node.js modules and their
// tests, and the files in .github/, which no package reads. Shell scripts are not, since the
// packages' tests run some, such as scripts/lib.sh to build the test database.
function reachedByScriptTestsAlone(path) {
  return (
    (path.startsWith("scripts/") &&
      path.endsWith(".mjs") &&
      !packageTestRunners.has(path)) ||
    path.startsWith(".github/")
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

// The changed source files whose coverage GitHub's check measures, as their package's coverage
// settings choose, in packages with tests. A changed or removed test stands for the source file
// beside it, which it may have covered alone.
function coveredBy(code, { workspace, exists }) {
  const sources = code
    .filter((path) => {
      const owner = packageOf(path);
      return (
        owner !== undefined &&
        workspace.get(owner)?.hasTests === true &&
        path.startsWith(`${owner}/src/`) &&
        typeScriptSource.test(path)
      );
    })
    .flatMap((path) =>
      typeScriptTest.test(path)
        ? [".ts", ".tsx"].map((ending) => path.replace(typeScriptTest, ending))
        : [path],
    )
    .filter((path) => exists(path));
  return [...new Set(sources)].sort();
}

const withTests = (folders, workspace) =>
  [...folders].filter((folder) => workspace.get(folder)?.hasTests).sort();

// The tests to run for these changed paths: none, or the script tests with the package folders
// whose every test runs, which is all of them for most changes outside the packages, those whose
// tests run only when they import a changed file, and the source files whose coverage is checked.
export function testsFor(
  paths,
  { workspace = readWorkspace(), exists = existsSync } = {},
) {
  const changed = paths.filter((path) => !isDocumentation(path));
  const code = changed.filter((path) => !reachedByScriptTestsAlone(path));
  if (code.some((path) => packageOf(path) === undefined))
    return {
      kind: "everything",
      whole: withTests(workspace.keys(), workspace),
      related: [],
      files: [],
      covered: coveredBy(code, { workspace, exists }),
    };
  if (changed.length === 0) return { kind: "none" };
  const covered = coveredBy(code, { workspace, exists });
  const imported = code.filter(reachedByImports);
  const wholly = withDependents(
    code.filter((path) => !reachedByImports(path)).map(packageOf),
    workspace,
  );
  const files = [
    ...new Set([
      ...imported
        .map((path) => (path.startsWith(helpPages) ? helpPagesModule : path))
        // A removed file runs nothing of its own, since whatever imported it changed too.
        .filter((path) => exists(path)),
      // Every test importing a covered file runs, so its coverage is measured as on GitHub.
      ...covered,
    ]),
  ].sort();
  const importing = [...withDependents(files.map(packageOf), workspace)].filter(
    (folder) => !wholly.has(folder),
  );
  return {
    kind: "packages",
    whole: withTests(wholly, workspace),
    related: withTests(importing, workspace),
    files,
    covered,
  };
}

// The tests to run for the command's arguments, with --uncommitted counting only the work not yet
// committed, and whether to check the types too, unless --without-types says another job does, as
// the check before a push's own does. Throws on an unknown argument.
export function testsForArguments(
  args,
  listChanged = changedPaths,
  choose = testsFor,
) {
  const { values } = parseArgs({
    args,
    options: {
      uncommitted: { type: "boolean", default: false },
      "without-types": { type: "boolean", default: false },
    },
  });
  return {
    tests: choose(listChanged({ uncommitted: values.uncommitted })),
    checkTypes: !values["without-types"],
  };
}

const filtersFor = (folders) =>
  folders.flatMap((folder) => ["--filter", `./${folder}`]);

const coverage = [
  "--coverage",
  "--coverage.reporter=text",
  "--coverage.skipFull",
];

// Vitest's arguments checking the coverage of a package's covered files alone, against the
// thresholds its settings set, or none when it holds none of them.
function coverageArguments(folder, covered) {
  const own = covered
    .filter((path) => path.startsWith(`${folder}/`))
    .map((path) => path.slice(folder.length + 1));
  return own.length === 0
    ? []
    : [...coverage, ...own.map((path) => `--coverage.include=${path}`)];
}

// Runs Vitest's command in the packages, side by side, on these files if any, with the coverage
// arguments each is given: those given the same together, so each run checks its own files. Says
// whether all passed.
async function inPackages(
  folders,
  { command, files = [], coverageFor, runPackages, environment },
) {
  const runs = new Map();
  for (const folder of folders) {
    const given = coverageFor(folder);
    const key = given.join(" ");
    runs.set(key, {
      coverage: given,
      folders: [...(runs.get(key)?.folders ?? []), folder],
    });
  }
  const passed = await Promise.all(
    [...runs.values()].map(({ coverage: given, folders: some }) =>
      runPackages(
        [
          ...filtersFor(some),
          "--parallel",
          "--no-bail",
          "exec",
          "vitest",
          ...command,
          ...given,
          ...files,
        ],
        { environment },
      ),
    ),
  );
  return passed.every(Boolean);
}

// Runs the tests chosen, and the type check unless told not to, once no other copy of the repository is running a
// check, unless there are none, and says whether they passed.
export async function runTests(
  tests,
  {
    checkTypes = true,
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
    console.log(
      tests.kind === "everything"
        ? "==> Files outside the packages changed, so every test runs"
        : "==> Testing the scripts and the packages a change can affect",
    );
    const scriptsPassed = await run(["test:scripts"], environment);
    // The tests compile without checking types, so the type check GitHub's check runs is run too;
    // its build is incremental, checking again only what changed.
    // The type check covers the packages alone, not the scripts.
    const packagesRun =
      tests.kind === "everything" ||
      tests.whole.length > 0 ||
      tests.related.length > 0;
    let typesPassed = true;
    if (checkTypes && packagesRun) {
      console.log("==> Checking the types");
      typesPassed = await run(["typecheck"], environment);
    }
    const covering = tests.covered.join(", ");
    if (covering !== "")
      console.log(`==> Checking the coverage of ${covering}`);
    let packagesPassed = true;
    if (tests.whole.length > 0) {
      console.log(
        `==> Every test of ${tests.whole.join(", ")}, with all their coverage`,
      );
      // Settings, dependencies or files outside the source can change any file's coverage.
      packagesPassed = await inPackages(tests.whole, {
        command: ["run"],
        coverageFor: () => coverage,
        runPackages,
        environment,
      });
    }
    if (tests.related.length > 0) {
      console.log(
        `==> The tests of ${tests.related.join(", ")} that import ${tests.files.join(", ")}`,
      );
      const relatedPassed = await inPackages(tests.related, {
        command: ["related", "--run", "--passWithNoTests"],
        files: tests.files.map((file) => resolve(root, file)),
        coverageFor: (folder) => coverageArguments(folder, tests.covered),
        runPackages,
        environment,
      });
      packagesPassed = packagesPassed && relatedPassed;
    }
    return scriptsPassed && typesPassed && packagesPassed;
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let chosen;
  try {
    chosen = testsForArguments(process.argv.slice(2));
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  }
  try {
    const { tests, checkTypes } = chosen;
    process.exit((await runTests(tests, { checkTypes })) ? 0 : 1);
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
