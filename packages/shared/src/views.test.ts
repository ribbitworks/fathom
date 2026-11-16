// SPDX-License-Identifier: Apache-2.0

// Tests for table views: reading a view from an address or a saved view, which drops what does not
// fit, checking a view a request sends, which must fit as a whole, and the columns and groupings a
// view uses.

import { describe, expect, it } from "vitest";
import {
  columnWidths,
  inPlacesOf,
  savedViewChangeSchema,
  savedViewRequestSchema,
  textLimit,
  viewColumnKeys,
  viewDefinitionSchema,
  viewGroupings,
} from "./views.ts";

describe("viewDefinitionSchema", () => {
  it("keeps a number filter's bounds, and drops one that is not a number Fathom keeps", () => {
    expect(
      viewDefinitionSchema.parse({
        filters: {
          score: { atLeast: -1.5, atMost: 10 },
          rank: { atLeast: "1" },
        },
      }).filters,
    ).toEqual({ score: { atLeast: -1.5, atMost: 10 } });
  });

  it("keeps a choice made of two identifiers, such as a release's, and drops one too long", () => {
    const release =
      "10000000-0000-4000-8000-000000000001 30000000-0000-4000-8000-000000000001";
    expect(
      viewDefinitionSchema.parse({
        filters: {
          release: { any: [release] },
          cycle: { any: ["x".repeat(129)] },
        },
      }).filters,
    ).toEqual({ release: { any: [release] } });
  });

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

  it("reads each column's unit and decimal places, dropping those that do not fit", () => {
    const read = viewDefinitionSchema.parse({
      units: { effort: "person-weeks", other: "Weeks!", "bad key!": "hours" },
      places: { effort: 1, other: 7, more: 1.5, fewer: -1, none: 0 },
    });
    expect(read.units).toEqual({ effort: "person-weeks" });
    expect(read.places).toEqual({ effort: 1, none: 0 });
    expect(viewDefinitionSchema.parse({ units: "x" }).units).toBe(undefined);
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

  it("reads hidden columns, dropping a repeat or a key that does not fit", () => {
    expect(
      viewDefinitionSchema.parse({ hidden: ["site", "site", "no good", 7] }),
    ).toEqual({ hidden: ["site"] });
    expect(viewDefinitionSchema.parse({ hidden: "site" })).toEqual({});
  });

  it("reads a page's choices, dropping each that does not fit on its own", () => {
    expect(
      viewDefinitionSchema.parse({
        choices: {
          mode: "board",
          hide: ["status", "size"],
          stream: 7,
          "no good": "board",
          long: "x".repeat(textLimit + 1),
        },
      }),
    ).toEqual({ choices: { mode: "board", hide: ["status", "size"] } });
    expect(viewDefinitionSchema.parse({ choices: ["board"] })).toEqual({});
  });

  it("keeps showing retired records only when asked for, dropping anything else", () => {
    expect([
      viewDefinitionSchema.parse({ retired: true }).retired,
      viewDefinitionSchema.parse({ retired: false }).retired,
      viewDefinitionSchema.parse({ retired: "yes" }).retired,
    ]).toEqual([true, undefined, undefined]);
  });

  it("reads a second grouping, dropping one that is not a column's key", () => {
    expect(
      viewDefinitionSchema.parse({ grouping: "site", thenBy: "level" }),
    ).toEqual({ grouping: "site", thenBy: "level" });
    expect(
      viewDefinitionSchema.parse({ grouping: "site", thenBy: ["level"] }),
    ).toEqual({ grouping: "site" });
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

describe("a view's order of columns", () => {
  it("puts the keys wanted into their places, leaving the others, and adds new ones last", () => {
    expect(inPlacesOf(["a", "x", "b"], ["b", "a"])).toEqual(["b", "x", "a"]);
    expect(inPlacesOf(["a"], ["n", "a"])).toEqual(["a", "n"]);
    expect(inPlacesOf([], ["a"])).toEqual(["a"]);
  });

  it("drops a repeat or a key that does not fit from an address", () => {
    expect(
      viewDefinitionSchema.parse({ order: ["a", "a", "not a key", "b"] }).order,
    ).toEqual(["a", "b"]);
  });

  it("refuses a repeat in a request", () => {
    expect(
      savedViewRequestSchema.safeParse({
        name: "Fictional View",
        scope: "personal",
        definition: { order: ["a", "a"] },
      }).success,
    ).toBe(false);
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

  it("accepts a choice made of two identifiers, and refuses one too long", () => {
    const filtered = (value: string) =>
      request({ filters: { release: { any: [value] } } }).success;
    expect([
      filtered(
        "10000000-0000-4000-8000-000000000001 30000000-0000-4000-8000-000000000001",
      ),
      filtered("x".repeat(128)),
      filtered("x".repeat(129)),
    ]).toEqual([true, true, false]);
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

  it("accepts units and decimal places that fit, and refuses those that do not", () => {
    expect(
      request({ units: { effort: "person-weeks" }, places: { effort: 0 } })
        .success,
    ).toBe(true);
    expect(request({ units: { effort: "Weeks" } }).success).toBe(false);
    expect(request({ places: { effort: 7 } }).success).toBe(false);
    expect(request({ places: { effort: 0.5 } }).success).toBe(false);
    const many = <Value>(value: Value) =>
      Object.fromEntries(
        Array.from({ length: 101 }, (_, index) => [`c${String(index)}`, value]),
      );
    expect(request({ units: many("hours") }).error?.issues[0]?.message).toBe(
      "Too many units",
    );
    expect(request({ places: many(1) }).error?.issues[0]?.message).toBe(
      "Too many places",
    );
  });

  it("accepts showing retired records, and refuses anything else for it", () => {
    expect([
      request({ retired: true }).success,
      request({ retired: false }).success,
    ]).toEqual([true, false]);
  });

  it("accepts hidden columns, and refuses a repeat or a key that does not fit", () => {
    expect(request({ hidden: ["site", "level"] }).success).toBe(true);
    expect(request({ hidden: ["site", "site"] }).success).toBe(false);
    expect(request({ hidden: ["no good"] }).success).toBe(false);
  });

  it("accepts choices of one value or several, and refuses others", () => {
    expect(
      request({ choices: { mode: "board", hide: ["status"] } }).success,
    ).toBe(true);
    expect(request({ choices: { mode: 7 } }).success).toBe(false);
    expect(request({ choices: { "no good": "board" } }).success).toBe(false);
    expect(
      request({
        choices: Object.fromEntries(
          Array.from({ length: 101 }, (_, index) => [
            `choice${String(index)}`,
            "on",
          ]),
        ),
      }).success,
    ).toBe(false);
  });

  it("accepts a second grouping by a column's key, and refuses anything else for it", () => {
    expect(request({ grouping: "site", thenBy: "level" }).success).toBe(true);
    expect(request({ thenBy: ["level"] }).success).toBe(false);
    expect(request({ thenBy: "" }).success).toBe(false);
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

describe("viewGroupings", () => {
  it("names the first grouping, then the one under it, leaving out those not set", () => {
    expect(viewGroupings({ grouping: "site", thenBy: "level" })).toEqual([
      "site",
      "level",
    ]);
    expect(viewGroupings({ thenBy: "level" })).toEqual(["level"]);
    expect(viewGroupings({})).toEqual([]);
  });
});

describe("viewColumnKeys", () => {
  it("names each column a view filters, sorts, breaks down, or groups by once", () => {
    expect(
      viewColumnKeys({
        filters: { site: {}, draft: {} },
        sort: ["-level", "site"],
        breakdown: ["team", "level"],
        grouping: "manager",
        thenBy: "office",
      }),
    ).toEqual(["site", "draft", "level", "team", "manager", "office"]);
    expect(viewColumnKeys({})).toEqual([]);
  });
});
