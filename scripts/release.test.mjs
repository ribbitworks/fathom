// SPDX-License-Identifier: Apache-2.0

// Tests for making a release: the next version from the commits since the last release tag, the
// changelog section, and the checks on the checkout; and of finding the newest full release, which
// the daily image scan pulls. Git is a fake history, so no test touches
// the real repository or creates a tag.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  addToChangelog,
  changelogSection,
  commitsSince,
  compareReleases,
  latestFullRelease,
  latestRelease,
  nextVersion,
  parseCommit,
  defaultGit,
  parseReleaseTag,
  release,
  tagRelease,
} from "./release.mjs";

const now = new Date(2026, 10, 7, 23, 30);
const newestReleaseCommand = fileURLToPath(
  new URL("newest-release.mjs", import.meta.url),
);

const commit = (subject, body = "") => ({ subject, body });

// A fake git for a clean main that matches origin, with the given tags, commits since the last
// one, CHANGELOG.md at HEAD, and the commit that added its newest section. Each call is recorded;
// settings change what the checkout looks like.
function fakeGit({
  tags = [],
  commits = [],
  status = "",
  branch = "main",
  remoteHead = "origin/main",
  local = "abc",
  remote = "abc",
  existingTags = [],
  branches = [],
  changelog,
  releaseCommit = "0123456789abcdef",
  fetchFails = false,
  pushFails = false,
} = {}) {
  const calls = [];
  const fail = () => {
    throw new Error("git failed");
  };
  const git = (args) => {
    calls.push(args);
    const [command, ...rest] = args;
    if (command === "fetch") return fetchFails ? fail() : "";
    if (command === "push") return pushFails ? fail() : "";
    if (command === "status") return status;
    if (command === "show") return changelog ?? fail();
    if (command === "symbolic-ref") {
      if (rest.at(-1) === "HEAD") return branch ?? fail();
      return remoteHead ?? fail();
    }
    if (command === "rev-parse") {
      const ref = rest.at(-1);
      if (ref.startsWith("refs/tags/"))
        return existingTags.includes(ref.slice(10)) ? "def" : fail();
      if (ref.startsWith("refs/"))
        return branches.includes(ref) ? "def" : fail();
      if (ref.startsWith("origin/")) return remote ?? fail();
      return local;
    }
    if (command === "tag" && rest[0] === "--list") return tags.join("\n");
    if (command === "log" && rest.includes("-S")) return releaseCommit;
    if (command === "log")
      return commits
        .map(({ subject, body }) => `${subject}\x1f${body}\x1e`)
        .join("\n");
    return "";
  };
  return { git, calls };
}

