// SPDX-License-Identifier: Apache-2.0

// Tests of the check's jobs: choosing them, checking them before waiting for a turn, running them
// side by side, stopping one that hangs, and naming each job that failed.

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
  for (const name of ["lib.sh", "check.sh", "run-command.mjs"])
    copyFileSync(join(scripts, name), join(root, "scripts", name));
  writeFileSync(
    join(root, "scripts", "check-turn.mjs"),
    [
      'import { spawnSync } from "node:child_process";',
      "const [command, ...args] = process.argv.slice(2);",
      'if (process.env.TURN_RUNS !== "1") {',
      "  console.log(`turn: ${JSON.stringify([command, ...args])}`);",
      "  process.exit(0);",
      "}",
      "const { status } = spawnSync(command, args, {",
      '  stdio: "inherit",',
      '  env: { ...process.env, FATHOM_CHECK_SLOT: "1" },',
      "});",
      "process.exit(status ?? 1);",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "scripts", "changed-paths.mjs"),
    [
      "export function changedPaths() {",
      '  if (process.env.CHANGED === "fail") throw new Error("git failed");',
      '  return (process.env.CHANGED ?? "").split("\\n").filter((path) => path !== "");',
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "scripts", "documentation-only.mjs"),
    'export const isDocumentationOnly = (paths) => paths.every((path) => path.endsWith(".md"));\n',
  );
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
      FATHOM_CHECK_SLOT: "1",
      CHANGED: "apps/web/src/app.tsx\nscripts/lib.sh",
      ...(ci === undefined ? {} : { CI: ci }),
      ...environment,
    },
  });
}

