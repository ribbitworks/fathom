// SPDX-License-Identifier: Apache-2.0

// Tests of deciding what can change the security scans' results: every file but Fathom's code,
// tests, documents and pictures can, as can everything the images are built from and the scan's
// own scripts. The image-scan command is run in a throwaway git repository with an origin/main of
// its own; every script the scan runs, with each one it imports, is checked to count; and the
// dependency hash is checked to change only with files that can change the dependency scan.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { changedPaths } from "./changed-paths.mjs";
import {
  changedImageInputs,
  decidesImageScan,
  dependencyFilesHash,
  unchanged,
} from "./scan-inputs.mjs";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const command = join(scripts, "scan-inputs.mjs");

describe("what decides the container images' scan", () => {
  it("counts the images' build files, Compose files, dependencies, exceptions, scan scripts and any new kind of file", () => {
    const decisive = [
      "deploy/docker/app/Dockerfile",
      "deploy/docker/app/Dockerfile.dockerignore",
      "deploy/docker/proxy/haproxy.cfg",
      "deploy/docker/postgres/init/01-roles.sh",
      "deploy/compose.yaml",
      "deploy/compose.dev.yaml",
      "package.json",
      "apps/server/package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      ".trivyignore.yaml",
      "scripts/lib.sh",
      "scripts/security-report.sh",
      "scripts/scan-reuse.mjs",
      "scripts/security-summary.mjs",
      "deploy/compose.env.example",
      "tsconfig.base.json",
      "apps/server/vendor/tool.bin",
    ];
    assert.deepEqual(changedImageInputs(decisive), decisive);
  });

  it("does not count Fathom's code, tests, documents, pictures or other scripts", () => {
    assert.deepEqual(
      changedImageInputs([
        "apps/server/src/people.ts",
        "apps/web/src/app.tsx",
        "apps/web/public/logo.svg",
        "packages/db/migrations/0037_planned_managers.sql",
        "docs/security/data-flow.txt",
        "README.md",
        "scripts/check.sh",
        "scripts/security-summary.test.mjs",
      ]),
      [],
    );
  });

  it("is what the security report compares with to skip the images", () => {
    const report = readFileSync(join(scripts, "security-report.sh"), "utf8");
    assert.ok(report.includes(`[ "$changed" = ${unchanged} ]`));
  });
});

describe("the scripts the image scan runs", () => {
  // Every scripts/*.mjs a shell script runs, and each one those import, transitively.
  function scriptsRunBy(shellScripts) {
    const found = new Set();
    const pending = shellScripts.flatMap((name) =>
      [
        ...readFileSync(join(scripts, name), "utf8").matchAll(
          /node scripts\/([\w-]+\.mjs)/g,
        ),
      ].map((match) => match[1]),
    );
    while (pending.length > 0) {
      const name = pending.pop();
      if (found.has(name)) continue;
      found.add(name);
      for (const match of readFileSync(join(scripts, name), "utf8").matchAll(
        /from "\.\/([\w-]+\.mjs)"/g,
      ))
        pending.push(match[1]);
    }
    return [...found];
  }

  it("each count, so changing one scans the images", () => {
    const run = scriptsRunBy(["security-report.sh", "lib.sh"]);
    assert.ok(run.includes("scan-reuse.mjs"));
    for (const name of ["lib.sh", "security-report.sh", ...run])
      assert.equal(decidesImageScan(`scripts/${name}`), true, name);
  });
});

