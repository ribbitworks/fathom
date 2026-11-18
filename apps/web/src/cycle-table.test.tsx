// SPDX-License-Identifier: Apache-2.0

// Tests for the Cycles tab's rows: each a record of its own, whatever its drafts do to its cycles.

import type {
  Cycle,
  CyclePattern,
  DraftKind,
  Release,
  ReleaseStream,
} from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { type CycleRow, cycleRows, cycleTable } from "./cycle-table.tsx";
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
    const changedBoth = (
      release: Partial<Release> = {},
      pattern: Partial<CyclePattern> = {},
    ) =>
      fictionalStream({
        patterns: [
          fictionalPattern({
            draft: recordDraft({
              changed: ["length"],
              madeBy: "Pattern Maker",
            }),
            ...pattern,
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
      const menu = table.menuDecides?.(row);
      return {
        records: table.drafts([row.id]).records,
        keys: table.draftKeys?.(row),
        decidable: table.decidable?.(row),
        menu: menu && { ...menu, approved: menu.approved.records },
      };
    };
    const both: DraftKind[] = ["cycle-pattern", "release"];
    const pattern = { type: "cycle-pattern", id: patternId };
    const release = { type: "release", id: releaseId };
    const bothKeys = [`cycle-pattern ${patternId}`, `release ${releaseId}`];
    const rejectedPattern = {
      draft: recordDraft({ changed: ["length"], state: "rejected" }),
    };
    const renamed = { changed: ["name"], live: { name: "Fictional One" } };
    const rejectedRelease = {
      draft: recordDraft({ ...renamed, state: "rejected" }),
    };
    const ownRelease = {
      draft: recordDraft({ ...renamed, needsOtherApprover: true }),
    };
    const unnamed = { approvedOf: undefined, rejectedOf: undefined };
    const harbours = { approvedOf: "Harbour", rejectedOf: "Harbour" };

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
      expect(decided(changedBoth(), both)).toEqual({
        records: [pattern, release],
        keys: bothKeys,
        decidable: true,
        menu: { approved: [pattern, release], ...unnamed },
      });
    });

    it.each([
      ["the new length", ["cycle-pattern"], pattern, unnamed],
      ["the release's draft", ["release"], release, harbours],
    ] as const)(
      "decides %s alone for a role approving only it",
      (_case, approves, ref, names) => {
        expect(decided(changedBoth(), [...approves])).toEqual({
          records: [ref],
          keys: bothKeys,
          decidable: true,
          menu: { approved: [ref], ...names },
        });
      },
    );

    it.each([
      ["was rejected", rejectedPattern, [`release ${releaseId}`]],
      ["is held by someone else", { heldBy: "Fictional Holder" }, bothKeys],
    ])(
      "decides the release's draft alone, named, where the new length %s",
      (_case, fields, keys) => {
        expect(decided(changedBoth({}, fields), both)).toEqual({
          records: [release],
          keys,
          decidable: true,
          menu: { approved: [release], ...harbours },
        });
      },
    );

    it("decides the release's draft alone for a role approving only releases once the new length was rejected", () => {
      expect(
        decided(changedBoth({}, rejectedPattern), ["release"]).records,
      ).toEqual([release]);
    });

    it("approves the release's draft alone where the new length needs another approver", () => {
      expect(
        decided(
          changedBoth(
            {},
            {
              draft: recordDraft({
                changed: ["length"],
                needsOtherApprover: true,
              }),
            },
          ),
          both,
        ).menu,
      ).toEqual({
        approved: [release],
        approvedOf: "Harbour",
        rejectedOf: undefined,
      });
    });

    it("approves nothing, deciding both, where both drafts need another approver", () => {
      expect(
        decided(
          changedBoth(ownRelease, {
            draft: recordDraft({
              changed: ["length"],
              needsOtherApprover: true,
            }),
          }),
          both,
        ),
      ).toEqual({
        records: [pattern, release],
        keys: bothKeys,
        decidable: true,
        menu: { approved: [], ...unnamed },
      });
    });

    it("decides the release's draft alone, but doesn't approve it, where it is the approver's own and the new length was rejected", () => {
      expect(decided(changedBoth(ownRelease, rejectedPattern), both)).toEqual({
        records: [release],
        keys: bothKeys.slice(1),
        decidable: true,
        menu: { approved: [], approvedOf: undefined, rejectedOf: "Harbour" },
      });
    });

    it("decides both drafts, approving the new length alone, where the release's draft is the approver's own", () => {
      expect(decided(changedBoth(ownRelease), both)).toEqual({
        records: [pattern, release],
        keys: bothKeys,
        decidable: true,
        menu: { approved: [pattern], ...unnamed },
      });
    });

    it.each([
      ["rejected", rejectedRelease, []],
      [
        "held by someone else",
        { heldBy: "Fictional Holder" },
        bothKeys.slice(1),
      ],
    ])(
      "decides nothing where the new length was rejected and the release's draft is %s",
      (_case, fields, keys) => {
        expect(decided(changedBoth(fields, rejectedPattern), both)).toEqual({
          records: [],
          keys,
          decidable: false,
          menu: { approved: [], ...unnamed },
        });
      },
    );

    it.each([
      ["rejected", rejectedRelease, bothKeys.slice(0, 1)],
      ["held by someone else", { heldBy: "Fictional Holder" }, bothKeys],
    ])(
      "decides the new length alone where the release's draft is %s",
      (_case, fields, keys) => {
        expect(decided(changedBoth(fields), both)).toEqual({
          records: [pattern],
          keys,
          decidable: true,
          menu: { approved: [pattern], ...unnamed },
        });
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
