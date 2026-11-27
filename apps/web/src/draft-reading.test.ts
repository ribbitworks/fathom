// SPDX-License-Identifier: Apache-2.0

// Tests for which drafts a role sees, by its permissions, which of them the reader may decide now,
// and how the drafts deciding one takes along are named.

import { describe, expect, it } from "vitest";
import type { Entry } from "./draft-entries.ts";
import { targetSelection } from "./draft-targets.ts";
import { draftsSeen, namedDrafts, toDecide } from "./draft-reading.ts";
import { type DraftSelection, noDrafts } from "./drafts.ts";

const entry = (key: string, more: Partial<Entry> = {}): Entry => ({
  key,
  madeAt: "2026-11-01T10:00:00.000Z",
  action: "changed",
  state: "waiting",
  who: "Fictional Editor",
  kind: "person",
  name: key,
  details: [],
  reason: undefined,
  unpublished: false,
  heldBy: undefined,
  needsOtherApprover: false,
  discardable: false,
  target: { kind: "person", id: key },
  selects: targetSelection(more.target ?? { kind: "person", id: key }),
  place: { kind: "person", keyNumber: 1 },
  ...more,
  decided: more.decided ?? { kind: more.kind ?? "person" },
});

describe("the drafts a role sees", () => {
  it("sees nothing beyond what its permissions give", () => {
    expect(draftsSeen([])).toEqual({
      approves: [],
      makesDrafts: false,
      seesPeople: false,
      seesLists: false,
      seesPlan: false,
      seesTeams: false,
      seesProjects: false,
      seesSettings: false,
      permissions: [],
    });
  });

  it("sees people, their lists and, with feature teams, the teams", () => {
    expect(draftsSeen(["people:view", "feature-teams:view"])).toMatchObject({
      seesPeople: true,
      seesLists: true,
      seesTeams: true,
    });
  });

  it("makes drafts with any permission that edits data with drafts", () => {
    expect(draftsSeen(["people:edit"]).makesDrafts).toBe(true);
    expect(draftsSeen(["people:view"]).makesDrafts).toBe(false);
  });

  it("doesn't see feature teams without people", () => {
    expect(draftsSeen(["feature-teams:view"]).seesTeams).toBe(false);
  });

  it("sees lists, streams and settings through configuration", () => {
    expect(draftsSeen(["configuration:view"])).toMatchObject({
      seesLists: true,
      seesPlan: true,
      seesSettings: true,
      seesPeople: false,
    });
  });

  it("sees streams through features, and the plan through the plan", () => {
    expect(draftsSeen(["features:view", "plan:view"])).toMatchObject({
      seesPlan: true,
      seesProjects: true,
      seesLists: false,
    });
  });

  it("approves the kinds its permissions approve", () => {
    expect(draftsSeen(["people:approve"]).approves).toEqual(["person"]);
    expect(draftsSeen(["people:approve", "people:view"]).approves).toEqual([
      "person",
      "field on people",
    ]);
  });
});

describe("the drafts to decide now", () => {
  const decides = {
    choosable: ({ key }: Entry) => key !== "not-ours",
    waits: ({ key }: Entry) => key === "waits",
    unseen: ({ key }: Entry) =>
      key === "unseen" ? "This role can't see Personal data" : undefined,
  };

  it("keeps a waiting, published draft of a kind the role decides", () => {
    expect(toDecide([entry("ours")], decides).map(({ key }) => key)).toEqual([
      "ours",
    ]);
  });

  it.each([
    ["of a kind the role doesn't decide", entry("not-ours")],
    ["of a list whose class the role can't see", entry("unseen")],
    ["waiting on a rejected draft", entry("waits")],
    ["rejected", entry("rejected", { state: "rejected" })],
    ["not published", entry("unpublished", { unpublished: true })],
    ["held by someone else", entry("held", { heldBy: "Fictional Other" })],
  ])("leaves out a draft %s", (_case, one) => {
    expect(toDecide([one], decides)).toEqual([]);
  });
});

describe("the drafts named in another's details", () => {
  const list = entry("list l1", {
    kind: "list",
    name: "Skills",
    place: { kind: "list", keyNumber: 7 },
    target: { kind: "list", listId: "l1" },
  });
  const namesOf = (drafts: DraftSelection) => [
    ...drafts.lists.map((id) => `the list ${id}`),
    ...drafts.orders.map((id) => `the new order for ${id}`),
  ];

  it("names each draft with a row as a decision does, after its record's key", () => {
    expect(
      namedDrafts({ ...noDrafts(), lists: ["l1"] }, [list], namesOf),
    ).toEqual([{ name: "the list l1", key: { kind: "list", keyNumber: 7 } }]);
  });

  it("names only the part of a row's drafts the selection holds", () => {
    const both = {
      ...list,
      selects: { ...noDrafts(), lists: ["l1"], orders: ["l1"] },
    };
    expect(
      namedDrafts({ ...noDrafts(), orders: ["l1"] }, [both], namesOf),
    ).toEqual([
      { name: "the new order for l1", key: { kind: "list", keyNumber: 7 } },
    ]);
  });

  it("names a draft with no row with no key", () => {
    expect(
      namedDrafts(
        { ...noDrafts(), lists: ["l1"], orders: ["l2"] },
        [list],
        namesOf,
      ),
    ).toEqual([
      { name: "the list l1", key: { kind: "list", keyNumber: 7 } },
      { name: "the new order for l2", key: undefined },
    ]);
  });

  it("gives no key to a draft of the planning settings", () => {
    expect(
      namedDrafts(
        { ...noDrafts(), lists: ["l1"] },
        [{ ...list, place: "planning-settings" }],
        namesOf,
      )[0]?.key,
    ).toBeUndefined();
  });
});
