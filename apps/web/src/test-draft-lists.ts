// SPDX-License-Identifier: Apache-2.0

// Fictional lists and choices with drafts, for the front-end tests of deciding drafts.

import type { Choice, List } from "@fathom/shared";

// A waiting draft with no maker, the base of the drafts in the tests of deciding drafts.
export const draftToDecide = {
  state: "waiting" as const,
  madeBy: null,
  madeAt: null,
};

export const addedChoice = (id: string): Choice => ({
  id,
  label: id.toUpperCase(),
  description: "",
  retired: false,
  draft: { ...draftToDecide, action: "created", changed: [], live: {} },
});

export const liveChoice = (id: string): Choice => ({
  id,
  label: id.toUpperCase(),
  description: "",
  retired: false,
});

// A list drafted to be added, whose order places one choice drafted to be added before a live one,
// and leaves another at the end, where it would go anyway.
export const teamsList: List = {
  id: "l1",
  keyNumber: 1,
  name: "Teams",
  description: "",
  visibility: "general",
  retired: false,
  choices: [addedChoice("b"), liveChoice("a"), addedChoice("c")],
  draft: { ...draftToDecide, action: "created", changed: [], live: {} },
  orderDraft: { ...draftToDecide, live: ["a"], uses: ["b"] },
};

// A live list whose order puts a choice drafted to be added first.
export const sitesList: List = {
  id: "l2",
  keyNumber: 1,
  name: "Sites",
  description: "",
  visibility: "general",
  retired: false,
  choices: [addedChoice("f"), liveChoice("d"), addedChoice("e")],
  orderDraft: { ...draftToDecide, live: ["d"], uses: ["f"] },
};

export const bothLists = [teamsList, sitesList];
