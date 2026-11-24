// SPDX-License-Identifier: Apache-2.0

// Unit tests for what a change to a stream's pattern or release keeps, and which release's activity a
// change may name.

import {
  cyclePatternRequestSchema,
  releaseRequestSchema,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  changedInStream,
  notedRelease,
  patternRecord,
  releaseActivity,
  releaseRecord,
} from "./releases.ts";
import {
  kindState,
  otherStream,
  pattern,
  recordsState,
  release,
  stream,
} from "./test-records-state.ts";

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

describe("a release's activity to change", () => {
  const state = recordsState({
    release: kindState([
      ["alpha", release("Fictional Alpha", "2027-01-01")],
      ["beta", release("Fictional Beta", "2027-04-01")],
    ]),
    "release-activity": kindState([
      ["testing", { releaseId: "alpha", name: "Release testing" }],
    ]),
  });

  it("is the activity, when it is the release's", () => {
    expect(releaseActivity(state, stream, "alpha", "testing")).toMatchObject({
      name: "Release testing",
    });
  });

  it("refuses an activity of another release", () => {
    expect(() => releaseActivity(state, stream, "beta", "testing")).toThrow(
      "There is no such activity in this release",
    );
  });

  it("refuses a release of another schedule", () => {
    expect(() =>
      releaseActivity(state, otherStream, "alpha", "testing"),
    ).toThrow("There is no such record in this schedule");
  });

  it("refuses an activity that doesn't exist", () => {
    expect(() => releaseActivity(state, stream, "alpha", "missing")).toThrow();
  });
});
