// SPDX-License-Identifier: Apache-2.0

// Tests for which roles' permissions open a page under Mine.

import { describe, expect, it } from "vitest";
import { opensUnderMine } from "./mine-section.tsx";

describe("a page's address and Mine", () => {
  it("opens a page under Mine only with Make private pages, and leaves every other page to its own needs", () => {
    expect(opensUnderMine("/mine/p1", ["private-pages:make"])).toBe(true);
    expect(opensUnderMine("/mine/p1", ["plan:view"])).toBe(false);
    expect(opensUnderMine("/features", [])).toBe(true);
  });
});
