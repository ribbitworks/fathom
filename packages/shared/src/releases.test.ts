// SPDX-License-Identifier: Apache-2.0

// Tests for the requests that change release streams, their cycle patterns, and their releases: how
// long a cycle may be, the order of a release's cycles, the day it ships, and its colour.

import { describe, expect, it } from "vitest";
import {
  cyclePatternRequestSchema,
  knownColour,
  planSubjects,
  releaseRequestSchema,
  shipsBeforeStart,
} from "./releases.ts";

const message = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

const quarters = {
  startsOn: "2027-01-01",
  length: 3,
  unit: "months",
  naming: "{YY}.{N}",
};

const release = {
  name: "Fictional One",
  firstCycle: "2027-01-01",
  lastCycle: "2027-04-01",
};

describe("cyclePatternRequestSchema", () => {
  it("accepts cycles of up to two years", () => {
    expect(
      cyclePatternRequestSchema.safeParse({ ...quarters, length: 24 }).success,
    ).toBe(true);
  });

  it("refuses cycles longer than two years, in weeks as in months", () => {
    expect(
      [
        { ...quarters, length: 25 },
        { ...quarters, length: 105, unit: "weeks" },
      ].map((pattern) => message(cyclePatternRequestSchema.safeParse(pattern))),
    ).toEqual([
      "A cycle can be at most two years long",
      "A cycle can be at most two years long",
    ]);
  });
});

describe("releaseRequestSchema", () => {
  it("ships at the end of its last cycle unless given a day", () => {
    expect(releaseRequestSchema.parse(release).shipsOn).toBeNull();
  });

  it("may ship on a day after its last cycle ends", () => {
    expect(
      releaseRequestSchema.parse({ ...release, shipsOn: "2027-07-31" }).shipsOn,
    ).toBe("2027-07-31");
  });

  it("refuses a last cycle before the first", () => {
    expect(
      message(
        releaseRequestSchema.safeParse({ ...release, lastCycle: "2026-10-01" }),
      ),
    ).toBe("A release's last cycle cannot come before its first");
  });

  it("refuses shipping before its first cycle starts", () => {
    expect(
      message(
        releaseRequestSchema.safeParse({ ...release, shipsOn: "2026-12-31" }),
      ),
    ).toBe(shipsBeforeStart);
  });
});

describe("a release's colour", () => {
  it("is the default unless one from the palette is given", () => {
    expect([
      releaseRequestSchema.parse(release).colour,
      releaseRequestSchema.parse({ ...release, colour: "teal" }).colour,
      releaseRequestSchema.safeParse({ ...release, colour: "sea" }).success,
    ]).toEqual([null, "teal", false]);
  });

  it("is read as the default once the palette no longer has it", () => {
    expect([
      knownColour("grape"),
      knownColour("beige"),
      knownColour(null),
    ]).toEqual(["grape", null, null]);
  });
});

describe("planSubjects", () => {
  it("names a stream, a change of its cycles, and a release as drafts name them", () => {
    expect([
      planSubjects.stream("Fictional Majors"),
      planSubjects.pattern("Fictional Majors", "2027-07-01"),
      planSubjects.release("Fictional One", "Fictional Majors"),
    ]).toEqual([
      "the release stream Fictional Majors",
      "the cycles of Fictional Majors from 2027-07-01",
      "the release Fictional One in Fictional Majors",
    ]);
  });
});
