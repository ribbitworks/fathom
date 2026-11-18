// SPDX-License-Identifier: Apache-2.0

// Tests of choosing which jobs run: the full check's, less any skipped, as the Check workflow does
// when other runners run the package tests, or the changed tests and the linters before a push; and
// of naming each job that failed. Each test runs the script from a copy in a throwaway folder, with
// a pnpm that only says what it was asked to run, failing for the scripts named in FAILING.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const jobs = [
  "ESLint",
  "Formatting",
  "Types",
  "Markdown",
  "Shell scripts",
  "Licences",
  "Script tests",
  "Package tests",
  "Security report",
];
const beforePush = [
  "Changed tests",
  "ESLint",
  "Formatting",
  "Types",
  "Markdown",
  "Shell scripts",
];
const folders = [];

function copy() {
  const root = mkdtempSync(join(tmpdir(), "fathom-check-"));
  folders.push(root);
  mkdirSync(join(root, "scripts"));
  for (const name of ["lib.sh", "check.sh"])
    copyFileSync(join(scripts, name), join(root, "scripts", name));
  const tools = join(root, "tools");
  mkdirSync(tools);
  writeFileSync(
    join(tools, "pnpm"),
    '#!/usr/bin/env bash\ncase " ${FAILING:-} " in *" $1 "*) echo "failed $*"; exit 1 ;; esac\necho "ran $*"\n',
    { mode: 0o755 },
  );
  return { root, tools };
}

function checkFailing(failing, ...args) {
  const { root, tools } = copy();
  return spawnSync("bash", ["scripts/check.sh", ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: `${tools}:${process.env.PATH ?? ""}`,
      HOME: process.env.HOME,
      FAILING: failing,
    },
  });
}

const check = (...args) => checkFailing("", ...args);

afterEach(() => {
  for (const made of folders.splice(0))
    rmSync(made, { recursive: true, force: true });
});

describe("scripts/check.sh", () => {
  it("runs every job but those skipped", () => {
    const result = check(
      "--skip",
      "Package tests",
      "--skip",
      "Security report",
    );
    assert.equal(result.status, 0, result.stderr);
    for (const job of jobs.slice(0, -2))
      assert.ok(result.stdout.includes(`| ${job} | Pass |`), result.stdout);
    assert.ok(!result.stdout.includes("Package tests"), result.stdout);
    assert.ok(!result.stdout.includes("Security report"), result.stdout);
    assert.ok(!result.stdout.includes("ran test:packages"), result.stdout);
  });

  it("refuses a job it does not know, naming the jobs", () => {
    const result = check("--skip", "Packages");
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        `No job left to skip is named Packages; those left are: ${jobs.join(", ")}`,
      ),
      result.stderr,
    );
    assert.ok(!result.stdout.includes("ran"), result.stdout);
  });

  it("refuses a job skipped already, naming those left", () => {
    const result = check("--skip", "ESLint", "--skip", "ESLint");
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        `No job left to skip is named ESLint; those left are: ${jobs.slice(1).join(", ")}`,
      ),
      result.stderr,
    );
  });

  it("refuses to skip every job", () => {
    const result = check(...jobs.flatMap((job) => ["--skip", job]));
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("Every job is skipped"), result.stderr);
  });

  it("asks for a job's name after --skip", () => {
    const result = check("--skip");
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        'error: --skip needs a job\'s name, such as --skip "Package tests"',
      ),
      result.stderr,
    );
  });

  it("says how to choose the jobs when given anything else", () => {
    const result = check("Package tests");
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "error: Usage: check.sh [--before-push] [--skip <job name>]...",
      ),
      result.stderr,
    );
  });

  it("runs only the changed tests and the linters before a push", () => {
    const result = check("--before-push");
    assert.equal(result.status, 0, result.stderr);
    for (const job of beforePush)
      assert.ok(result.stdout.includes(`| ${job} | Pass |`), result.stdout);
    assert.ok(result.stdout.includes("ran test:changed"), result.stdout);
    for (const job of jobs.filter((one) => !beforePush.includes(one)))
      assert.ok(!result.stdout.includes(`| ${job} |`), result.stdout);
  });

  it("skips a job before a push, whichever option comes first", () => {
    const result = check("--skip", "Changed tests", "--before-push");
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes("Changed tests"), result.stdout);
    assert.ok(!result.stdout.includes("ran test:changed"), result.stdout);
    assert.ok(result.stdout.includes("| ESLint | Pass |"), result.stdout);
  });

  it("refuses to skip a job only the full check runs, before a push", () => {
    const result = check("--before-push", "--skip", "Licences");
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        `No job left to skip is named Licences; those left are: ${beforePush.join(", ")}`,
      ),
      result.stderr,
    );
  });

  it("fails naming each job that failed, after running every job", () => {
    const result = checkFailing("test:changed typecheck", "--before-push");
    assert.equal(result.status, 1);
    assert.ok(
      result.stdout.includes("| Changed tests | Fail |"),
      result.stdout,
    );
    assert.ok(result.stdout.includes("| Types | Fail |"), result.stdout);
    assert.ok(result.stdout.includes("| ESLint | Pass |"), result.stdout);
    assert.ok(
      result.stderr.includes(
        "error: These checks failed: Changed tests, Types; see their output above",
      ),
      result.stderr,
    );
  });
});
