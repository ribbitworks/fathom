// SPDX-License-Identifier: Apache-2.0

// Tests for the drafts waiting among lists: of lists, their choices and their orders, and those of
// them that need no other approver.

import type { List } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { noDrafts } from "./drafts.ts";
import { approvableIn, draftsWaitingIn } from "./list-changes.ts";

const waiting = { state: "waiting" as const, madeBy: null, madeAt: null };
const renamed = {
  ...waiting,
  action: "changed" as const,
  changed: ["name"],
  live: { name: "Sites" },
};

const list = (more: Partial<List> = {}): List => ({
  id: "l1",
  keyNumber: 1,
  name: "Locations",
  description: "",
  visibility: "general",
  retired: false,
  choices: [
    {
      id: "c1",
      label: "Northmere",
      description: "",
      retired: false,
      draft: { ...renamed, changed: ["label"], live: { label: "North" } },
    },
    { id: "c2", label: "Kestrel Bay", description: "", retired: false },
  ],
  draft: renamed,
  orderDraft: { ...waiting, live: ["c2", "c1"] },
  ...more,
});

describe("the drafts waiting among lists", () => {
  it("are the lists', their choices' and their orders'", () => {
    expect(draftsWaitingIn([list()])).toEqual({
      selection: {
        ...noDrafts(),
        lists: ["l1"],
        choices: ["c1"],
        orders: ["l1"],
      },
      total: 3,
    });
  });

  it("leave out an order someone else is changing", () => {
    expect(
      draftsWaitingIn([list({ orderHeldBy: "Fictional Editor" })]).selection
        .orders,
    ).toEqual([]);
  });

  it("that need no other approver leave out those that do", () => {
    expect(
      approvableIn([list({ draft: { ...renamed, needsOtherApprover: true } })]),
    ).toEqual({ ...noDrafts(), choices: ["c1"], orders: ["l1"] });
  });
});
