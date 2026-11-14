// SPDX-License-Identifier: Apache-2.0

// Tests for the day a page reads as of: today, or another day the reader's role sees.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shownDay } from "./today.ts";

const now = "2027-03-10";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${now}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("shownDay", () => {
  const every = { otherDates: true, futureDates: true };
  it.each([
    ["none asked", undefined, every, undefined],
    ["today", now, every, undefined],
    ["an earlier day", "2025-03-15", every, "2025-03-15"],
    ["a later day", "2028-03-15", every, "2028-03-15"],
    [
      "no other day without other dates",
      "2025-03-15",
      { otherDates: false, futureDates: false },
      undefined,
    ],
    [
      "an earlier day without future dates",
      "2025-03-15",
      { otherDates: true, futureDates: false },
      "2025-03-15",
    ],
    [
      "no later day without future dates",
      "2028-03-15",
      { otherDates: true, futureDates: false },
      undefined,
    ],
  ])("%s", (_, asked, sees, expected) => {
    expect(shownDay(asked, sees)).toBe(expected);
  });
});
