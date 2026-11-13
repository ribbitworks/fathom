// SPDX-License-Identifier: Apache-2.0

// Tests of scripts/run-command.mjs: a command ends with its own exit code, or 128 and the number of
// the signal that stopped it, one that cannot start is reported, and nothing is left listening for
// requests to stop after it ends.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { couldNotStart, runCommand } from "./run-command.mjs";

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
