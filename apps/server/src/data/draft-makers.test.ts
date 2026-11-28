// SPDX-License-Identifier: Apache-2.0

// Unit tests for the rule for who may discard any draft, the marks a draft carries for the viewer,
// and what every read of a draft says about it.

import { describe, expect, it } from "vitest";
import {
  draftStanding,
  fieldEditorsOf,
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

describe("what a read of a draft says about it", () => {
  const waiting = { state: "waiting" as const, reason: null };
  const rejected = { state: "rejected" as const, reason: "Not this quarter" };

  it("names its state, who made it and the viewer's marks", () => {
    expect(draftStanding(waiting, maker(true))).toEqual({
      state: "waiting",
      madeBy: "Fictional Maker",
      madeAs: "Fictional Role",
      madeAt: "2026-06-01T09:00:00.000Z",
      editors: ["Fictional Maker"],
      discardable: true,
    });
  });

  it("names no maker for a draft Fathom made, nor marks for the viewer", () => {
    expect(draftStanding(waiting, undefined)).toEqual({
      state: "waiting",
      madeBy: null,
      madeAs: null,
      madeAt: null,
      editors: [],
    });
  });

  it("gives a rejection's reason", () => {
    expect(draftStanding(rejected, undefined).reason).toBe("Not this quarter");
  });

  const reasonless: [
    string,
    { state: "rejected"; reason: string | null },
    () => boolean,
  ][] = [
    ["a reader who may not see it", rejected, () => false],
    ["a rejection with none", { state: "rejected", reason: null }, () => true],
  ];

  it.each(reasonless)("gives no reason to %s", (_, draft, reasonShown) => {
    expect(draftStanding(draft, undefined, { reasonShown })).not.toHaveProperty(
      "reason",
    );
  });

  it("asks whether the reader may see the reason only of a rejection", () => {
    let asked = false;
    draftStanding(waiting, undefined, {
      reasonShown: () => {
        asked = true;
        return true;
      },
    });
    expect(asked).toBe(false);
  });

  it("marks the viewer's own unpublished change", () => {
    expect(
      draftStanding({ ...waiting, unpublished: true }, undefined).unpublished,
    ).toBe(true);
  });

  it("marks nothing unpublished for a published draft", () => {
    expect(
      draftStanding({ ...waiting, unpublished: false }, undefined),
    ).not.toHaveProperty("unpublished");
  });

  it("takes the marks a kind's own rule gives in place of the shared one", () => {
    expect(
      draftStanding(waiting, maker(false), {
        marks: viewerMarks(maker(false), true),
      }).discardable,
    ).toBe(true);
  });
});

describe("who last changed each field of a draft", () => {
  const editing: Maker = {
    ...maker(true),
    fieldEditors: new Map([["positionId", "Fictional Editor"]]),
  };

  it("names each field's last editor, or none, by the field's own name", () => {
    expect(fieldEditorsOf(editing, ["positionId", "siteId"])).toEqual({
      positionId: "Fictional Editor",
      siteId: null,
    });
  });

  it("names each by the name the reader knows it by", () => {
    expect(
      fieldEditorsOf(editing, ["positionId"], (field) => `${field}Shown`),
    ).toEqual({ positionIdShown: "Fictional Editor" });
  });

  it("names nobody for a draft Fathom made", () => {
    expect(fieldEditorsOf(undefined, ["positionId"])).toEqual({
      positionId: null,
    });
  });
});
