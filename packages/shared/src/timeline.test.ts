// SPDX-License-Identifier: Apache-2.0

// Tests for a timeline as the API sends it: days with their changes, each change's field one known.

import { describe, expect, it } from "vitest";
import { timelineSchema } from "./timeline.ts";

describe("a timeline", () => {
  it("takes days with changes, and refuses a day with none or a field it doesn't know", () => {
    const day = {
      day: "2026-03-02",
      changes: [
        {
          field: "manager",
          value: { id: "m1", name: "Fictional Ana" },
          others: 2,
        },
      ],
    };
    expect(timelineSchema.safeParse({ days: [day] }).success).toBe(true);
    expect(
      timelineSchema.safeParse({ days: [{ ...day, changes: [] }] }).success,
    ).toBe(false);
    expect(
      timelineSchema.safeParse({
        days: [{ ...day, changes: [{ field: "position" }] }],
      }).success,
    ).toBe(false);
  });
});
