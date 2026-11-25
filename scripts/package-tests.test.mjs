// SPDX-License-Identifier: Apache-2.0

// Tests of scripts/package-tests.mjs: waiting for a check's turn, workers per package, choosing
// packages, and pnpm failing to start.

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { checkRuns } from "./check-turn.mjs";
import {
  runPackageTests,
  runPnpm,
  workersPerPackage,
} from "./package-tests.mjs";

let folder;
let reports;
let runs;

function options(passes = true) {
  return {
    slots: {
      ...checkRuns,
      folder,
      retryMilliseconds: 5,
      report: (message) => reports.push(message),
    },
    run: (args, environment) => {
      runs.push({ args, environment });
      return passes;
    },
    environment: {},
  };
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "fathom-package-tests-"));
  reports = [];
  runs = [];
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe("running package tests", () => {
  it("waits while another copy runs a check, saying so at once, then runs, saying how long it waited", async () => {
    // Given another running copy holding the turn
    writeFileSync(
      join(folder, "slot-0"),
      `${String(process.pid)}:held:/work/fathom-3`,
    );

    // When package tests are asked for
    const running = runPackageTests(["--recursive", "test"], options());
    while (reports.length === 0) await delay(5);

    // Then they say what they wait for, run once a turn is free, and free it after
    assert.deepEqual(reports, [
      `Waiting to run a check; the slots in ${folder} are held by process ${String(process.pid)} (/work/fathom-3)`,
    ]);
    assert.deepEqual(runs, []);
    rmSync(join(folder, "slot-0"));
    assert.equal(await running, true);
    assert.deepEqual(
      runs.map(({ args }) => args),
      [["--recursive", "test"]],
    );
    assert.match(reports[1] ?? "", /^Waited \d+s to run a check$/);
    assert.deepEqual(readdirSync(folder), []);
  });

  it("says when they fail, without a word of waiting when nobody else runs them", async () => {
    assert.equal(await runPackageTests(["test"], options(false)), false);
    assert.deepEqual(reports, []);
  });

  it("gives each package its share of the computer's workers, unless told how many, an empty setting saying nothing", async () => {
    await runPackageTests(["test"], options());
    await runPackageTests(["test"], {
      ...options(),
      environment: { VITEST_MAX_WORKERS: "7" },
    });
    await runPackageTests(["test"], {
      ...options(),
      environment: { VITEST_MAX_WORKERS: "" },
    });
    const perPackage = String(workersPerPackage());
    assert.deepEqual(
      runs.map(({ environment }) => environment.VITEST_MAX_WORKERS),
      [perPackage, "7", perPackage],
    );
  });

  it("runs at once within a check's turn", async () => {
    // Given the turn held by the check that runs these tests
    writeFileSync(join(folder, "slot-0"), `${String(process.pid)}:held`);

    // When that check runs package tests
    const passed = await runPackageTests(["test"], {
      ...options(),
      environment: { FATHOM_CHECK_SLOT: "1" },
    });

    // Then they run without waiting
    assert.equal(passed, true);
    assert.deepEqual(reports, []);
  });

  it("shares the cores but two among the four packages that run longest, giving each at least one", () => {
    assert.equal(workersPerPackage(18), 4);
    assert.equal(workersPerPackage(10), 2);
    assert.equal(workersPerPackage(4), 1);
    assert.equal(workersPerPackage(1), 1);
  });

  it("chooses the packages given after the script's name", async () => {
    await runPackageTests(
      [
        "--recursive",
        "test",
        "--filter",
        "@fathom/web",
        "-F",
        "@fathom/db",
        "--filter=!@fathom/seed",
        "--fail-if-no-match",
      ],
      options(),
    );
    assert.deepEqual(runs[0]?.args, [
      "--filter",
      "@fathom/web",
      "-F",
      "@fathom/db",
      "--filter=!@fathom/seed",
      "--fail-if-no-match",
      "--recursive",
      "test",
    ]);
  });

  it("refuses a filter with no package, before waiting its turn", async () => {
    await assert.rejects(
      runPackageTests(["test", "--filter"], options()),
      new Error("--filter needs a package, such as --filter @fathom/web"),
    );
    assert.deepEqual(runs, []);
    assert.deepEqual(reports, []);
  });

  it("says when pnpm cannot start", async (context) => {
    const problems = context.mock.method(console, "error", () => undefined);
    context.mock.method(console, "log", () => undefined);
    assert.equal(await runPnpm(["--version"], { PATH: folder }), false);
    assert.match(
      String(problems.mock.calls[0]?.arguments[0]),
      /^error: pnpm did not start: /,
    );
  });

  it("stops pnpm as hung, naming what it ran, once it runs past a check's job limit", async (context) => {
    const problems = context.mock.method(console, "error", () => undefined);
    context.mock.method(console, "log", () => undefined);
    writeFileSync(join(folder, "pnpm"), "#!/bin/sh\nexec /bin/sleep 30\n", {
      mode: 0o755,
    });
    const started = Date.now();
    assert.equal(
      await runPnpm(["test:changed"], {
        PATH: folder,
        FATHOM_CHECK_JOB_SECONDS: "1",
      }),
      false,
    );
    assert.ok(Date.now() - started < 10_000);
    assert.equal(
      problems.mock.calls[0]?.arguments[0],
      "==> pnpm test:changed ran past the 1s limit, so it was stopped",
    );
  });
});
