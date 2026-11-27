// SPDX-License-Identifier: Apache-2.0

// Unit tests for the drafts any role that may change cycles discards, whoever changed them.

import { fictionalUser as user } from "@fathom/test-utils";
import { describe, expect, it } from "vitest";
import { actorFor } from "../access.ts";
import { discardedByAnyEditor } from "./bound-drafts.ts";
import {
  draft,
  kindState,
  pattern,
  patternId,
  recordsState,
  schedule,
  stream,
  twoStreams,
} from "./test-records-state.ts";

const changesCycles = actorFor(user, "workforce-administrator");
const changesReleasesOnly = actorFor(user, "feature-lead");

// A live stream whose cycles a draft renames.
const renamed = recordsState(
  twoStreams({
    patternDrafts: [
      [patternId, draft("changed", pattern({ naming: "Q{N} {YYYY}" }))],
    ],
  }),
);

describe("the drafts any role that changes cycles discards", () => {
  it("hold a change of a schedule's cycles, though it only renames them", () => {
    expect([...discardedByAnyEditor(renamed, changesCycles)]).toEqual([
      `cycle-pattern ${patternId}`,
    ]);
  });

  it("hold none for a role that doesn't change cycles", () => {
    expect(discardedByAnyEditor(renamed, changesReleasesOnly).size).toBe(0);
  });

  it("leave out a new schedule, which its new cycles use but which uses none of them", () => {
    // Given a schedule only drafted to be added, with its cycles
    const state = recordsState({
      "release-stream": kindState([], [[stream, draft("created", schedule())]]),
      "cycle-pattern": kindState(
        [],
        [[patternId, draft("created", pattern())]],
      ),
    });

    // When the drafts any role that changes cycles discards are found
    const found = discardedByAnyEditor(state, changesCycles);

    // Then they hold its cycles' draft alone
    expect([...found]).toEqual([`cycle-pattern ${patternId}`]);
  });
});
