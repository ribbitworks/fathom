// SPDX-License-Identifier: Apache-2.0

// Tests for table views: reading a view from an address or a saved view, which drops what does not
// fit, checking a view a request sends, which must fit as a whole, and the columns a view uses.

import { describe, expect, it } from "vitest";
import {
  columnWidths,
  savedViewChangeSchema,
  savedViewRequestSchema,
  textLimit,
  viewColumnKeys,
  viewDefinitionSchema,
} from "./views.ts";

describe("viewDefinitionSchema", () => {
  it("reads an empty view", () => {
    expect(viewDefinitionSchema.parse({})).toEqual({});
  });

  it("drops each part that does not fit on its own, keeping the others", () => {
    expect(
      viewDefinitionSchema.parse({
        search: "x".repeat(textLimit + 1),
        show: "sideways",
        filters: {
          site: { any: ["a"] },
          "": { contains: "x" },
          level: { from: "not a date" },
        },
        sort: ["name", "-level", "bad level!", 7],
        breakdown: ["site", "site", "level", "team", "bad key!"],
        frozen: 1.5,
        widths: { name: 200, note: 12, "bad key!": 200, site: "200" },
      }),
    ).toEqual({
      search: undefined,
      show: undefined,
      filters: { site: { any: ["a"] } },
      sort: ["name", "-level"],
      breakdown: ["site", "level"],
      frozen: undefined,
      widths: { name: 200 },
    });
  });

  it("reads widths whole and within their limits, and drops those that are not", () => {
    const widths = (set: unknown) =>
      viewDefinitionSchema.parse({ widths: { note: set } }).widths;
    expect(widths(columnWidths.least)).toEqual({ note: columnWidths.least });
    expect(widths(columnWidths.most)).toEqual({ note: columnWidths.most });
    expect(widths(columnWidths.least - 1)).toEqual({});
    expect(widths(columnWidths.most + 1)).toEqual({});
    expect(widths(200.5)).toEqual({});
    expect(viewDefinitionSchema.parse({ widths: "x" }).widths).toBe(undefined);
  });

  it("reads how many columns are frozen, none included, but never fewer or too many", () => {
    expect(viewDefinitionSchema.parse({ frozen: 0 }).frozen).toBe(0);
    expect(viewDefinitionSchema.parse({ frozen: 3 }).frozen).toBe(3);
    expect(viewDefinitionSchema.parse({ frozen: -1 }).frozen).toBe(undefined);
    expect(viewDefinitionSchema.parse({ frozen: 101 }).frozen).toBe(undefined);
    expect(viewDefinitionSchema.parse({ frozen: "2" }).frozen).toBe(undefined);
  });

  it("drops filters, sorts, and breakdowns that are not lists or records", () => {
    expect(
      viewDefinitionSchema.parse({ filters: "x", sort: "x", breakdown: "x" }),
    ).toEqual({ filters: undefined, sort: undefined, breakdown: undefined });
  });

  it("keeps at most 100 filters and 10 sort levels", () => {
    const filters = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`c${String(index)}`, {}]),
    );
    const sort = Array.from({ length: 11 }, (_, index) => `c${String(index)}`);
    const view = viewDefinitionSchema.parse({ filters, sort });
    expect(Object.keys(view.filters ?? {})).toHaveLength(100);
    expect(view.sort).toHaveLength(10);
  });
});

describe("savedViewChangeSchema", () => {
  it("accepts a scope, or none, and refuses one that is not personal or shared", () => {
    expect(savedViewChangeSchema.safeParse({ scope: "shared" }).success).toBe(
      true,
    );
    expect(savedViewChangeSchema.safeParse({}).success).toBe(true);
    expect(savedViewChangeSchema.safeParse({ scope: "team" }).success).toBe(
      false,
    );
  });
});

describe("savedViewRequestSchema", () => {
  const request = (definition: object) =>
    savedViewRequestSchema.safeParse({
      name: "Fictional View",
      scope: "personal",
      definition,
    });

  it("needs a view to be personal or shared", () => {
    const named = { name: "Fictional View", definition: {} };
    expect(
      savedViewRequestSchema.safeParse({ ...named, scope: "shared" }).success,
    ).toBe(true);
    expect(savedViewRequestSchema.safeParse(named).success).toBe(false);
    expect(
      savedViewRequestSchema.safeParse({ ...named, scope: "team" }).success,
    ).toBe(false);
  });

  it("accepts a view that fits", () => {
    expect(
      request({
        filters: { site: {} },
        breakdown: ["site", "level"],
        frozen: 2,
        widths: { name: 240 },
      }).success,
    ).toBe(true);
  });

  it("refuses a width that is not whole, too narrow, or too wide, and too many widths", () => {
    expect(request({ widths: { name: 240.5 } }).success).toBe(false);
    expect(request({ widths: { name: columnWidths.least - 1 } }).success).toBe(
      false,
    );
    expect(request({ widths: { name: columnWidths.most + 1 } }).success).toBe(
      false,
    );
    const widths = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`c${String(index)}`, 200]),
    );
    expect(request({ widths }).error?.issues[0]?.message).toBe(
      "Too many widths",
    );
  });

  it("refuses a number of frozen columns that is not whole or is negative", () => {
    expect(request({ frozen: 1.5 }).success).toBe(false);
    expect(request({ frozen: -1 }).success).toBe(false);
  });

  it("refuses too many filters and a column broken down twice", () => {
    const filters = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`c${String(index)}`, {}]),
    );
    expect(request({ filters }).error?.issues[0]?.message).toBe(
      "Too many filters",
    );
    expect(
      request({ breakdown: ["site", "site"] }).error?.issues[0]?.message,
    ).toBe("Repeated column");
  });
});

describe("viewColumnKeys", () => {
  it("names each column a view filters, sorts, or breaks down on once", () => {
    expect(
      viewColumnKeys({
        filters: { site: {}, draft: {} },
        sort: ["-level", "site"],
        breakdown: ["team", "level"],
      }),
    ).toEqual(["site", "draft", "level", "team"]);
    expect(viewColumnKeys({})).toEqual([]);
  });
});
