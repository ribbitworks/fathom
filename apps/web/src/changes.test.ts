// SPDX-License-Identifier: Apache-2.0

// Tests for how the change history words a new order of a list's choices, one choice moved, drafted
// or approved, how it names the plan's records, such as release streams, and how it words a
// release's colour, and the words for a feature team's changes.

import type { ChangedRecord } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { describeField, describeRecord, describeValue } from "./changes.ts";

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
    [
      "a planned hire by name",
      planRecord("planned-hire", "Fictional Engineer, TBD-7", null),
      "drafted adding the planned hire Fictional Engineer, TBD-7",
    ],
    [
      "a planned hire the reader may not name",
      planRecord("planned-hire", null, null),
      "drafted adding a planned hire",
    ],
    [
      "a feature team",
      planRecord("feature-team", "Fictional Harbour", null),
      "drafted adding the feature team Fictional Harbour",
    ],
    [
      "a feature",
      planRecord("feature", "Fictional Offline Sync", null),
      "drafted adding the feature Fictional Offline Sync",
    ],
  ])("names %s", (_case, record, sentence) => {
    expect(describeRecord(record).sentence).toBe(sentence);
  });
});

describe("a release's colour in the change history", () => {
  const colour = (oldValue: string | null, newValue: string | null) =>
    describeField({ field: "colour", oldValue, newValue }, "release");
  const from = (before: string, after: string) => [
    { strong: "Colour" },
    " from ",
    { value: before },
    " to ",
    { value: after },
  ];

  it("names the colours, the default as sea", () => {
    expect([
      colour("teal", "grape"),
      colour(null, "grape"),
      colour("teal", null),
    ]).toEqual([
      from("Teal", "Grape"),
      from("Sea", "Grape"),
      from("Teal", "Sea"),
    ]);
  });

  it("shows a colour the palette no longer has as sea", () => {
    expect(colour("beige", "teal")).toEqual(from("Sea", "Teal"));
  });

  it("words a colour field of another kind as any other field", () => {
    expect(
      describeField({ field: "colour", oldValue: null, newValue: "teal" }),
    ).toEqual([{ strong: "Colour" }, " set to ", { value: "teal" }]);
  });
});

describe("a feature team's changes in the change history", () => {
  it("names its lead, members, and the days they join or leave", () => {
    expect([
      describeField({
        field: "leadId",
        oldValue: "Avery Fictional",
        newValue: "Blake Fictional",
      })[0],
      describeField({
        field: "members",
        oldValue: ["Avery Fictional"],
        newValue: ["Avery Fictional", "Blake Fictional"],
      })[0],
      describeField({ field: "memberFrom", oldValue: null, newValue: null }),
    ]).toEqual([
      { strong: "Feature lead" },
      { strong: "Members" },
      [{ strong: "Joining and leaving dates" }, " changed"],
    ]);
  });

  it("words a value of a record added or removed, or nothing without one", () => {
    expect([
      describeValue("leadId", "Avery Fictional"),
      describeValue("members", ["Avery Fictional", "Blake Fictional"]),
      describeValue("members", []),
      describeValue("leadId", null),
    ]).toEqual([
      [{ strong: "Feature lead" }, " ", { value: "Avery Fictional" }],
      [
        { strong: "Members" },
        " ",
        { value: "Avery Fictional, Blake Fictional" },
      ],
      undefined,
      undefined,
    ]);
  });
});
