// SPDX-License-Identifier: Apache-2.0

// Tests of the check's jobs: choosing them, how many run side by side, stopping one that hangs, and
// naming each job that failed.

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
  "Package tests",
  "Security report",
  "Script tests",
  "ESLint",
  "Formatting",
  "Types",
  "Markdown",
  "Shell scripts",
  "Licences",
  "Renovate settings",
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

function copy({ prepared }) {
  const root = mkdtempSync(join(tmpdir(), "fathom-check-"));
  folders.push(root);
  mkdirSync(join(root, "scripts"));
  for (const name of ["lib.sh", "check.sh"])
    copyFileSync(join(scripts, name), join(root, "scripts", name));
  writeFileSync(
    join(root, "scripts", "offline.mjs"),
    'process.exit(process.env.ONLINE === "0" ? 1 : 0);\n',
  );
  if (prepared) {
    mkdirSync(join(root, ".cache", "offline"), { recursive: true });
    writeFileSync(
      join(root, ".cache", "offline", "security-fixes-date"),
      "2026-11-01\n",
    );
  }
  const tools = join(root, "tools");
  mkdirSync(tools);
  writeFileSync(
    join(tools, "pnpm"),
    '#!/usr/bin/env bash\ncase " ${HANGING:-} " in *" $1 "*) echo "started $*"; exec sleep 60 ;; esac\ncase " ${FAILING:-} " in *" $1 "*) echo "failed $*"; exit 1 ;; esac\necho "ran $*${FATHOM_OFFLINE:+ offline, fixes from $FATHOM_SECURITY_FIXES_DATE}"\n',
    { mode: 0o755 },
  );
  return { root, tools };
}

function run(
  args,
  {
    failing = "",
    online = true,
    prepared = true,
    ci = undefined,
    environment = {},
  } = {},
) {
  const { root, tools } = copy({ prepared });
  return spawnSync("bash", ["scripts/check.sh", ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: `${tools}:${process.env.PATH ?? ""}`,
      HOME: process.env.HOME,
      FAILING: failing,
      ONLINE: online ? "1" : "0",
      ...(ci === undefined ? {} : { CI: ci }),
      ...environment,
    },
  });
}

