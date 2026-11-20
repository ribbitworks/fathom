// SPDX-License-Identifier: Apache-2.0

// Unit tests for when a person is employed: the months their dates cover, and whether they have
// started or are current on a day.

import { describe, expect, it } from "vitest";
import { currentOn, employedMonths, notStarted } from "./people-reads.ts";

const today = "2026-06-15";
const earlier = "2026-03-02";
const later = "2026-09-30";

describe("the months a person is employed in", () => {
  it("runs from the start date's month to the end date's", () => {
    expect(employedMonths({ startDate: earlier, endDate: later })).toEqual({
      first: "2026-03",
      last: "2026-09",
    });
  });

  it("has only a first month with only a start date", () => {
    expect(employedMonths({ startDate: earlier, endDate: null })).toEqual({
      first: "2026-03",
    });
  });

  it("has only a last month with only an end date", () => {
    expect(employedMonths({ startDate: null, endDate: later })).toEqual({
      last: "2026-09",
    });
  });

  it("has no first or last month with neither date", () => {
    expect(employedMonths({ startDate: null, endDate: null })).toEqual({});
  });
});

describe("whether a person has started", () => {
  it("has not started before a start date to come", () => {
    expect(notStarted({ startDate: later }, today)).toBe(true);
  });

  it("has started on the start date itself", () => {
    expect(notStarted({ startDate: today }, today)).toBe(false);
  });

  it("has started with no start date", () => {
    expect(notStarted({ startDate: null }, today)).toBe(false);
  });
});

describe("whether a person is current on a day", () => {
  it("is current between the start and end dates", () => {
    expect(currentOn({ startDate: earlier, endDate: later }, today)).toBe(true);
  });

  it("is current on the start date itself", () => {
    expect(currentOn({ startDate: today, endDate: later }, today)).toBe(true);
  });

  it("is current on the end date itself", () => {
    expect(currentOn({ startDate: earlier, endDate: today }, today)).toBe(true);
  });

  it("is current with neither date set", () => {
    expect(currentOn({}, today)).toBe(true);
  });

  it("is not current before the start date", () => {
    expect(currentOn({ startDate: later, endDate: null }, today)).toBe(false);
  });

  it("is not current once the end date has passed", () => {
    expect(currentOn({ startDate: null, endDate: earlier }, today)).toBe(false);
  });
});
