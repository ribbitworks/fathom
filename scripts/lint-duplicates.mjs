// SPDX-License-Identifier: Apache-2.0

// Fails when the change copies code: when jscpd, as .jscpd.json sets it up, finds more code repeated
// between two files than in the code the branch left origin/main at.

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mergeBase, output } from "./changed-paths.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const jscpd = join(repositoryRoot, "node_modules", ".bin", "jscpd");
const reportName = "jscpd-report";
const configName = ".jscpd.json";

// The copies in a jscpd report of files under root, each naming its two places from the root.
export function copiesIn(report, root) {
  if (!Array.isArray(report?.duplicates))
    throw new Error("jscpd's report lists no duplicates");
  return report.duplicates.map((duplicate) => ({
    tokens: duplicate.tokens,
    lines: duplicate.lines,
    places: [duplicate.firstFile, duplicate.secondFile].map((file) => ({
      path: relative(root, file.name),
      start: file.start,
      end: file.end,
    })),
  }));
}

function pairOf(copy, renamed = new Map()) {
  return copy.places
    .map(({ path }) => renamed.get(path) ?? path)
    .sort()
    .join("\n");
}

function tokensByPair(copies, renamed) {
  const tokens = new Map();
  for (const copy of copies) {
    const pair = pairOf(copy, renamed);
    tokens.set(pair, (tokens.get(pair) ?? 0) + copy.tokens);
  }
  return tokens;
}

function location({ path, start, end }) {
  return `${path}:${start}-${end}`;
}

function olderCopiesLine(count) {
  if (count === 0) return "No code copied by this change, and no older copies";
  return count === 1
    ? "No code copied by this change; 1 older copy is left for a later change to share"
    : `No code copied by this change; ${count} older copies are left for later changes to share`;
}

// Fails where two files repeat more of each other than they did at the base, so an edit inside an
// older copy, which shrinks it, still passes. Files the change renamed are known by their new paths.
export function duplicatesVerdict({ copies, baseCopies, renamed }) {
  const before = tokensByPair(baseCopies, renamed);
  const after = tokensByPair(copies);
  const grownPairs = new Set(
    [...after]
      .filter(([pair, tokens]) => tokens > (before.get(pair) ?? 0))
      .map(([pair]) => pair),
  );
  const newCopies = copies.filter((copy) => grownPairs.has(pairOf(copy)));
  if (newCopies.length === 0)
    return { passed: true, lines: [olderCopiesLine(copies.length)] };
  return {
    passed: false,
    lines: [
      grownPairs.size === 1
        ? "This change copies code between two files; share it instead:"
        : `This change copies code between ${grownPairs.size} pairs of files; share each instead:`,
      ...newCopies.map(
        ({ places: [first, second], lines }) =>
          `  ${location(first)} and ${location(second)} (${lines} lines)`,
      ),
    ],
  };
}

// The new paths of the files git's --name-status output says were renamed, by their old paths.
export function renamesIn(nameStatus) {
  return new Map(
    nameStatus
      .split("\n")
      .filter((line) => line.startsWith("R"))
      .map((line) => {
        const [, from, to] = line.split("\t");
        return [from, to];
      }),
  );
}

// jscpd reads the paths .jscpd.json names from the folder that holds it.
function scan(folder) {
  const reports = mkdtempSync(join(tmpdir(), "fathom-duplicates-"));
  try {
    output(
      jscpd,
      [
        "--config",
        join(folder, configName),
        "--reporters",
        "json",
        "--output",
        reports,
        "--report-name",
        reportName,
        "--absolute",
        "--silent",
      ],
      { cwd: folder },
    );
    const report = JSON.parse(
      readFileSync(join(reports, `${reportName}.json`), "utf8"),
    );
    return copiesIn(report, folder);
  } finally {
    rmSync(reports, { recursive: true, force: true });
  }
}

function failure(what, result) {
  return new Error(
    `${what} failed: ${String(result.error?.message ?? result.stderr).trim()}`,
  );
}

// The files git tracks at a commit, written out to a folder of their own.
function exported(repository, commit) {
  // By its real path, as jscpd names the files, since macOS's temporary folder is a link.
  const folder = realpathSync(
    mkdtempSync(join(tmpdir(), "fathom-duplicates-base-")),
  );
  const archive = spawnSync("git", ["archive", commit], {
    cwd: repository,
    maxBuffer: Number.MAX_SAFE_INTEGER,
  });
  if (archive.status !== 0) throw failure(`git archive ${commit}`, archive);
  const unpacked = spawnSync("tar", ["-x", "-C", folder], {
    input: archive.stdout,
  });
  if (unpacked.status !== 0) throw failure(`Unpacking ${commit}`, unpacked);
  return folder;
}

// Checks a repository's change since it left origin/main, scanning both with its .jscpd.json.
export function lintDuplicates(checkout) {
  const repository = realpathSync(checkout);
  const base = mergeBase("origin/main", { cwd: repository });
  const baseFolder = exported(repository, base);
  try {
    copyFileSync(join(repository, configName), join(baseFolder, configName));
    return duplicatesVerdict({
      copies: scan(repository),
      baseCopies: scan(baseFolder),
      renamed: renamesIn(
        output("git", ["diff", "--name-status", "-M", base], {
          cwd: repository,
        }),
      ),
    });
  } finally {
    rmSync(baseFolder, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const verdict = lintDuplicates(repositoryRoot);
    for (const line of verdict.lines)
      (verdict.passed ? console.log : console.error)(line);
    if (!verdict.passed) process.exitCode = 1;
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
