// SPDX-License-Identifier: Apache-2.0

// Tests for how the change history words a new order of a list's choices, one choice moved, drafted
// or approved, how it names the plan's records, such as release streams and proposals, and their
// fields, how it words a release's colour, the words for a feature team's changes, and the class of
// a list or column added.

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
    [
      "a customer",
      planRecord("customer", "Fictional Clinics", null),
      "drafted adding the customer Fictional Clinics",
    ],
    [
      "a project",
      planRecord("project", "Fictional Cranes", null),
      "drafted adding the project Fictional Cranes",
    ],
    [
      "a proposal",
      planRecord("proposal", "Fictional Bid", null),
      "drafted adding the proposal Fictional Bid",
    ],
    [
      "a milestone with its project",
      planRecord("milestone", "Fictional Handover", "Fictional Cranes"),
      "drafted adding the milestone Fictional Handover of Fictional Cranes",
    ],
    [
      "a milestone whose project is not named",
      planRecord("milestone", "Fictional Handover", null),
      "drafted adding the milestone Fictional Handover",
    ],
    [
      "an allocation by who it puts on which feature",
      planRecord("allocation", "Fictional Person on Fictional Sync", null),
      "drafted adding the allocation of Fictional Person on Fictional Sync",
    ],
    [
      "an allocation the reader may not name",
      planRecord("allocation", null, null),
      "drafted adding an allocation",
    ],
  ])("names %s", (_case, record, sentence) => {
    expect(describeRecord(record).sentence).toBe(sentence);
  });
});

describe("the plan's fields in the change history", () => {
  it("names them as their columns are", () => {
    expect(
      describeField({
        field: "featureIds",
        oldValue: ["Fictional Sync", "Fictional Export"],
        newValue: ["Fictional Export"],
      }),
    ).toEqual([
      { strong: "Features" },
      " from ",
      { value: "Fictional Sync, Fictional Export" },
      " to ",
      { value: "Fictional Export" },
    ]);
    expect(describeValue("statusId", "Fictional Planned")?.at(0)).toEqual({
      strong: "Status",
    });
  });

  it("names a field by its kind's column where kinds differ", () => {
    const named = (kind: string) =>
      describeField({ field: "note", oldValue: null, newValue: "x" }, kind).at(
        0,
      );
    expect([named("feature"), named("release")]).toEqual([
      { strong: "Notes" },
      { strong: "Note" },
    ]);
  });

  it("names a project's and a proposal's own ID as its column does", () => {
    const named = (kind?: string) =>
      describeField(
        { field: "externalId", oldValue: null, newValue: "X-1" },
        kind,
      ).at(0);
    expect([named("project"), named("proposal"), named()]).toEqual([
      { strong: "Project ID" },
      { strong: "Proposal ID" },
      { strong: "ID" },
    ]);
  });
});

describe("how far a stream's cycles go in the change history", () => {
  it("names its last day Ends, and the day its cycles start up to Cycles until", () => {
    expect([
      describeField(
        { field: "endsOn", oldValue: null, newValue: "2027-03-31" },
        "release-stream",
      ),
      describeField(
        {
          field: "cyclesUntil",
          oldValue: "2028-11-14",
          newValue: "2028-12-31",
        },
        "release-stream",
      ).at(0),
    ]).toEqual([
      [{ strong: "Ends" }, " set to ", { value: "Mar 31, 2027" }],
      { strong: "Cycles until" },
    ]);
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

describe("a feature's estimate in the change history", () => {
  it("is named Effort and given in hours, as kept", () => {
    expect(
      describeField({ field: "estimateHours", oldValue: "8", newValue: "16" }),
    ).toEqual([
      { strong: "Effort" },
      " from ",
      { value: "8 hours" },
      " to ",
      { value: "16 hours" },
    ]);
  });
});

describe("a size's weight in the change history", () => {
  it("is named Weight and written as the reader's language writes numbers", () => {
    expect(
      describeField({ field: "weight", oldValue: "1200", newValue: "2.5" }),
    ).toEqual([
      { strong: "Weight" },
      " from ",
      { value: "1,200" },
      " to ",
      { value: "2.5" },
    ]);
  });
});

describe("the planning settings in the change history", () => {
  it("names them as one record, changed for everyone", () => {
    expect(
      describeRecord({
        kind: "planning-settings",
        action: "changed",
        name: null,
        list: null,
        draft: false,
        fields: [{ field: "hoursPerDay", oldValue: "8", newValue: "7.5" }],
      }).sentence,
    ).toBe("changed the planning settings");
  });

  it("names each setting, with percentages as such", () => {
    expect([
      describeField({ field: "hoursPerDay", oldValue: "8", newValue: "7.5" }),
      describeField({ field: "focusPercent", oldValue: "80", newValue: "70" }),
      describeField({
        field: "rampUpPercents",
        oldValue: ["50", "75"],
        newValue: ["50"],
      }),
    ]).toEqual([
      [
        { strong: "Hours a day" },
        " from ",
        { value: "8" },
        " to ",
        { value: "7.5" },
      ],
      [
        { strong: "Default focus" },
        " from ",
        { value: "80%" },
        " to ",
        { value: "70%" },
      ],
      [
        { strong: "Ramp-up" },
        " from ",
        { value: "50%, 75%" },
        " to ",
        { value: "50%" },
      ],
    ]);
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

describe("a list or column added", () => {
  const added = (
    kind: ChangedRecord["kind"],
    visibility: string | null,
  ): ChangedRecord => ({
    kind,
    action: "created",
    name: "Lockers",
    list: null,
    draft: true,
    fields: [
      { field: "name", oldValue: null, newValue: "Lockers" },
      { field: "visibility", oldValue: null, newValue: visibility },
    ],
  });

  it("names its class beyond General", () => {
    expect(describeRecord(added("list", "confidential")).details).toEqual([
      [{ strong: "Class" }, " ", { value: "Confidential" }],
    ]);
    expect(
      describeRecord(added("field", "personal"), "approval").details,
    ).toEqual([[{ strong: "Class" }, " ", { value: "Personal" }]]);
  });

  it("names no class for General, for a column taking its list's, or for another record", () => {
    expect(describeRecord(added("list", "general")).details).toEqual([]);
    expect(describeRecord(added("field", null)).details).toEqual([]);
    expect(describeRecord(added("release", "personal")).details).toEqual([]);
    expect(
      describeRecord({ ...added("list", "personal"), action: "deleted" })
        .details,
    ).toEqual([]);
  });
});
