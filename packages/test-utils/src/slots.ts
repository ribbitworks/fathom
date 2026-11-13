// SPDX-License-Identifier: Apache-2.0

// Limits how many of one kind of work run at once on this computer, across processes and copies of
// the repository, such as starting test databases or running the package tests. Each run holds a
// slot, a file in a folder of the user's own under the system's temporary folder, naming its
// process; a slot whose process has ended is taken over, so a crashed run never blocks others.

import { randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const millisecondsPerSecond = 1_000;

export interface SlotOptions {
  folder: string;
  atOnce: number;
  retryMilliseconds: number;
  // How long to wait before saying which processes hold the slots, in case they are stuck.
  reportAfterMilliseconds: number;
  // What a run waits to do, as in "Waiting to start a test database".
  waitingTo: string;
  report: (message: string) => void;
}

// Slots shared by every copy of the repository on this computer, named for the work they limit,
// whose waits are reported on standard error.
export function machineSlots(
  name: string,
  settings: Omit<SlotOptions, "folder" | "report">,
): SlotOptions {
  return {
    folder: join(tmpdir(), `fathom-${name}-${String(userInfo().uid)}`),
    report: (message) => {
      process.stderr.write(`${message}\n`);
    },
    ...settings,
  };
}

function isRunning(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

// What a slot holds: its holder's process, a token of its own, and the folder it runs in, or nothing
// once it is freed. Copies of the repository on older code write no folder.
function contentsOf(slot: string): string | undefined {
  try {
    return readFileSync(slot, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function holderIn(contents: string): number | undefined {
  const processId = Number.parseInt(contents.split(":")[0] ?? "", 10);
  return Number.isInteger(processId) ? processId : undefined;
}

function describeHolder(contents: string): string | undefined {
  const holder = holderIn(contents);
  if (holder === undefined) return undefined;
  const folder = contents.split(":").slice(2).join(":");
  return folder === ""
    ? `process ${String(holder)}`
    : `process ${String(holder)} (${folder})`;
}

// Removes the slot only while it still holds these contents, so nobody frees another's slot.
// Between reading and removing, another process could take the slot over; that can let one extra
// run through, never more, since each holder frees only its own slot.
function removeIfHolding(slot: string, contents: string): void {
  if (contentsOf(slot) === contents) rmSync(slot, { force: true });
}

function tryTake(slot: string, token: string): boolean {
  try {
    writeFileSync(slot, token, { flag: "wx" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const contents = contentsOf(slot);
  const holder = contents === undefined ? undefined : holderIn(contents);
  // A slot being written has no process yet, and is left to its writer.
  if (contents !== undefined && holder !== undefined && !isRunning(holder))
    removeIfHolding(slot, contents);
  return false;
}

function slotsOf(options: SlotOptions): string[] {
  return Array.from({ length: options.atOnce }, (_, index) =>
    join(options.folder, `slot-${String(index)}`),
  );
}

// The temporary folder may be shared by every user, as on Linux, so a slot folder another user made,
// or could write to, is refused rather than waited on.
const ownerOnly = 0o700;
const groupAndOthers = 0o077;

function ownFolder(folder: string): void {
  mkdirSync(folder, { recursive: true, mode: ownerOnly });
  if (process.getuid === undefined) return;
  const found = lstatSync(folder);
  if (
    !found.isDirectory() ||
    found.uid !== process.getuid() ||
    (found.mode & groupAndOthers) !== 0
  ) {
    throw new Error(
      `${folder} must be a folder of your own that only you can use; remove it and try again`,
    );
  }
}

async function takeSlot(options: SlotOptions, token: string): Promise<string> {
  ownFolder(options.folder);
  const asked = Date.now();
  let reported = false;
  for (;;) {
    for (const slot of slotsOf(options)) {
      if (tryTake(slot, token)) return slot;
    }
    if (!reported && Date.now() - asked >= options.reportAfterMilliseconds) {
      reported = true;
      const holders = slotsOf(options)
        .map((slot) => describeHolder(contentsOf(slot) ?? ""))
        .filter((holder) => holder !== undefined);
      options.report(
        `Waiting to ${options.waitingTo}; the slots in ${options.folder} are held by ${holders.join(", ")}`,
      );
    }
    await delay(options.retryMilliseconds);
  }
}

// Runs the work once a slot is free, and frees the slot when it ends, whether or not it succeeded.
export async function inSlot<T>(
  work: () => Promise<T>,
  options: SlotOptions,
): Promise<T> {
  const token = `${String(process.pid)}:${randomUUID()}:${process.cwd()}`;
  const slot = await takeSlot(options, token);
  try {
    return await work();
  } finally {
    removeIfHolding(slot, token);
  }
}

// Runs the work in this computer's one slot for it, or at once when the environment shows a run that
// already holds that slot, as for processes the work itself starts. The work is given the
// environment marked so. A run that had to wait says so, and once it starts, how long it waited.
export async function inTurn<T>(
  work: (environment: NodeJS.ProcessEnv) => T | Promise<T>,
  options: SlotOptions,
  marker: string,
  environment: NodeJS.ProcessEnv,
): Promise<T> {
  const marked = { ...environment, [marker]: "1" };
  const inHeldSlot = Object.entries(environment).some(
    ([name, value]) => name === marker && value === "1",
  );
  if (inHeldSlot) return work(marked);
  const asked = Date.now();
  let waited = false;
  return inSlot(
    async () => {
      if (waited) {
        options.report(
          `Waited ${String(Math.round((Date.now() - asked) / millisecondsPerSecond))}s to ${options.waitingTo}`,
        );
      }
      return work(marked);
    },
    {
      ...options,
      report: (message) => {
        waited = true;
        options.report(message);
      },
    },
  );
}
