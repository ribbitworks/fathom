// SPDX-License-Identifier: Apache-2.0

// Makes a release in two steps, so the default branch only changes through a pull request:
// - `pnpm release` works out the next version from the commits since the last release tag, adds
//   their subjects to CHANGELOG.md, commits it as "chore: release vX.Y.Z" on a release/vX.Y.Z
//   branch and pushes that branch, to be merged by pull request on whichever host keeps the code.
// - `pnpm release:tag`, after the merge, puts an annotated tag vX.Y.Z on the default branch's
//   commit that added that changelog section. It never pushes the tag.
// Both run only on a clean checkout of the default branch that matches origin, and --dry-run only
// prints what they would do.
//
// The version follows semantic versioning from the commit subjects, which follow the Commit
// Message Rules (`type: subject`):
// - A breaking change, marked by `!` after the type (`feat!: subject`) or a line starting
//   `BREAKING CHANGE:` in the body, raises the major, or the minor before 1.0.0.
// - Otherwise a `feat` or `ui` commit raises the minor, and anything else the patch.
// - The first release, with no release tag yet, is 0.1.0, and its changelog says only
//   "First release." rather than listing every commit since the start.
// - After a pre-release tag such as v0.2.0-rc.1, the next release is the version it led to, 0.2.0.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const changelogFile = "CHANGELOG.md";

const firstVersion = { major: 0, minor: 1, patch: 0 };

// The same rule as fathom_is_release_tag in lib.sh: vMAJOR.MINOR.PATCH with an optional
// pre-release, and no leading zeros in numbers.
const number = "(0|[1-9][0-9]*)";
const part = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)";
const releaseTag = new RegExp(
  `^v${number}\\.${number}\\.${number}(?:-(${part}(?:\\.${part})*))?$`,
);

export function parseReleaseTag(tag) {
  const match = releaseTag.exec(tag);
  if (!match) return undefined;
  const [, major, minor, patch, pre] = match;
  return {
    tag,
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    pre: pre ? pre.split(".") : [],
  };
}

