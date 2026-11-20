// SPDX-License-Identifier: Apache-2.0

// Tests for how pasted lines become choices, and which choice a built-in list keeps offered.

import type { Choice, List } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { lastKept, pastedChoices } from "./choice-rules.ts";
import { fictionalChoice } from "./test-support.tsx";

describe("pasting lines", () => {
  it("makes a choice of each non-empty line, with a description after a tab", () => {
    expect(
      pastedChoices("Kestrel Bay\tHead office.\r\n\n  Northmere \nAsh\tA\tB"),
    ).toEqual([
      { label: "Kestrel Bay", description: "Head office." },
      { label: "Northmere", description: "" },
      { label: "Ash", description: "A B" },
    ]);
  });
});

describe("the last choice a built-in list keeps", () => {
  const states = (...meant: Choice[]): List => ({
    id: "l1",
    keyNumber: 1,
    name: "Fictional States",
    description: "",
    visibility: "confidential",
    retired: false,
    builtIn: "hiring-states",
    choices: meant,
  });
  const proposed = { ...fictionalChoice("p"), meaning: "proposed" as const };
  const open = { ...fictionalChoice("o"), meaning: "open" as const };
  const approved = { ...fictionalChoice("a"), meaning: "open" as const };

  it("is the only one offered with its meaning", () => {
    const list = states(proposed, open, approved);
    expect(lastKept(list, proposed)).toBe("proposed");
    expect(lastKept(list, open)).toBeUndefined();
  });

  it("leaves out others that are retired or drafted to be removed", () => {
    const removed = {
      ...approved,
      draft: {
        action: "deleted" as const,
        changed: [],
        live: {},
        state: "waiting" as const,
        madeBy: null,
        madeAt: null,
      },
    };
    expect(lastKept(states(open, removed), open)).toBe("open");
    expect(lastKept(states(open, { ...approved, retired: true }), open)).toBe(
      "open",
    );
  });

  it("is never a retired choice, nor one in a list without meanings", () => {
    expect(
      lastKept(states({ ...open, retired: true }), {
        ...open,
        retired: true,
      }),
    ).toBeUndefined();
    const plain = fictionalChoice("x");
    expect(
      lastKept({ ...states(plain), builtIn: null }, plain),
    ).toBeUndefined();
  });

  it("is the last offered choice in Positions", () => {
    const positions = (...held: Choice[]): List => ({
      ...states(...held),
      visibility: "general",
      builtIn: "positions",
    });
    const employee = fictionalChoice("e");
    const manager = fictionalChoice("m");
    expect(lastKept(positions(employee, manager), employee)).toBeUndefined();
    expect(
      lastKept(positions(employee, { ...manager, retired: true }), employee),
    ).toBe("any");
  });
});
