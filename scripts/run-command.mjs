// SPDX-License-Identifier: Apache-2.0

// Runs a command with its output shown as it comes, and gives back how it ended, as a shell would:
// its exit code, or 128 and the number of the signal that stopped it. While it runs, a request to
// stop the script that started it is passed on, so the command ends first and whatever the script
// holds, such as its turn to check, is freed only after.

import { spawn } from "node:child_process";
import { constants } from "node:os";

// Exit codes as shells give them: a command that could not start, and one a signal stopped.
export const couldNotStart = 127;
const signalled = 128;
const signalNumbers = new Map(Object.entries(constants.signals));

// Signals that ask a script to stop, which are sent on to the command. Pressing Ctrl-C in a terminal
// already sends the interrupt to the command, so then it is only waited on.
const passedOn = ["SIGTERM", "SIGHUP"];

function stopSignals() {
  return process.stdin.isTTY ? passedOn : [...passedOn, "SIGINT"];
}

export function runCommand(command, args, environment = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: environment,
    });
    const passOn = (signal) => child.kill(signal);
    const waitForCommand = () => undefined;
    const sentOn = stopSignals();
    for (const signal of sentOn) process.on(signal, passOn);
    if (!sentOn.includes("SIGINT")) process.on("SIGINT", waitForCommand);
    let finished = false;
    const finish = (code) => {
      if (finished) return;
      finished = true;
      for (const signal of sentOn) process.off(signal, passOn);
      process.off("SIGINT", waitForCommand);
      resolve(code);
    };
    child.on("error", (error) => {
      console.error(`error: ${command} did not start: ${error.message}`);
      finish(couldNotStart);
    });
    child.on("close", (code, signal) => {
      finish(
        signal === null ? code : signalled + (signalNumbers.get(signal) ?? 0),
      );
    });
  });
}