const check = (...args) => run(args);
const withoutTurn = { FATHOM_CHECK_SLOT: "" };

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

  it("waits for its turn once its arguments are checked, passing them on", () => {
    const result = run(["--before-push", "--skip", "Changed tests"], {
      environment: withoutTurn,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout,
      `turn: ${JSON.stringify(["bash", "scripts/check.sh", "--before-push", "--skip", "Changed tests"])}\n`,
    );
  });

  it("refuses an unknown job before waiting for a turn", () => {
    const result = run(["--skip", "Packages"], { environment: withoutTurn });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes("No job left to skip is named Packages"),
      result.stderr,
    );
    assert.ok(!result.stdout.includes("turn:"), result.stdout);
  });

  it("says what working offline leaves out once, in its turn", () => {
    const result = run(["--offline"], {
      environment: { ...withoutTurn, TURN_RUNS: "1" },
    });
    assert.equal(result.status, 0, result.stderr);
    const output = result.stdout + result.stderr;
    for (const line of [
      "Working offline, so these are left out: Renovate settings",
      "The security report names each scan it skips offline",
      "The Check workflow runs everything on the pull request",
    ])
      assert.equal(output.split(line).length - 1, 1, output);
  });

  it("stops without a connection before waiting for a turn", () => {
    const result = run([], { online: false, environment: withoutTurn });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("--offline"), result.stderr);
    assert.ok(!result.stdout.includes("turn:"), result.stdout);
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

  it("runs only Markdown before a push of documentation alone, without a turn", () => {
    const result = run(["--before-push"], {
      environment: { ...withoutTurn, CHANGED: "docs/design/architecture.md" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.stdout.includes(
        "Only documentation changed, so only Markdown runs",
      ),
      result.stdout,
    );
    assert.ok(result.stdout.includes("| Markdown | Pass |"), result.stdout);
    for (const job of beforePush.filter((one) => one !== "Markdown"))
      assert.ok(!result.stdout.includes(`| ${job} |`), result.stdout);
    assert.ok(!result.stdout.includes("turn:"), result.stdout);
  });

  it("checks documentation alone offline before it is prepared, but not where CI is set", () => {
    const offline = run(["--before-push", "--offline"], {
      prepared: false,
      environment: { ...withoutTurn, CHANGED: "docs/a.md" },
    });
    assert.equal(offline.status, 0, offline.stderr);
    assert.ok(offline.stdout.includes("| Markdown | Pass |"), offline.stdout);
    const inCi = run(["--before-push", "--offline"], {
      ci: "true",
      environment: { ...withoutTurn, CHANGED: "docs/a.md" },
    });
    assert.equal(inCi.status, 1);
    assert.ok(inCi.stderr.includes("--offline"), inCi.stderr);
  });

  it("leaves out Shell scripts before a push that changes no shell script, saying so once", () => {
    const result = run(["--before-push"], {
      environment: {
        ...withoutTurn,
        TURN_RUNS: "1",
        CHANGED: "apps/web/src/app.tsx\ndocs/a.md",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    for (const job of beforePush.filter((one) => one !== "Shell scripts"))
      assert.ok(result.stdout.includes(`| ${job} | Pass |`), result.stdout);
    assert.ok(!result.stdout.includes("| Shell scripts |"), result.stdout);
    const note = "No shell script changed, so Shell scripts doesn't run";
    assert.equal(result.stdout.split(note).length - 1, 1, result.stdout);
  });

  it("runs every job before a push when the changes can't be listed, saying so once", () => {
    const result = run(["--before-push"], {
      environment: { ...withoutTurn, TURN_RUNS: "1", CHANGED: "fail" },
    });
    assert.equal(result.status, 0, result.stderr);
    const note = "The changes couldn't be listed, so every job runs";
    assert.equal(result.stdout.split(note).length - 1, 1, result.stdout);
    assert.ok(result.stdout.includes("git failed"), result.stdout);
    for (const job of beforePush)
      assert.ok(result.stdout.includes(`| ${job} | Pass |`), result.stdout);
  });

  it("refuses when the only job documentation alone needs is skipped", () => {
    const result = run(["--before-push", "--skip", "Markdown"], {
      environment: { CHANGED: "docs/a.md" },
    });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "Every job this change needs is skipped, so there is nothing to check",
      ),
      result.stderr,
    );
  });

  it("refuses when only Shell scripts is left and no shell script changed", () => {
    const result = run(
      [
        "--before-push",
        ...[
          "Changed tests",
          "ESLint",
          "Formatting",
          "Types",
          "Markdown",
        ].flatMap((job) => ["--skip", job]),
      ],
      { environment: { CHANGED: "apps/web/src/app.tsx" } },
    );
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "Every job this change needs is skipped, so there is nothing to check",
      ),
      result.stderr,
    );
  });

  it("runs every job of the full check in its turn, whatever changed", () => {
    const waiting = run([], {
      environment: { ...withoutTurn, CHANGED: "docs/a.md" },
    });
    assert.equal(waiting.status, 0, waiting.stderr);
    assert.ok(waiting.stdout.startsWith("turn: "), waiting.stdout);
    const result = run([], { environment: { CHANGED: "docs/a.md" } });
    assert.equal(result.status, 0, result.stderr);
    for (const job of jobs)
      assert.ok(result.stdout.includes(`| ${job} | Pass |`), result.stdout);
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

  it("stops a job that runs past the time limit, naming it, while the rest still run", () => {
    // Given the first job hanging
    const result = run(["--before-push"], {
      environment: {
        HANGING: "test:changed",
        FATHOM_CHECK_JOB_SECONDS: "3",
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
      result.stdout.indexOf("==> ESLint: Pass") <
        result.stdout.indexOf("==> Changed tests: Stopped"),
      result.stdout,
    );
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

  it("runs every job side by side", () => {
    const result = run(["--before-push"]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.stdout.includes("Running 6 jobs side by side"),
      result.stdout,
    );
    for (const job of beforePush)
      assert.ok(result.stdout.includes(`| ${job} | Pass |`), result.stdout);
    assert.ok(!result.stderr.includes("setpgid"), result.stderr);
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
    const result = run(["--offline"], {
      prepared: false,
      environment: withoutTurn,
    });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "error: Not ready to work offline. Run 'pnpm offline:prepare' while connected, then try again",
      ),
      result.stderr,
    );
    assert.ok(!result.stdout.includes("ran"), result.stdout);
    assert.ok(!result.stdout.includes("turn:"), result.stdout);
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