function comparePart(a, b) {
  const aNumber = /^[0-9]+$/.test(a);
  const bNumber = /^[0-9]+$/.test(b);
  if (aNumber && bNumber) return Number(a) - Number(b);
  if (aNumber !== bNumber) return aNumber ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

// Semantic versioning's order: by major, minor and patch, then a release after its pre-releases,
// then pre-releases part by part, a longer one after one it begins with.
export function compareReleases(a, b) {
  const core = a.major - b.major || a.minor - b.minor || a.patch - b.patch;
  if (core) return core;
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length;
  const parts = a.pre.map((part, i) => [part, b.pre.at(i)]);
  for (const [aPart, bPart] of parts.slice(0, b.pre.length)) {
    const order = comparePart(aPart, bPart);
    if (order) return order;
  }
  return a.pre.length - b.pre.length;
}

export function latestRelease(tags) {
  return tags.map(parseReleaseTag).filter(Boolean).sort(compareReleases).at(-1);
}

// The newest release that is not a pre-release, which is what people most likely run.
export function latestFullRelease(tags) {
  return latestRelease(
    tags.filter((tag) => parseReleaseTag(tag)?.pre.length === 0),
  );
}

const subjectPattern = /^([a-z]+)(!?):\s*(.*)$/;
const breakingLine = /^BREAKING[ -]CHANGE:/m;

export function parseCommit({ subject, body = "" }) {
  const match = subjectPattern.exec(subject);
  if (!match) return { type: "other", breaking: false, text: subject };
  const [, type, bang, text] = match;
  return { type, breaking: bang === "!" || breakingLine.test(body), text };
}

export function nextVersion(last, commits) {
  if (!last) return { ...firstVersion };
  const { major, minor, patch } = last;
  if (last.pre.length) return { major, minor, patch };
  const breaking = commits.some((commit) => commit.breaking);
  const feature = commits.some((commit) =>
    ["feat", "ui"].includes(commit.type),
  );
  if (breaking && major > 0) return { major: major + 1, minor: 0, patch: 0 };
  if (breaking || feature) return { major, minor: minor + 1, patch: 0 };
  return { major, minor, patch: patch + 1 };
}

export const formatVersion = ({ major, minor, patch }) =>
  `${major}.${minor}.${patch}`;

const headings = [
  ["Breaking Changes", (commit) => commit.breaking],
  ["Features", (commit) => commit.type === "feat"],
  ["Fixes", (commit) => commit.type === "fix"],
  ["Interface", (commit) => commit.type === "ui"],
  ["Documentation", (commit) => commit.type === "docs"],
  ["Other", () => true],
];

// The changelog section for a release: each commit once, under the first heading it fits, in the
// order the commits were made.
export function changelogSection(version, date, commits) {
  const groups = new Map(headings.map(([heading]) => [heading, []]));
  for (const commit of commits) {
    const [heading] = headings.find(([, fits]) => fits(commit));
    groups.get(heading).push(commit.text);
  }
  const lines = [`## v${version} (${date})`, ""];
  for (const [heading, texts] of groups) {
    if (!texts.length) continue;
    lines.push(`### ${heading}`, "", ...texts.map((text) => `- ${text}`), "");
  }
  return lines.join("\n");
}

const changelogHeader =
  "# Changelog\n\nEach release of Fathom, newest first, made by `pnpm release`.\n\n";

// Puts the section before the first release in the changelog, leaving earlier sections as they are.
export function addToChangelog(existing, section) {
  if (existing === undefined) return `${changelogHeader}${section}`;
  const first = existing.search(/^## /m);
  if (first === -1) return `${existing.replace(/\n*$/, "\n\n")}${section}`;
  return `${existing.slice(0, first)}${section}\n${existing.slice(first)}`;
}

// The day in the releaser's time zone, as 2026-11-07.
const localDate = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

export function defaultGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

function tryGit(git, args) {
  try {
    return git(args);
  } catch {
    return undefined;
  }
}

function defaultBranch(git) {
  const head = tryGit(git, [
    "symbolic-ref",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  return head ? head.replace(/^origin\//, "") : "main";
}

// What stops a release here: changed files, another branch, or a branch that differs from origin.
export function checkoutProblems(git, { fetch = true } = {}) {
  const problems = [];
  if (fetch) {
    try {
      git(["fetch", "--quiet", "--tags", "origin"]);
    } catch {
      problems.push("Fetching from origin failed, so its state is not known.");
    }
  }
  if (git(["status", "--porcelain"]))
    problems.push("The checkout has uncommitted or untracked changes.");
  const branch = defaultBranch(git);
  const current = tryGit(git, ["symbolic-ref", "--short", "HEAD"]);
  if (current !== branch)
    problems.push(
      `The checkout is on ${current ?? "a detached commit"}, not the default branch ${branch}.`,
    );
  const local = tryGit(git, ["rev-parse", branch]);
  const remote = tryGit(git, ["rev-parse", `origin/${branch}`]);
  if (!remote) problems.push(`origin has no branch ${branch}.`);
  else if (local !== remote)
    problems.push(`${branch} is not the same as origin/${branch}.`);
  return { branch, problems };
}

const separator = "\x1f";
const end = "\x1e";

export function commitsSince(git, last) {
  const range = last ? [`${last.tag}..HEAD`] : ["HEAD"];
  const log = git([
    "log",
    "--no-merges",
    "--reverse",
    `--format=%s${separator}%b${end}`,
    ...range,
  ]);
  return log
    .split(end)
    .map((entry) => entry.replace(/^\n/, ""))
    .filter(Boolean)
    .map((entry) => {
      const [subject, body] = entry.split(separator);
      return parseCommit({ subject, body });
    });
}

const exists = (git, ref) =>
  Boolean(tryGit(git, ["rev-parse", "--verify", "--quiet", ref]));

// The version CHANGELOG.md's newest section names in the commit, if any.
export function changelogVersion(git, commit = "HEAD") {
  const text = tryGit(git, ["show", `${commit}:${changelogFile}`]);
  return /^## v(\S+) \(/m.exec(text ?? "")?.[1];
}

function refuse(action, problems) {
  throw new Error(
    `Cannot ${action}:\n${problems.map((p) => `- ${p}`).join("\n")}`,
  );
}

// Prepares a release: commits the changelog on a release/vX.Y.Z branch and pushes that branch for
// a pull request. The default branch is never changed here; the tag follows the merge.
export function release({
  root,
  dryRun = false,
  git = (args) => defaultGit(args, root),
  now = new Date(),
  log = console.log,
} = {}) {
  const { branch, problems } = checkoutProblems(git, { fetch: !dryRun });
  if (problems.length && !dryRun) refuse("release", problems);

  const pending = changelogVersion(git);
  if (pending && !exists(git, `refs/tags/v${pending}`))
    throw new Error(
      `Cannot release: v${pending} is in ${changelogFile} but not tagged. Run pnpm release:tag first.`,
    );

  const tags = git(["tag", "--list", "v*", "--merged", "HEAD"]).split("\n");
  const last = latestRelease(tags);
  const commits = commitsSince(git, last);
  if (!commits.length)
    throw new Error(
      `Nothing to release: no commits since ${last?.tag ?? "the start"}.`,
    );

  const version = formatVersion(nextVersion(last, commits));
  const tag = `v${version}`;
  const releaseBranch = `release/${tag}`;
  if (exists(git, `refs/tags/${tag}`))
    throw new Error(`Cannot release: the tag ${tag} already exists.`);
  for (const ref of [
    `refs/heads/${releaseBranch}`,
    `refs/remotes/origin/${releaseBranch}`,
  ])
    if (exists(git, ref))
      throw new Error(
        `Cannot release: the branch ${releaseBranch} already exists.`,
      );
  // The first release says only that, rather than listing every commit since the start.
  const section = last
    ? changelogSection(version, localDate(now), commits)
    : `## v${version} (${localDate(now)})\n\nFirst release.\n`;

  if (dryRun) {
    log(
      `Dry run: would push ${releaseBranch} for ${tag}${last ? ` after ${last.tag}` : ""}.`,
    );
    for (const problem of problems) log(`Would refuse: ${problem}`);
    log(`\n${section}`);
    return { version, section };
  }

  git(["switch", "--quiet", "-c", releaseBranch]);
  try {
    const path = join(root, changelogFile);
    const existing = existsSync(path) ? readFileSync(path, "utf8") : undefined;
    writeFileSync(path, addToChangelog(existing, section));
    git(["add", changelogFile]);
    git(["commit", "--quiet", "-m", `chore: release ${tag}`]);
    git(["push", "--quiet", "--set-upstream", "origin", releaseBranch]);
  } finally {
    git(["switch", "--quiet", branch]);
  }

  log(
    [
      `Pushed ${releaseBranch} with the changelog for ${tag}. Next:`,
      "",
      `  1. Open a pull request from ${releaseBranch} into ${branch}, and merge it.`,
      `  2. On an up-to-date ${branch}, run: pnpm release:tag`,
    ].join("\n"),
  );
  return { version, section };
}

// Tags a merged release: the newest version in CHANGELOG.md on the default branch, when it has no
// tag yet, on the default branch's commit that added it. It never pushes the tag.
export function tagRelease({
  root,
  dryRun = false,
  git = (args) => defaultGit(args, root),
  log = console.log,
} = {}) {
  const { problems } = checkoutProblems(git, { fetch: !dryRun });
  if (problems.length && !dryRun) refuse("tag the release", problems);

  const version = changelogVersion(git);
  if (!version)
    throw new Error(`Nothing to tag: ${changelogFile} names no release.`);
  const tag = `v${version}`;
  if (!parseReleaseTag(tag))
    throw new Error(`Cannot tag: ${tag} is not a release version.`);
  if (exists(git, `refs/tags/${tag}`))
    throw new Error(`Nothing to tag: ${tag} is already tagged.`);
  const commit = git([
    "log",
    "-1",
    "--first-parent",
    "--format=%H",
    "-S",
    `## ${tag} (`,
    "--",
    changelogFile,
  ]);

  if (dryRun) {
    log(`Dry run: would tag ${commit.slice(0, 12)} as ${tag}.`);
    for (const problem of problems) log(`Would refuse: ${problem}`);
    return { version, commit };
  }

  git(["tag", "-a", tag, "-m", `Release ${tag}`, commit]);
  log(
    [
      `Tagged ${commit.slice(0, 12)} as ${tag}, not yet pushed. To publish it:`,
      "",
      `  git push origin ${tag}`,
      `  pnpm publish:images ${tag}`,
    ].join("\n"),
  );
  return { version, commit };
}

// The command-line entry point; the tests call release() and tagRelease() instead.
/* node:coverage disable */
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !["--dry-run", "--tag"].includes(arg));
  if (unknown.length) {
    console.error(
      "Usage: pnpm release [--dry-run] | pnpm release:tag [--dry-run]",
    );
    process.exit(2);
  }
  const options = {
    root: fileURLToPath(new URL("..", import.meta.url)),
    dryRun: args.includes("--dry-run"),
  };
  try {
    if (args.includes("--tag")) tagRelease(options);
    else release(options);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
/* node:coverage enable */
