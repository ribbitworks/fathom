// SPDX-License-Identifier: Apache-2.0

// Tests for counts, written as the language settings the tests fix write them.

import { describe, expect, it } from "vitest";
import { count } from "./numbers.ts";

describe("counts", () => {
  it("group thousands as the language settings do", () => {
    expect(count(7)).toBe("7");
    expect(count(1500)).toBe("1,500");
  });
});
