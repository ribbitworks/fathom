// SPDX-License-Identifier: Apache-2.0

// Tests for the Cycles tab's rows: each a record of its own, whatever its drafts do to its cycles.

import type { Cycle } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { cycleRows } from "./cycle-table.tsx";
import {
  fictionalPattern,
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
});
