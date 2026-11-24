// SPDX-License-Identifier: Apache-2.0

// Unit tests for the rules every kind of the plan's records shares: how a record is shown, the
// records its links name, which drafts a draft uses, which values are taken, and a change considered
// before it is saved.

import { releases } from "@fathom/db";
import { describe, expect, it } from "vitest";
import {
  linkedRefs,
  linkedType,
  linksTo,
  type RecordKind,
  shownVersion,
  usesOf,
  valueTaken,
  withVersion,
} from "./record-state.ts";
import { releaseKind } from "./release-kinds.ts";
import { draft, kindState, recordsState } from "./test-records-state.ts";

// A made-up kind that links to streams and has no value that must be unique.
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

describe("the records a link names", () => {
  const either = ["project-activity", "release-activity"] as const;
  const state = recordsState({
    "project-activity": kindState([["activity-1", { name: "Live" }]]),
    "release-activity": kindState(
      [],
      [["activity-2", draft("created", { name: "Drafted" })]],
    ),
  });

  it("names the one kind a field links to", () => {
    expect(linkedType(state, "release-stream", "anything")).toBe(
      "release-stream",
    );
  });

  it("finds, of several kinds, the one that has the record, live or drafted", () => {
    expect(linkedType(state, either, "activity-1")).toBe("project-activity");
    expect(linkedType(state, either, "activity-2")).toBe("release-activity");
  });

  it("takes the first kind when none has the record", () => {
    expect(linkedType(state, either, "activity-3")).toBe("project-activity");
  });

  it("says whether a field may name a kind", () => {
    expect(linksTo("release-stream", "release-stream")).toBe(true);
    expect(linksTo(either, "release-activity")).toBe(true);
    expect(linksTo(either, "feature")).toBe(false);
  });

  it("lists each record a record links to, with its kind", () => {
    expect(
      linkedRefs(
        { ...linking, links: { workId: either, streamId: "release-stream" } },
        state,
        { workId: "activity-2", streamId: "stream-1" },
      ),
    ).toEqual([
      { type: "release-activity", id: "activity-2" },
      { type: "release-stream", id: "stream-1" },
    ]);
  });
});
