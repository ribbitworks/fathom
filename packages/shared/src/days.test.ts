// SPDX-License-Identifier: Apache-2.0

// Tests for days as Fathom keeps them: which text is a day that exists, and a day typed as digits
// laid out as it fills.

import { describe, expect, it } from "vitest";
import { isDay, typedDay } from "./days.ts";

describe("isDay", () => {
  it("accepts only ISO dates that exist", () => {
    expect([
      isDay("2027-02-28"),
      isDay("2027-02-30"),
      isDay("27-2-28"),
    ]).toEqual([true, false, false]);
  });
});

describe("typedDay", () => {
  it("lays out digits as a day as they fill it", () => {
    expect([
      typedDay("2027"),
      typedDay("202701"),
      typedDay("20270104"),
    ]).toEqual(["2027", "2027-01", "2027-01-04"]);
  });

  it("keeps digits typed with their dashes in the same form", () => {
    expect(typedDay(" 2027-01-04 ")).toBe("2027-01-04");
  });

  it("stops at a whole day's digits", () => {
    expect(typedDay("2027010499")).toBe("2027-01-04");
  });

  it("leaves text that is not digits and dashes as typed, trimmed", () => {
    expect(typedDay(" 4 Jan 2027 ")).toBe("4 Jan 2027");
  });
});
