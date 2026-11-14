// SPDX-License-Identifier: Apache-2.0

// Tests for how searches match text.

import { describe, expect, it } from "vitest";
import { folded, matchesWords, searchWords } from "./search.ts";

describe("search", () => {
  it("folds letter case and accents, but not marks that make another letter", () => {
    expect(folded("ÉCOLE")).toBe("ecole");
    expect(folded("й")).toBe("и");
    expect(folded("が")).toBe("が");
    expect(folded("한국")).toBe("한국");
  });

  it("folds letters drawn with a stroke to the plain letter", () => {
    expect(folded("Holm-Schrøder")).toBe("holm-schroder");
    expect(folded("ĐŁØ")).toBe("dlo");
  });

  it("splits a search into folded words, leaving out empty ones", () => {
    expect(searchWords("  Café   Noir ")).toEqual(["cafe", "noir"]);
    expect(searchWords("   ")).toEqual([]);
  });

  it("matches text holding every word, in any order", () => {
    expect(matchesWords("Noir Café", ["cafe", "noir"])).toBe(true);
    expect(matchesWords("Café", ["cafe", "noir"])).toBe(false);
    expect(matchesWords("anything", [])).toBe(true);
  });
});
