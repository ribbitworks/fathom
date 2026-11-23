// SPDX-License-Identifier: Apache-2.0

// Tests of the limits on how much of one kind of work runs at once on this computer, and in what
// order, which packages/test-utils/src/slots.ts sets.

import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
  inSlot,
  inTurn,
  machineSlots,
  mayTakeTurn,
} from "../packages/test-utils/src/slots.ts";

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

  it("tells a run that starts alone that no other runs", async () => {
    assert.equal(
      await inSlot((others) => Promise.resolve(others), options()),
      0,
    );
  });

  it("tells a run how many others held a slot or waited for one as it started", async () => {
    // Given another running process holding one slot, and another run waiting in line behind
    writeFileSync(join(folder, "slot-0"), `${String(process.pid)}:held`);
    writeFileSync(
      join(folder, `ticket-${"9".repeat(15)}-${String(process.pid)}-later`),
      `${String(process.pid)}:later`,
    );

    // When a run takes the free slot
    const others = await inSlot((count) => Promise.resolve(count), options());

    // Then it is told of both
    assert.equal(others, 2);
  });

  it("counts no run whose process has ended among the others", async () => {
    // Given a slot and a ticket left by runs whose processes have ended
    writeFileSync(join(folder, "slot-0"), `${String(endedProcess)}:held`);
    writeFileSync(
      join(folder, `ticket-${"9".repeat(15)}-${String(endedProcess)}-ended`),
      `${String(endedProcess)}:ended`,
    );

    // When a run takes its slot
    const others = await inSlot((count) => Promise.resolve(count), options());

    // Then it is told it runs alone
    assert.equal(others, 0);
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

  it("waits behind a run that asked first, though a slot is free", async () => {
    // Given a run of another copy that asked first and still waits
    const earlier = join(
      folder,
      `ticket-000000000000001-${String(process.pid)}-earlier`,
    );
    writeFileSync(earlier, "");
    const waiting = inSlot(
      () => Promise.resolve("started"),
      options({ atOnce: 1, reportAfterMilliseconds: 0 }),
    );

    // When it has looked for a slot
    while (reports.length === 0) await delay(5);

    // Then it has left the free slot to the run ahead, and takes it once that run has gone
    assert.deepEqual(reports, [
      "Waiting to start a test database; 1 run asked first",
    ]);
    assert.equal(existsSync(join(folder, "slot-0")), false);
    rmSync(earlier);
    assert.equal(await waiting, "started");
    assert.deepEqual(readdirSync(folder), []);
  });

  it("takes its turn ahead of a waiting run whose process has ended", async () => {
    writeFileSync(
      join(folder, `ticket-000000000000001-${String(endedProcess)}-crashed`),
      "",
    );
    const result = await inSlot(
      () => Promise.resolve("started"),
      options({ atOnce: 1 }),
    );
    assert.equal(result, "started");
    assert.deepEqual(readdirSync(folder), []);
  });

  it("passes a waiting run's ticket left untouched long enough to be a crashed run's", async () => {
    // Given a ticket of a running process, untouched for an hour
    const stale = join(
      folder,
      `ticket-000000000000001-${String(process.pid)}-reused`,
    );
    writeFileSync(stale, "");
    const anHourAgo = new Date(Date.now() - 3_600_000);
    utimesSync(stale, anHourAgo, anHourAgo);

    // Then a run takes its turn ahead of it, and the ticket is gone
    const result = await inSlot(
      () => Promise.resolve("started"),
      options({ atOnce: 1 }),
    );
    assert.equal(result, "started");
    assert.deepEqual(readdirSync(folder), []);
  });

  it("puts its ticket back, keeping its place, when another run passed it while it slept", async () => {
    // Given a run waiting for the one slot
    writeFileSync(join(folder, "slot-0"), `${String(process.pid)}:held`);
    const waiting = inSlot(
      () => Promise.resolve("started"),
      options({ atOnce: 1 }),
    );
    const tickets = () =>
      readdirSync(folder).filter((name) => name.startsWith("ticket-"));
    while (tickets().length === 0) await delay(5);
    const [ticket] = tickets();

    // When its ticket is removed, as a run that woke first removes a stale one
    rmSync(join(folder, ticket));

    // Then it puts the same ticket back, and takes the slot once it is free
    while (tickets().length === 0) await delay(5);
    assert.deepEqual(tickets(), [ticket]);
    rmSync(join(folder, "slot-0"));
    assert.equal(await waiting, "started");
    assert.deepEqual(readdirSync(folder), []);
  });

  it("names the holders and the runs ahead when both keep it waiting, but no holder that has ended", async () => {
    // Given one slot held by a running process, one by an ended one, and a run that asked first
    writeFileSync(join(folder, "slot-0"), `${String(process.pid)}:held`);
    writeFileSync(join(folder, "slot-1"), `${String(endedProcess)}:left`);
    const earlier = join(
      folder,
      `ticket-000000000000001-${String(process.pid)}-earlier`,
    );
    writeFileSync(earlier, "");
    const waiting = inSlot(
      () => Promise.resolve(),
      options({ reportAfterMilliseconds: 0 }),
    );

    // When it has looked for a slot
    while (reports.length === 0) await delay(5);

    // Then it names the running holder and the run ahead
    assert.deepEqual(reports, [
      `Waiting to start a test database; the slots in ${folder} are held by process ${String(process.pid)}; 1 run asked first`,
    ]);
    rmSync(earlier);
    await waiting;
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

describe("running in turn", () => {
  const marker = "FATHOM_TEST_SLOT";
  const turnOptions = () =>
    options({ atOnce: 1, reportAfterMilliseconds: 0, waitingTo: "run a test" });

  it("says how long it waited once its turn comes, and gives the work the marked environment", async () => {
    // Given another running process holding the one slot
    writeFileSync(join(folder, "slot-0"), `${String(process.pid)}:held`);

    // When work asks for its turn
    const running = inTurn(
      (environment) => environment,
      turnOptions(),
      marker,
      { OTHER: "kept" },
    );
    while (reports.length === 0) await delay(5);
    rmSync(join(folder, "slot-0"));

    // Then it runs once the slot is free, saying how long it waited, with the marker set
    assert.deepEqual(await running, { OTHER: "kept", [marker]: "1" });
    assert.match(reports[1] ?? "", /^Waited \d+s to run a test$/);
    assert.deepEqual(readdirSync(folder), []);
  });

  it("says nothing of waiting when the slot is free", async () => {
    assert.equal(await inTurn(() => "ran", turnOptions(), marker, {}), "ran");
    assert.deepEqual(reports, []);
  });

  it("tells work that takes its turn how many others run, and work within a turn nothing", async () => {
    const taken = await inTurn(
      (_environment, others) => others,
      turnOptions(),
      marker,
      {},
    );
    const within = await inTurn(
      (_environment, others) => others,
      turnOptions(),
      marker,
      { [marker]: "1" },
    );
    assert.equal(taken, 0);
    assert.equal(within, undefined);
  });

  it("runs at once within a run holding the slot", async () => {
    writeFileSync(join(folder, "slot-0"), `${String(process.pid)}:held`);
    assert.equal(
      await inTurn(() => "ran", turnOptions(), marker, { [marker]: "1" }),
      "ran",
    );
    assert.deepEqual(reports, []);
  });
});

describe("taking turns", () => {
  const line = ["ticket-2-b", "ticket-1-a", "ticket-3-c"];

  it("lets the first in line take the one free slot", () => {
    assert.equal(mayTakeTurn(line, "ticket-1-a", 1), true);
  });

  it("keeps the next in line waiting while only one slot is free", () => {
    assert.equal(mayTakeTurn(line, "ticket-2-b", 1), false);
  });

  it("lets as many of the first in line through as slots are free", () => {
    assert.equal(mayTakeTurn(line, "ticket-2-b", 2), true);
  });

  it("lets nobody through while no slot is free", () => {
    assert.equal(mayTakeTurn(line, "ticket-1-a", 0), false);
  });

  it("lets through no run that is not in line", () => {
    assert.equal(mayTakeTurn(line, "ticket-4-d", 3), false);
  });
});
