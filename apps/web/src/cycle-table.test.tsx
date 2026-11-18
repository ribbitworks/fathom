// SPDX-License-Identifier: Apache-2.0

// Tests for the Cycles tab's rows: each a record of its own, whatever its drafts do to its cycles.

import type { Cycle, DraftKind, Release, ReleaseStream } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import {
  type CycleDraft,
  type CycleRow,
  cycleRows,
  cycleTable,
} from "./cycle-table.tsx";
import {
  fictionalPattern,
  fictionalRelease,
  fictionalStream,
  recordDraft,
} from "./test-support.tsx";

const cycle = (name: string, startsOn: string, endsOn: string): Cycle => ({
  name,
  startsOn,
  endsOn,
  months: [],
});

describe("the Cycles tab's rows", () => {
  it("keep a removed cycle apart from a moved one starting on its first day", () => {
    // Given a freeze drafted away, the cycle after it moved to start on the freeze's first day
    const stream = fictionalStream({
      patterns: [
        fictionalPattern({ draft: recordDraft({ changed: ["length"] }) }),
      ],
      cycles: [
        cycle("27.2", "2027-04-01", "2027-06-15"),
        cycle("27.3", "2027-06-16", "2027-09-30"),
      ],
      liveCycles: [
        cycle("27.2", "2027-04-01", "2027-06-15"),
        cycle("Freeze", "2027-06-16", "2027-06-30"),
        cycle("27.3", "2027-07-01", "2027-09-30"),
      ],
    });

    // Then each row is a record of its own
    const rows = cycleRows([stream], "both", "2027-05-15");
    expect(rows.map(({ name, draft }) => [name, draft?.action])).toEqual([
      ["27.2", undefined],
      ["27.3", "changed"],
      ["Freeze", "deleted"],
    ]);
    expect(new Set(rows.map(({ id }) => id)).size).toBe(rows.length);
  });

  describe("a cycle both a new length and its release's own draft change", () => {
    const patternId = "20000000-0000-4000-8000-000000000001";
    const releaseId = "30000000-0000-4000-8000-000000000001";
    // A new length that ends 27.1 a month early, and 27.1's release drafted to be renamed.
    const changedBoth = (release: Partial<Release> = {}) =>
      fictionalStream({
        patterns: [
          fictionalPattern({
            draft: recordDraft({
              changed: ["length"],
              madeBy: "Pattern Maker",
            }),
          }),
        ],
        cycles: [cycle("27.1", "2027-01-01", "2027-02-28")],
        liveCycles: [cycle("27.1", "2027-01-01", "2027-03-31")],
        releases: [
          fictionalRelease({
            name: "Harbour",
            draft: recordDraft({
              changed: ["name"],
              live: { name: "Fictional One" },
              madeBy: "Release Maker",
            }),
            ...release,
          }),
        ],
      });
    const rowOf = (stream: ReleaseStream) => {
      const [row] = cycleRows([stream], "both", "2027-01-15");
      expect(row).toBeDefined();
      return row as CycleRow;
    };
    const decided = (stream: ReleaseStream, approves: DraftKind[]) => {
      const row = rowOf(stream);
      const table = cycleTable({
        streams: [stream],
        rows: [row],
        day: "2027-01-15",
        onOpen: () => undefined,
        approves,
      });
      expect(row.draft).toBeDefined();
      return {
        records: table.drafts([row.id]).records,
        keys: table.draftKeys?.(row.draft as CycleDraft),
      };
    };
    const pattern = { type: "cycle-pattern", id: patternId };
    const release = { type: "release", id: releaseId };

    it("credits the Release to the release's draft and the rest to the new length", () => {
      const row = rowOf(changedBoth());

      expect(row.draft?.ref).toEqual(pattern);
      expect(row.draft?.changed).toEqual(
        expect.arrayContaining(["endsOn", "release", "releaseName"]),
      );
      expect(row.draft?.changedBy).toEqual({
        release: "Release Maker",
        releaseName: "Release Maker",
      });
      expect(row.subject).toBe(
        "Part of a change to the cycles of Fictional Majors from 27.1, and of a change to Harbour",
      );
    });

    it("decides both drafts for a role approving both", () => {
      expect(decided(changedBoth(), ["cycle-pattern", "release"])).toEqual({
        records: [pattern, release],
        keys: [`cycle-pattern ${patternId}`, `release ${releaseId}`],
      });
    });

    it("decides the new length alone for a role approving only it", () => {
      expect(decided(changedBoth(), ["cycle-pattern"])).toEqual({
        records: [pattern],
        keys: [`cycle-pattern ${patternId}`],
      });
    });

    it.each([
      [
        "rejected",
        { draft: recordDraft({ state: "rejected", changed: ["name"] }) },
      ],
      ["held by someone else", { heldBy: "Fictional Holder" }],
      [
        "the approver's own",
        { draft: recordDraft({ changed: ["name"], needsOtherApprover: true }) },
      ],
    ])(
      "decides the new length alone where the release's draft is %s",
      (_case, fields) => {
        expect(
          decided(changedBoth(fields), ["cycle-pattern", "release"]).records,
        ).toEqual([pattern]);
      },
    );

    it("credits a cycle moved into another release to the new length alone", () => {
      // Given a new length that moves 27.2 into the next release, which has a draft of its own
      const stream = fictionalStream({
        patterns: [
          fictionalPattern({ draft: recordDraft({ changed: ["length"] }) }),
        ],
        cycles: [cycle("27.2", "2027-05-01", "2027-07-31")],
        liveCycles: [cycle("27.2", "2027-04-01", "2027-06-30")],
        releases: [
          fictionalRelease({
            firstCycle: "2027-04-01",
            lastCycle: "2027-04-01",
          }),
          fictionalRelease({
            id: "30000000-0000-4000-8000-000000000002",
            name: "Later",
            firstCycle: "2027-05-01",
            lastCycle: "2027-05-01",
            draft: recordDraft({ changed: ["shipsOn"] }),
          }),
        ],
      });

      // Then its row carries the new length alone
      const row = rowOf(stream);
      expect(row.draft?.release).toBeUndefined();
      expect(row.draft?.changedBy).toBeUndefined();
      expect(row.subject).not.toContain("Later");
    });
  });
});
