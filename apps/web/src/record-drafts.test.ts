// SPDX-License-Identifier: Apache-2.0

// Tests for working out, from the drafts each draft of the plan's records uses, which others
// approving some includes, or rejecting them must include, and how they are named.

import type { RecordRef } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  originalOf,
  recordNames,
  type RecordNode,
  recordsJoined,
  recordsWithout,
  rejectedRecords,
  usedRecords,
  usingRecords,
} from "./record-drafts.ts";
import { recordDraft } from "./test-support.tsx";

const stream: RecordRef = {
  type: "release-stream",
  id: "10000000-0000-4000-8000-000000000001",
};
const pattern: RecordRef = {
  type: "cycle-pattern",
  id: "20000000-0000-4000-8000-000000000001",
};
const release: RecordRef = {
  type: "release",
  id: "30000000-0000-4000-8000-000000000001",
};
const other: RecordRef = {
  type: "release",
  id: "30000000-0000-4000-8000-000000000002",
};

const node = (
  ref: RecordRef,
  subject: string,
  draft?: RecordNode["draft"],
): RecordNode => ({ ref, subject, draft, heldBy: undefined });

// A stream drafted to be added, a change of its cycles that uses it, and a release that uses the
// change of cycles, so uses the stream through it. Another release has no draft.
const nodes = [
  node(stream, "the schedule Fictional Majors", recordDraft()),
  node(
    pattern,
    "the cycles of Fictional Majors from 2027-01-01",
    recordDraft({ uses: [stream] }),
  ),
  node(
    release,
    "the release Fictional One in Fictional Majors",
    recordDraft({ uses: [pattern, stream] }),
  ),
  node(other, "the release Fictional Two in Fictional Majors"),
];

describe("drafts an approval of the plan's records includes", () => {
  it("includes the drafts used, and those they use, each once", () => {
    expect(usedRecords([release], nodes)).toEqual([pattern, stream]);
  });

  it("includes nothing for a record whose draft uses none", () => {
    expect(usedRecords([other], nodes)).toEqual([]);
  });

  it("includes nothing for a record it does not know", () => {
    expect(
      usedRecords(
        [{ type: "release", id: "30000000-0000-4000-8000-000000000009" }],
        nodes,
      ),
    ).toEqual([]);
  });
});

describe("drafts a rejection of the plan's records includes", () => {
  it("includes the drafts that use those rejected, and those that use them", () => {
    expect(usingRecords([stream], nodes)).toEqual([pattern, release]);
  });

  it("includes nothing when no draft uses those rejected", () => {
    expect(usingRecords([release], nodes)).toEqual([]);
  });

  it("leaves out drafts only their makers see", () => {
    const unpublished = nodes.map((one) =>
      one.ref === pattern
        ? { ...one, draft: recordDraft({ uses: [stream], unpublished: true }) }
        : one,
    );
    expect(usingRecords([stream], unpublished)).toEqual([release]);
  });
});

describe("rejected drafts of the plan's records", () => {
  it("finds those among the records given whose drafts were rejected", () => {
    const rejected = nodes.map((one) =>
      one.ref === pattern
        ? { ...one, draft: recordDraft({ state: "rejected" }) }
        : one,
    );
    expect(rejectedRecords([stream, pattern, other], rejected)).toEqual([
      pattern,
    ]);
  });
});

describe("the plan's records named and combined", () => {
  it("names the records given, as the Drafts page names them", () => {
    expect(recordNames([release, stream], nodes)).toEqual([
      "the schedule Fictional Majors",
      "the release Fictional One in Fictional Majors",
    ]);
  });

  it("leaves out the records in another selection", () => {
    expect(recordsWithout([stream, pattern, release], [pattern])).toEqual([
      stream,
      release,
    ]);
  });

  it("joins two selections, keeping each record once", () => {
    expect(recordsJoined([stream, pattern], [{ ...pattern }, release])).toEqual(
      [stream, pattern, release],
    );
  });
});

describe("a record as it is with every draft", () => {
  const shown = { id: "r1", name: "Fictional Live" };
  const original = { id: "r1", name: "Fictional Drafted" };

  it("is the record of the same id the view was made from", () => {
    expect(originalOf(new Map([["r1", original]]), shown)).toBe(original);
  });

  it("is the record shown when the view was made from none of its id", () => {
    expect(originalOf(new Map(), shown)).toBe(shown);
  });
});