describe("the command", () => {
  let repository;

  function git(...args) {
    const result = spawnSync("git", args, {
      cwd: repository,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }

  function write(path, contents = "fictional\n") {
    mkdirSync(dirname(join(repository, path)), { recursive: true });
    writeFileSync(join(repository, path), contents);
  }

  function run() {
    return spawnSync("node", [command, "image-scan"], {
      cwd: repository,
      encoding: "utf8",
    });
  }

  beforeEach(() => {
    repository = mkdtempSync(join(tmpdir(), "fathom-image-inputs-"));
    git("init", "--quiet");
    git("config", "user.email", "tester@example.test");
    git("config", "user.name", "Fictional Tester");
    write("apps/server/src/people.ts");
    write("deploy/compose.yaml");
    git("add", ".");
    git("commit", "--quiet", "-m", "start");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
  });

  afterEach(() => {
    rmSync(repository, { recursive: true, force: true });
  });

  it("says unchanged when only Fathom's code changed, committed or not", () => {
    write("apps/server/src/people.ts", "changed\n");
    git("commit", "--quiet", "-am", "code");
    write("apps/web/src/new-page.tsx");
    const result = run();
    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${unchanged}\n`);
  });

  it("names each changed path that decides the scan, a new file or a moved one included", () => {
    git("mv", "deploy/compose.yaml", "deploy/compose.old.yaml");
    write("pnpm-lock.yaml");
    const result = run();
    assert.equal(result.status, 0);
    assert.deepEqual(result.stdout.trim().split("\n").sort(), [
      "deploy/compose.old.yaml",
      "deploy/compose.yaml",
      "pnpm-lock.yaml",
    ]);
  });

  it("fails when it cannot compare with origin/main, so the images are scanned", () => {
    git("update-ref", "-d", "refs/remotes/origin/main");
    const result = run();
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /error: git merge-base/);
  });

  it("lists every changed path for the commands that test or scan only what changed", () => {
    write("docs/notes.md");
    const previous = process.cwd();
    process.chdir(repository);
    try {
      assert.deepEqual(changedPaths(), ["docs/notes.md"]);
    } finally {
      process.chdir(previous);
    }
  });

  it("lists only the work not yet committed when asked, staged or not", () => {
    write("apps/server/src/people.ts", "changed\n");
    git("commit", "--quiet", "-am", "code");
    write("deploy/compose.yaml", "changed\n");
    git("add", "deploy/compose.yaml");
    write("apps/web/src/theme.css");
    write("docs/notes.md");
    const previous = process.cwd();
    process.chdir(repository);
    try {
      assert.deepEqual(changedPaths({ uncommitted: true }).sort(), [
        "apps/web/src/theme.css",
        "deploy/compose.yaml",
        "docs/notes.md",
      ]);
    } finally {
      process.chdir(previous);
    }
  });

  it("lists the paths changed since another base left this branch, a moved file by both its paths", () => {
    // Given a base that has moved on since this branch left it
    git("checkout", "--quiet", "-b", "base");
    write("deploy/other.yaml");
    git("add", ".");
    git("commit", "--quiet", "-m", "on the base");
    git("checkout", "--quiet", "-");
    mkdirSync(join(repository, "docs"));
    git("mv", "apps/server/src/people.ts", "docs/people.md");
    git("commit", "--quiet", "-m", "moved");
    const previous = process.cwd();
    process.chdir(repository);
    try {
      // When
      const paths = changedPaths({ since: "base" });
      // Then
      assert.deepEqual(paths.sort(), [
        "apps/server/src/people.ts",
        "docs/people.md",
      ]);
    } finally {
      process.chdir(previous);
    }
  });

  it("fails, naming git's command, when it can't compare with the base", () => {
    const previous = process.cwd();
    process.chdir(repository);
    try {
      assert.throws(
        () => changedPaths({ since: "no-such-base" }),
        /git merge-base HEAD no-such-base failed/,
      );
    } finally {
      process.chdir(previous);
    }
  });
});

describe("the dependency hash", () => {
  let folder;

  function write(path, contents = "fictional\n") {
    mkdirSync(dirname(join(folder, path)), { recursive: true });
    writeFileSync(join(folder, path), contents);
  }

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "fathom-dependency-hash-"));
    write("pnpm-lock.yaml");
    write("apps/server/package.json");
    write("apps/server/src/people.ts");
  });

  afterEach(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  it("changes with a dependency file, or any new kind of file", () => {
    const before = dependencyFilesHash(folder);
    write("pnpm-lock.yaml", "changed\n");
    const changedLockfile = dependencyFilesHash(folder);
    assert.notEqual(changedLockfile, before);
    write("tools/requirements.txt");
    assert.notEqual(dependencyFilesHash(folder), changedLockfile);
  });

  it("does not change with code, documents, or installed packages", () => {
    const before = dependencyFilesHash(folder);
    write("apps/server/src/people.ts", "changed\n");
    write("docs/notes.md");
    write("node_modules/example/package.json");
    assert.equal(dependencyFilesHash(folder), before);
  });

  it("prints nothing and fails for a folder it cannot read", () => {
    const result = spawnSync(
      "node",
      [command, "dependency-hash", join(folder, "missing")],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
  });
});
