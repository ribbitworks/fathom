// SPDX-License-Identifier: Apache-2.0

// Tests for where removing a page under Mine leaves its maker.

import { describe, expect, it } from "vitest";
import { landingAfter } from "./private-pages.ts";

const pages = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("landingAfter", () => {
  it("is the page after the one removed", () => {
    expect(landingAfter(pages, "b")).toBe("c");
  });

  it("is the page before, for the last", () => {
    expect(landingAfter(pages, "c")).toBe("b");
  });

  it("is the next, for the first", () => {
    expect(landingAfter(pages, "a")).toBe("b");
  });

  it("is none, for the Overview, once no page is left", () => {
    expect(landingAfter([{ id: "a" }], "a")).toBeUndefined();
  });
});
