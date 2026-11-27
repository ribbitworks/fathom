// SPDX-License-Identifier: Apache-2.0

// Unit tests for who may discard a plan record's draft: one who changed it, but for a draft bound to
// a change of a schedule's cycles, which any role that may change cycles discards, and which a role
// that may not change cycles never discards.

import { fictionalUser as user } from "@fathom/test-utils";
import { describe, expect, it } from "vitest";
import { actorFor } from "../access.ts";
import { recordDiscardRefusal } from "./record-discards.ts";
import {
  draft,
  kindState,
  otherStream,
  pattern,
  patternId,
  recordsState,
  release,
  schedule,
  stream,
  twoStreams,
} from "./test-records-state.ts";

const changesCycles = actorFor(user, "workforce-administrator");
const changesReleasesOnly = actorFor(user, "feature-lead");
const othersRefusal = "Only someone who changed this draft can discard it.";
const cyclesRefusal = "Only someone who changes cycles can discard this.";

const patternRef = { type: "cycle-pattern", id: patternId } as const;
const releaseRef = { type: "release", id: "release-1" } as const;

// A renamed release in the second stream, with, where asked, a draft renaming the first's cycles.
const withRelease = (renamedCycles: boolean) =>
  recordsState({
    ...twoStreams({
      patternDrafts: renamedCycles
        ? [[patternId, draft("changed", pattern({ naming: "Q{N} {YYYY}" }))]]
        : [],
    }),
    release: kindState(
      [
        [
          releaseRef.id,
          release("Fictional Release", "2027-01-01", "2027-01-01", otherStream),
        ],
      ],
      [
        [
          releaseRef.id,
          draft(
            "changed",
            release(
              "Fictional Renamed",
              "2027-01-01",
              "2027-01-01",
              otherStream,
            ),
          ),
        ],
      ],
    ),
  });

describe("who may discard a plan record's draft", () => {
  it.each([
    [true, undefined],
    [false, othersRefusal],
  ])(
    "is one who changed it, with no change of cycles drafted: changed %s",
    (changed, refusal) => {
      expect(
        recordDiscardRefusal(
          withRelease(false),
          changesReleasesOnly,
          releaseRef,
          changed,
        ),
      ).toBe(refusal);
    },
  );

  it("is one who changed a draft no change of cycles takes along, though one is drafted", () => {
    expect(
      recordDiscardRefusal(
        withRelease(true),
        changesReleasesOnly,
        releaseRef,
        true,
      ),
    ).toBeUndefined();
  });

  it("is any role that changes cycles for a change of cycles, though it only renames them", () => {
    expect(
      recordDiscardRefusal(withRelease(true), changesCycles, patternRef, false),
    ).toBeUndefined();
  });

  it("is never a role that doesn't change cycles, for a change of cycles, though they changed it", () => {
    expect(
      recordDiscardRefusal(
        withRelease(true),
        changesReleasesOnly,
        patternRef,
        true,
      ),
    ).toBe(cyclesRefusal);
  });

  it("is only one who changed a new schedule, which its new cycles use but which uses none of them", () => {
    // Given a schedule only drafted to be added, with its cycles
    const state = recordsState({
      "release-stream": kindState([], [[stream, draft("created", schedule())]]),
      "cycle-pattern": kindState(
        [],
        [[patternId, draft("created", pattern())]],
      ),
    });
    const scheduleRef = { type: "release-stream", id: stream } as const;

    // When another role that changes cycles would discard the schedule, and its cycles
    const refusals = [
      recordDiscardRefusal(state, changesCycles, scheduleRef, false),
      recordDiscardRefusal(state, changesCycles, patternRef, false),
    ];

    // Then the schedule is refused them, but its cycles are not
    expect(refusals).toEqual([othersRefusal, undefined]);
  });
});