const check = (...args) => run(args);

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
    for (const job of jobs.filter(
      (one) => !["Package tests", "Security report"].includes(one),
    ))
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
        `No job left to skip is named ESLint; those left are: ${jobs.filter((job) => job !== "ESLint").join(", ")}`,
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
        "error: Usage: check.sh [--before-push] [--offline] [--skip <job name>]...",
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
    const result = run(["--before-push"], {
      failing: "test:changed typecheck",
    });
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

  it("stops a job that runs past the time limit, naming it, and runs the rest in its place", () => {
    // Given one job side by side, and the first job hanging
    const result = run(["--before-push"], {
      environment: {
        HANGING: "test:changed",
        FATHOM_CHECK_JOB_SECONDS: "3",
        FATHOM_CHECK_SHARES: "1000",
      },
    });

    // Then it is stopped, named, with its output so far, and every other job still runs
    assert.equal(result.status, 1);
    assert.ok(
      result.stdout.includes("| Changed tests | Stopped |"),
      result.stdout,
    );
    for (const job of beforePush.filter((one) => one !== "Changed tests"))
      assert.ok(result.stdout.includes(`| ${job} | Pass |`), result.stdout);
    assert.ok(
      result.stdout.includes(
        "==> Changed tests ran past the 3s limit, so it was stopped; its output up to then follows\nstarted test:changed",
      ),
      result.stdout,
    );
    assert.ok(
      result.stderr.includes("error: These checks failed: Changed tests;"),
      result.stderr,
    );
  });

  it("runs every job side by side when no other check shares the computer", () => {
    const result = check("--before-push");
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.stdout.includes("Running 6 jobs, up to 6 side by side"),
      result.stdout,
    );
    assert.ok(!result.stderr.includes("setpgid"), result.stderr);
  });

  it("runs only its share of the cores side by side, and every job in the end", () => {
    const result = run(["--before-push"], {
      environment: { FATHOM_CHECK_SHARES: "1000" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.stdout.includes("Running 6 jobs, up to 1 side by side"),
      result.stdout,
    );
    for (const job of beforePush)
      assert.ok(result.stdout.includes(`| ${job} | Pass |`), result.stdout);
  });

  it("stops before starting any job without a connection, naming --offline", () => {
    const result = run([], { online: false });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "error: This computer can't reach the internet, which some checks need. Run 'pnpm check --offline' or 'pnpm security --offline' to leave them out",
      ),
      result.stderr,
    );
    assert.ok(!result.stdout.includes("ran"), result.stdout);
  });

  it("checks no connection when no job left needs the internet", () => {
    for (const args of [
      ["--before-push"],
      ["--skip", "Security report", "--skip", "Renovate settings"],
    ]) {
      const result = run(args, { online: false });
      assert.equal(result.status, 0, result.stderr);
    }
  });

  it("offline, leaves out what needs the internet and runs the rest offline", () => {
    const result = run(["--offline"], { online: false });
    assert.equal(result.status, 0, result.stderr);
    for (const job of jobs.filter((one) => one !== "Renovate settings"))
      assert.ok(result.stdout.includes(`| ${job} | Pass |`), result.stdout);
    assert.ok(!result.stdout.includes("| Renovate settings |"), result.stdout);
    assert.ok(
      result.stdout.includes(
        "==> Working offline, so these are left out: Renovate settings",
      ),
      result.stdout,
    );
    assert.ok(
      result.stdout.includes(
        "==> The security report names each scan it skips offline",
      ),
      result.stdout,
    );
    assert.ok(
      result.stdout.includes(
        "ran security --offline offline, fixes from 2026-11-01",
      ),
      result.stdout,
    );
    assert.ok(
      result.stdout.includes(
        "ran test:packages offline, fixes from 2026-11-01",
      ),
      result.stdout,
    );
  });

  it("offline, runs the changed tests and linters before a push", () => {
    const result = run(["--before-push", "--offline"], { online: false });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.stdout.includes("ran test:changed offline, fixes from 2026-11-01"),
      result.stdout,
    );
    assert.ok(!result.stdout.includes("left out"), result.stdout);
    assert.ok(!result.stdout.includes("security report"), result.stdout);
  });

  it("refuses to work offline where CI is set, as on GitHub", () => {
    const result = run(["--offline"], { ci: "true" });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "error: --offline leaves out scans the Check workflow must run, so it can't be used where CI is set",
      ),
      result.stderr,
    );
    assert.ok(!result.stdout.includes("ran"), result.stdout);
  });

  it("offline, skips a job and leaves out the rest that need the internet", () => {
    for (const [args, gone] of [
      [["--offline", "--skip", "Renovate settings"], "Renovate settings"],
      [
        ["--before-push", "--offline", "--skip", "Changed tests"],
        "Changed tests",
      ],
    ]) {
      const result = run(args, { online: false });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(!result.stdout.includes(`| ${gone} |`), result.stdout);
      assert.ok(!result.stdout.includes("left out"), result.stdout);
    }
  });

  it("offline, still fails naming each job that failed", () => {
    const result = run(["--offline"], { online: false, failing: "security" });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "error: These checks failed: Security report; see their output above",
      ),
      result.stderr,
    );
  });

  it("refuses to work offline until prepared", () => {
    const result = run(["--offline"], { prepared: false });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "error: Not ready to work offline. Run 'pnpm offline:prepare' while connected, then try again",
      ),
      result.stderr,
    );
    assert.ok(!result.stdout.includes("ran"), result.stdout);
  });

  it("refuses to work offline when only jobs that need the internet are left", () => {
    const result = run([
      "--offline",
      ...jobs
        .filter((job) => job !== "Renovate settings")
        .flatMap((job) => ["--skip", job]),
    ]);
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "Every job left needs the internet, so there is nothing to check offline",
      ),
      result.stderr,
    );
  });
});
