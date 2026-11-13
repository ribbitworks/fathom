// SPDX-License-Identifier: Apache-2.0

// Tests for lists with meanings: which meanings each list's choices take, their names, and what each
// list must keep a choice for; and for the weights of feature sizes.

import { describe, expect, it } from "vitest";
import {
  keptOf,
  meaningName,
  meaningSchema,
  meaningsOf,
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
      "Weight: use a number such as 1234.5",
      "Weight: use 0.01 to 9999.99",
      "Weight: use 0.01 to 9999.99",
      "Weight: use at most 2 digits after the point",
      undefined,
    ]);
  });
});
