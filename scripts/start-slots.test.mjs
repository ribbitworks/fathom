// SPDX-License-Identifier: Apache-2.0

// Tests of the limit on how many test databases start at once, which
// packages/test-utils/src/start-slots.ts sets: no more starts run together than the limit, a slot
// is freed whether or not its start succeeds, a slot whose process has ended is taken over, a slot
// is freed only by its holder, and a long wait says which processes hold the slots.

import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { inStartSlot } from "../packages/test-utils/src/start-slots.ts";

// A process number no process holds, above the largest any system gives out.
const endedProcess = 99_999_999;

let folder;
let reports;

function options(overrides = {}) {
  return {
    folder,
    startsAtOnce: 2,
    retryMilliseconds: 5,
    reportAfterMilliseconds: 60_000,
    report: (message) => reports.push(message),
    ...overrides,
  };
}

// A start that stays running until it is let go, and says when it began.
function heldStart() {
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
  folder = mkdtempSync(join(tmpdir(), "fathom-start-slots-"));
  reports = [];
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe("starting test databases", () => {
  it("runs no more starts together than the limit, and the next once one ends", async () => {
    // Given two starts holding both slots
    const first = heldStart();
    const second = heldStart();
    const third = heldStart();
    const running = [
      inStartSlot(first.run, options()),
      inStartSlot(second.run, options()),
    ];
    await Promise.all([first.started, second.started]);

    // When a third asks for a slot
    let thirdBegan = false;
    const waiting = inStartSlot(async () => {
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

  it("frees the slot when the start fails", async () => {
    await assert.rejects(
      inStartSlot(() => Promise.reject(new Error("no port")), options()),
      /no port/,
    );
    assert.deepEqual(readdirSync(folder), []);
  });

  it("takes over a slot whose process has ended", async () => {
    writeFileSync(join(folder, "slot-0"), `${String(endedProcess)}:left`);
    const result = await inStartSlot(
      () => Promise.resolve("started"),
      options({ startsAtOnce: 1 }),
    );
    assert.equal(result, "started");
    assert.equal(existsSync(join(folder, "slot-0")), false);
  });

  it("leaves a slot alone that another holder took in the meantime", async () => {
    // Given a start whose slot another process holds by the time it ends
    const slot = join(folder, "slot-0");
    await inStartSlot(
      async () => {
        writeFileSync(slot, `${String(process.pid)}:another holder`);
      },
      options({ startsAtOnce: 1 }),
    );

    // Then that holder's slot is still there
    assert.equal(existsSync(slot), true);
  });

  it("says which processes hold every slot when a start waits long", async () => {
    // Given every slot held by this running process
    writeFileSync(join(folder, "slot-0"), `${String(process.pid)}:held`);
    const waiting = inStartSlot(
      () => Promise.resolve(),
      options({ startsAtOnce: 1, reportAfterMilliseconds: 20 }),
    );

    // When the wait passes the limit
    while (reports.length === 0) await delay(5);

    // Then it names the holder and the folder, once
    assert.deepEqual(reports, [
      `Waiting to start a test database: processes ${String(process.pid)} hold every slot in ${folder}`,
    ]);
    rmSync(join(folder, "slot-0"));
    await waiting;
    assert.equal(reports.length, 1);
  });
});
