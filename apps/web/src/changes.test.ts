// SPDX-License-Identifier: Apache-2.0

// Tests for how the change history words a new order of a list's choices: one choice moved, drafted
// or approved.

import type { ChangedRecord } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { describeRecord } from "./changes.ts";

const order = (
  oldValue: string[],
  newValue: string[],
  name: string | null = "Levels",
): ChangedRecord => ({
  kind: "choice-order",
  action: "changed",
  name,
  list: null,
  draft: true,
  fields: [{ field: "order", oldValue, newValue }],
});

describe("a new order of a list's choices", () => {
  it("names the one choice moved, and where to", () => {
    expect(
      describeRecord(order(["P1", "P2", "M1"], ["P1", "M1", "P2"])).sentence,
    ).toBe("drafted moving M1 in Levels after P1");
    expect(
      describeRecord(order(["P1", "P2"], ["P2", "P1"], null)).sentence,
    ).toBe("drafted moving P2 in a list to the top");
  });

  it("says a new order when several moved, or when approved", () => {
    expect(
      describeRecord(order(["A", "B", "C", "D"], ["B", "A", "D", "C"]))
        .sentence,
    ).toBe("drafted a new order of Levels");
    expect(
      describeRecord(order(["P1", "P2"], ["P2", "P1"]), "approval").sentence,
    ).toBe("approved a new order of Levels");
  });

  it("names the list it belongs to elsewhere", () => {
    expect(describeRecord(order(["A"], ["A"]), "discard").sentence).toBe(
      "discarded the draft of the order of Levels",
    );
  });
});
