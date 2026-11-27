// SPDX-License-Identifier: Apache-2.0

// Unit tests for the rules of each kind of change set.

import { describe, expect, it } from "vitest";
import { kindsWhere, rulesOf, storedKind } from "./change-set-kinds.ts";

describe("a kind of change set as stored", () => {
  it("is the kind it names, when the server knows it", () => {
    expect(storedKind("gone")).toBe("gone");
  });

  it("is saved changes, when the server no longer knows it", () => {
    expect(storedKind("retired-kind")).toBe("edit");
    expect(rulesOf("retired-kind").shownAs).toBe("edit");
  });
});

describe("the kinds of change set that end their maker's earlier private ones", () => {
  it("are a user's private changes all discarded at once", () => {
    expect(kindsWhere(({ endsOpen }) => endsOpen)).toEqual(["withdrawal"]);
  });
});
