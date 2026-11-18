// SPDX-License-Identifier: Apache-2.0

// Prints "true" or "false", for the Check workflow, saying whether a pull request needs the
// container tests. Usage: node scripts/needs-container-tests.mjs <base commit>

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { isDocumentation } from "./test-changed.mjs";

// The images are built from the code, its packages and its settings, so only documentation is spared.
export function needsContainerTests(paths) {
  return paths.some((path) => !isDocumentation(path));
}

// The paths changed between the base commit and this one, or a thrown error when git can't say.
export function pathsChangedSince(base, run = spawnSync) {
  const result = run("git", ["diff", "--name-only", `${base}...HEAD`], {
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(
      `git diff against ${base} failed: ${String(result.stderr).trim()}`,
    );
  return result.stdout.split("\n").filter((line) => line !== "");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [base] = process.argv.slice(2);
  if (base === undefined || base === "") {
    console.error("error: Usage: needs-container-tests.mjs <base commit>");
    process.exit(2);
  }
  try {
    console.log(String(needsContainerTests(pathsChangedSince(base))));
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
