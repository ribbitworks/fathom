// SPDX-License-Identifier: Apache-2.0

// Unit tests for what a change to a stream's pattern or release keeps: the fields its request holds,
// and what it doesn't, such as a release's note.

import {
  cyclePatternRequestSchema,
  releaseRequestSchema,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  changedInStream,
  notedRelease,
  patternRecord,
  releaseRecord,
} from "./releases.ts";
import { pattern, release, stream } from "./test-records-state.ts";

const noted = {
  ...release("Fictional Alpha", "2027-01-01", "2027-04-01"),
  shipsOn: null,
  colour: null,
  note: "Fictional note",
};

describe("a release changed", () => {
  it("takes what the request holds and keeps its note", () => {
    const request = releaseRequestSchema.parse({
      name: "Fictional Renamed",
      firstCycle: "2027-04-01",
      lastCycle: "2027-07-01",
      colour: "teal",
    });

    expect(changedInStream(noted, releaseRecord(stream, request))).toEqual({
      streamId: stream,
      name: "Fictional Renamed",
      firstCycle: "2027-04-01",
      lastCycle: "2027-07-01",
      shipsOn: null,
      colour: "teal",
      note: "Fictional note",
    });
  });
});

describe("a pattern changed", () => {
  it("takes what the request holds", () => {
    const request = cyclePatternRequestSchema.parse({
      startsOn: "2027-01-01",
      length: 2,
      unit: "weeks",
      naming: "Sprint {#}",
    });

    expect(changedInStream(pattern(), patternRecord(stream, request))).toEqual({
      streamId: stream,
      startsOn: "2027-01-01",
      length: 2,
      unit: "weeks",
      naming: "Sprint {#}",
    });
  });
});

describe("a release's note changed", () => {
  it.each([
    ["is the note given", "Fictional new note"],
    ["is none once removed", null],
  ])("%s, the rest of the release kept", (_, note) => {
    expect(notedRelease(noted, note)).toEqual({ ...noted, note });
  });
});
