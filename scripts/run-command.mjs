// SPDX-License-Identifier: Apache-2.0

// Runs a command with its output shown as it comes, and gives back how it ended, as a shell would:
// its exit code, or 128 and the number of the signal that stopped it. While it runs, a request to
// stop the script that started it is passed on, so the command ends first and whatever the script
// holds, such as its turn to check, is freed only after. A command given a time limit runs in a
// process group of its own, which is stopped, with every process the command started, once it runs
// past the limit.

import { spawn } from "node:child_process";
import { constants } from "node:os";

// Exit codes as shells give them: a command that could not start, and one a signal stopped.
export const couldNotStart = 127;
const signalled = 128;
// The exit code GNU timeout gives a command it stopped for running too long.
export const ranTooLong = 124;
const signalNumbers = new Map(Object.entries(constants.signals));

// Signals that ask a script to stop, which are sent on to the command. Pressing Ctrl-C in a terminal
// already sends the interrupt to the command, so then it is only waited on.
const passedOn = ["SIGTERM", "SIGHUP"];

// A command in a process group of its own no longer hears the terminal's interrupt, so it is sent on.
function stopSignals(ownGroup) {
  return process.stdin.isTTY && !ownGroup ? passedOn : [...passedOn, "SIGINT"];
}

// A check's job running longer than this has hung; the longest, the package tests, takes about 5
// minutes. FATHOM_CHECK_JOB_SECONDS sets another.
const defaultJobLimitSeconds = 900;

// Node's timers wait at most this long.
const longestLimitSeconds = 2_147_483;

export function jobLimitSeconds(environment = process.env) {
  const seconds = Number(environment.FATHOM_CHECK_JOB_SECONDS ?? "");
  return Number.isInteger(seconds) && seconds > 0
    ? Math.min(seconds, longestLimitSeconds)
    : defaultJobLimitSeconds;
}

// How long a command asked to stop has to end before it and every process it started are killed,
// since a hung command may not heed the request. It is shorter than the five seconds check.sh gives
// a job it stops, so the command's group is killed before check.sh kills this script.
const stopGraceMilliseconds = 2_000;
const millisecondsPerSecond = 1_000;

// A group already gone, or ending, cannot be signalled, and needs nothing more.
function signalGroup(leader, signal) {
  try {
    process.kill(-leader, signal);
  } catch (error) {
    if (error.code !== "ESRCH" && error.code !== "EPERM") throw error;
  }
}

export function runCommand(
  command,
  args,
  environment = process.env,
  { limitSeconds, graceMilliseconds = stopGraceMilliseconds } = {},
) {
  return new Promise((resolve) => {
    const ownGroup = limitSeconds !== undefined;
    const child = spawn(command, args, {
      stdio: "inherit",
      env: environment,
      detached: ownGroup,
    });
    const signalCommand = (signal) =>
      ownGroup && child.pid !== undefined
        ? signalGroup(child.pid, signal)
        : child.kill(signal);
    let killing;
    // A command in a group of its own is killed with everything it started if it hasn't ended once
    // the grace has passed, as nothing outside the group would kill them.
    const stopCommand = (signal) => {
      signalCommand(signal);
      if (ownGroup && killing === undefined)
        killing = setTimeout(() => signalCommand("SIGKILL"), graceMilliseconds);
    };
    const waitForCommand = () => undefined;
    const sentOn = stopSignals(ownGroup);
    let stoppedForTime = false;
    const limit = ownGroup
      ? setTimeout(() => {
          stoppedForTime = true;
          console.error(
            `==> ${[command, ...args].join(" ")} ran past the ${String(limitSeconds)}s limit, so it was stopped`,
          );
          stopCommand("SIGTERM");
        }, limitSeconds * millisecondsPerSecond)
      : undefined;
    for (const signal of sentOn) process.on(signal, stopCommand);
    if (!sentOn.includes("SIGINT")) process.on("SIGINT", waitForCommand);
    let finished = false;
    const finish = (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(limit);
      clearTimeout(killing);
      // Whatever a stopped command started and left running is killed with it.
      if (killing !== undefined) signalCommand("SIGKILL");
      for (const signal of sentOn) process.off(signal, stopCommand);
      process.off("SIGINT", waitForCommand);
      resolve(code);
    };
    child.on("error", (error) => {
      console.error(`error: ${command} did not start: ${error.message}`);
      finish(couldNotStart);
    });
    child.on("close", (code, signal) => {
      if (stoppedForTime) finish(ranTooLong);
      else if (signal === null) finish(code);
      else finish(signalled + (signalNumbers.get(signal) ?? 0));
    });
  });
}
