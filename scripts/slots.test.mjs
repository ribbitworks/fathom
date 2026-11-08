// SPDX-License-Identifier: Apache-2.0

// Tests of the limits on how much of one kind of work runs at once on this computer, which
// packages/test-utils/src/slots.ts sets: no more runs together than the limit, a slot is freed
// whether or not its run succeeds, a slot whose process has ended is taken over, a slot is freed
// only by its holder, and a long wait says what it waits to do and which processes hold the slots.

import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { inSlot, machineSlots } from "../packages/test-utils/src/slots.ts";

// A process number no process holds, above the largest any system gives out.
const endedProcess = 99_999_999;

let folder;
let reports;

function options(overrides = {}) {
  return {
    folder,
    atOnce: 2,
    retryMilliseconds: 5,
    reportAfterMilliseconds: 60_000,
    waitingTo: "start a test database",
    report: (message) => reports.push(message),
    ...overrides,
  };
}

// A run that keeps going until it is let go, and says when it began.
function heldRun() {
  let release;
  let began;
  const started = new Promise((resolve) => {
    began = resolve;
  });
  const finished = new Promise((resolve) => {
    release = resolve;
  });
  return {
    started,
    release,
    run: async () => {
      began();
      await finished;
    },
  };
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "fathom-slots-"));
  reports = [];
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe("running in slots", () => {
  it("runs no more together than the limit, and the next once one ends", async () => {
    // Given two runs holding both slots
    const first = heldRun();
    const second = heldRun();
    const third = heldRun();
    const running = [
      inSlot(first.run, options()),
      inSlot(second.run, options()),
    ];
    await Promise.all([first.started, second.started]);

    // When a third asks for a slot
    let thirdBegan = false;
    const waiting = inSlot(async () => {
      thirdBegan = true;
      await third.run();
    }, options());

    // Then its first try finds no slot, and it waits until one of them ends
    assert.equal(thirdBegan, false);
    first.release();
    await third.started;
    assert.equal(thirdBegan, true);
    second.release();
    third.release();
    await Promise.all([...running, waiting]);
    assert.deepEqual(readdirSync(folder), []);
  });

  it("frees the slot when the run fails", async () => {
    await assert.rejects(
      inSlot(() => Promise.reject(new Error("no port")), options()),
      /no port/,
    );
    assert.deepEqual(readdirSync(folder), []);
  });

  it("takes over a slot whose process has ended", async () => {
    writeFileSync(join(folder, "slot-0"), `${String(endedProcess)}:left`);
    const result = await inSlot(
      () => Promise.resolve("started"),
      options({ atOnce: 1 }),
    );
    assert.equal(result, "started");
    assert.equal(existsSync(join(folder, "slot-0")), false);
  });

  it("leaves a slot alone that another holder took in the meantime", async () => {
    // Given a run whose slot another process holds by the time it ends
    const slot = join(folder, "slot-0");
    await inSlot(
      async () => {
        writeFileSync(slot, `${String(process.pid)}:another holder`);
      },
      options({ atOnce: 1 }),
    );

    // Then that holder's slot is still there
    assert.equal(existsSync(slot), true);
  });

  it("says what it waits to do, and which processes hold the slots and where, when it waits long", async () => {
    // Given both slots held by this running process, one from a copy on older code naming no folder
    writeFileSync(
      join(folder, "slot-0"),
      `${String(process.pid)}:held:/work/fathom-3`,
    );
    writeFileSync(join(folder, "slot-1"), `${String(process.pid)}:held`);
    const waiting = inSlot(
      () => Promise.resolve(),
      options({ reportAfterMilliseconds: 20 }),
    );

    // When the wait passes the limit
    while (reports.length === 0) await delay(5);

    // Then it names them, once
    assert.deepEqual(reports, [
      `Waiting to start a test database; the slots in ${folder} are held by process ${String(process.pid)} (/work/fathom-3), process ${String(process.pid)}`,
    ]);
    rmSync(join(folder, "slot-0"));
    await waiting;
    assert.equal(reports.length, 1);
  });

  it("names the folder it runs in, in the slot it holds", async () => {
    const holding = await inSlot(
      () => Promise.resolve(readFileSync(join(folder, "slot-0"), "utf8")),
      options(),
    );
    assert.equal(holding.startsWith(`${String(process.pid)}:`), true);
    assert.equal(holding.endsWith(`:${process.cwd()}`), true);
  });

  it(
    "refuses a slot folder that others can use",
    { skip: process.getuid === undefined },
    async () => {
      chmodSync(folder, 0o755);
      await assert.rejects(
        inSlot(() => Promise.resolve(), options()),
        new Error(
          `${folder} must be a folder of your own that only you can use; remove it and try again`,
        ),
      );
    },
  );

  it("keeps test database starts in the folder older copies of the repository use", () => {
    assert.equal(
      machineSlots("test-database-starts", {
        atOnce: 1,
        retryMilliseconds: 5,
        reportAfterMilliseconds: 0,
        waitingTo: "start a test database",
      }).folder,
      join(tmpdir(), `fathom-test-database-starts-${String(userInfo().uid)}`),
    );
  });
});
