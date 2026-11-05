// SPDX-License-Identifier: Apache-2.0

// Tests for how the change history words a new order of a list's choices, one choice moved, drafted
// or approved, and how it names the plan's records, such as release streams.

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
    ).toBe("drafted a new order for Levels");
    expect(
      describeRecord(order(["P1", "P2"], ["P2", "P1"]), "approval").sentence,
    ).toBe("approved a new order for Levels");
  });

  it("names the list it belongs to elsewhere", () => {
    expect(describeRecord(order(["A"], ["A"]), "discard").sentence).toBe(
      "discarded the draft of the order of Levels",
    );
  });
});

const planRecord = (
  kind: ChangedRecord["kind"],
  name: string | null,
  list: string | null,
): ChangedRecord => ({
  kind,
  action: "created",
  name,
  list,
  draft: true,
  fields: [],
});

describe("the plan's records in the change history", () => {
  it.each([
    [
      "a release stream",
      planRecord("release-stream", "Fictional Majors", null),
      "drafted adding the release stream Fictional Majors",
    ],
    [
      "a change of cycles by its stream",
      planRecord("cycle-pattern", null, "Fictional Majors"),
      "drafted adding the cycles of Fictional Majors",
    ],
    [
      "a change of cycles whose stream is not named",
      planRecord("cycle-pattern", null, null),
      "drafted adding a stream's cycles",
    ],
    [
      "a release with its stream",
      planRecord("release", "Fictional One", "Fictional Majors"),
      "drafted adding the release Fictional One in Fictional Majors",
    ],
    [
      "a release whose stream is not named",
      planRecord("release", "Fictional One", null),
      "drafted adding the release Fictional One",
    ],
  ])("names %s", (_case, record, sentence) => {
    expect(describeRecord(record).sentence).toBe(sentence);
  });
});
