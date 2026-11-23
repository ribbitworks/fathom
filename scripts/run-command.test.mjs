// SPDX-License-Identifier: Apache-2.0

// Tests of scripts/run-command.mjs: a command ends with its own exit code, or 128 and the number of
// the signal that stopped it, one that cannot start is reported, one past its time limit is stopped
// with every process it started, and nothing is left listening for requests to stop after it ends.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  couldNotStart,
  jobLimitSeconds,
  ranTooLong,
  runCommand,
} from "./run-command.mjs";

function isRunning(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}

describe("running a command", () => {
  it("gives the command's exit code", async () => {
    assert.equal(await runCommand(process.execPath, ["--version"]), 0);
    assert.equal(
      await runCommand(process.execPath, ["--eval", "process.exit(3)"]),
      3,
    );
  });

  it("gives 128 and the signal's number when a signal stops the command", async () => {
    assert.equal(
      await runCommand(process.execPath, [
        "--eval",
        "process.kill(process.pid, 'SIGTERM')",
      ]),
      143,
    );
  });

  it("says when the command cannot start", async (context) => {
    const problems = context.mock.method(console, "error", () => undefined);
    assert.equal(
      await runCommand("fathom-no-such-command", [], {}),
      couldNotStart,
    );
    assert.equal(problems.mock.callCount(), 1);
    assert.match(
      String(problems.mock.calls[0]?.arguments[0]),
      /^error: fathom-no-such-command did not start: /,
    );
  });

  it("stops listening for requests to stop once the command ends, whether or not it started", async (context) => {
    context.mock.method(console, "error", () => undefined);
    const signals = ["SIGTERM", "SIGHUP", "SIGINT"];
    const listening = () =>
      signals.map((signal) => process.listenerCount(signal));
    const before = listening();
    await runCommand(process.execPath, ["--version"]);
    await runCommand("fathom-no-such-command", [], {});
    assert.deepEqual(listening(), before);
  });
});

describe("a command's time limit", () => {
  // A command that starts a process ignoring requests to stop, writes its number down, then hangs,
  // itself ignoring them too when told to.
  const hanging = (written, { ignoresStop = false } = {}) => [
    "--eval",
    `const { spawn } = require("node:child_process");
${ignoresStop ? "process.on('SIGTERM', () => {});" : ""}
const left = spawn(process.execPath, ["--eval", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: "ignore" });
require("node:fs").writeFileSync(${JSON.stringify(written)}, String(left.pid));
setInterval(() => {}, 1000);`,
  ];

  async function inFolder(work) {
    const folder = mkdtempSync(join(tmpdir(), "fathom-run-command-"));
    try {
      return await work(join(folder, "left"));
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }

  const pause = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function hasEnded(written) {
    const left = Number(readFileSync(written, "utf8"));
    for (let tries = 0; isRunning(left) && tries < 50; tries += 1)
      await pause(20);
    return !isRunning(left);
  }

  async function writtenSoon(written) {
    for (let tries = 0; tries < 250; tries += 1) {
      try {
        if (readFileSync(written, "utf8") !== "") return;
      } catch {
        // Not written yet.
      }
      await pause(20);
    }
    throw new Error(`${written} was never written`);
  }

  it("stops a command past its limit, with every process it started, naming it", async (context) => {
    const problems = context.mock.method(console, "error", () => undefined);
    await inFolder(async (written) => {
      const args = hanging(written);
      const started = Date.now();
      assert.equal(
        await runCommand(process.execPath, args, process.env, {
          limitSeconds: 1,
        }),
        ranTooLong,
      );
      assert.ok(Date.now() - started < 10_000);
      assert.equal(
        problems.mock.calls[0]?.arguments[0],
        `==> ${[process.execPath, ...args].join(" ")} ran past the 1s limit, so it was stopped`,
      );
      assert.equal(await hasEnded(written), true);
    });
  });

  it("kills a command past its limit that ignores the request to stop, once the grace has passed", async (context) => {
    context.mock.method(console, "error", () => undefined);
    await inFolder(async (written) => {
      assert.equal(
        await runCommand(
          process.execPath,
          hanging(written, { ignoresStop: true }),
          process.env,
          { limitSeconds: 1, graceMilliseconds: 200 },
        ),
        ranTooLong,
      );
      assert.equal(await hasEnded(written), true);
    });
  });

  it("passes a request to stop on to the command's group, killing what ignores it once the grace has passed", async () => {
    await inFolder(async (written) => {
      const ended = runCommand(
        process.execPath,
        hanging(written, { ignoresStop: true }),
        process.env,
        { limitSeconds: 60, graceMilliseconds: 200 },
      );
      await writtenSoon(written);
      process.emit("SIGTERM", "SIGTERM");
      assert.equal(await ended, 137);
      assert.equal(await hasEnded(written), true);
    });
  });

  it("gives a command that ends within its limit its own exit code", async () => {
    assert.equal(
      await runCommand(
        process.execPath,
        ["--eval", "process.exit(3)"],
        process.env,
        { limitSeconds: 60 },
      ),
      3,
    );
  });

  it("is a check's job limit, 15 minutes unless set to a whole number of seconds, at most as long as a timer waits", () => {
    assert.equal(jobLimitSeconds({}), 900);
    assert.equal(jobLimitSeconds({ FATHOM_CHECK_JOB_SECONDS: "3" }), 3);
    assert.equal(
      jobLimitSeconds({ FATHOM_CHECK_JOB_SECONDS: "99999999" }),
      2_147_483,
    );
    for (const setting of ["", "0", "-2", "1.5", "soon"])
      assert.equal(
        jobLimitSeconds({ FATHOM_CHECK_JOB_SECONDS: setting }),
        900,
        setting,
      );
  });
});