describe("release tags", () => {
  it("reads versions and pre-releases", () => {
    assert.deepEqual(parseReleaseTag("v1.2.3-rc.1"), {
      tag: "v1.2.3-rc.1",
      major: 1,
      minor: 2,
      patch: 3,
      pre: ["rc", "1"],
    });
  });

  it("ignores tags that are not releases", () => {
    for (const tag of ["v1.2", "1.2.3", "v01.2.3", "v1.2.3-01", "vnext"])
      assert.equal(parseReleaseTag(tag), undefined, tag);
  });

  it("orders releases as semantic versioning does", () => {
    const ordered = [
      "v0.9.0",
      "v0.10.0-1",
      "v0.10.0-2",
      "v0.10.0-alpha",
      "v0.10.0-alpha.1",
      "v0.10.0-beta",
      "v0.10.0",
      "v0.10.1",
      "v1.0.0",
    ].map(parseReleaseTag);
    const sorted = [...ordered].reverse().sort(compareReleases);
    assert.deepEqual(sorted, ordered);
    assert.equal(compareReleases(ordered[3], ordered[3]), 0);
  });

  it("puts numbers before words and orders words as text, either way round", () => {
    const [one, alpha, beta] = ["v1.0.0-1", "v1.0.0-alpha", "v1.0.0-beta"].map(
      parseReleaseTag,
    );
    assert.ok(compareReleases(alpha, one) > 0);
    assert.ok(compareReleases(one, alpha) < 0);
    assert.ok(compareReleases(beta, alpha) > 0);
    assert.ok(compareReleases(alpha, beta) < 0);
  });

  it("picks the latest release tag and skips others", () => {
    assert.equal(
      latestRelease(["v0.2.0", "v0.10.0", "v0.11.0-x.y.01", "vtest", ""]).tag,
      "v0.10.0",
    );
    assert.equal(latestRelease([""]), undefined);
  });

  it("picks the latest full release, leaving out newer pre-releases", () => {
    assert.equal(
      latestFullRelease(["v0.2.0", "v0.10.0", "v0.11.0-rc.1", "vtest"]).tag,
      "v0.10.0",
    );
    assert.equal(latestFullRelease(["v0.1.0-rc.1", "latest"]), undefined);
  });

  it("prints the latest full release from tags on standard input, or nothing before the first", () => {
    const newest = (input) =>
      spawnSync("node", [newestReleaseCommand], { input, encoding: "utf8" });
    assert.equal(newest("v0.1.0\nv0.2.0\nv0.3.0-rc.1\n").stdout, "v0.2.0\n");
    const none = newest("v0.1.0-rc.1\n");
    assert.equal(none.status, 0);
    assert.equal(none.stdout, "");
  });
});

describe("commit subjects", () => {
  it("reads the type and the text after it", () => {
    assert.deepEqual(parseCommit(commit("fix: date the seed data")), {
      type: "fix",
      breaking: false,
      text: "date the seed data",
    });
  });

  it("marks a breaking change by ! after the type", () => {
    assert.equal(parseCommit(commit("feat!: drop old links")).breaking, true);
  });

  it("marks a breaking change by BREAKING CHANGE: in the body", () => {
    const body = "- Rename the setting\nBREAKING CHANGE: old name is gone";
    assert.equal(parseCommit(commit("refactor: rename", body)).breaking, true);
  });

  it("keeps a subject without a type as other", () => {
    assert.deepEqual(parseCommit(commit("Initial commit")), {
      type: "other",
      breaking: false,
      text: "Initial commit",
    });
  });
});

describe("next version", () => {
  const v = (tag) => parseReleaseTag(tag);
  const types = (...subjects) => subjects.map((s) => parseCommit(commit(s)));

  it("is 0.1.0 with no release tag yet", () => {
    assert.deepEqual(nextVersion(undefined, types("fix: a")), {
      major: 0,
      minor: 1,
      patch: 0,
    });
  });

  it("raises the minor and resets the patch for a feat or ui", () => {
    for (const subject of ["feat: a", "ui: a"])
      assert.deepEqual(nextVersion(v("v0.3.2"), types("fix: b", subject)), {
        major: 0,
        minor: 4,
        patch: 0,
      });
  });

  it("raises the patch for anything else", () => {
    assert.deepEqual(
      nextVersion(v("v0.3.2"), types("fix: a", "docs: b", "chore: c")),
      { major: 0, minor: 3, patch: 3 },
    );
  });

  it("raises the minor for a breaking change before 1.0.0", () => {
    assert.deepEqual(nextVersion(v("v0.3.2"), types("fix!: a")), {
      major: 0,
      minor: 4,
      patch: 0,
    });
  });

  it("raises the major for a breaking change from 1.0.0", () => {
    assert.deepEqual(nextVersion(v("v1.3.2"), types("fix!: a")), {
      major: 2,
      minor: 0,
      patch: 0,
    });
  });

  it("releases the version a pre-release led to", () => {
    assert.deepEqual(nextVersion(v("v0.4.0-rc.1"), types("feat: a")), {
      major: 0,
      minor: 4,
      patch: 0,
    });
  });
});

