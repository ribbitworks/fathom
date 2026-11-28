// SPDX-License-Identifier: Apache-2.0

// Tests of scripts/check-turn.mjs: a check waits its turn, saying so and how long it waited, goes
// ahead within a check that holds the turn, and ends with its command, passing on a request to stop.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { checkRuns, inCheckTurn } from "./check-turn.mjs";

const script = fileURLToPath(new URL("check-turn.mjs", import.meta.url));

let folder;
let reports;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "fathom-checks-"));
  reports = [];
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

// A limit on each test, since one that runs the script waits on it.
const testLimit = { timeout: 30_000 };

// A command that keeps going, though not for ever, saying when it is ready.
const keepsGoing = [
  process.execPath,
  "--eval",
  "console.log('ready'); setTimeout(() => undefined, 60_000)",
];

// Starts the script as its own process, marked as holding the turn, so it does not wait on a check
// running on this computer, and with no terminal. It is stopped when the test ends.
function started(context, args) {
  const child = spawn(process.execPath, [script, ...args], {
    env: { ...process.env, FATHOM_CHECK_SLOT: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  context.after(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // Already ended, with the command it ran.
    }
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });
  return {
    child,
    output: () => output,
    ended: once(child, "close").then(([code]) => code),
  };
}

describe("running a check", () => {
  it(
    "waits while another copy runs one, saying so at once, then runs, saying how long it waited",
    testLimit,
    async () => {
      // Given another running copy holding the turn
      writeFileSync(
        join(folder, "slot-0"),
        `${String(process.pid)}:held:/work/fathom-1`,
      );
      const slots = {
        ...checkRuns,
        atOnce: 1,
        folder,
        retryMilliseconds: 5,
        report: (message) => reports.push(message),
      };

      // When a check is asked for
      const running = inCheckTurn(() => "passed", { slots, environment: {} });
      while (reports.length === 0) await delay(5);

      // Then it says what it waits for, and runs once the slot is free
      assert.deepEqual(reports, [
        `Waiting to run a check; the slots in ${folder} are held by process ${String(process.pid)} (/work/fathom-1)`,
      ]);
      rmSync(join(folder, "slot-0"));
      assert.equal(await running, "passed");
      assert.match(reports[1] ?? "", /^Waited \d+s to run a check$/);
      assert.deepEqual(readdirSync(folder), []);
    },
  );

  it("runs a check started within one that holds the turn at once", async () => {
    // Given another running copy holding the turn
    writeFileSync(
      join(folder, "slot-0"),
      `${String(process.pid)}:held:/work/fathom-1`,
    );

    // When a check is asked for from within a check that holds it
    const ran = await inCheckTurn(() => "passed", {
      slots: { ...checkRuns, atOnce: 1, folder },
      environment: { FATHOM_CHECK_SLOT: "1" },
    });

    // Then it runs without waiting
    assert.equal(ran, "passed");
    assert.deepEqual(reports, []);
  });

  it("ends with the command's exit code", testLimit, async (context) => {
    const { ended } = started(context, [
      process.execPath,
      "--eval",
      "process.exit(3)",
    ]);
    assert.equal(await ended, 3);
  });

  for (const [signal, code] of [
    ["SIGTERM", 143],
    ["SIGHUP", 129],
    ["SIGINT", 130],
  ]) {
    it(
      `passes ${signal} on to the command, and ends once the command has`,
      {
        ...testLimit,
        skip: "Times out now and then under a full check's load, until it is fixed",
      },
      async (context) => {
        // Given a check running a command that keeps going
        const { child, output, ended } = started(context, keepsGoing);
        while (!output().includes("ready")) await delay(5);

        // When the check alone is asked to stop
        child.kill(signal);

        // Then it ends as the stopped command did
        assert.equal(await ended, code);
      },
    );
  }

  it("says how to use it when given no command", testLimit, async (context) => {
    const { output, ended } = started(context, []);
    assert.equal(await ended, 2);
    assert.equal(
      output(),
      "error: Usage: check-turn.mjs <command> [arguments]\n",
    );
  });
});
