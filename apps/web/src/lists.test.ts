// SPDX-License-Identifier: Apache-2.0

// Tests for lists as their drafts will make them, and for drafts that retire or restore a list or
// choice: where it is live, and the mark that says which.

import type { List } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { draftedLists, retiredLive, withRetiring } from "./lists.ts";

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
