// SPDX-License-Identifier: Apache-2.0

// Tests for lists with meanings: which meanings each list's choices take, their names, and what each
// list must keep a choice for.

import { describe, expect, it } from "vitest";
import { keptOf, meaningName, meaningSchema, meaningsOf } from "./lists.ts";

describe("lists with meanings", () => {
  it("gives the hiring states Proposed, Open, Hired, and Left, and other lists none", () => {
    expect(meaningsOf("hiring-states")).toEqual([
      "proposed",
      "open",
      "hired",
      "left",
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
