// SPDX-License-Identifier: Apache-2.0

// Tests of the release, commit and commit date scripts/lib.sh reads from git for Help's About box,
// in a throwaway repository holding a copy of lib.sh, tagged as each test needs.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const folders = [];

// Committed late on November 2 in UTC-7, which is already November 3 in UTC.
const committed = "2026-11-02T22:30:00-07:00";

function run(root, environment, command, ...args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: root,
      // So git never finds a repository the system's temporary folder may be inside, by either path.
      GIT_CEILING_DIRECTORIES: `${tmpdir()}:${realpathSync(tmpdir())}`,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Fictional Author",
      GIT_AUTHOR_EMAIL: "author@example.com",
      GIT_COMMITTER_NAME: "Fictional Author",
      GIT_COMMITTER_EMAIL: "author@example.com",
      GIT_AUTHOR_DATE: committed,
      GIT_COMMITTER_DATE: committed,
      ...environment,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const git = (root, ...args) => run(root, {}, "git", ...args).trimEnd();

// A folder with a copy of lib.sh, made a repository with one commit unless asked not to.
function folder({ repository = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "fathom-build-info-"));
  folders.push(root);
  mkdirSync(join(root, "scripts"));
  copyFileSync(join(scripts, "lib.sh"), join(root, "scripts/lib.sh"));
  if (repository) {
    git(root, "init", "--quiet");
    git(root, "add", ".");
    commit(root);
  }
  return root;
}

function commit(root) {
  git(root, "commit", "--quiet", "--allow-empty", "--message", "test");
}

// What lib.sh exports, sourced as the scripts source it, with their settings.
function built(root, environment = {}) {
  const [version, commit, date] = run(
    root,
    environment,
    "bash",
    "-c",
    'set -euo pipefail; source scripts/lib.sh; printf "%s\\n" "$FATHOM_VERSION" "$FATHOM_COMMIT" "$FATHOM_COMMIT_DATE"',
  ).split("\n", 3);
  return { version, commit, date };
}

afterEach(() => {
  for (const root of folders.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("the release, commit and commit date", () => {
  it("has no release before the first tag, but has the commit and its committer's date", () => {
    const root = folder();
    assert.deepEqual(built(root), {
      version: "",
      commit: git(root, "rev-parse", "--short", "HEAD"),
      date: "2026-11-02",
    });
  });

  it("is the release tag on the commit built", () => {
    const root = folder();
    git(root, "tag", "v0.1.0");
    commit(root);
    git(root, "tag", "v0.2.0");
    assert.equal(built(root).version, "0.2.0");
  });

  it("counts the commits after the release, ignoring tags that are not releases", () => {
    const root = folder();
    git(root, "tag", "v1.0.0-rc.1");
    commit(root);
    git(root, "tag", "v1.0.0+7");
    commit(root);
    git(root, "tag", "not-a-release");
    assert.equal(built(root).version, "1.0.0-rc.1+2");
  });

  it("marks the commit as modified when the files differ from it", () => {
    const root = folder();
    const clean = built(root).commit;
    writeFileSync(join(root, "new-file.txt"), "not committed\n");
    assert.equal(built(root).commit, `${clean}-modified`);
  });

  it("takes each value set instead, even an empty one", () => {
    const root = folder();
    git(root, "tag", "v0.1.0");
    assert.deepEqual(
      built(root, {
        FATHOM_VERSION: "",
        FATHOM_COMMIT: "abc1234",
        FATHOM_COMMIT_DATE: "2026-10-30",
      }),
      { version: "", commit: "abc1234", date: "2026-10-30" },
    );
  });

  it("leaves them empty outside a repository, without stopping the script", () => {
    assert.deepEqual(built(folder({ repository: false })), {
      version: "",
      commit: "",
      date: "",
    });
  });
});
