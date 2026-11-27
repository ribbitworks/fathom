// SPDX-License-Identifier: Apache-2.0

// Unit tests for who may discard a draft, and the marks a draft carries for the viewer.

import { describe, expect, it } from "vitest";
import { type Maker, mayDiscard, viewerMarks } from "./draft-makers.ts";

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
    [true, false, true],
    [false, true, true],
    [false, false, false],
  ])(
    "is one who changed it (%s), or whose role discards it whoever changed it (%s): %s",
    (changed, whoever, may) => {
      expect(mayDiscard(changed, whoever)).toBe(may);
    },
  );
});

describe("a draft's marks for the viewer", () => {
  it("mark it discardable for the viewer who changed it", () => {
    expect(viewerMarks(maker(true))).toEqual({ discardable: true });
  });

  it("mark it discardable for a role that discards it whoever changed it, though Fathom made it", () => {
    expect(viewerMarks(undefined, true)).toEqual({ discardable: true });
  });

  it("mark nothing for anyone else", () => {
    expect(viewerMarks(maker(false))).toEqual({});
  });
});
