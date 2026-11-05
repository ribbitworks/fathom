// SPDX-License-Identifier: Apache-2.0

// Tests for Fathom's settings: which text is a time zone Fathom offers, and the day a moment falls
// on in one.

import { describe, expect, it } from "vitest";
import {
  dayIn,
  defaultTimeZone,
  knowsTimeZone,
  timeZoneChoices,
  timeZoneRequestSchema,
} from "./settings.ts";

describe("dayIn", () => {
  // 03:30 UTC on 5 November is still the evening of 4 November in Vancouver.
  const moment = new Date("2026-11-05T03:30:00Z");

  it("is the day in the time zone given, not in UTC", () => {
    expect([
      dayIn("America/Vancouver", moment),
      dayIn("UTC", moment),
      dayIn("Asia/Tokyo", moment),
    ]).toEqual(["2026-11-04", "2026-11-05", "2026-11-05"]);
  });

  // New York's clocks go back at 06:00 UTC on 1 November 2026, and forward at 07:00 UTC on 8 March.
  it("follows the clocks changing", () => {
    expect([
      dayIn("America/New_York", new Date("2026-11-01T04:30:00Z")),
      dayIn("America/New_York", new Date("2026-11-02T04:30:00Z")),
      dayIn("America/New_York", new Date("2026-03-08T04:30:00Z")),
      dayIn("America/New_York", new Date("2026-03-09T03:30:00Z")),
    ]).toEqual(["2026-11-01", "2026-11-01", "2026-03-07", "2026-03-08"]);
  });
});

describe("timeZoneRequestSchema", () => {
  it("keeps a time zone in the spelling the list gives it", () => {
    expect(timeZoneRequestSchema.parse({ timeZone: " asia/tokyo " })).toEqual({
      timeZone: "Asia/Tokyo",
    });
  });

  it("keeps a current name the list gives by an older one, as browsers offer it", () => {
    expect(timeZoneRequestSchema.parse({ timeZone: "Asia/Kolkata" })).toEqual({
      timeZone: "Asia/Kolkata",
    });
  });

  it.each(["Middle/Earth", "+05:00", "-0700", "GMT+5"])(
    "refuses %s, which is not a time zone Fathom offers",
    (timeZone) => {
      expect(timeZoneRequestSchema.safeParse({ timeZone }).success).toBe(false);
    },
  );
});

describe("timeZoneChoices", () => {
  it("offers the default and UTC", () => {
    expect(timeZoneChoices()).toEqual(
      expect.arrayContaining([defaultTimeZone, "UTC"]),
    );
  });
});

describe("knowsTimeZone", () => {
  it("tells a time zone dates can be worked out in from one they cannot", () => {
    expect([
      knowsTimeZone("Asia/Tokyo"),
      knowsTimeZone("Middle/Earth"),
    ]).toEqual([true, false]);
  });
});
