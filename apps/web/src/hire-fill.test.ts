// SPDX-License-Identifier: Apache-2.0

// Tests for which planned hires can be filled, who can fill one, and what a fill says about the
// manager.

import type { List, Person } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  canFill,
  fillCandidates,
  managerChange,
  newFilling,
  underPlannedManager,
  wouldMove,
} from "./hire-fill.ts";

const day = "2026-11-08";
const person = (id: string, details: Partial<Person> = {}): Person => ({
  id,
  preferredName: `Fictional ${id}`,
  employeeId: id,
  values: {},
  links: {},
  ...details,
});
const hire = (details: Partial<Person> = {}) =>
  person("h1", { kind: "planned-hire", stateId: "open", ...details });
const lists = [
  {
    builtIn: "hiring-states",
    choices: [
      { id: "open", meaning: "open" },
      { id: "proposed", meaning: "proposed" },
    ],
  },
] as unknown as List[];
const draft = (details: object) =>
  ({
    action: "changed",
    changed: [],
    live: { values: {}, links: {} },
    state: "waiting",
    madeBy: null,
    madeAt: null,
    ...details,
  }) as Person["draft"];

describe("whether a planned hire can be filled", () => {
  it("is true of an approved hire with nothing in the way", () => {
    expect(canFill(hire(), lists)).toBe(true);
  });

  it("is true of one whose draft changes something other than its manager", () => {
    expect(
      canFill(hire({ draft: draft({ changed: ["targetDate"] }) }), lists),
    ).toBe(true);
  });

  it.each<[string, Person]>([
    ["a person", person("p1", { stateId: "open" })],
    ["one already being filled", hire({ filler: "p1" })],
    ["one being filled, not said by whom", hire({ filler: null })],
    ["one someone else is changing", hire({ heldBy: "Fictional Editor" })],
    [
      "one drafted to be removed",
      hire({ draft: draft({ action: "deleted" }) }),
    ],
    [
      "one only drafted to be added",
      hire({ draft: draft({ action: "created" }) }),
    ],
    [
      "one with a rejected draft",
      hire({ draft: draft({ state: "rejected" }) }),
    ],
    [
      "one whose draft changes its manager",
      hire({ draft: draft({ changed: ["managerId"] }) }),
    ],
    ["one not yet approved", hire({ stateId: "proposed" })],
  ])("is false of %s", (_name, row) => {
    expect(canFill(row, lists)).toBe(false);
  });
});

describe("who can fill a planned hire", () => {
  const ids = (people: Person[], managerId?: string) =>
    fillCandidates(people, managerId, day).map(({ id }) => id);

  it("offers people with no end date, or one still to come", () => {
    expect(ids([person("a"), person("b", { endDate: "2030-01-01" })])).toEqual([
      "a",
      "b",
    ]);
  });

  it("leaves out those who cannot", () => {
    expect(
      ids(
        [
          hire(),
          person("left", { endDate: "2026-01-01" }),
          person("drafted", { draft: draft({}) }),
          person("held", { heldBy: "Fictional Editor" }),
          person("filling"),
          hire({ id: "h2", filler: "filling" }),
          person("manager"),
        ],
        "manager",
      ),
    ).toEqual([]);
  });
});

describe("whether someone would change manager", () => {
  const managed = person("a", {
    manager: { id: "m", preferredName: "Fictional m" },
  });

  it("is true when the manager is someone else", () => {
    expect(wouldMove(managed, "n")).toBe(true);
    expect(wouldMove(person("a"), "n")).toBe(true);
  });

  it("is false with no one chosen, no manager, or the same manager", () => {
    expect(wouldMove(undefined, "n")).toBe(false);
    expect(wouldMove(managed, undefined)).toBe(false);
    expect(wouldMove(managed, "m")).toBe(false);
  });
});

describe("what a fill says about the manager", () => {
  const managed = hire({ manager: { id: "m", preferredName: "Fictional m" } });

  it("says nothing when it is the hire's own", () => {
    expect(managerChange(managed, "m")).toEqual({});
    expect(managerChange(hire(), undefined)).toEqual({});
  });

  it("names another, or none", () => {
    expect(managerChange(managed, "n")).toEqual({ managerId: "n" });
    expect(managerChange(managed, undefined)).toEqual({ managerId: null });
  });
});

describe("whether a hire is under a planned manager", () => {
  const under = hire({ manager: { id: "h2", preferredName: "Fictional" } });

  it("is true when its manager is a planned hire", () => {
    expect(
      underPlannedManager(under, [
        under,
        person("h2", { kind: "planned-hire" }),
      ]),
    ).toBe(true);
  });

  it("is false when its manager is a person, or it has none", () => {
    expect(underPlannedManager(under, [under, person("h2")])).toBe(false);
    expect(underPlannedManager(hire(), [hire()])).toBe(false);
  });
});

describe("a new fill", () => {
  it("starts as a new person, with nothing entered", () => {
    expect(newFilling({ id: "h1" })).toEqual({
      hireId: "h1",
      by: "new person",
      values: {},
    });
  });
});
