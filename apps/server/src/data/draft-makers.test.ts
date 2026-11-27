// SPDX-License-Identifier: Apache-2.0

// Unit tests for the rule for who may discard any draft, and the marks a draft carries for the
// viewer.

import { describe, expect, it } from "vitest";
import {
  type Maker,
  ownDiscardRefusal,
  ownMarks,
  viewerMarks,
} from "./draft-makers.ts";

const maker = (changedByUser: boolean): Maker => ({
  madeBy: "Fictional Maker",
  madeAs: "Fictional Role",
  madeAt: new Date("2026-06-01T09:00:00.000Z"),
  editors: ["Fictional Maker"],
  fieldEditors: new Map(),
  needsOtherApprover: false,
  changedByUser,
});

describe("who may discard a draft", () => {
  it.each([
    [true, undefined],
    [false, "Only someone who changed this draft can discard it."],
  ])("is one who changed it: changed %s", (changed, refusal) => {
    expect(ownDiscardRefusal(changed)).toBe(refusal);
  });
});

describe("a draft's marks for the viewer", () => {
  it("mark it discardable for the viewer who changed it", () => {
    expect(ownMarks(maker(true))).toEqual({ discardable: true });
  });

  it("mark nothing for anyone else, nor for a draft Fathom made", () => {
    expect([ownMarks(maker(false)), ownMarks(undefined)]).toEqual([{}, {}]);
  });

  it("mark it discardable where the plan's rule lets the viewer discard it, though Fathom made it", () => {
    expect(viewerMarks(undefined, true)).toEqual({ discardable: true });
  });
});
