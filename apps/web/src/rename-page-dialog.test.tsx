// SPDX-License-Identifier: Apache-2.0

// Tests for a page's name refusals, shared by New page and Rename page.

import { describe, expect, it } from "vitest";
import { pageNameProblem } from "./rename-page-dialog.tsx";

const pages = [
  { id: "a", name: "Follow-ups" },
  { id: "b", name: "Customer asks" },
];

describe("pageNameProblem", () => {
  it("needs a name", () => {
    expect(pageNameProblem("  ", pages, undefined, false)).toBe("Name needed");
  });

  it("refuses another page's name, ignoring letter case", () => {
    expect(pageNameProblem("customer ASKS", pages, "a", false)).toBe(
      "Another page has that name",
    );
  });

  it("lets a page keep its own name", () => {
    expect(pageNameProblem("Follow-ups", pages, "a", false)).toBeUndefined();
  });

  it("refuses a name the server said was taken", () => {
    expect(pageNameProblem("Ideas", pages, "a", true)).toBe(
      "Another page has that name",
    );
  });
});
