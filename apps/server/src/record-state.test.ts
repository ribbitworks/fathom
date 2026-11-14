// SPDX-License-Identifier: Apache-2.0

// Tests for the rules every kind of the plan's records shares, worked out in memory: how a record
// is shown, which drafts a draft uses, which values are taken, and a change considered before it is
// saved. A kind made up for the tests, with a link and no unique value, stands beside a real one.

import { releases } from "@fathom/db";
import { describe, expect, it } from "vitest";
import type { Draft, Recorded } from "./data/drafts.ts";
import {
  type KindState,
  type RecordKind,
  type RecordsState,
  shownVersion,
  usesOf,
  valueTaken,
  withVersion,
} from "./data/record-state.ts";
import { releaseKind } from "./data/release-kinds.ts";

const draft = (action: Draft["action"], fields: Recorded = {}): Draft => ({
  action,
  fields,
  state: "waiting",
  reason: null,
  sequence: 1,
});

const kindState = (
  live: [string, Recorded][] = [],
  drafts: [string, Draft][] = [],
  held: KindState["held"] = new Map(),
): KindState => ({
  live: new Map(live),
  rows: new Map(live),
  drafts: new Map(drafts),
  held,
});

const recordsState = (parts: Partial<RecordsState>): RecordsState => ({
  "release-stream": kindState(),
  "cycle-pattern": kindState(),
  release: kindState(),
  feature: kindState(),
  customer: kindState(),
  proposal: kindState(),
  project: kindState(),
  milestone: kindState(),
  allocation: kindState(),
  "planning-settings": kindState(),
  ...parts,
});

// A kind that links to streams and has no value that must be unique.
const linking: RecordKind = {
  type: "cycle-pattern",
  table: releases,
  fields: ["streamId", "label"],
  links: { streamId: "release-stream" },
  readWith: ["plan:view"],
  unseenSubject: "a record",
  subject: () => "a fictional record",
};

describe("a record shown", () => {
  it("is as it is live when its draft removes it", () => {
    const state = recordsState({
      release: kindState(
        [["r", { name: "Fictional" }]],
        [["r", draft("deleted")]],
      ),
    });
    expect(shownVersion(state, "release", "r")).toEqual({ name: "Fictional" });
  });
});

describe("the drafts a draft uses", () => {
  const added = kindState([], [["s", draft("created", { name: "New" })]]);

  it("are those of the records only drafted to be added that it links to", () => {
    const state = recordsState({
      "release-stream": added,
      "cycle-pattern": kindState(
        [],
        [["p", draft("created", { streamId: "s", label: "A" })]],
      ),
    });
    expect(usesOf(linking, state, "p")).toEqual([
      { type: "release-stream", id: "s" },
    ]);
  });

  it("are none for a record with no draft", () => {
    const state = recordsState({
      "release-stream": added,
      "cycle-pattern": kindState([["p", { streamId: "s", label: "A" }]]),
    });
    expect(usesOf(linking, state, "p")).toEqual([]);
  });

  it("are none for a draft that removes the record", () => {
    const state = recordsState({
      "release-stream": added,
      "cycle-pattern": kindState(
        [["p", { streamId: "s", label: "A" }]],
        [["p", draft("deleted")]],
      ),
    });
    expect(usesOf(linking, state, "p")).toEqual([]);
  });
});

describe("a value taken", () => {
  it("is never so for a kind with no unique value", () => {
    const state = recordsState({
      "cycle-pattern": kindState([["p", { streamId: "s", label: "A" }]]),
    });
    expect(valueTaken(linking, state, { streamId: "s", label: "A" }, "q")).toBe(
      false,
    );
  });

  it("counts drafts others hold, ignoring letter case", () => {
    const state = recordsState({
      release: kindState(
        [],
        [],
        new Map([
          [
            "r",
            {
              holderId: "u",
              holder: "Fictional Holder",
              draft: draft("created", { streamId: "s", name: "Taken" }),
            },
          ],
        ]),
      ),
    });
    expect(
      valueTaken(releaseKind, state, { streamId: "s", name: "taken" }, "q"),
    ).toBe(true);
  });

  it("is free in another stream", () => {
    const state = recordsState({
      release: kindState([["r", { streamId: "s", name: "Taken" }]]),
    });
    expect(
      valueTaken(releaseKind, state, { streamId: "t", name: "Taken" }, "q"),
    ).toBe(false);
  });
});

describe("a change considered before it is saved", () => {
  it("leaves no draft when it makes the record as it is live", () => {
    const state = recordsState({
      release: kindState(
        [["r", { name: "Fictional" }]],
        [["r", draft("changed", { name: "Other" })]],
      ),
    });
    const after = withVersion(state, "release", "r", { name: "Fictional" });
    expect(after.release.drafts.has("r")).toBe(false);
  });
});
