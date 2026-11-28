// SPDX-License-Identifier: Apache-2.0

// Lists every path changed since this branch left origin/main, or another base, committed or not,
// or only the work not yet committed, for the commands that run only what a change can affect.

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// A command's standard output, failing with what it said when it can't start or doesn't succeed.
export function output(command, args, { cwd } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", cwd });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} failed: ${String(result.error?.message ?? result.stderr).trim()}`,
    );
  return result.stdout;
}

// The commit this branch left origin/main at, or another base.
export function mergeBase(since = "origin/main", { cwd } = {}) {
  return output("git", ["merge-base", "HEAD", since], { cwd }).trim();
}

export function changedPaths({
  uncommitted = false,
  since = "origin/main",
} = {}) {
  const base = uncommitted ? "HEAD" : mergeBase(since);
  const lines = [
    output("git", ["diff", "--name-only", "--no-renames", base]),
    output("git", ["ls-files", "--others", "--exclude-standard"]),
  ].join("\n");
  return [...new Set(lines.split("\n").filter((line) => line !== ""))];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    for (const path of changedPaths()) console.log(path);
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
