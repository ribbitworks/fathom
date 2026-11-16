// SPDX-License-Identifier: Apache-2.0

// Tests for which choices a draft of a list's order marks as moved, and places in words.

import type { List } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { listMark, movedChoices, ordinal } from "./list-drafts.tsx";
import { liveLists } from "./lists.ts";

const listIn = (live: string[], drafted: string[]): List => ({
  id: "l1",
  keyNumber: 1,
  name: "Levels",
  description: "",
  visibility: "general",
  retired: false,
  choices: drafted.map((id) => ({
    id,
    label: id,
    description: "",
    retired: false,
  })),
  orderDraft: { live, state: "waiting", madeBy: null, madeAt: null },
});

describe("moved choices", () => {
  it("marks only the choice moved, with its live place", () => {
    const live = ["P1", "P2", "M1", "M2", "Co-op"];
    expect(
      movedChoices(listIn(live, ["P1", "P2", "Co-op", "M1", "M2"])),
    ).toEqual(new Map([["Co-op", 5]]));
  });

  it("marks nothing without a draft of the order", () => {
    expect(
      movedChoices({ ...listIn(["a"], ["a"]), orderDraft: undefined }),
    ).toEqual(new Map());
  });

  it("names places", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "101st",
    ]);
  });
});

const waiting = { state: "waiting" as const, madeBy: null, madeAt: null };

const plain = (id: string, more: Partial<List> = {}): List => ({
  id,
  keyNumber: 1,
  name: `List ${id}`,
  description: "",
  visibility: "general",
  retired: false,
  choices: [],
  ...more,
});

const choice = (id: string) => ({
  id,
  label: id,
  description: "",
  retired: false,
});

describe("the mark beside a list", () => {
  it("is its own draft's, or says its choices or order have drafts", () => {
    const own = {
      ...waiting,
      action: "deleted" as const,
      changed: [],
      live: {},
    };
    expect(listMark(plain("l1"))).toBeUndefined();
    expect(listMark(plain("l1", { draft: own }))).toBe(own);
    expect(
      listMark(plain("l1", { orderDraft: { ...waiting, live: [] } })),
    ).toEqual({ state: "waiting" });
    expect(
      listMark(
        plain("l1", {
          choices: [
            {
              ...choice("a"),
              draft: { ...waiting, action: "created", changed: [], live: {} },
            },
          ],
        }),
      ),
    ).toEqual({ action: "changed", state: "waiting" });
    expect(
      listMark(
        plain("l1", {
          orderDraft: { ...waiting, state: "rejected", live: [] },
        }),
      ),
    ).toEqual({ state: "rejected" });
  });

  it("is waiting while anything in the list waits, and leaves out rejected drafts when asked", () => {
    const described = {
      ...waiting,
      state: "rejected" as const,
      action: "changed" as const,
      changed: ["description"],
      live: { description: "" },
    };
    const list = plain("l1", {
      draft: described,
      choices: [
        {
          ...choice("a"),
          draft: { ...waiting, action: "deleted", changed: [], live: {} },
        },
      ],
      orderDraft: { ...waiting, state: "rejected", live: [] },
    });
    expect(listMark(list)).toEqual({ action: "changed", state: "waiting" });
    expect(listMark(list, true)).toEqual({
      action: "changed",
      state: "waiting",
    });
    expect(listMark(plain("l1", { draft: described }))).toEqual({
      action: "changed",
      state: "rejected",
    });
    expect(listMark(plain("l1", { draft: described }), true)).toBeUndefined();
    const added = { ...described, action: "created" as const };
    expect(listMark(plain("l1", { draft: added }))).toBe(added);
    const renamed = { ...described, state: "waiting" as const };
    expect(listMark(plain("l1", { draft: renamed }))).toEqual({
      action: "changed",
      state: "waiting",
    });
    const retiring = {
      ...renamed,
      changed: ["retired"],
      live: { retired: false },
    };
    expect(listMark(plain("l1", { retired: true, draft: retiring }))).toEqual({
      ...retiring,
      retiring: true,
    });
  });
});

describe("the live lists", () => {
  it("leaves out what drafts add, and puts back what they change and the live order", () => {
    const changedList = plain("l2", {
      name: "Renamed",
      draft: {
        ...waiting,
        action: "changed",
        changed: ["name"],
        live: { name: "List l2" },
      },
      choices: [
        {
          ...choice("new"),
          draft: { ...waiting, action: "created", changed: [], live: {} },
        },
        {
          ...choice("b"),
          label: "Bee",
          draft: {
            ...waiting,
            action: "changed",
            changed: ["label"],
            live: { label: "b" },
          },
        },
        choice("a"),
        {
          ...choice("c"),
          draft: { ...waiting, action: "deleted", changed: [], live: {} },
        },
      ],
      orderDraft: { ...waiting, live: ["a", "b"] },
    });
    expect(
      liveLists([
        plain("l1", {
          draft: { ...waiting, action: "created", changed: [], live: {} },
        }),
        changedList,
        plain("l3", {
          choices: [choice("x")],
          draft: { ...waiting, action: "deleted", changed: [], live: {} },
        }),
        plain("l4", {
          name: "New name",
          description: "New",
          visibility: "personal",
          retired: true,
          draft: {
            ...waiting,
            action: "changed",
            changed: ["name", "description", "visibility", "retired"],
            live: {
              name: "List l4",
              description: "",
              visibility: "general",
              retired: false,
            },
          },
        }),
        plain("l5", {
          description: "New",
          draft: {
            ...waiting,
            action: "changed",
            changed: ["description"],
            live: { description: "" },
          },
        }),
      ]),
    ).toEqual([
      plain("l2", { choices: [choice("a"), choice("b"), choice("c")] }),
      plain("l3", { choices: [choice("x")] }),
      plain("l4"),
      plain("l5"),
    ]);
  });
});
