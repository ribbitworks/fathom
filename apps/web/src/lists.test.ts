// SPDX-License-Identifier: Apache-2.0

// Tests for lists as their drafts will make them, and for drafts that retire or restore a list or
// choice: where it is live, and the mark that says which.

import type { List } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  builtInFirst,
  draftedLists,
  retiredLive,
  unchangeableLists,
  unseenInDrafts,
  withRetiring,
} from "./lists.ts";

const waiting = { state: "waiting" as const, madeBy: null, madeAt: null };
const rejected = { ...waiting, state: "rejected" as const, reason: "Not yet" };
const choice = (id: string, more: object = {}) => ({
  id,
  label: id.toUpperCase(),
  description: "",
  retired: false,
  ...more,
});
const retiring = (retired: boolean) => ({
  ...waiting,
  action: "changed" as const,
  changed: ["retired"],
  live: { retired: !retired },
});

describe("lists as their drafts will make them", () => {
  it("takes back rejected drafts, and leaves out what drafts remove", () => {
    const sites: List = {
      id: "l1",
      keyNumber: 1,
      name: "Sites",
      description: "",
      visibility: "general",
      retired: false,
      choices: [
        choice("a", {
          draft: { ...rejected, action: "created", changed: [], live: {} },
        }),
        choice("b", {
          draft: { ...waiting, action: "deleted", changed: [], live: {} },
        }),
        choice("c"),
      ],
    };
    const gone: List = {
      ...sites,
      id: "l2",
      choices: [],
      draft: { ...waiting, action: "deleted", changed: [], live: {} },
    };
    expect(draftedLists([sites, gone])).toEqual([
      { ...sites, choices: [choice("c")] },
    ]);
  });
});

describe("lists with meanings as their drafts will make them", () => {
  it("puts back a choice's meaning when its rejected draft changed it", () => {
    const states: List = {
      id: "l3",
      keyNumber: 1,
      name: "States",
      description: "",
      visibility: "confidential",
      retired: false,
      builtIn: "hiring-states",
      choices: [
        choice("p", {
          meaning: "open",
          draft: {
            ...rejected,
            action: "changed",
            changed: ["meaning"],
            live: { meaning: "proposed" },
          },
        }),
      ],
    };
    expect(draftedLists([states])[0]?.choices).toEqual([
      choice("p", { meaning: "proposed" }),
    ]);
  });
});

describe("drafts that retire or restore", () => {
  it("tell where a list or choice is live, and say which they do", () => {
    const retired = { retired: true, draft: retiring(true) };
    const restored = { retired: false, draft: retiring(false) };
    const renamed = {
      retired: false,
      draft: { ...waiting, action: "changed", changed: ["label"], live: {} },
    };
    expect(retiredLive(retired)).toBe(false);
    expect(retiredLive(restored)).toBe(true);
    expect(retiredLive(renamed)).toBe(false);
    expect(retiredLive({ retired: true })).toBe(true);
    expect(withRetiring(retired).retiring).toBe(true);
    expect(withRetiring(restored).retiring).toBe(false);
    expect(withRetiring(renamed)).toBe(renamed.draft);
  });
});

describe("the order of lists", () => {
  const list = (name: string, builtIn: List["builtIn"] = null): List => ({
    id: name,
    keyNumber: 1,
    name,
    description: "",
    visibility: "general",
    retired: false,
    builtIn,
    choices: [],
  });

  it("puts the built-in lists first, then the custom ones, each in the order given", () => {
    const lists = [
      list("Department"),
      list("Feature sizes", "feature-sizes"),
      list("Equipment"),
      list("Positions", "positions"),
    ];

    expect(builtInFirst(lists).map(({ name }) => name)).toEqual([
      "Feature sizes",
      "Positions",
      "Department",
      "Equipment",
    ]);
  });
});

describe("the lists a role may not change, by their class", () => {
  const list = (id: string, visibility: string, more: object = {}): List =>
    ({
      id,
      keyNumber: 1,
      name: id,
      description: "",
      visibility,
      retired: false,
      choices: [choice(`${id}-choice`)],
      ...more,
    }) as List;
  const lists = [
    list("general", "general"),
    list("personal", "personal"),
    // General live, drafted to Confidential.
    list("becoming", "confidential", {
      draft: {
        ...waiting,
        action: "changed",
        changed: ["visibility"],
        live: { visibility: "general" },
      },
    }),
  ];
  const unseen = (permissions: Parameters<typeof unchangeableLists>[1]) => {
    const unchangeable = unchangeableLists(lists, permissions);
    return (asked: {
      lists?: string[];
      choices?: string[];
      orders?: string[];
    }) =>
      unseenInDrafts(
        { lists: [], choices: [], orders: [], ...asked },
        lists,
        unchangeable,
      );
  };

  it("leaves a General list to a role that sees people", () => {
    expect(unseen(["people:view"])({ lists: ["general"] })).toBeUndefined();
  });

  it("closes a General list to a role that doesn't see people", () => {
    expect(unseen([])({ lists: ["general"] })).toBe(
      "This role can't see people's details",
    );
  });

  it.each([
    ["a list", { lists: ["personal"] }],
    ["a choice", { choices: ["personal-choice"] }],
    ["an order", { orders: ["personal"] }],
  ])("closes %s of a class the role can't see", (_case, asked) => {
    expect(unseen(["people:view"])(asked)).toBe(
      "This role can't see Personal data",
    );
  });

  it("closes a list drafted to a class the role can't see", () => {
    expect(
      unseen(["people:view", "personal:view"])({ lists: ["becoming"] }),
    ).toBe("This role can't see Confidential data");
  });

  it("finds no list for a choice it doesn't have", () => {
    expect(unseen(["people:view"])({ choices: ["gone"] })).toBeUndefined();
  });
});
