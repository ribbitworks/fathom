// SPDX-License-Identifier: Apache-2.0

// Tests for planned hires: the moves between hiring states a change may make, and what a request to
// add or change a hire accepts.

import { describe, expect, it } from "vitest";
import {
  type HiringState,
  hireChangeSchema,
  hireLengths,
  hireRequestSchema,
  hiringStateNames,
  hiringStateSchema,
  nextHiringStates,
} from "./hires.ts";

const manager = "6f1c2b9e-4d3a-4f8b-9c7e-2a1b3c4d5e6f";

describe("moves between hiring states", () => {
  it.each<[HiringState, HiringState[]]>([
    ["proposed", ["approved", "cancelled"]],
    ["approved", ["proposed", "recruiting", "cancelled"]],
    ["recruiting", ["approved", "offer-accepted", "cancelled"]],
    ["offer-accepted", ["recruiting", "cancelled"]],
  ])("moves a hire %s one state either way, or cancels it", (state, next) => {
    expect(nextHiringStates(state, null)).toEqual(next);
  });

  it("moves a cancelled hire back only to the state it left", () => {
    expect(nextHiringStates("cancelled", "recruiting")).toEqual(["recruiting"]);
  });

  it("leaves a cancelled hire that left no state where it is", () => {
    expect(nextHiringStates("cancelled", null)).toEqual([]);
  });

  it("never moves a filled hire", () => {
    expect(nextHiringStates("filled", null)).toEqual([]);
  });

  it("names every state", () => {
    expect(Object.keys(hiringStateNames)).toEqual(hiringStateSchema.options);
    expect(Object.values(hiringStateNames)).toEqual([
      "Proposed",
      "Approved",
      "Recruiting",
      "Offer accepted",
      "Filled",
      "Cancelled",
    ]);
  });
});

describe("adding a hire", () => {
  it("starts it proposed, with no manager, unless told otherwise", () => {
    expect(
      hireRequestSchema.parse({
        title: " Engineer ",
        targetDate: "2027-03-01",
      }),
    ).toEqual({
      title: "Engineer",
      targetDate: "2027-03-01",
      state: "proposed",
      managerId: null,
    });
  });

  it("takes any open state and a manager", () => {
    expect(
      hireRequestSchema.parse({
        title: "Engineer",
        targetDate: "2027-03-01",
        state: "offer-accepted",
        managerId: manager,
      }),
    ).toMatchObject({ state: "offer-accepted", managerId: manager });
  });

  it.each([
    ["an empty title", { title: "  " }],
    ["a title too long", { title: "x".repeat(hireLengths.title + 1) }],
    ["a date that is not a day", { targetDate: "2027-03" }],
    ["the filled state", { state: "filled" }],
    ["the cancelled state", { state: "cancelled" }],
    ["a manager that is not an identifier", { managerId: "someone" }],
  ])("refuses %s", (_what, wrong) => {
    expect(
      hireRequestSchema.safeParse({
        title: "Engineer",
        targetDate: "2027-03-01",
        ...wrong,
      }).success,
    ).toBe(false);
  });
});

describe("changing a hire", () => {
  it("takes any of its details alone", () => {
    expect(hireChangeSchema.parse({ state: "cancelled" })).toEqual({
      state: "cancelled",
    });
    expect(hireChangeSchema.parse({ managerId: null })).toEqual({
      managerId: null,
    });
  });

  it("never fills a hire", () => {
    expect(hireChangeSchema.safeParse({ state: "filled" }).success).toBe(false);
  });
});
