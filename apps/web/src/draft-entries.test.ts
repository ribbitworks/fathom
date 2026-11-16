// SPDX-License-Identifier: Apache-2.0

// Tests for which drafts a role sees, by its permissions, and which of them the reader may decide
// now.

import { describe, expect, it } from "vitest";
import { draftsSeen, type Entry, toDecide } from "./draft-entries.ts";
import { noDrafts } from "./drafts.ts";

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
  place: { page: "people", open: `E-${key}` },
  selects: noDrafts(),
  ...more,
});

describe("the drafts a role sees", () => {
  it("sees nothing beyond what its permissions give", () => {
    expect(draftsSeen([])).toEqual({
      approves: [],
      seesPeople: false,
      seesLists: false,
      seesPlan: false,
      seesTeams: false,
      seesProjects: false,
      seesSettings: false,
    });
  });

  it("sees people, their lists and, with feature teams, the teams", () => {
    expect(draftsSeen(["people:view", "feature-teams:view"])).toMatchObject({
      seesPeople: true,
      seesLists: true,
      seesTeams: true,
    });
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
  });
});

describe("the drafts to decide now", () => {
  const decides = {
    choosable: ({ key }: Entry) => key !== "not-ours",
    waits: ({ key }: Entry) => key === "waits",
  };

  it("keeps a waiting, published draft of a kind the role decides", () => {
    expect(toDecide([entry("ours")], decides).map(({ key }) => key)).toEqual([
      "ours",
    ]);
  });

  it.each([
    ["of a kind the role doesn't decide", entry("not-ours")],
    ["waiting on a rejected draft", entry("waits")],
    ["rejected", entry("rejected", { state: "rejected" })],
    ["not published", entry("unpublished", { unpublished: true })],
    ["held by someone else", entry("held", { heldBy: "Fictional Other" })],
  ])("leaves out a draft %s", (_case, one) => {
    expect(toDecide([one], decides)).toEqual([]);
  });
});
