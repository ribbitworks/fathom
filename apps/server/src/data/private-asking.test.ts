// SPDX-License-Identifier: Apache-2.0

// Unit tests for what a user is asked about a clash on publishing their private changes: both sides
// and who made the other where the role sees them, or the clash given up where it doesn't.

import { describe, expect, it } from "vitest";
import { type Draft } from "./draft-records.ts";
import {
  askedAbout,
  blindField,
  isBlind,
  liveMaker,
  otherMaker,
  sideSeen,
} from "./private-asking.ts";
import {
  kai,
  leeds,
  lisbon,
  porto,
  privateChange,
} from "./test-private-changes.ts";

describe("a clash left unresolved as the answer gives it", () => {
  const side = (newValue: string) => ({
    field: "value",
    column: "Site",
    oldValue: "Leeds",
    newValue,
  });
  const sides = { mine: side("Lisbon"), theirs: side("Porto") };
  const unresolved = (state: Draft["state"] | "live") => ({
    row: privateChange({ site: lisbon }, { site: leeds }),
    kind: "person" as const,
    conflict: {
      field: "site",
      was: leeds,
      mine: lisbon,
      theirs: porto,
      state,
    },
  });

  it("asks with both sides, and who made the other value in the draft", () => {
    expect(
      askedAbout(unresolved("waiting"), "Kai Lindqvist", sides, "Ana", "shown"),
    ).toEqual({
      recordType: "person",
      recordId: kai,
      subject: "Kai Lindqvist",
      field: "site",
      ...sides,
      state: "waiting",
      by: "Ana",
      token: "shown",
    });
  });

  it("names nobody for a value the history holds no maker of", () => {
    expect(
      askedAbout(unresolved("waiting"), "Kai", sides, undefined, "shown").by,
    ).toBeNull();
  });

  it("names nobody for a live value", () => {
    expect(
      askedAbout(unresolved("live"), "Kai", sides, "Ana", "shown").by,
    ).toBeNull();
  });

  it("asks with neither side, nor who made the other, for a field the history doesn't show", () => {
    const asked = askedAbout(
      unresolved("waiting"),
      "Kai",
      { mine: sides.mine, theirs: "unshown" },
      "Ana",
      "shown",
    );

    expect(asked).not.toHaveProperty("mine");
    expect(asked).not.toHaveProperty("theirs");
    expect(asked.by).toBeNull();
  });

  it.each([
    ["mine", { mine: "unseen", theirs: side("Porto") }, true],
    ["theirs", { mine: side("Lisbon"), theirs: "unseen" }, true],
    ["neither", sides, false],
  ] as const)(
    "is given up where the role doesn't see the %s side",
    (_, seenSides, blind) => {
      expect(isBlind(seenSides)).toBe(blind);
    },
  );

  it("is named alone, by its record and field, where given up", () => {
    expect(blindField(unresolved("waiting"), "a person")).toEqual({
      recordType: "person",
      recordId: kai,
      subject: "a person",
      field: "site",
    });
  });

  const recordClashed = {
    row: privateChange({ site: lisbon }, { site: leeds }),
    kind: "person" as const,
    clash: {
      removedBy: "theirs" as const,
      state: "waiting" as const,
      fields: [],
    },
  };

  it("asks about a whole record, with who changed it", () => {
    expect(
      askedAbout(
        recordClashed,
        "Kai",
        { mine: "unshown", theirs: "unshown" },
        undefined,
        "shown",
      ),
    ).toEqual({
      recordType: "person",
      recordId: kai,
      subject: "Kai",
      removedBy: "theirs",
      state: "waiting",
      by: null,
      token: "shown",
    });
  });

  it("names a whole record given up by the record alone", () => {
    expect(blindField(recordClashed, "a person")).toEqual({
      recordType: "person",
      recordId: kai,
      subject: "a person",
    });
  });
});

describe("who made the other side of a clash", () => {
  const madeAt = new Date("2026-11-20T10:00:00Z");
  const maker = {
    madeBy: "Ana",
    madeAs: null,
    madeAt,
    editors: ["Ana"],
    fieldEditors: new Map([["site", "Cleo"]]),
    needsOtherApprover: false,
  };
  const field = {
    row: privateChange({ site: lisbon }, { site: leeds }),
    kind: "person" as const,
    conflict: {
      field: "site",
      was: leeds,
      mine: lisbon,
      theirs: porto,
      state: "waiting" as const,
    },
  };
  const record = (removedBy: "theirs" | "mine") => ({
    row: privateChange({}, {}, "deleted"),
    kind: "person" as const,
    clash: { removedBy, state: "waiting" as const, fields: [] },
  });
  const before = new Date("2026-11-19T10:00:00Z");
  const after = new Date("2026-11-21T10:00:00Z");

  it("is who last changed the field", () => {
    expect(otherMaker(field, maker, undefined, null)).toBe("Cleo");
  });

  it("is who last changed a record they removed", () => {
    expect(otherMaker(record("theirs"), maker, after, null)).toBe("Ana");
  });

  it("is who changed a record the user removes, after the removal began", () => {
    expect(otherMaker(record("mine"), maker, before, null)).toBe("Ana");
  });

  it("is nobody for a change made before the user's removal began", () => {
    expect(otherMaker(record("mine"), maker, after, null)).toBeNull();
  });

  it("is nobody where the history names no one", () => {
    expect(otherMaker(record("mine"), undefined, before, null)).toBeNull();
    expect(otherMaker(record("mine"), maker, undefined, null)).toBeNull();
  });

  it("is who made a record's change live, for a removal of a record changed live", () => {
    const live = {
      ...record("mine"),
      clash: { ...record("mine").clash, state: "live" as const },
    };

    expect(otherMaker(live, maker, before, "Dee")).toBe("Dee");
  });
});

describe("who made a record's change live since a removal began", () => {
  const liveSince = {
    added: false,
    changes: [
      { field: "site", tier: "general", madeBy: "Dee" },
      { field: "salary", tier: "confidential", madeBy: "Eli" },
    ],
  };

  it("is who made the latest the role is shown", () => {
    expect(liveMaker(liveSince, ({ tier }) => tier === "general")).toBe("Dee");
  });

  it("is nobody where the role is shown none, or nothing was made live", () => {
    expect(liveMaker(liveSince, () => false)).toBeNull();
    expect(liveMaker(undefined, () => true)).toBeNull();
  });
});

describe("how the role sees a side", () => {
  const field = { field: "name", oldValue: "A", newValue: "B" };
  const shown = new Map([
    ["shown", field],
    ["unshown", undefined],
  ]);

  it.each([
    ["as the history shows it", "shown", field],
    ["as a field the history doesn't show", "unshown", "unshown"],
    ["not at all, where the history hides it", "hidden", "unseen"],
  ])("is %s", (_, side, seen) => {
    expect(sideSeen(shown, side)).toEqual(seen);
  });
});
