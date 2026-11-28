// SPDX-License-Identifier: Apache-2.0

// Tests for where removing a page under Mine leaves its maker, and for a page's name refusals,
// shared by New page and Rename page.

import { describe, expect, it } from "vitest";
import { landingAfter, pageNameProblem } from "./private-pages.ts";

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

  it("is none, for the Overview, for a page no longer listed", () => {
    expect(landingAfter(pages, "d")).toBeUndefined();
  });
});

const named = [
  { id: "a", name: "Follow-ups" },
  { id: "b", name: "Customer asks" },
];

describe("pageNameProblem", () => {
  it("needs a name", () => {
    expect(pageNameProblem("  ", named, undefined, false)).toBe("Name needed");
  });

  it("refuses another page's name, ignoring letter case", () => {
    expect(pageNameProblem("customer ASKS", named, "a", false)).toBe(
      "Another page has that name",
    );
  });

  it("lets a page keep its own name", () => {
    expect(pageNameProblem("Follow-ups", named, "a", false)).toBeUndefined();
  });

  it("refuses a name the server said was taken", () => {
    expect(pageNameProblem("Ideas", named, "a", true)).toBe(
      "Another page has that name",
    );
  });
});
