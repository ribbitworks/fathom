// SPDX-License-Identifier: Apache-2.0

// A smoke check that the routes and a reference model agree on who changed a draft, over a handful
// of seeded random sequences of steps through the routes; the rule's cases are unit tests.

import { type PrivateConflicts } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Method, testPosition, unique } from "./test-app.ts";
import {
  closeUnpublishedTests,
  personOf,
  send,
  startUnpublishedTests,
  user,
  type User,
} from "./test-unpublished.ts";

beforeAll(startUnpublishedTests);

afterAll(closeUnpublishedTests);

const sequences = 5;
// The side a publish keeps, by its place among those it draws from.
const keepingTheirs = 1;
const stepsEach = 12;
// Steps that can't be taken, such as publishing with nothing private, are drawn again, up to this.
const triesEach = 200;

// A seeded random source, so each sequence is the same on every run.
function randomFrom(seed: number): (count: number) => number {
  let state = seed;
  return (count) => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return Math.floor((((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296) * count);
  };
}

// A change that counts once it reaches the published draft, from then.
interface Made {
  maker: string;
  at: number;
}

// A user's private changes to a record: their changes, and whether they remove it, and when, and
// whether it was only drafted to be added then, so removing it discards that draft and decides it.
interface Held {
  changes: number;
  removal: boolean;
  removedAt?: number;
  draftOnly?: boolean;
}

// What a user's next publish publishes besides what they hold: changes left by a discard by choice,
// and decisions it made, counting from when made.
interface Pending {
  recordId: string;
  decidesAt?: number;
}

interface RecordModel {
  live: boolean;
  gone: boolean;
  // The published draft, and whether it removes the record.
  draft: "none" | "change" | "removal";
  rejected: boolean;
  standing: Made[];
}

interface Model {
  time: number;
  records: Map<string, RecordModel>;
  held: Map<string, Map<string, Held>>;
  pending: Map<string, Pending[]>;
}

const heldBy = (model: Model, userId: string) =>
  model.held.get(userId) ?? new Map<string, Held>();

const pendingOf = (model: Model, userId: string) =>
  model.pending.get(userId) ?? [];

// Who counts as having changed a record's draft for a reader: those whose published changes stand
// since the last decision, and the reader while they hold changes to it, after their own decisions
// still private.
function editors(model: Model, recordId: string, reader?: string): string[] {
  const record = model.records.get(recordId) as RecordModel;
  let standing = record.standing;
  if (reader !== undefined && heldBy(model, reader).has(recordId)) {
    for (const { recordId: id, decidesAt } of pendingOf(model, reader)) {
      if (id === recordId && decidesAt !== undefined) {
        standing = standing.filter(({ at }) => at > decidesAt);
      }
    }
    const held = heldBy(model, reader).get(recordId) as Held;
    const own =
      held.changes > 0 ||
      (held.removal && record.live) ||
      pendingOf(model, reader).some(
        (each) => each.recordId === recordId && each.decidesAt === undefined,
      );
    return inTurn([
      ...standing.map(({ maker }) => maker),
      ...(own ? [reader] : []),
    ]);
  }
  return inTurn(standing.map(({ maker }) => maker));
}

// Makers in the order each last changed the draft.
const inTurn = (makers: readonly string[]): string[] =>
  makers.filter((maker, place) => !makers.slice(place + 1).includes(maker));

// A record going: everyone's private changes to it withdrawn, never counting.
function goes(model: Model, recordId: string) {
  const record = model.records.get(recordId) as RecordModel;
  record.gone = true;
  for (const [userId, held] of model.held) {
    held.delete(recordId);
    model.pending.set(
      userId,
      pendingOf(model, userId).filter((each) => each.recordId !== recordId),
    );
  }
}

interface World {
  model: Model;
  users: Map<string, User>;
  names: string[];
  recordIds: string[];
}

type Step = (world: World) => Promise<string | undefined>;

const personOk = async (
  who: User,
  method: Method,
  url: string,
  body?: object,
) => {
  const response = await send(who, method, url, body);
  expect(
    response.statusCode,
    `${method} ${url}: ${response.body}`,
  ).toBeLessThan(300);
};

type StepName =
  | "rename"
  | "remove"
  | "publish"
  | "discardChosen"
  | "discardAll"
  | "approve"
  | "reject"
  | "add";

function steps(
  world: World,
  random: (count: number) => number,
): Record<StepName, Step> {
  const anyOf = <Item>(items: readonly Item[]) =>
    items[random(items.length)] as Item;
  const name = anyOf(world.names);
  const who = world.users.get(name) as User;
  const recordId = anyOf(world.recordIds);
  const { model } = world;
  const record = model.records.get(recordId) as RecordModel;
  const held = heldBy(model, name);
  const mine = held.get(recordId);
  const changing = !record.gone && record.draft !== "removal" && !mine?.removal;
  return {
    rename: async () => {
      if (!changing) return undefined;
      await personOk(who, "PATCH", `/api/people/${recordId}`, {
        preferredName: unique("Fictional Named"),
      });
      held.set(recordId, {
        changes: (mine?.changes ?? 0) + 1,
        removal: false,
      });
      model.held.set(name, held);
      return `${name} renames ${recordId}`;
    },
    remove: async () => {
      if (!changing) return undefined;
      await personOk(who, "DELETE", `/api/people/${recordId}`);
      model.time += 1;
      held.set(recordId, {
        changes: mine?.changes ?? 0,
        removal: true,
        removedAt: model.time,
        draftOnly: !record.live,
      });
      model.held.set(name, held);
      return `${name} removes ${recordId}`;
    },
    publish: async () => {
      if (held.size === 0) return undefined;
      const keep = anyOf(["mine", "theirs"] as const);
      const asked = await send(who, "POST", "/api/unpublished/publish");
      if (asked.statusCode === 409) {
        const { conflicts = [] } = asked.json<Partial<PrivateConflicts>>();
        expect(conflicts.length, asked.body).toBeGreaterThan(0);
        const answer = await send(who, "POST", "/api/unpublished/publish", {
          resolutions: conflicts.map(
            ({ recordType, recordId: id, field, token }) => ({
              recordType,
              recordId: id,
              ...(field === undefined ? {} : { field }),
              keep,
              token,
            }),
          ),
        });
        expect(answer.statusCode, answer.body).toBe(200);
        if (keep === "theirs") {
          for (const { recordId: id } of conflicts) held.delete(id);
        }
      } else {
        expect(asked.statusCode, asked.body).toBe(200);
      }
      const clashed = asked.statusCode === 409;
      model.time += 1;
      const at = model.time;
      for (const { recordId: id, decidesAt } of pendingOf(model, name)) {
        const each = model.records.get(id) as RecordModel;
        if (decidesAt === undefined) each.standing.push({ maker: name, at });
        else
          each.standing = each.standing.filter((made) => made.at > decidesAt);
      }
      model.pending.set(name, []);
      for (const [id, each] of held) {
        const published = model.records.get(id) as RecordModel;
        if (each.draftOnly === true) {
          if (!published.live) {
            goes(model, id);
            continue;
          }
          // Approved since, the record has no draft left to discard: the discard decides nothing
          // published after it was made, and covers the maker's own changes before it.
          const decidedAt = each.removedAt ?? 0;
          published.standing = published.standing.filter(
            (made) => made.at > decidedAt,
          );
          continue;
        }
        published.standing.push({ maker: name, at });
        published.draft = each.removal ? "removal" : "change";
        published.rejected = false;
      }
      held.clear();
      return clashed
        ? `${name} publishes over a clash, keeping ${keep}`
        : `${name} publishes`;
    },
    discardChosen: async () => {
      if (mine === undefined) return undefined;
      await personOk(who, "POST", "/api/unpublished/discard", {
        drafts: { people: [recordId] },
      });
      model.time += 1;
      const pending = pendingOf(model, name);
      // With a published draft, taking it back is a change of the maker's, and their earlier ones
      // count; with none, it's a decision that covers their earlier changes.
      if (record.draft === "none") {
        pending.push({ recordId, decidesAt: model.time });
      } else {
        pending.push({ recordId });
      }
      model.pending.set(name, pending);
      held.delete(recordId);
      return `${name} discards ${recordId} by choice`;
    },
    discardAll: async () => {
      if (held.size === 0) return undefined;
      await personOk(who, "POST", "/api/unpublished/discard");
      held.clear();
      model.pending.set(name, []);
      return `${name} discards everything`;
    },
    approve: async () => {
      if (record.gone || record.draft === "none" || record.rejected) {
        return undefined;
      }
      // A private change to a record only drafted to be added, published once its addition is
      // approved, makes a draft that no longer fits, which this model doesn't reach.
      const changing = [...model.held.values()].some(
        (each) => (each.get(recordId)?.changes ?? 0) > 0,
      );
      if (!record.live && changing) return undefined;
      const response = await send(who, "POST", "/api/drafts/approval", {
        people: [recordId],
      });
      const refused = editors(model, recordId).includes(name);
      expect(response.statusCode, response.body).toBe(refused ? 403 : 200);
      if (refused) return `${name} is refused approving ${recordId}`;
      model.time += 1;
      record.standing = [];
      if (record.draft === "removal") goes(model, recordId);
      record.live = true;
      record.draft = "none";
      return `${name} approves ${recordId}`;
    },
    reject: async () => {
      if (record.gone || record.draft === "none" || record.rejected) {
        return undefined;
      }
      await personOk(who, "POST", "/api/drafts/rejection", {
        people: [recordId],
        reason: "Fictional reason",
      });
      record.rejected = true;
      return `${name} rejects ${recordId}`;
    },
    add: async () => {
      // A new record, only drafted to be added, once fewer than two are left to change.
      const left = world.recordIds.filter((id) => {
        const each = model.records.get(id) as RecordModel;
        return !each.gone && each.draft !== "removal";
      });
      if (left.length >= 2) return undefined;
      const id = await added(world.users.get(adder) as User);
      model.time += 1;
      model.records.set(id, {
        live: false,
        gone: false,
        draft: "change",
        rejected: false,
        standing: [{ maker: adder, at: model.time }],
      });
      world.recordIds.push(id);
      return `${adder} adds a record`;
    },
  };
}

// Each reader's editors of each record still there, and the model's.
async function compare(world: World, done: readonly string[]) {
  for (const name of world.names) {
    const reader = world.users.get(name) as User;
    for (const recordId of world.recordIds) {
      const record = world.model.records.get(recordId) as RecordModel;
      const mine = heldBy(world.model, name).get(recordId);
      if (record.gone || mine?.removal === true) continue;
      const draft = (await personOf(reader, recordId))?.draft;
      // A record with no draft, published or the reader's own, shows nobody.
      const expected =
        record.draft === "none" && mine === undefined
          ? []
          : editors(world.model, recordId, name);
      const names = new Map(
        [...world.users].map(([key, each]) => [each.name, key]),
      );
      const named = (editor: unknown) => names.get(String(editor));
      const context = `${name} reading ${recordId} after ${done.join("; ")}`;
      expect((draft?.editors ?? []).map(named), context).toEqual(expected);
      if (expected.length > 0) {
        expect(named(draft?.madeBy), context).toBe(expected.at(-1));
        const renamedBy = draft?.changedBy?.preferredName;
        if (renamedBy !== undefined) {
          expect(named(renamedBy), context).toBe(expected.at(-1));
        }
      }
    }
  }
}

// A person a user adds and publishes, only drafted to be added.
async function added(who: User): Promise<string> {
  const response = await send(who, "POST", "/api/people", {
    people: [
      {
        preferredName: unique("Fictional Person"),
        employeeId: unique("E"),
        positionId: testPosition,
      },
    ],
  });
  const [id = ""] = response.json<{ ids: string[] }>().ids;
  await personOk(who, "POST", "/api/unpublished/publish");
  return id;
}

// Who adds the records the sequences change, besides the readers.
const adder = "eve";

async function newWorld(): Promise<World> {
  const names = ["dan", "uma", "ann"];
  const users = new Map<string, User>();
  for (const name of names) {
    users.set(
      name,
      await user(["people:edit", "people:approve", "people:view"]),
    );
  }
  users.set(adder, await user(["people:edit", "people:view"]));
  const dan = users.get("dan") as User;
  const kai = await added(dan);
  const mo = await added(dan);
  // Kai is only drafted to be added, by Dan; Mo is approved, so live, by Uma.
  await personOk(users.get("uma") as User, "POST", "/api/drafts/approval", {
    people: [mo],
  });
  const records = new Map<string, RecordModel>([
    [
      kai,
      {
        live: false,
        gone: false,
        draft: "change",
        rejected: false,
        standing: [{ maker: "dan", at: 0 }],
      },
    ],
    [
      mo,
      { live: true, gone: false, draft: "none", rejected: false, standing: [] },
    ],
  ]);
  return {
    model: { time: 1, records, held: new Map(), pending: new Map() },
    users,
    names,
    recordIds: [kai, mo],
  };
}

// Runs one seeded sequence, comparing after each step.
async function sequence(seed: number): Promise<void> {
  const random = randomFrom(seed);
  const world = await newWorld();
  const done: string[] = [];
  for (
    let tried = 0;
    done.length < stepsEach && tried < triesEach;
    tried += 1
  ) {
    const choices = Object.values(steps(world, random));
    const step = choices[random(choices.length)] as Step;
    const name = await step(world);
    if (name !== undefined) {
      done.push(name);
      await compare(world, done);
    }
  }
  expect(done.length, `sequence ${String(seed)}: ${done.join("; ")}`).toBe(
    stepsEach,
  );
}

async function replay(
  world: World,
  chosen: StepName,
  random: (count: number) => number,
  done: string[],
) {
  // The name is one of the steps' own keys.
  // eslint-disable-next-line security/detect-object-injection
  const name = await steps(world, random)[chosen](world);
  expect(name, `${chosen} after ${done.join("; ")}`).toBeDefined();
  done.push(String(name));
  await compare(world, done);
}

describe("who counts as having changed a draft, against a model replaying each record", () => {
  it.each(Array.from({ length: sequences }, (_, index) => index + 1))(
    "agrees for every reader after each step of sequence %i",
    async (seed) => {
      await sequence(seed);
    },
  );

  it("agrees after a give-up following a discard by choice of a record with no draft", async () => {
    // Uma renames Mo, discards that by choice, renames it again; Ann renames Mo and publishes; Uma
    // publishes over the clash, keeping Ann's name; Uma approves Mo.
    const world = await newWorld();
    const [, mo = ""] = world.recordIds;
    const pick = (person: string, record: string) => {
      let calls = 0;
      // The steps' own draws, answered so they pick the person and record named, then the side.
      return () => {
        calls += 1;
        if (calls === 1) return world.names.indexOf(person);
        if (calls === 2) return world.recordIds.indexOf(record);
        return keepingTheirs;
      };
    };
    const done: string[] = [];
    for (const [person, chosen] of [
      ["uma", "rename"],
      ["uma", "discardChosen"],
      ["uma", "rename"],
      ["ann", "rename"],
      ["ann", "publish"],
      ["uma", "publish"],
      ["uma", "approve"],
    ] as const) {
      await replay(world, chosen, pick(person, mo), done);
    }
    expect(done).toContain("uma publishes over a clash, keeping theirs");
  });
});
