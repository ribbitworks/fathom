// SPDX-License-Identifier: Apache-2.0

// Tests for the rules every kind of the plan's records shares, worked out in memory: how a record
// is shown, which drafts a draft uses, which values are taken, and a change considered before it is
// saved. A kind made up for the tests, with a link and no unique value, stands beside a real one.

import { releases } from "@fathom/db";
import { defaultClasses, type Permission } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  type RecordKind,
  readsKind,
  subjectFor,
  shownVersion,
  usesOf,
  valueTaken,
  withVersion,
} from "./record-state.ts";
import { activityKind } from "./activity-kinds.ts";
import { allocationKind } from "./allocation-kinds.ts";
import { releaseKind } from "./release-kinds.ts";
import { draft, kindState, recordsState } from "./test-records-state.ts";

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
  const activities = recordsState({
    activity: kindState([
      ["a", { projectId: "p", releaseId: null, name: "Release testing" }],
      ["b", { projectId: null, releaseId: "r", name: "Release testing" }],
    ]),
  });

  it("is so among the records with the same value in the field it is unique within", () => {
    expect(
      valueTaken(
        activityKind,
        activities,
        { projectId: "p", releaseId: null, name: "release TESTING" },
        "c",
      ),
    ).toBe(true);
  });

  it("is not so among records with another value, or none, in that field", () => {
    expect(
      valueTaken(
        activityKind,
        activities,
        { projectId: null, releaseId: "s", name: "Release testing" },
        "c",
      ),
    ).toBe(false);
  });

  it("is never so for a kind with no unique value", () => {
    const state = recordsState({
      "cycle-pattern": kindState([["p", { streamId: "s", label: "A" }]]),
    });
    expect(valueTaken(linking, state, { streamId: "s", label: "A" }, "q")).toBe(
      false,
    );
  });

  it("counts drafts, ignoring letter case", () => {
    const state = recordsState({
      release: kindState(
        [],
        [["r", draft("created", { streamId: "s", name: "Taken" })]],
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

describe("whether a role reads a kind", () => {
  const access = (permissions: Permission[]) => ({
    permissions,
    dataClasses: defaultClasses,
  });

  it("needs a permission the kind is read with", () => {
    expect(readsKind(releaseKind, access(["features:view"]))).toBe(true);
    expect(readsKind(releaseKind, access(["plan:view"]))).toBe(false);
  });

  it("needs every class of data the kind's view needs, for a kind that has one", () => {
    expect(readsKind(allocationKind, access(["allocations:view"]))).toBe(false);
    expect(
      readsKind(allocationKind, access(["allocations:view", "personal:view"])),
    ).toBe(true);
  });

  it("names an allocation only by its kind to a role without its view's classes", () => {
    const state = recordsState({
      feature: kindState([["f", { name: "Fictional Feature" }]]),
      allocation: kindState([["a", { featureId: "f" }]]),
    });
    const named = (permissions: Permission[]) =>
      subjectFor(allocationKind, state, "a", access(permissions));

    expect(named(["allocations:view"])).toBe("an allocation");
    expect(named(["allocations:view", "personal:view"])).toBe(
      "an allocation to a feature",
    );
    expect(named(["allocations:view", "personal:view", "features:view"])).toBe(
      "an allocation to the feature Fictional Feature",
    );
  });
});
