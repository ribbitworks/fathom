// SPDX-License-Identifier: Apache-2.0

// Limits how many test databases start at once on this computer, across test processes and copies
// of the repository, since starting many together can make Testcontainers time out waiting for a
// container's ports. Each start holds a slot, a file in a folder of the user's own under the
// system's temporary folder, naming its process; a slot whose process has ended is taken over, so a
// crashed test never blocks others.

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export interface StartSlotOptions {
  folder: string;
  startsAtOnce: number;
  retryMilliseconds: number;
  // How long to wait before saying which processes hold the slots, in case they are stuck.
  reportAfterMilliseconds: number;
  report: (message: string) => void;
}

// Chosen by measurement: 4 at once made test files queue in a full check, and starting every test
// database at once is what times out on a busy computer.
const defaultStartSlotOptions: StartSlotOptions = {
  folder: join(
    tmpdir(),
    `fathom-test-database-starts-${String(userInfo().uid)}`,
  ),
  startsAtOnce: 8,
  retryMilliseconds: 250,
  reportAfterMilliseconds: 30_000,
  report: (message) => {
    process.stderr.write(`${message}\n`);
  },
};

function isRunning(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

// What a slot holds: its holder's process and a token of its own, or nothing once it is freed.
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

// Removes the slot only while it still holds these contents, so nobody frees another's slot.
// Between reading and removing, another process could take the slot over; that can let one extra
// start through, never more, since each holder frees only its own slot.
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

function slotsOf(options: StartSlotOptions): string[] {
  return Array.from({ length: options.startsAtOnce }, (_, index) =>
    join(options.folder, `slot-${String(index)}`),
  );
}

async function takeSlot(
  options: StartSlotOptions,
  token: string,
): Promise<string> {
  mkdirSync(options.folder, { recursive: true, mode: 0o700 });
  const asked = Date.now();
  let reported = false;
  for (;;) {
    for (const slot of slotsOf(options)) {
      if (tryTake(slot, token)) return slot;
    }
    if (!reported && Date.now() - asked >= options.reportAfterMilliseconds) {
      reported = true;
      const holders = slotsOf(options)
        .map((slot) => holderIn(contentsOf(slot) ?? ""))
        .filter((holder) => holder !== undefined);
      options.report(
        `Waiting to start a test database: processes ${holders.join(", ")} hold every slot in ${options.folder}`,
      );
    }
    await delay(options.retryMilliseconds);
  }
}

// Runs the start once a slot is free, and frees the slot when it ends, whether or not it succeeded.
export async function inStartSlot<T>(
  start: () => Promise<T>,
  options: StartSlotOptions = defaultStartSlotOptions,
): Promise<T> {
  const token = `${String(process.pid)}:${randomUUID()}`;
  const slot = await takeSlot(options, token);
  try {
    return await start();
  } finally {
    removeIfHolding(slot, token);
  }
}
