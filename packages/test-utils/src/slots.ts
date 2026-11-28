// SPDX-License-Identifier: Apache-2.0

// Limits how many of one kind of work run at once on this computer, across processes and copies of
// the repository, in the order they asked, such as starting test databases or running checks.

import { randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
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

// Whether a run whose ticket this is may take a free slot now: those waiting take turns in the
// order they asked, so only as many of the first in line as there are free slots may.
export function mayTakeTurn(
  waiting: readonly string[],
  ticket: string,
  free: number,
): boolean {
  const place = [...waiting].sort().indexOf(ticket);
  return place !== -1 && place < free;
}

// A waiting run's ticket is named ticket-<when it asked, in padded milliseconds>-<process>-<token>,
// so the line sorts by when each run asked, then by its process.
const ticketTimeDigits = 15;

function ticketFor(token: string): string {
  const [processId, tokenId] = token.split(":");
  return `ticket-${String(Date.now()).padStart(ticketTimeDigits, "0")}-${processId ?? ""}-${tokenId ?? ""}`;
}

function ticketHolder(ticket: string): number | undefined {
  const processId = Number.parseInt(ticket.split("-")[2] ?? "", 10);
  return Number.isInteger(processId) ? processId : undefined;
}

// A waiting run touches its ticket each time it looks for a slot, so a ticket left untouched this
// long is a crashed run's, even if another process has since been given its number.
const ticketStaleMilliseconds = 60_000;

function isWaiting(folder: string, ticket: string): boolean {
  const holder = ticketHolder(ticket);
  if (holder === undefined || !isRunning(holder)) return false;
  try {
    return (
      Date.now() - statSync(join(folder, ticket)).mtimeMs <
      ticketStaleMilliseconds
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

// The tickets of the runs still waiting, after removing those of runs that have ended, so a crashed
// waiter never holds up the line.
function waitingLine(folder: string): string[] {
  return readdirSync(folder)
    .filter((name) => name.startsWith("ticket-"))
    .filter((ticket) => {
      if (isWaiting(folder, ticket)) return true;
      rmSync(join(folder, ticket), { force: true });
      return false;
    });
}

function isFree(slot: string): boolean {
  const contents = contentsOf(slot);
  if (contents === undefined) return true;
  const holder = holderIn(contents);
  return holder !== undefined && !isRunning(holder);
}

const heldSlots = (options: SlotOptions): string[] =>
  slotsOf(options).filter((slot) => !isFree(slot));

// What a run waiting its turn says: what it waits to do, which running processes hold the slots, and
// how many runs that asked first wait ahead of it.
function waitWords(options: SlotOptions, ahead: number): string {
  const holders = heldSlots(options)
    .map((slot) => describeHolder(contentsOf(slot) ?? ""))
    .filter((holder) => holder !== undefined);
  const reasons = [
    ...(holders.length > 0
      ? [`the slots in ${options.folder} are held by ${holders.join(", ")}`]
      : []),
    ...(ahead > 0
      ? [`${String(ahead)} ${ahead === 1 ? "run" : "runs"} asked first`]
      : []),
  ];
  return [`Waiting to ${options.waitingTo}`, ...reasons].join("; ");
}

// Touches a waiting run's ticket, or puts it back under its first name, keeping its place, when
// another run passed it as stale while this one was asleep, as a computer is while closed.
function touchTicket(ticketFile: string, token: string): void {
  const now = new Date();
  try {
    utimesSync(ticketFile, now, now);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    writeFileSync(ticketFile, token);
  }
}

async function takeSlot(options: SlotOptions, token: string): Promise<string> {
  ownFolder(options.folder);
  const ticket = ticketFor(token);
  const ticketFile = join(options.folder, ticket);
  writeFileSync(ticketFile, token);
  try {
    const asked = Date.now();
    let reported = false;
    for (;;) {
      touchTicket(ticketFile, token);
      // The line is read before the free slots are counted, so a slot freed in between is left to
      // whoever is first in line by then.
      const line = waitingLine(options.folder);
      const free = slotsOf(options).filter(isFree).length;
      if (mayTakeTurn(line, ticket, free)) {
        // Highest first, leaving the first slot to copies on older code that use only that one, so
        // one of them first in line isn't kept waiting behind a later run that took it.
        for (const slot of slotsOf(options).reverse()) {
          if (tryTake(slot, token)) return slot;
        }
      }
      if (!reported && Date.now() - asked >= options.reportAfterMilliseconds) {
        reported = true;
        options.report(waitWords(options, line.sort().indexOf(ticket)));
      }
      await delay(options.retryMilliseconds);
    }
  } finally {
    rmSync(ticketFile, { force: true });
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

// Whether the environment shows a run that already holds its turn, marked so by inTurn.
function holdsTurn(environment: NodeJS.ProcessEnv, marker: string): boolean {
  return Object.entries(environment).some(
    ([name, value]) => name === marker && value === "1",
  );
}

// Runs the work in its turn on this computer, or at once when the environment shows a run that
// already holds its turn, as for processes the work itself starts. The work is given the
// environment marked so. A run that had to wait says so, and once it starts, how long it waited.
export async function inTurn<T>(
  work: (environment: NodeJS.ProcessEnv) => T | Promise<T>,
  options: SlotOptions,
  marker: string,
  environment: NodeJS.ProcessEnv,
): Promise<T> {
  const marked = { ...environment, [marker]: "1" };
  if (holdsTurn(environment, marker)) return work(marked);
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
