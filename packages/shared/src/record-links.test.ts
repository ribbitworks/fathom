// SPDX-License-Identifier: Apache-2.0

// Tests for links to records: the page each kind of record opens on, and the server's answers a
// link may give.

import { describe, expect, it } from "vitest";
import {
  isFoundPrivate,
  recordLookupSchema,
  recordPage,
} from "./record-links.ts";

describe("the page a record opens on", () => {
  it.each([
    ["feature", "features"],
    ["project", "projects"],
    ["proposal", "projects"],
    ["customer", "projects"],
    ["milestone", "projects"],
    ["release", "releases"],
    ["schedule", "releases"],
    ["person", "people"],
    ["hire", "people"],
    ["team", "org-chart"],
    ["list", "lists"],
    ["account", "accounts"],
    ["role", "roles"],
  ] as const)("opens a %s on %s", (kind, page) => {
    expect(recordPage({ kind })).toBe(page);
  });

  it("opens an added column on the table it is on", () => {
    expect(recordPage({ kind: "column", table: "features" })).toBe("features");
    expect(recordPage({ kind: "column", table: "people" })).toBe("people");
  });

  it("opens an added column named without its table on People", () => {
    expect(recordPage({ kind: "column" })).toBe("people");
  });
});

describe("a link's answer", () => {
  it.each([
    { result: "found", kind: "column", id: "c1", table: "people" },
    { result: "found", kind: "row", id: "r1", pageId: "p1" },
    { result: "removed", kind: "feature", id: "f1" },
    { result: "nothing" },
  ])("reads %j", (answer) => {
    expect(recordLookupSchema.parse(answer)).toEqual(answer);
  });

  it("refuses a column on a table that can't have columns", () => {
    expect(
      recordLookupSchema.safeParse({
        result: "found",
        kind: "column",
        id: "c1",
        table: "releases",
      }).success,
    ).toBe(false);
  });

  it("tells a private page or row found from any other record found", () => {
    expect(
      isFoundPrivate({ result: "found", kind: "page", id: "p1", pageId: "p1" }),
    ).toBe(true);
    expect(isFoundPrivate({ result: "found", kind: "feature", id: "f1" })).toBe(
      false,
    );
  });

  it("refuses a private row found without its page", () => {
    expect(
      recordLookupSchema.safeParse({ result: "found", kind: "row", id: "r1" })
        .success,
    ).toBe(false);
  });
});
