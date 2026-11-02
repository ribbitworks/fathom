// SPDX-License-Identifier: Apache-2.0

// Tests for working out, as the server does, which other drafts approving or rejecting a selection
// includes, and how they are named.

import type { Choice, List } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  draftNames,
  draftTotal,
  joined,
  noDrafts,
  usedDrafts,
  usingDrafts,
} from "./drafts.ts";

const waiting = { state: "waiting" as const, madeBy: null, madeAt: null };

const added = (id: string): Choice => ({
  id,
  label: id.toUpperCase(),
  description: "",
  retired: false,
  draft: { ...waiting, action: "created", changed: [], live: {} },
});

const live = (id: string): Choice => ({
  id,
  label: id.toUpperCase(),
  description: "",
  retired: false,
});

// A list drafted to be added, whose order places one choice drafted to be added before a live one,
// and leaves another at the end, where it would go anyway.
const teams: List = {
  id: "l1",
  name: "Teams",
  description: "",
  visibility: "general",
  retired: false,
  choices: [added("b"), live("a"), added("c")],
  draft: { ...waiting, action: "created", changed: [], live: {} },
  orderDraft: { ...waiting, live: ["a"], uses: ["b"] },
};

// A live list whose order puts a choice drafted to be added first.
const sites: List = {
  id: "l2",
  name: "Sites",
  description: "",
  visibility: "general",
  retired: false,
  choices: [added("f"), live("d"), added("e")],
  orderDraft: { ...waiting, live: ["d"], uses: ["f"] },
};

const lists = [teams, sites];

describe("drafts an approval includes", () => {
  it("approves the choices an order places, and the lists they are added to", () => {
    expect(usedDrafts({ ...noDrafts(), orders: ["l1"] }, lists)).toEqual({
      ...noDrafts(),
      lists: ["l1"],
      choices: ["b"],
    });
    expect(usedDrafts({ ...noDrafts(), orders: ["l2"] }, lists)).toEqual({
      ...noDrafts(),
      choices: ["f"],
    });
  });

  it("adds nothing already chosen, or for an order that is gone", () => {
    expect(
      usedDrafts(
        { ...noDrafts(), lists: ["l1"], choices: ["b"], orders: ["l1", "l9"] },
        lists,
      ),
    ).toEqual(noDrafts());
  });

  it("rejects a list's choices and order with it, and an order with the choices it places", () => {
    expect(usingDrafts({ ...noDrafts(), lists: ["l1"] }, lists)).toEqual({
      ...noDrafts(),
      choices: ["b", "c"],
      orders: ["l1"],
    });
    expect(
      usingDrafts({ ...noDrafts(), choices: ["f"], orders: ["l2"] }, lists),
    ).toEqual(noDrafts());
  });

  it("joins selections once each, counts them, and names them", () => {
    const both = joined(
      { ...noDrafts(), people: ["p1"], lists: ["l1"] },
      { ...noDrafts(), people: ["p1"], choices: ["b"], orders: ["l2"] },
    );
    expect(both).toEqual({
      people: ["p1"],
      lists: ["l1"],
      choices: ["b"],
      orders: ["l2"],
    });
    expect(draftTotal(both)).toBe(4);
    expect(draftNames(both, lists)).toEqual([
      "the list Teams",
      "the choice B in Teams",
      "the order of Sites",
    ]);
  });
});
