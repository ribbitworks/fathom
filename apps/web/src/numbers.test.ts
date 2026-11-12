// SPDX-License-Identifier: Apache-2.0

// Tests for counts, written as the language settings the tests fix write them.

import { describe, expect, it } from "vitest";
import { count, decimalUpTo, percentage } from "./numbers.ts";

describe("decimalUpTo", () => {
  it("rounds a number up to the places given, as the language settings write it", () => {
    expect(decimalUpTo(2 / 3, 2)).toBe("0.67");
    expect(decimalUpTo(2.65, 1)).toBe("2.7");
    expect(decimalUpTo(2.01, 0)).toBe("3");
    expect(decimalUpTo(1234.5, 2)).toBe("1,234.5");
  });

  it("leaves a number already at the places given as it is", () => {
    expect(decimalUpTo(1.975, 3)).toBe("1.975");
    expect(decimalUpTo(2, 0)).toBe("2");
  });
});

describe("counts", () => {
  it("group thousands as the language settings do", () => {
    expect(count(7)).toBe("7");
    expect(count(1500)).toBe("1,500");
  });
});

describe("percentage", () => {
  it("writes a whole percentage as the language settings do", () => {
    expect(percentage(80)).toBe("80%");
    expect(percentage(0)).toBe("0%");
  });
});