describe("changelog", () => {
  const commits = [
    "feat: add views",
    "fix: keep sort order",
    "ui: move the menu",
    "docs: explain releases",
    "test: wait for menus",
    "chore: update packages",
    "feat!: drop old links",
  ].map((subject) => parseCommit(commit(subject)));

  it("groups subjects under headings without their type", () => {
    assert.equal(
      changelogSection("0.2.0", "2026-11-07", commits),
      [
        "## v0.2.0 (2026-11-07)",
        "",
        "### Breaking Changes",
        "",
        "- drop old links",
        "",
        "### Features",
        "",
        "- add views",
        "",
        "### Fixes",
        "",
        "- keep sort order",
        "",
        "### Interface",
        "",
        "- move the menu",
        "",
        "### Documentation",
        "",
        "- explain releases",
        "",
        "### Other",
        "",
        "- wait for menus",
        "- update packages",
        "",
      ].join("\n"),
    );
  });

  it("leaves out empty headings", () => {
    const section = changelogSection(
      "0.1.1",
      "2026-11-07",
      commits.slice(1, 2),
    );
    assert.equal(
      section,
      "## v0.1.1 (2026-11-07)\n\n### Fixes\n\n- keep sort order\n",
    );
  });

  const section = "## v0.2.0 (2026-11-07)\n\n### Fixes\n\n- b\n";

  it("starts a changelog when there is none", () => {
    const text = addToChangelog(undefined, section);
    assert.match(text, /^# Changelog\n\n.*\n\n## v0\.2\.0/);
    assert.ok(text.endsWith(section));
  });

  it("puts the new section first and keeps earlier ones as they are", () => {
    const earlier =
      "# Changelog\n\nIntro.\n\n## v0.1.0 (2026-10-01)\n\n### Features\n\n- a\n";
    assert.equal(
      addToChangelog(earlier, section),
      `# Changelog\n\nIntro.\n\n${section}\n## v0.1.0 (2026-10-01)\n\n### Features\n\n- a\n`,
    );
  });

  it("adds the first section after a changelog's introduction", () => {
    assert.equal(
      addToChangelog("# Changelog\n\nIntro.", section),
      `# Changelog\n\nIntro.\n\n${section}`,
    );
  });
});

describe("default git", () => {
  it("runs git and returns its output without the last newline", () => {
    const folder = mkdtempSync(join(tmpdir(), "fathom-release-git-"));
    try {
      assert.match(defaultGit(["--version"], folder), /^git version \S+$/);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("commits from a real repository", () => {
  it("reads subjects and bodies since the tag, oldest first", () => {
    const folder = mkdtempSync(join(tmpdir(), "fathom-release-repo-"));
    // Settings on each call keep the user's own git settings, such as signing or hooks, out.
    const git = (args) =>
      defaultGit(
        [
          "-c",
          "user.name=Test",
          "-c",
          "user.email=test@example.com",
          "-c",
          "commit.gpgsign=false",
          "-c",
          "core.hooksPath=/dev/null",
          ...args,
        ],
        folder,
      );
    const commitAll = (...messages) =>
      git([
        "commit",
        "--quiet",
        "--allow-empty",
        ...messages.flatMap((m) => ["-m", m]),
      ]);
    try {
      git(["init", "--quiet"]);
      commitAll("chore: start");
      git(["tag", "v0.1.0"]);
      commitAll("fix: keep sort order", "- Keep it after a reload");
      commitAll(
        "refactor: rename the setting",
        "- Use one name\n\nBREAKING CHANGE: the old name is gone",
      );
      commitAll("feat: add views");
      assert.deepEqual(commitsSince(git, parseReleaseTag("v0.1.0")), [
        { type: "fix", breaking: false, text: "keep sort order" },
        { type: "refactor", breaking: true, text: "rename the setting" },
        { type: "feat", breaking: false, text: "add views" },
      ]);
      assert.equal(commitsSince(git, undefined).length, 4);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("release", () => {
  let root;
  let output;
  const log = (line) => output.push(line);

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "fathom-release-"));
    output = [];
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const run = (history, options = {}) => {
    const fake = fakeGit(history);
    const result = release({ root, git: fake.git, now, log, ...options });
    return { ...result, calls: fake.calls };
  };

  const released = "# Changelog\n\n## v0.1.0 (2026-10-01)\n\n- a\n";

  it("commits the changelog on a release branch and pushes it, leaving main as it was", () => {
    writeFileSync(join(root, "CHANGELOG.md"), released);
    const { version, calls } = run({
      tags: ["v0.1.0"],
      existingTags: ["v0.1.0"],
      changelog: released,
      commits: [commit("fix: keep sort order")],
    });
    assert.equal(version, "0.1.1");
    assert.equal(
      readFileSync(join(root, "CHANGELOG.md"), "utf8"),
      "# Changelog\n\n## v0.1.1 (2026-11-07)\n\n### Fixes\n\n- keep sort order\n\n## v0.1.0 (2026-10-01)\n\n- a\n",
    );
    assert.deepEqual(calls.slice(-5), [
      ["switch", "--quiet", "-c", "release/v0.1.1"],
      ["add", "CHANGELOG.md"],
      ["commit", "--quiet", "-m", "chore: release v0.1.1"],
      ["push", "--quiet", "--set-upstream", "origin", "release/v0.1.1"],
      ["switch", "--quiet", "main"],
    ]);
    assert.ok(calls.some((args) => args[0] === "fetch"));
    assert.ok(!calls.some((args) => args[0] === "tag" && args[1] === "-a"));
    assert.match(
      output.at(-1),
      /pull request from release\/v0\.1\.1 into main[^]*pnpm release:tag/,
    );
  });

  it("goes back to main when the push fails", () => {
    const { git, calls } = fakeGit({
      commits: [commit("fix: a")],
      pushFails: true,
    });
    assert.throws(() => release({ root, git, now, log }), /git failed/);
    assert.deepEqual(calls.at(-1), ["switch", "--quiet", "main"]);
  });

  it("reads the commits since the latest release tag", () => {
    const { calls } = run({
      tags: ["v0.1.0", "v0.2.0", "other"],
      commits: [commit("feat: a")],
    });
    const logCall = calls.find((args) => args[0] === "log");
    assert.equal(logCall.at(-1), "v0.2.0..HEAD");
  });

  it("makes the first release 0.1.0 from the whole history", () => {
    const { version, calls } = run({
      commits: [commit("chore: start"), commit("fix: a", "- detail")],
    });
    assert.equal(version, "0.1.0");
    assert.equal(calls.find((args) => args[0] === "log").at(-1), "HEAD");
    assert.match(
      readFileSync(join(root, "CHANGELOG.md"), "utf8"),
      /^# Changelog/,
    );
  });

  it("writes only First release. for the first release's changes", () => {
    run({ commits: [commit("feat: a"), commit("fix: b")] });
    const text = readFileSync(join(root, "CHANGELOG.md"), "utf8");
    assert.ok(text.endsWith("## v0.1.0 (2026-11-07)\n\nFirst release.\n"));
    assert.doesNotMatch(text, /###|- a|- b/);
  });

  it("stops when there is nothing to release", () => {
    assert.throws(
      () => run({ tags: ["v0.1.0"] }),
      /Nothing to release: no commits since v0\.1\.0\./,
    );
    assert.throws(() => run({}), /no commits since the start/);
  });

  it("stops when a merged release is not tagged yet", () => {
    assert.throws(
      () => run({ changelog: released, commits: [commit("fix: a")] }),
      /v0\.1\.0 is in CHANGELOG\.md but not tagged\. Run pnpm release:tag first\./,
    );
  });

  it("stops when the tag already exists", () => {
    assert.throws(
      () =>
        run({
          tags: ["v0.1.0"],
          commits: [commit("fix: a")],
          existingTags: ["v0.1.1"],
        }),
      /the tag v0\.1\.1 already exists/,
    );
  });

  for (const ref of [
    "refs/heads/release/v0.1.0",
    "refs/remotes/origin/release/v0.1.0",
  ])
    it(`stops when the release branch already exists as ${ref}`, () => {
      assert.throws(
        () => run({ commits: [commit("fix: a")], branches: [ref] }),
        /the branch release\/v0\.1\.0 already exists/,
      );
    });

  for (const [problem, history, message] of [
    ["changed files", { status: " M a.ts" }, /uncommitted or untracked/],
    [
      "another branch",
      { branch: "feat/x" },
      /on feat\/x, not the default branch main/,
    ],
    ["a detached commit", { branch: null }, /on a detached commit/],
    [
      "a branch behind origin",
      { remote: "abd" },
      /main is not the same as origin\/main/,
    ],
    ["no remote branch", { remote: null }, /origin has no branch main/],
    ["a failed fetch", { fetchFails: true }, /Fetching from origin failed/],
  ])
    it(`refuses to run on ${problem}, naming it`, () => {
      assert.throws(
        () => run({ commits: [commit("fix: a")], ...history }),
        message,
      );
      assert.throws(() => readFileSync(join(root, "CHANGELOG.md")));
    });

  it("uses origin's default branch, or main when origin names none", () => {
    assert.throws(
      () => run({ commits: [commit("fix: a")], remoteHead: "origin/trunk" }),
      /not the default branch trunk/,
    );
    assert.equal(
      run({ commits: [commit("fix: a")], remoteHead: null }).version,
      "0.1.0",
    );
  });

  it("prints the version and section on a dry run and changes nothing", () => {
    const { version, calls } = run(
      { tags: ["v0.1.0"], commits: [commit("feat: a")], status: " M x" },
      { dryRun: true },
    );
    assert.equal(version, "0.2.0");
    assert.deepEqual(output, [
      "Dry run: would push release/v0.2.0 for v0.2.0 after v0.1.0.",
      "Would refuse: The checkout has uncommitted or untracked changes.",
      "\n## v0.2.0 (2026-11-07)\n\n### Features\n\n- a\n",
    ]);
    assert.ok(
      !calls.some((args) =>
        ["fetch", "switch", "add", "commit", "push"].includes(args[0]),
      ),
    );
    assert.throws(() => readFileSync(join(root, "CHANGELOG.md")));
  });

  it("says nothing about a previous release on a first dry run", () => {
    run({ commits: [commit("feat: a")] }, { dryRun: true });
    assert.equal(output[0], "Dry run: would push release/v0.1.0 for v0.1.0.");
  });
});

describe("tagging a merged release", () => {
  let output;
  const log = (line) => output.push(line);
  beforeEach(() => {
    output = [];
  });

  const merged = "# Changelog\n\n## v0.2.0 (2026-11-07)\n\n- b\n";
  const run = (history, options = {}) => {
    const fake = fakeGit({ changelog: merged, ...history });
    const result = tagRelease({ git: fake.git, log, ...options });
    return { ...result, calls: fake.calls };
  };

  it("tags the commit that added the newest section and prints how to publish it", () => {
    const { version, calls } = run({});
    assert.equal(version, "0.2.0");
    assert.deepEqual(
      calls.find((args) => args.includes("-S")),
      [
        "log",
        "-1",
        "--first-parent",
        "--format=%H",
        "-S",
        "## v0.2.0 (",
        "--",
        "CHANGELOG.md",
      ],
    );
    assert.deepEqual(calls.at(-1), [
      "tag",
      "-a",
      "v0.2.0",
      "-m",
      "Release v0.2.0",
      "0123456789abcdef",
    ]);
    assert.ok(!calls.some((args) => args[0] === "push"));
    assert.match(
      output.at(-1),
      /git push origin v0\.2\.0\n {2}pnpm publish:images v0\.2\.0/,
    );
  });

  it("stops when the newest release is already tagged", () => {
    assert.throws(
      () => run({ existingTags: ["v0.2.0"] }),
      /Nothing to tag: v0\.2\.0 is already tagged\./,
    );
  });

  it("stops when the changelog names no release", () => {
    for (const changelog of [undefined, "# Changelog\n"])
      assert.throws(
        () => run({ changelog }),
        /Nothing to tag: CHANGELOG\.md names no release\./,
      );
  });

  it("stops when the changelog's version is not a release version", () => {
    assert.throws(
      () => run({ changelog: "## v1.2 (2026-11-07)\n" }),
      /v1\.2 is not a release version/,
    );
  });

  it("refuses to run off an up-to-date main, naming why", () => {
    assert.throws(
      () => run({ branch: "release/v0.2.0" }),
      /Cannot tag the release:\n- The checkout is on release\/v0\.2\.0/,
    );
  });

  it("prints the commit on a dry run and tags nothing", () => {
    const { calls } = run({ remote: "abd" }, { dryRun: true });
    assert.deepEqual(output, [
      "Dry run: would tag 0123456789ab as v0.2.0.",
      "Would refuse: main is not the same as origin/main.",
    ]);
    assert.ok(!calls.some((args) => ["fetch", "tag"].includes(args[0])));
  });
});

describe("a release in a real repository", () => {
  it("pushes a release branch, then tags its merge on main", () => {
    const folder = mkdtempSync(join(tmpdir(), "fathom-release-flow-"));
    const work = join(folder, "work");
    const git = (args, cwd = work) =>
      defaultGit(
        [
          "-c",
          "user.name=Test",
          "-c",
          "user.email=test@example.com",
          "-c",
          "commit.gpgsign=false",
          "-c",
          "tag.gpgsign=false",
          "-c",
          "core.hooksPath=/dev/null",
          ...args,
        ],
        cwd,
      );
    const quiet = () => {};
    try {
      git(["init", "--quiet", "--bare", "-b", "main", "origin.git"], folder);
      git(["init", "--quiet", "-b", "main", "work"], folder);
      git(["remote", "add", "origin", join(folder, "origin.git")]);
      git(["commit", "--quiet", "--allow-empty", "-m", "chore: start"]);
      git(["tag", "v0.1.0"]);
      git(["commit", "--quiet", "--allow-empty", "-m", "feat: add views"]);
      git(["push", "--quiet", "origin", "main", "v0.1.0"]);
      const main = git(["rev-parse", "main"]);

      const { version } = release({ root: work, git, now, log: quiet });
      assert.equal(version, "0.2.0");
      assert.equal(git(["symbolic-ref", "--short", "HEAD"]), "main");
      assert.equal(git(["rev-parse", "main"]), main);
      assert.equal(git(["status", "--porcelain"]), "");
      assert.equal(
        git(["log", "-1", "--format=%s", "origin/release/v0.2.0"]),
        "chore: release v0.2.0",
      );

      git([
        "merge",
        "--quiet",
        "--no-ff",
        "-m",
        "Merge v0.2.0",
        "release/v0.2.0",
      ]);
      git(["push", "--quiet", "origin", "main"]);
      assert.throws(
        () => release({ root: work, git, now, log: quiet }),
        /v0\.2\.0 is in CHANGELOG\.md but not tagged/,
      );

      tagRelease({ root: work, git, log: quiet });
      assert.equal(git(["cat-file", "-t", "v0.2.0"]), "tag");
      assert.equal(
        git(["rev-parse", "v0.2.0^{commit}"]),
        git(["rev-parse", "HEAD"]),
      );
      assert.equal(git(["ls-remote", "--tags", "origin", "v0.2.0"]), "");
      assert.throws(
        () => tagRelease({ root: work, git, log: quiet }),
        /already tagged/,
      );
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
