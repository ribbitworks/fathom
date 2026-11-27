// SPDX-License-Identifier: Apache-2.0

// Tests for lists with meanings: which meanings each list's choices take, their names, and what each
// list must keep a choice for; for the weights of feature sizes; and for finding a choice by name.

import { describe, expect, it } from "vitest";
import {
  choiceNamed,
  keptOf,
  meaningName,
  meaningSchema,
  meaningsOf,
  sameName,
  weighs,
  weightProblem,
  weightSchema,
} from "./lists.ts";

describe("lists with meanings", () => {
  it("gives the hiring states Proposed, Open, Hired, and Left, and other lists none", () => {
    expect(meaningsOf("hiring-states")).toEqual([
      "proposed",
      "open",
      "hired",
      "left",
    ]);
    expect(meaningsOf("feature-statuses")).toEqual([
      "possible",
      "planned",
      "in-progress",
      "done",
      "cancelled",
    ]);
    expect(meaningsOf("positions")).toEqual([]);
    expect(meaningsOf(null)).toEqual([]);
    expect(meaningsOf(undefined)).toEqual([]);
  });

  it("names every meaning", () => {
    expect(meaningSchema.options.map(meaningName)).toEqual([
      "Proposed",
      "Open",
      "Hired",
      "Left",
      "Possible",
      "Planned",
      "In progress",
      "Done",
      "Cancelled",
    ]);
  });

  it("keeps a choice for each meaning, any choice in Positions, and nothing in other lists", () => {
    expect(keptOf("hiring-states")).toEqual([
      "proposed",
      "open",
      "hired",
      "left",
    ]);
    expect(keptOf("positions")).toEqual(["any"]);
    expect(keptOf(null)).toEqual([]);
    expect(keptOf(undefined)).toEqual([]);
  });
});

describe("weights", () => {
  it("gives feature sizes weights, and no other list", () => {
    expect(weighs("feature-sizes")).toBe(true);
    expect(weighs("feature-risks")).toBe(false);
    expect(weighs(null)).toBe(false);
  });

  it("takes a weight above 0 and below 10,000, to two places", () => {
    for (const weight of [0.01, 0.5, 1, 2.25, 9999.99]) {
      expect(weightSchema.safeParse(weight).success).toBe(true);
    }
    for (const weight of [0, -1, 10000, 0.005, 1.234]) {
      expect(weightSchema.safeParse(weight).success).toBe(false);
    }
  });

  it("says what is wrong with a weight as typed", () => {
    expect(
      ["", "abc", "0", "10000", "1.234", "2.5"].map(weightProblem),
    ).toEqual([
      "Weight needed",
      "Number needed, such as 1234.5",
      "Type a number from 0.01 to 9999.99",
      "Type a number from 0.01 to 9999.99",
      "At most 2 digits after the point",
      undefined,
    ]);
  });
});

describe("finding a choice by name", () => {
  const choices = [
    { id: "a", label: "Harbour" },
    { id: "b", label: "Ines Fictional" },
    { id: "c", label: "ines fictional " },
  ];

  it("compares names ignoring letter case and spaces at either end", () => {
    expect(sameName(" Harbour", "harbour ")).toBe(true);
    expect(sameName("Harbour", "Harbours")).toBe(false);
  });

  it("finds the one choice with the name, ignoring letter case and spaces at either end", () => {
    expect(choiceNamed(choices, "  HARBOUR ")).toEqual({
      match: "one",
      choice: { id: "a", label: "Harbour" },
    });
  });

  it("finds none when no choice has the name", () => {
    expect(choiceNamed(choices, "Lighthouse")).toEqual({ match: "none" });
    expect(choiceNamed([], "Harbour")).toEqual({ match: "none" });
  });

  it("finds several, rather than the first, when more than one choice has the name", () => {
    expect(choiceNamed(choices, "Ines Fictional")).toEqual({
      match: "several",
    });
  });
});
