// SPDX-License-Identifier: Apache-2.0

// Tests of scripts/package-tests.mjs: waiting for a check's turn, workers per package and checks
// sharing the computer, choosing packages, and pnpm failing to start.

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
  sharesOf,
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
  it("waits while two other copies run checks, saying so at once, then runs, saying how long it waited", async () => {
    // Given other running copies holding both turns
    writeFileSync(
      join(folder, "slot-0"),
      `${String(process.pid)}:held:/work/fathom-3`,
    );
    writeFileSync(
      join(folder, "slot-1"),
      `${String(process.pid)}:held:/work/fathom-4`,
    );

    // When package tests are asked for
    const running = runPackageTests(["--recursive", "test"], options());
    while (reports.length === 0) await delay(5);

    // Then they say what they wait for, run once a turn is free, and free it after
    assert.deepEqual(reports, [
      `Waiting to run a check; the slots in ${folder} are held by process ${String(process.pid)} (/work/fathom-3), process ${String(process.pid)} (/work/fathom-4)`,
    ]);
    assert.deepEqual(runs, []);
    rmSync(join(folder, "slot-1"));
    assert.equal(await running, true);
    assert.deepEqual(
      runs.map(({ args }) => args),
      [["--recursive", "test"]],
    );
    assert.match(reports[1] ?? "", /^Waited \d+s to run a check$/);
    assert.deepEqual(readdirSync(folder), ["slot-0"]);
  });

  it("says when they fail, without a word of waiting when nobody else runs them", async () => {
    assert.equal(await runPackageTests(["test"], options(false)), false);
    assert.deepEqual(reports, []);
  });

  it("gives each package of a check running alone the whole computer's workers, unless told how many, an empty setting saying nothing", async () => {
    await runPackageTests(["test"], options());
    await runPackageTests(["test"], {
      ...options(),
      environment: { VITEST_MAX_WORKERS: "7" },
    });
    await runPackageTests(["test"], {
      ...options(),
      environment: { VITEST_MAX_WORKERS: "" },
    });
    const alone = String(workersPerPackage(undefined, 1));
    assert.deepEqual(
      runs.map(({ environment }) => environment.VITEST_MAX_WORKERS),
      [alone, "7", alone],
    );
  });

  it("runs at once within a check's turn, with the share that check was given", async () => {
    // Given both turns held, one by the check that runs these tests
    writeFileSync(join(folder, "slot-0"), `${String(process.pid)}:held`);
    writeFileSync(join(folder, "slot-1"), `${String(process.pid)}:held`);

    // When that check runs package tests
    const passed = await runPackageTests(["test"], {
      ...options(),
      environment: { FATHOM_CHECK_SLOT: "1", FATHOM_CHECK_SHARES: "2" },
    });

    // Then they run without waiting, with its share of the workers
    assert.equal(passed, true);
    assert.deepEqual(reports, []);
    assert.equal(
      runs[0]?.environment.VITEST_MAX_WORKERS,
      String(workersPerPackage(undefined, 2)),
    );
  });

  it("uses every core on GitHub, where CI is true", async () => {
    await runPackageTests(["test"], {
      ...options(),
      environment: { CI: "true" },
    });
    assert.equal(
      runs[0]?.environment.VITEST_MAX_WORKERS,
      String(workersPerPackage()),
    );
  });

  it("shares the cores but two among the four packages that run longest, giving each at least one", () => {
    assert.equal(workersPerPackage(18), 4);
    assert.equal(workersPerPackage(10), 2);
    assert.equal(workersPerPackage(4), 1);
    assert.equal(workersPerPackage(1), 1);
  });

  it("gives each package its share of the workers when checks share the computer", () => {
    assert.equal(workersPerPackage(18, 2), 2);
    assert.equal(workersPerPackage(4, 2), 1);
  });

  it("counts one check sharing the computer unless told a whole number of them", () => {
    assert.equal(sharesOf({ FATHOM_CHECK_SHARES: "2" }), 2);
    assert.equal(sharesOf({}), 1);
    assert.equal(sharesOf({ FATHOM_CHECK_SHARES: "0" }), 1);
    assert.equal(sharesOf({ FATHOM_CHECK_SHARES: "many" }), 1);
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
});
