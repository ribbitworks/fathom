// SPDX-License-Identifier: Apache-2.0

// Tests of scripts/package-tests.mjs: package tests wait, saying so at once and how long they waited,
// while another copy of the repository runs them, then run, reporting whether they passed; package
// tests run from within a run do not wait on it; and pnpm failing to start is reported.

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { packageTestRuns, runPackageTests, runPnpm } from "./package-tests.mjs";

let folder;
let reports;
let runs;

function options(passes = true) {
  return {
    slots: {
      ...packageTestRuns,
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
  it("waits while another copy runs them, saying so at once, then runs, saying how long it waited", async () => {
    // Given another running process holding the one slot
    writeFileSync(
      join(folder, "slot-0"),
      `${String(process.pid)}:held:/work/fathom-3`,
    );

    // When package tests are asked for
    const running = runPackageTests(["--recursive", "test"], options());
    while (reports.length === 0) await delay(5);

    // Then they say what they wait for, run once the slot is free, and free it after
    assert.deepEqual(reports, [
      `Waiting to run package tests; the slots in ${folder} are held by process ${String(process.pid)} (/work/fathom-3)`,
    ]);
    assert.deepEqual(runs, []);
    rmSync(join(folder, "slot-0"));
    assert.equal(await running, true);
    assert.deepEqual(
      runs.map(({ args }) => args),
      [["--recursive", "test"]],
    );
    assert.match(reports[1] ?? "", /^Waited \d+s to run package tests$/);
    assert.deepEqual(readdirSync(folder), []);
  });

  it("says when they fail, without a word of waiting when nobody else runs them", async () => {
    assert.equal(await runPackageTests(["test"], options(false)), false);
    assert.deepEqual(reports, []);
  });

  it("does not wait on the slot their own run holds, when run from within it", async () => {
    // Given a run's processes, marked as holding the slot, while it holds it
    await runPackageTests(["test"], options());
    const { environment } = runs[0] ?? {};
    writeFileSync(join(folder, "slot-0"), `${String(process.pid)}:held`);

    // When package tests are run from within it
    const nested = await runPackageTests(["test"], {
      ...options(),
      environment,
    });

    // Then they run at once
    assert.equal(nested, true);
    assert.equal(runs.length, 2);
  });

  it("says when pnpm cannot start", (context) => {
    const problems = context.mock.method(console, "error", () => undefined);
    context.mock.method(console, "log", () => undefined);
    assert.equal(runPnpm(["--version"], { PATH: folder }), false);
    assert.match(
      String(problems.mock.calls[0]?.arguments[0]),
      /^error: pnpm did not start: /,
    );
  });
});
